// Balance Lab: seaport trade and the goods shortage (SEAPORT_DESIGN.md, sim/seaport.ts,
// sim/goods.ts). Not part of the game.
//
// Probes on a saved city as it stands, with traffic settled after each edit:
//   today     the goods shortage with no port.
//   heavy     industry dezoned (fixed order) until shops are ≥ 3× industry by level;
//             the shortage, what it costs shops, and the shortage once a port opens by the shops.
//   port      a port at the coastal site with the most industry near it: export income,
//             payback of its cost, its share of city income, income per industry level served.
//   split     a second port on the same district: how much more the two earn.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { BUILDING_NONE, BUILDING_SEAPORT, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_C, ZONE_I, ZONE_NONE } from '../sim/constants';
import { footprintTiles, footprintEdge, shapeRoles } from '../sim/buildingShapes';
import { openWater } from '../sim/openWater';
import { goodsShortage } from '../sim/goods';
import { exportIncome, portTradeAt } from '../sim/seaport';
import { ordinanceModifier } from '../sim/ordinances';
import { taxIncomeMult } from '../sim/tax';
import { cloneWorld } from './world';

/** Trade numbers to try: any of BALANCE.port, BALANCE.goods, transit.goodsCapacity and the port building's cost / upkeep. */
export interface TradeValues {
  port?: Partial<Record<keyof typeof BALANCE.port, number>>;
  goods?: Partial<Record<keyof typeof BALANCE.goods, number>>;
  goodsCapacity?: number;
  portCost?: number;
  portUpkeep?: number;
}

/** Apply `v` to BALANCE; returns a function that puts the old numbers back. */
export function applyTradeValues(v: TradeValues): () => void {
  const port = { ...BALANCE.port }, goods = { ...BALANCE.goods }, cap = BALANCE.transit.goodsCapacity, b = { ...BALANCE.buildings[BUILDING_SEAPORT] };
  Object.assign(BALANCE.port, v.port ?? {});
  Object.assign(BALANCE.goods, v.goods ?? {});
  const transit = BALANCE.transit as { goodsCapacity: number };
  if (v.goodsCapacity !== undefined) transit.goodsCapacity = v.goodsCapacity;
  if (v.portCost !== undefined) BALANCE.buildings[BUILDING_SEAPORT].cost = v.portCost;
  if (v.portUpkeep !== undefined) BALANCE.buildings[BUILDING_SEAPORT].maintenance = v.portUpkeep;
  return () => { Object.assign(BALANCE.port, port); Object.assign(BALANCE.goods, goods); transit.goodsCapacity = cap; Object.assign(BALANCE.buildings[BUILDING_SEAPORT], b); };
}

export interface PortProbe {
  site: { x: number; y: number; rot: number };
  /** Export money per tick, and the port's upkeep per tick. */
  income: number;
  upkeep: number;
  /** Game days for net export income to repay the port's cost (null = never). */
  paybackDays: number | null;
  /** Exports ÷ the port's export capacity. */
  fullShare: number;
  /** Export income ÷ the city's whole income that tick. */
  incomeShare: number;
  /** Export income per industry level served ÷ industry's own tax per level. */
  perLevelRatio: number | null;
}

export interface TradeResult {
  levels: { c: number; i: number };
  /** Shortage with no port, as the city stands. */
  shortage: number;
  heavy: { ratio: number; shortage: number; incomeLoss: number; withPort: number | null } | null;
  port: PortProbe | null;
  /** A second port on the same district: (income of both − first's) ÷ first's, and how full the first was. */
  split: { gain: number; firstFull: number } | null;
  note?: string;
}

const TICKS_PER_DAY = () => BALANCE.ticksPerDay;

function levels(w: World): { c: number; i: number } {
  let c = 0, i = 0;
  const { zone, devLevel, abandoned } = w.layers;
  for (let k = 0; k < zone.length; k++) {
    if (!devLevel[k] || abandoned[k]) continue;
    if (zone[k] === ZONE_C) c += devLevel[k]; else if (zone[k] === ZONE_I) i += devLevel[k];
  }
  return { c, i };
}

/** Systems for `w`, settled; `settle()` re-settles traffic after an edit and runs one day so the budget catches up. */
function simFor(w: World) {
  const sim = createSystems();
  const scheduler = new Scheduler(w, sim.systems);
  const settle = () => { sim.transit.recompute(w); for (let k = 0; k < TICKS_PER_DAY(); k++) scheduler.tick(); };
  settle();
  return { settle };
}

