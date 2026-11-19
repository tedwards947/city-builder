// Balance Lab: the landscape suite (owner-approved targets, 2026-11-19,
// LANDSCAPING_DESIGN.md "Proposed lab targets and numbers").
//
// On each saved city, under the BALANCE numbers in force:
// - Trees and income: land value is settled on a copy of the city (the land
//   value system alone, run until it stops moving), then one economy pass
//   gives the income a tick. The same is done after planting, so the
//   difference comes from the trees only, with no random growth in it.
// - Green vibe: 50 trees planted with the tree brush, then cleared, against
//   one park, read off the vibeGreen layer straight after each command.
// - Water: the price of a 20-tile canal and of filling a 10×10 block of
//   water, from waterQuote, against the city's own surplus (10 days of the
//   real sim).
// The tree belt probe (treeBuffer) is a small made-up map: a block of
// level-3 industry, a 3-tile gap with trees or without, then a row of homes.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_PARK, TERRAIN_WATER, VEG_NONE, VEG_TREE_1, ZONE_I, ZONE_R } from '../sim/constants';
import { canHoldTree, waterQuote } from '../sim/landscaping';
import { LandValueSystem } from '../sim/systems/LandValueSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { PollutionSystem } from '../sim/systems/PollutionSystem';
import { ClearTreesCommand, PlantTreesCommand } from '../commands/TreeCommands';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { cloneWorld, freshWorld, startSim } from './world';

