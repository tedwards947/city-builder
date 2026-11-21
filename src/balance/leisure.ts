// Balance Lab: the leisure suite (owner-approved targets, 2026-11-20). Not part of the game.
//
// On each saved city, against twins:
//   MUSEUM    the museum on free land beside a street, nearest the middle of the
//             homes: days for its extra net income to repay its cost.
//   NEED      the city as saved (1×1 parks only): share of the homes the leisure
//             need applies to (level 2 and up, growing to 3 or merging) that
//             have no leisure in reach.
//   PARKS     the big park, the 2×2 park and the plaza, each beside the homes:
//             days for the extra tax from the homes and shops within 12 tiles
//             (land value and growth), less upkeep, over the last third of the
//             run, to repay its cost.
//   TOURISM   an airport (built if the city has none) with and without the
//             museum, a big park and a plaza: the extra income ÷ the city's.
// The leisure.* targets (targets.ts) read the result.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_AIRPORT, BUILDING_BIG_PARK, BUILDING_MID_PARK, BUILDING_MUSEUM, BUILDING_NONE, BUILDING_PLAZA, ROAD_HIGHWAY, ROAD_NONE, TERRAIN_WATER, ZONE_NONE, ZONE_R } from '../sim/constants';
import { footprintTiles } from '../sim/buildingShapes';
import { attractionAt, lacksLeisure } from '../sim/leisureTraffic';
import { levelWeight } from '../sim/lots';
import { taxIncomeMult } from '../sim/tax';
import { ZONE_C } from '../sim/constants';
import { placeAirport } from './airport';
import { cloneWorld, startSim } from './world';

const D = BALANCE.ticksPerDay;
export const PARK_KINDS = [BUILDING_BIG_PARK, BUILDING_MID_PARK, BUILDING_PLAZA];

export interface LeisureResult {
  population: number;
  museum: { paybackDays: number | null; netPerDay: number; fill: number | null } | null;
  /** Homes the need applies to, and the share of them with no leisure in reach. */
  need: { homes: number; lacking: number | null };
  /** Per park kind: payback days (null: never), net a day over the last third, homes in its reach no longer lacking. */
  parks: Record<number, { paybackDays: number | null; netPerDay: number; fill: number | null } | null>;
  tourism: { share: number | null; income: number; airportBuilt: boolean } | null;
  note?: string;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const free = (w: World, i: number) => w.layers.terrain[i] !== TERRAIN_WATER && w.layers.building[i] === BUILDING_NONE && w.layers.roadClass[i] === ROAD_NONE && w.layers.devLevel[i] === 0 && w.layers.zone[i] === ZONE_NONE;
const street = (w: World, i: number) => w.layers.roadClass[i] !== ROAD_NONE && w.layers.roadClass[i] !== ROAD_HIGHWAY;

/** Sites for `kind` on free land with a street beside it, nearest the middle of the level-2+ homes first. */
function sites(w: World, kind: number): { x: number; y: number }[] {
  const { width, height } = w.grid;
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < w.layers.zone.length; k++) if (w.layers.zone[k] === ZONE_R && w.layers.devLevel[k] >= 2) { sx += k % width; sy += Math.floor(k / width); n++; }
  if (!n) return [];
  const cx = sx / n, cy = sy / n;
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const t = footprintTiles(width, height, x, y, kind, 0);
    if (!t || !t.every(i => free(w, i))) continue;
    let touches = false;
    for (const i of t) { const xx = i % width; for (const j of [xx > 0 ? i - 1 : -1, xx < width - 1 ? i + 1 : -1, i - width, i + width]) if (j >= 0 && j < width * height && street(w, j)) touches = true; }
    if (touches && w.checkPlacement(x, y, kind, 0).ok) out.push({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) });
  }
  return out.sort((a, b) => a.d - b.d);
}

/** Place `kind` at its best site, avoiding `taken` tiles; the site, or null. */
function place(w: World, kind: number, taken = new Set<number>()): { x: number; y: number } | null {
  const { width, height } = w.grid;
  for (const s of sites(w, kind)) {
    const t = footprintTiles(width, height, s.x, s.y, kind, 0)!;
    if (t.some(i => taken.has(i))) continue;
    if (w.placeBuilding(s.x, s.y, kind, 0)) { for (const i of t) taken.add(i); return s; }
  }
  return null;
}

function needShare(w: World): { homes: number; lacking: number | null } {
  let homes = 0, lacking = 0;
  for (let k = 0; k < w.index.zonedCount; k++) {
    const i = w.index.zoned[k];
    if (w.layers.zone[i] !== ZONE_R || w.layers.abandoned[i] || w.layers.devLevel[i] + 1 < BALANCE.leisure.need.fromLevel) continue;
    homes++;
    if (lacksLeisure(w, i)) lacking++;
  }
  return { homes, lacking: homes ? r3(lacking / homes) : null };
}