interface Site { x: number; y: number; rot: number; tiles: number[]; /** Street tiles to lay from the yard to the nearest street or avenue (empty if one runs along it). */ access: number[] }

const isStreet = (w: World, i: number) => w.layers.roadClass[i] !== ROAD_NONE && w.layers.roadClass[i] !== ROAD_HIGHWAY;
const ACCESS_MAX = 24;

/** The shortest line of free, undeveloped land tiles from the yard's edge to a street or avenue (BFS), or null. */
function accessPath(w: World, body: number[], footprint: Set<number>): number[] | null {
  const { width, height } = w.grid;
  const edge = footprintEdge(width, height, body);
  if (edge.some(i => isStreet(w, i))) return [];
  const prev = new Map<number, number>();
  let frontier: number[] = [];
  const free = (i: number) => !footprint.has(i) && w.layers.terrain[i] !== TERRAIN_WATER && w.layers.building[i] === BUILDING_NONE && w.layers.roadClass[i] === ROAD_NONE && w.layers.devLevel[i] === 0;
  for (const i of edge) if (free(i)) { prev.set(i, -1); frontier.push(i); }
  for (let d = 1; d <= ACCESS_MAX && frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % width;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i < width * (height - 1) ? i + width : -1]) {
        if (j < 0 || prev.has(j)) continue;
        if (isStreet(w, j)) { const path = [i]; let k = prev.get(i)!; while (k >= 0) { path.push(k); k = prev.get(k)!; } return path; }
        if (free(j)) { prev.set(j, i); next.push(j); }
      }
    }
    frontier = next;
  }
  return null;
}

/** Every place a port fits on free, undeveloped land that a street of ≤ ACCESS_MAX tiles can reach. */
function portSites(w: World): Site[] {
  const { width, height } = w.grid;
  const roles = shapeRoles(BUILDING_SEAPORT);
  // checkPlacement re-hashes the terrain for open water on every call: screen with one mask first.
  const open = openWater(w);
  const out: Site[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let rot = 0; rot < 4; rot++) {
    const tiles = footprintTiles(width, height, x, y, BUILDING_SEAPORT, rot);
    if (!tiles) continue;
    if (tiles.some((i, k) => roles[k] === 'dock' && !open[i])) continue;
    const body = tiles.filter((_, k) => roles[k] !== 'dock');
    if (body.some(i => w.layers.devLevel[i] > 0)) continue;
    if (!w.checkPlacement(x, y, BUILDING_SEAPORT, rot).ok) continue;
    const access = accessPath(w, body, new Set(tiles));
    if (access) out.push({ x, y, rot, tiles, access });
  }
  return out;
}

/** Place the port and lay its access street. */
function build(w: World, s: Site): boolean {
  if (!w.placeBuilding(s.x, s.y, BUILDING_SEAPORT, s.rot)) return false;
  for (const i of s.access) w.setRoad(i % w.grid.width, Math.floor(i / w.grid.width), ROAD_STREET);
  return w.buildingAccessRoads(s.x, s.y).length > 0;
}

/** Developed levels of `zone` within `r` tiles (Manhattan) of a site. */
function levelsNear(w: World, s: Site, zone: number, r: number): number {
  const { width, height } = w.grid;
  const cx = s.tiles.reduce((a, i) => a + (i % width), 0) / s.tiles.length;
  const cy = s.tiles.reduce((a, i) => a + Math.floor(i / width), 0) / s.tiles.length;
  let n = 0;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(height - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(width - 1, Math.ceil(cx + r)); x++) {
      if (Math.abs(x - cx) + Math.abs(y - cy) > r) continue;
      const i = y * width + x;
      if (w.layers.zone[i] === zone && !w.layers.abandoned[i]) n += w.layers.devLevel[i];
    }
  }
  return n;
}

const NEAR = 16, FAR = 40;

function bestSite(w: World, zone: number): Site | null {
  // Most levels within NEAR tiles, then within FAR, then the shortest access street.
  let best: Site | null = null, bestN = -Infinity;
  for (const s of portSites(w)) { const n = levelsNear(w, s, zone, NEAR) * 1e4 + levelsNear(w, s, zone, FAR) - s.access.length * 1e-3; if (n > bestN) { bestN = n; best = s; } }
  return best;
}

/** Build a seaport at the site with the most industry near it, with its access street; false if there is none (src/gen/showcase.ts). */
export function placeSeaport(w: World): boolean {
  const s = bestSite(w, ZONE_I);
  return s ? build(w, s) : false;
}