export interface LandscapeResult {
  population: number;
  /** Money a day: the city's surplus over 10 days of the real sim, and its income a day with land value settled. */
  surplus: number;
  income: number;
  /** Land value a home gains from 8 trees within treeRadius. */
  treeHome: number | null;
  /** One tree on the free tile that reaches the most level-3 homes: days to repay its price in extra tax. */
  payback: { days: number | null; homes: number };
  /** Income with the tree bonus on (wild trees count) ÷ off, minus 1. */
  shock: number | null;
  /** Every free tile within treeRadius of a home planted: income gain (share) and the price in days of surplus. */
  spam: { trees: number; gain: number | null; priceDays: number | null };
  /** The green vibe from 50 trees ÷ one park; and what is left of it after clearing them (share). */
  green: { parks: number | null; left: number | null };
  /** A 20-tile canal's price in days of surplus. */
  canalDays: number | null;
  /** Filling a 10×10 block of water: share of 30 days' surplus. */
  reclaimShare: number | null;
  note?: string;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const LV = BALANCE.landValue as { treeBonus: number; treeRadius: number; treeBonusMax: number };
const isHome = (w: World, i: number) => w.layers.zone[i] === ZONE_R && w.layers.devLevel[i] > 0 && !w.layers.abandoned[i];

/** Tiles within treeRadius of `i` (a square), `i` itself left out. */
function around(w: World, i: number, r = Math.max(0, LV.treeRadius | 0)): number[] {
  const { width, height } = w.grid, x = i % width, y = (i - x) / width, out: number[] = [];
  for (let yy = Math.max(0, y - r); yy <= Math.min(height - 1, y + r); yy++)
    for (let xx = Math.max(0, x - r); xx <= Math.min(width - 1, x + r); xx++) if (xx !== x || yy !== y) out.push(yy * width + xx);
  return out;
}

/** A copy of `world` with `edit` applied, land value settled, and one economy pass run. */
function settled(world: World, edit?: (w: World) => void): World {
  const w = cloneWorld(world);
  edit?.(w);
  const ti = BALANCE.growth.tickInterval, lvs = new LandValueSystem();
  w.tick = Math.ceil(w.tick / ti) * ti;
  for (let k = 0; k < 80; k++) { lvs.update(w); w.tick += ti; }
  new EconomySystem().update(w);
  return w;
}
const incomeOf = (w: World) => w.budget.income * BALANCE.ticksPerDay;

/** The home whose land value is nearest the median of level-3 homes with no tree near them. */
function bareHome(w: World): number {
  const veg = w.layers.vegetation, lv = w.layers.landValue;
  const c: number[] = [];
  for (let i = 0; i < veg.length; i++) if (isHome(w, i) && w.layers.devLevel[i] === 3 && veg[i] === VEG_NONE && around(w, i).every(j => veg[j] === VEG_NONE)) c.push(i);
  if (!c.length) return -1;
  c.sort((a, b) => lv[a] - lv[b]);
  return c[c.length >> 1];
}

/** The free tile whose one tree would raise the most level-3 homes (homes already at the cap don't count). */
function bestTreeTile(w: World): { tile: number; homes: number } {
  const veg = w.layers.vegetation, cap = LV.treeBonus > 0 ? Math.floor(LV.treeBonusMax / LV.treeBonus) : Infinity;
  let best = -1, most = 0;
  for (let i = 0; i < veg.length; i++) {
    if (veg[i] !== VEG_NONE || !canHoldTree(w, i)) continue;
    let n = 0;
    for (const j of around(w, i)) if (isHome(w, j) && w.layers.devLevel[j] === 3 && around(w, j).filter(k => veg[k] !== VEG_NONE).length < cap) n++;
    if (n > most) { most = n; best = i; }
  }
  return { tile: best, homes: most };
}

/** Every free, tree-less tile within treeRadius of a home. */
function spamTiles(w: World): number[] {
  const out = new Set<number>(), veg = w.layers.vegetation;
  for (let i = 0; i < veg.length; i++) if (isHome(w, i)) for (const j of around(w, i)) if (veg[j] === VEG_NONE && canHoldTree(w, j)) out.add(j);
  return [...out];
}

const greenSum = (w: World) => w.layers.vibeGreen.reduce((a, b) => a + b, 0);

/** The green vibe from planting `tiles` (then clearing them) against one park on its own copy. */
function greenProbe(world: World, tiles: number[]): LandscapeResult['green'] {
  if (tiles.length < 50) return { parks: null, left: null };
  const pick = tiles.slice(0, 50);
  const a = startSim(cloneWorld(world)); a.world.budget.money = 1e12; a.tick(1);
  const g0 = greenSum(a.world);
  if (!a.history.run(new PlantTreesCommand(pick, VEG_TREE_1))) return { parks: null, left: null };
  const g1 = greenSum(a.world);
  a.history.run(new ClearTreesCommand(pick));
  const g2 = greenSum(a.world);
  const b = startSim(cloneWorld(world)); b.world.budget.money = 1e12; b.tick(1);
  const { width, height } = b.world.grid;
  let park = 0;
  for (let i = 0; i < width * height && !park; i++) {
    if (!canHoldTree(b.world, i)) continue;
    const p0 = greenSum(b.world);
    if (b.history.run(new PlaceBuildingCommand(i % width, Math.floor(i / width), BUILDING_PARK))) park = greenSum(b.world) - p0;
  }
  const trees = g1 - g0;
  return { parks: park > 0 ? r3(trees / park) : null, left: trees !== 0 ? r3((g2 - g0) / trees) : null };
}

/** 20 free land tiles in a straight row (a canal), or null. */
function canalTiles(w: World): number[] | null {
  const { width, height } = w.grid;
  for (let y = 0; y < height; y++) {
    let run: number[] = [];
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (canHoldTree(w, i)) { run.push(i); if (run.length === 20) return run; } else run = [];
    }
  }
  return null;
}

/** A 10×10 block of open water with no road or track on it, or null. */
function waterBlock(w: World): number[] | null {
  const { width, height } = w.grid, L = w.layers;
  for (let y = 0; y + 10 <= height; y++) for (let x = 0; x + 10 <= width; x++) {
    const tiles: number[] = [];
    let ok = true;
    for (let yy = y; yy < y + 10 && ok; yy++) for (let xx = x; xx < x + 10; xx++) {
      const i = yy * width + xx;
      if (L.terrain[i] !== TERRAIN_WATER || L.roadClass[i] !== 0 || L.rail[i] !== 0) { ok = false; break; }
      tiles.push(i);
    }
    if (ok) return tiles;
  }
  return null;
}