/** Tax a tick from the homes and shops on `tiles` (EconomySystem's sum, tile by tile, at the city's tax level). */
function localTax(w: World, tiles: number[]): number {
  const L = w.layers, floor = BALANCE.tax.landValueFloor, rates = w.budget.taxRates;
  let v = 0;
  for (const i of tiles) {
    if (!L.devLevel[i] || L.abandoned[i] || (L.zone[i] !== ZONE_R && L.zone[i] !== ZONE_C)) continue;
    const lvMult = floor + (1 - floor) * (L.landValue[i] / 128);
    const edu = L.zone[i] === ZONE_R ? 1 + (L.education[i] / 255) * (BALANCE.education.taxMultiplier - 1) : 1;
    const sick = L.zone[i] === ZONE_R ? 1 - (L.sickness[i] / 255) * BALANCE.healthcare.taxPenalty : 1;
    v += levelWeight(L.devLevel[i]) * (L.zone[i] === ZONE_R ? rates.R : rates.C) * lvMult * edu * sick;
  }
  return v * taxIncomeMult(w.budget.taxLevel);
}

/** Tiles within `r` of the footprint of `kind` at (x, y). */
function around(w: World, kind: number, x: number, y: number, r: number): number[] {
  const { width, height } = w.grid;
  const t = footprintTiles(width, height, x, y, kind, 0)!;
  const xs = t.map(i => i % width), ys = t.map(i => (i - (i % width)) / width);
  const out: number[] = [];
  for (let yy = Math.max(0, Math.min(...ys) - r); yy <= Math.min(height - 1, Math.max(...ys) + r); yy++)
    for (let xx = Math.max(0, Math.min(...xs) - r); xx <= Math.min(width - 1, Math.max(...xs) + r); xx++) out.push(yy * width + xx);
  return out;
}

/** How far from a park its effect on taxes is counted (its land value reach and the leisure trips round it). */
const LOCAL_RADIUS = 12;

/**
 * `kind` beside the homes against a twin for `days`; payback from the net over the last `tail` days.
 * Ticketed kinds (the museum) use the city's money; free ones the tax from homes and shops within
 * LOCAL_RADIUS less the upkeep, since a whole city's money drifts more between twins than a park earns.
 */
function payback(world: World, kind: number, days: number, tail: number) {
  const a = cloneWorld(world), t = cloneWorld(world);
  const s = place(a, kind);
  if (!s) return null;
  const local = !(BALANCE.leisure.kinds[kind]?.ticket! > 0);
  const tiles = local ? around(a, kind, s.x, s.y, LOCAL_RADIUS) : [];
  const sa = startSim(a), st = startSim(t);
  sa.tick((days - tail) * D); st.tick((days - tail) * D);
  const ma = a.budget.money, mt = t.budget.money;
  let tax = 0;
  for (let d = 0; d < tail; d++) {
    sa.tick(D); st.tick(D);
    if (local) tax += (localTax(a, tiles) - localTax(t, tiles)) * D;
  }
  const upkeep = (BALANCE.buildings[kind]?.maintenance ?? 0) * D;
  const net = local ? tax / tail - upkeep : ((a.budget.money - ma) - (t.budget.money - mt)) / tail;
  const info = attractionAt(a, s.x, s.y);
  const cost = BALANCE.buildings[kind]?.cost ?? 0;
  return { paybackDays: net > 0 ? Math.round(cost / net) : null, netPerDay: r3(net), fill: info ? r3(info.arrivals / info.capacity) : null };
}

/** Income a day over `days` (after a 2-day settle). */
function incomePerDay(w: World, days: number): number {
  const sim = startSim(w);
  sim.tick(2 * D);
  let inc = 0;
  for (let k = 0; k < days * D; k++) { sim.tick(1); inc += w.budget.income; }
  return inc / days;
}

export function leisureResult(saved: World, o: { museumDays?: number; parkDays?: number; tourismDays?: number } = {}): LeisureResult {
  const world = cloneWorld(saved);
  startSim(world).tick(2 * D);
  const res: LeisureResult = { population: world.stats.population, museum: null, need: needShare(world), parks: {}, tourism: null };
  const museumDays = o.museumDays ?? 60, parkDays = o.parkDays ?? 180, tourismDays = o.tourismDays ?? 20;
  res.museum = payback(world, BUILDING_MUSEUM, museumDays, museumDays / 2);
  for (const k of PARK_KINDS) res.parks[k] = payback(world, k, parkDays, parkDays / 3);
  // Tourism: the airport twin, and the same with attractions.
  const base = cloneWorld(world);
  const airportBuilt = !base.buildings.some(b => b.kind === BUILDING_AIRPORT);
  if (airportBuilt && !placeAirport(base)) { res.note = 'no airport site'; return res; }
  const withA = cloneWorld(base), taken = new Set<number>();
  for (const k of [BUILDING_MUSEUM, BUILDING_BIG_PARK, BUILDING_PLAZA]) place(withA, k, taken);
  const i0 = incomePerDay(base, tourismDays), i1 = incomePerDay(withA, tourismDays);
  res.tourism = { share: i1 > 0 ? r3((i1 - i0) / i1) : null, income: Math.round(i1 - i0), airportBuilt };
  return res;
}