/** Industry's own tax per developed level per tick, as EconomySystem pays it. */
function industryTaxPerLevel(w: World): number {
  return w.budget.taxRates.I * BALANCE.tax.industryLandValueMult * ordinanceModifier(w, 'industrialIncome') * taxIncomeMult(w.budget.taxLevel);
}

function portProbe(w: World, settle: () => void): { probe: PortProbe; site: Site } | null {
  const site = bestSite(w, ZONE_I);
  if (!site || !build(w, site)) return null;
  settle();
  const t = portTradeAt(w, site.x, site.y);
  if (!t) return null;
  const income = exportIncome(w), upkeep = BALANCE.buildings[BUILDING_SEAPORT]?.maintenance ?? 0;
  const net = (income - upkeep) * TICKS_PER_DAY();
  const served = BALANCE.port.exportTripsPerLevel > 0 ? t.exports / BALANCE.port.exportTripsPerLevel : 0;
  const tax = industryTaxPerLevel(w);
  return {
    site,
    probe: {
      site: { x: site.x, y: site.y, rot: site.rot },
      income: r3(income), upkeep,
      paybackDays: net > 0 ? Math.round((BALANCE.buildings[BUILDING_SEAPORT]?.cost ?? 0) / net) : null,
      fullShare: t.exportCapacity > 0 ? r3(t.exports / t.exportCapacity) : 0,
      incomeShare: w.budget.income > 0 ? r3(income / w.budget.income) : 0,
      perLevelRatio: served > 0 && tax > 0 ? r3(income / served / tax) : null,
    },
  };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** All trade probes on a copy of `world`, under the BALANCE numbers in force. */
export function tradeResult(world: World): TradeResult {
  // ── Today and the port, on one copy ──
  const w = cloneWorld(world);
  const { settle } = simFor(w);
  const lv = levels(w);
  const res: TradeResult = { levels: lv, shortage: r3(goodsShortage(w)), heavy: null, port: null, split: null };
  const first = portProbe(w, settle);
  if (first) {
    res.port = first.probe;
    const before = exportIncome(w);
    const second = bestSite(w, ZONE_I);
    if (second && before > 0 && build(w, second)) {
      settle();
      res.split = { gain: r3(exportIncome(w) / before - 1), firstFull: first.probe.fullShare };
    }
  } else res.note = 'no coastal site a street can reach';

  // ── Shops 3× industry: dezone industry in a fixed order until C ≥ 3·I ──
  const h = cloneWorld(world);
  const { settle: settleH } = simFor(h);
  const { width } = h.grid;
  let { c, i } = levels(h);
  if (c > 0) {
    const ind: number[] = [];
    for (let k = 0; k < h.layers.zone.length; k++) if (h.layers.zone[k] === ZONE_I && h.layers.devLevel[k] > 0) ind.push(k);
    ind.sort((a, b) => ((a * 2654435761) >>> 0) - ((b * 2654435761) >>> 0));
    for (const k of ind) {
      if (c >= 3 * i) break;
      i -= h.layers.devLevel[k];
      h.setZone(k % width, Math.floor(k / width), ZONE_NONE);
    }
    settleH();
    const sh = goodsShortage(h);
    let withPort: number | null = null;
    const site = bestSite(h, ZONE_C);
    if (site && build(h, site)) { settleH(); withPort = r3(goodsShortage(h)); }
    res.heavy = { ratio: r3(c / Math.max(1, i)), shortage: r3(sh), incomeLoss: r3(BALANCE.goods.shortageIncomePenalty * sh), withPort };
  }
  return res;
}

// ── Presets the lab grades ──────────────────────────────────────────────────

export interface TradePreset { id: string; name: string; desc: string; values: TradeValues }

export const TRADE_PRESETS: TradePreset[] = [
  { id: 'shipped', name: 'Shipped', desc: 'As in BALANCE: trade and the goods penalties switched off.', values: {} },
  { id: 'proposed', name: 'Proposed', desc: 'ENGINEER 3 sweep, 2026-11-17 (balance-results/trade-*.json): goods capacity 0.55, shops lose up to 25% at a full shortage; a port takes 15 export trips a tick at 8 each, imports 200; cost 200k, upkeep 30.',
    values: { goodsCapacity: 0.55, goods: { shortageIncomePenalty: 0.25 }, portCost: 200000, portUpkeep: 30, port: { exportTripsPerLevel: 0.1, exportCapacity: 15, exportIncomePerTrip: 8, importCapacity: 200 } } },
];