/** The landscape probes on a copy of a saved city, under the BALANCE numbers in force. */
export function landscapeResult(world: World): LandscapeResult {
  // The city's own surplus: 10 days of the real sim, untouched.
  const s = startSim(cloneWorld(world)), m0 = s.world.budget.money;
  s.tick(10 * BALANCE.ticksPerDay);
  const surplus = (s.world.budget.money - m0) / 10;

  const base = settled(world), income = incomeOf(base);
  const res: LandscapeResult = { population: world.stats.population, surplus: Math.round(surplus), income: Math.round(income), treeHome: null, payback: { days: null, homes: 0 }, shock: null, spam: { trees: 0, gain: null, priceDays: null }, green: { parks: null, left: null }, canalDays: null, reclaimShare: null };
  const perDay = (cost: number) => surplus > 0 ? r3(cost / surplus) : null;

  // land.treeShock: the bonus switched off against on.
  const was = LV.treeBonus;
  try { LV.treeBonus = 0; const off = incomeOf(settled(world)); res.shock = off > 0 ? r3(income / off - 1) : null; } finally { LV.treeBonus = was; }

  // land.treeHome: 8 trees round a bare level-3 home, free tiles first.
  const home = bareHome(world);
  if (home >= 0) {
    const ring = around(world, home).sort((a, b) => Number(canHoldTree(world, b)) - Number(canHoldTree(world, a))).slice(0, 8);
    const w = settled(world, w => { for (const j of ring) w.layers.vegetation[j] = VEG_TREE_1; });
    res.treeHome = w.layers.landValue[home] - base.layers.landValue[home];
  }

  // land.treePayback: one tree where it reaches the most level-3 homes.
  const best = bestTreeTile(world);
  res.payback.homes = best.homes;
  if (best.tile >= 0) {
    const gain = incomeOf(settled(world, w => { w.layers.vegetation[best.tile] = VEG_TREE_1; })) - income;
    res.payback.days = gain > 0 ? Math.round(BALANCE.costs.tree / gain) : null;
  }

  // land.treeSpam: every free tile near a home.
  const spam = spamTiles(world);
  res.spam.trees = spam.length;
  if (spam.length) {
    const gain = incomeOf(settled(world, w => { for (const j of spam) w.layers.vegetation[j] = VEG_TREE_1; })) - income;
    res.spam.gain = income > 0 ? r3(gain / income) : null;
    res.spam.priceDays = perDay(spam.length * BALANCE.costs.tree);
  }

  // vibe.treeGreen
  res.green = greenProbe(world, spam);

  // water.canal / water.reclaim
  const canal = canalTiles(world);
  if (canal) res.canalDays = perDay(waterQuote(world, canal, true).cost);
  const block = waterBlock(world);
  if (block) res.reclaimShare = surplus > 0 ? r3(waterQuote(world, block, false).cost / (30 * surplus)) : null;
  const missing = [!canal && 'no 20-tile canal site', !block && 'no 10×10 block of water', home < 0 && 'no bare level-3 home'].filter(Boolean);
  if (missing.length) res.note = missing.join('; ');
  return res;
}

/**
 * land.treeBuffer on a made-up map: a 32×4 block of level-3 industry, a 3-tile
 * gap, a row of level-3 homes. Pollution at the homes with the gap planted ÷
 * with it bare, after the pollution field settles; returns 1 − that.
 */
export function treeBufferResult(): number | null {
  const run = (trees: boolean) => {
    const w = freshWorld(64, 7);
    for (let y = 20; y < 24; y++) for (let x = 16; x < 48; x++) { w.setZone(x, y, ZONE_I); w.layers.devLevel[w.grid.idx(x, y)] = 3; }
    for (let x = 16; x < 48; x++) { w.setZone(x, 27, ZONE_R); w.layers.devLevel[w.grid.idx(x, 27)] = 3; }
    if (trees) for (let y = 24; y < 27; y++) for (let x = 16; x < 48; x++) w.layers.vegetation[w.grid.idx(x, y)] = VEG_TREE_1;
    const p = new PollutionSystem();
    for (let k = 0; k < 400; k++) { p.update(w); w.tick++; }
    let sum = 0;
    for (let x = 20; x < 44; x++) sum += w.layers.pollution[w.grid.idx(x, 27)];
    return sum;
  };
  const bare = run(false);
  return bare > 0 ? r3(1 - run(true) / bare) : null;
}
