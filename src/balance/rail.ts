// Balance Lab: the rail suite (owner-approved targets, 2026-11-18; RAIL_DESIGN.md).
//
// On each saved city: a station near the jobs, and a suburb 50–90 tiles out
// (homes along a street, its own police, fire, school and hospital, and a
// station). The suburb is joined to the city by one long street, which brings
// power, water and sewage (they spread along roads only, as do services: the
// owner's call), and by one rail line. It runs `days` against a twin with the
// same street and no line, so the line is the only difference. On the end of
// the rail run, static probes: freight on the track, junction loads, the full
// suburb's taxes and fares against the line's upkeep, and a big suburb on one
// line and then two. Then track nuisance on the city as it stands, and the
// suburb's homes near its station with the station growth bonus off and on
// (growth alone, 20 seeds, 360 days, after the line has run 30 days). On a fresh map: a real-money Planner's bank at day 180 and
// 360 against a starter line's price.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_NONE, BUILDING_STATION, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL,
  RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_C, ZONE_I, ZONE_NONE, ZONE_R,
} from '../sim/constants';
import { MARKET_DEFS, railLoad } from '../sim/TrafficData';
import { platformEnds } from '../sim/buildingShapes';
import { railLinks, stationGrowthMask, trackBlocker } from '../sim/rail';
import { pcQuote, pcCap } from '../sim/politics';
import { mulberry32 } from '../sim/rng';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { taxIncomeMult } from '../sim/tax';
import { cloneWorld, freshWorld, startSim } from './world';
import { playPersona, PERSONAS } from './personas';

/** The suburb's street to the city is at least this long: a far suburb, beyond the city's police and fire (15 road steps). */
export const MIN_STREET = 25;

/** A starter line, for the money targets: two straight stations and this much ground track. */
export const STARTER_TILES = 60;
/** A starter line's upkeep per tick: its track and its two stations. */
export function starterLineUpkeep(): number {
  return 2 * (BALANCE.buildings[BUILDING_STATION]?.maintenance ?? 0) + STARTER_TILES * (BALANCE.rail.track[RAIL_GROUND]?.maintenance ?? 0);
}
export function starterLineCost(): number {
  return 2 * (BALANCE.buildings[BUILDING_STATION]?.cost ?? 0) + STARTER_TILES * (BALANCE.rail.track[RAIL_GROUND]?.cost ?? 0);
}

export interface RailResult {
  population: number;
  note?: string;
  /** Tiles of track on the line (platforms not counted), and of the street joining the suburb to the city. */
  lineTiles: number | null;
  streetTiles: number | null;
  /** Mean job access (0–255) of the suburb's homes at the end: with the line, and the twin with the street only. */
  suburbAccess: number | null;
  streetAccess: number | null;
  /** Median job access of the city's own developed homes (rail run, end). */
  cityAccess: number | null;
  /** Home levels in the suburb at the end, with the line and in the street-only twin. */
  railLevels: number | null;
  streetLevels: number | null;
  /** Freight (every market that never rides) on any tile of track. */
  freightOnTrack: number | null;
  /** Load at a 3-way and a 4-way junction laid on the line, scaled to plain track at 0.5. */
  junction3: number | null;
  junction4: number | null;
  /** The big suburb: residents at full size, worst load on one line, and worst on either of two lines. */
  bigResidents: number | null;
  oneLine: number | null;
  twoLines: number | null;
  /** The suburb at full size: (its home taxes + fares) ÷ a starter line's upkeep (two stations, STARTER_TILES of track). */
  pays: number | null;
  /** The twin's surplus per day, and a starter line's price in days of it (null if the city runs at a loss). */
  surplusPerDay: number | null;
  lineCostDays: number | null;
  /** Track nuisance on the city as it stands (null: no 20-tile run of free land). */
  nuisance?: RailNuisance | null;
  /** The suburb's homes near its station: days to level 3 with the station bonus off and on (null: no site). */
  stationGrowth?: StationGrowth | null;
}

export interface RailFresh {
  /** A fresh real-money Planner's bank at day 180 and day 360. */
  bank180: number;
  bank360: number;
  starterCost: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const isStreet = (w: World, i: number) => w.layers.roadClass[i] !== ROAD_NONE && w.layers.roadClass[i] !== ROAD_HIGHWAY;
const free = (w: World, i: number) => w.layers.terrain[i] !== TERRAIN_WATER && w.layers.building[i] === BUILDING_NONE && w.layers.roadClass[i] === ROAD_NONE && w.layers.zone[i] === ZONE_NONE && w.layers.rail[i] === 0;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

// ── Stations in the city ─────────────────────────────────────────────────────

interface Pt { x: number; y: number }

/** The tiles just beyond a straight station's platform ends (rotation 0), west then east, as tile indices. */
export function stationEnds(w: World, p: Pt): { west: number; east: number } {
  const e = platformEnds(BUILDING_STATION, 0).slice().sort((a, b) => a[0] - b[0]);
  return { west: w.grid.idx(p.x + e[0][0], p.y + e[0][1]), east: w.grid.idx(p.x + e[e.length - 1][0], p.y + e[e.length - 1][1]) };
}

/** Straight stations (rotation 0: three platform tiles east from the anchor) on free land with a street along the north side, nearest the jobs first. */
export function cityStations(w: World): Pt[] {
  const { width, height } = w.grid;
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < w.layers.zone.length; k++) {
    const z = w.layers.zone[k];
    if ((z === ZONE_C || z === ZONE_I) && w.layers.devLevel[k]) { sx += k % width; sy += Math.floor(k / width); n++; }
  }
  if (!n) return [];
  const cx = sx / n, cy = sy / n;
  const out: (Pt & { d: number })[] = [];
  for (let y = 1; y < height - 4; y++) for (let x = 2; x < width - 6; x++) {
    let ok = true;
    // the platform, a free tile at each of its ends, and the row south of it
    for (let dy = 0; dy < 2 && ok; dy++) for (let dx = -1; dx < 4 && ok; dx++) if (!free(w, w.grid.idx(x + dx, y + dy))) ok = false;
    if (!ok) continue;
    let road = false;
    for (let dx = 0; dx < 3; dx++) if (isStreet(w, w.grid.idx(x + dx, y - 1))) road = true;
    if (!road || !w.checkPlacement(x, y, BUILDING_STATION, 0).ok) continue;
    out.push({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) });
  }
  return out.sort((a, b) => a.d - b.d);
}

// ── The suburb ───────────────────────────────────────────────────────────────

// Layout, from its corner (x, y), with `rows` streets and `homes` home tiles a side:
//   streets along y+2, y+5, … from x−5 to x+homes+5, joined at both ends;
//   homes on both sides of each street, x … x+homes−1;
//   police, fire, school and hospital north of the first street at x+homes+1 … +4;
//   the east station's platform along the south side of the last street, x+homes+1 … +3 (track joins its west end at x+homes);
//   a west station (for a second line) the same way at x−5 … x−3 (track joins its west end at x−6).
interface Suburb { x: number; y: number; homes: number[]; streets: Set<number>; reserved: Set<number>; east: Pt; west: Pt; eastEnd: number; westEnd: number }
const subW = (homes: number) => homes + 13;               // x−7 … x+homes+5
const subH = (rows: number) => 3 * rows + 4;

function suburbFits(w: World, x: number, y: number, homes: number, rows: number, margin: number): boolean {
  const { width, height } = w.grid;
  const x0 = x - 7 - margin, x1 = x - 7 + subW(homes) + margin, y0 = y - margin, y1 = y + subH(rows) + margin;
  if (x0 < 0 || y0 < 0 || x1 >= width || y1 >= height) return false;
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const i = w.grid.idx(xx, yy);
    if (w.layers.roadClass[i] !== ROAD_NONE || w.layers.zone[i] !== ZONE_NONE || w.layers.building[i] !== BUILDING_NONE || w.layers.rail[i]) return false;
    if (xx >= x - 7 && xx < x - 7 + subW(homes) && yy >= y && yy < y + subH(rows) && w.layers.terrain[i] === TERRAIN_WATER) return false;
  }
  return true;
}

function buildSuburb(w: World, x: number, y: number, homes: number, rows: number): Suburb | null {
  const g = w.grid, list: number[] = [], streets = new Set<number>();
  const last = y + 2 + 3 * (rows - 1);
  for (let r = 0; r < rows; r++) {
    const sy = y + 2 + 3 * r;
    for (let xx = x - 5; xx <= x + homes + 5; xx++) { if (!w.setRoad(xx, sy, ROAD_STREET)) return null; streets.add(g.idx(xx, sy)); }
    for (let xx = x; xx < x + homes; xx++) for (const yy of [sy - 1, sy + 1]) { const i = g.idx(xx, yy); w.layers.zone[i] = ZONE_R; list.push(i); }
  }
  // The streets are joined at both ends, so every home reaches both stations.
  for (const cx of [x - 5, x + homes + 5]) for (let yy = y + 2; yy <= last; yy++) if (!streets.has(g.idx(cx, yy))) { if (!w.setRoad(cx, yy, ROAD_STREET)) return null; streets.add(g.idx(cx, yy)); }
  const svc: [number, number][] = [[BUILDING_POLICE, 1], [BUILDING_FIRE, 2], [BUILDING_SCHOOL, 3], [BUILDING_HOSPITAL, 4]];
  for (const [b, dx] of svc) if (!w.placeBuilding(x + homes + dx, y + 1, b)) return null;
  const east = { x: x + homes + 1, y: last + 1 };
  if (!w.placeBuilding(east.x, east.y, BUILDING_STATION, 0)) return null;
  const west = { x: x - 5, y: last + 1 };
  // Kept free for the west station, its platform ends and a tile beyond each: track
  // laid there first would join the second line or the platform and make a junction.
  const reserved = new Set<number>();
  for (let dy = 0; dy < 3; dy++) for (let dx = -2; dx <= 5; dx++) reserved.add(g.idx(west.x + dx, west.y + dy));
  w.grid.markAllDirty();
  return { x, y, homes: list, streets, reserved, east, west, eastEnd: stationEnds(w, east).west, westEnd: stationEnds(w, west).west };
}

/** The shortest street from the suburb's west end to a city street, over free land; laid. Its length, or null. */
function joinByStreet(w: World, s: Suburb): number | null {
  const { width } = w.grid, n = width * w.grid.height;
  const start = w.grid.idx(s.x - 5, s.y + 2);
  const prev = new Map<number, number>([[start, -1]]);
  let q = [start], hit = -1;
  while (q.length && hit < 0) {
    const nq: number[] = [];
    for (const i of q) {
      const x = i % width;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
        if (j < 0 || j >= n || prev.has(j)) continue;
        if (isStreet(w, j) && !s.streets.has(j) && i !== start) { prev.set(j, i); hit = j; break; }
        if (free(w, j) && !s.reserved.has(j)) { prev.set(j, i); nq.push(j); }
      }
      if (hit >= 0) break;
    }
    q = nq;
  }
  if (hit < 0) return null;
  let k = prev.get(hit)!, len = 0;
  while (k !== start) { if (!w.setRoad(k % width, Math.floor(k / width), ROAD_STREET)) return null; len++; k = prev.get(k)!; }
  return len;
}

/**
 * The shortest track path from tile a to tile b: over free land, or straight
 * across a street that runs the other way; never beside other track (so it
 * makes no junction or shortcut to a platform). Tiles a and b (beside the
 * platform ends) included.
 */
function trackPath(w: World, a: number, b: number, blocked: Set<number> = new Set()): number[] | null {
  const { width, height } = w.grid;
  const rc = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && w.layers.roadClass[y * width + x] !== ROAD_NONE;
  const ok = (i: number) => {
    if (blocked.has(i)) return false;
    if (!free(w, i) && !(isStreet(w, i) && w.layers.building[i] === BUILDING_NONE && w.layers.rail[i] === 0)) return false;
    const x = i % width, y = Math.floor(i / width);
    for (const [dx, dy] of DIRS) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const j = yy * width + xx;
      if (w.layers.rail[j]) return false;          // no junction, and no link to a platform's other end
    }
    return true;
  };
  const prev = new Int32Array(width * height * 4).fill(-2);
  let q: number[] = [];
  for (let d = 0; d < 4; d++) { prev[a * 4 + d] = -1; q.push(a * 4 + d); }
  while (q.length) {
    const nq: number[] = [];
    for (const s of q) {
      const i = s >> 2, din = s & 3, x = i % width, y = Math.floor(i / width);
      if (i === b) { const path: number[] = []; let k = s; while (k >= 0) { path.push(k >> 2); k = prev[k]; } return path.reverse(); }
      const onRoad = isStreet(w, i);
      for (let d = 0; d < 4; d++) {
        if (onRoad && d !== din) continue;                    // straight across a street
        const xx = x + DIRS[d][0], yy = y + DIRS[d][1];
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = yy * width + xx;
        if (j !== b && j !== a && !ok(j)) continue;
        if (isStreet(w, j)) {
          const horiz = d === 1 || d === 3;
          const along = horiz ? rc(xx + 1, yy) || rc(xx - 1, yy) : rc(xx, yy + 1) || rc(xx, yy - 1);
          const across = horiz ? rc(xx, yy + 1) || rc(xx, yy - 1) : rc(xx + 1, yy) || rc(xx - 1, yy);
          if (along || !across) continue;
        }
        const ns = j * 4 + d;
        if (prev[ns] !== -2) continue;
        prev[ns] = s; nq.push(ns);
      }
    }
    q = nq;
  }
  return null;
}

function layPath(w: World, path: number[]): boolean {
  const { width } = w.grid;
  for (const i of path) if (!(w.layers.rail[i] & RAIL_GROUND) && !w.layTrack(i % width, Math.floor(i / width))) return false;
  return true;
}

interface Site { world: World; sub: Suburb; city: Pt; street: number; path: number[] }

/**
 * A suburb `homes` × `rows` 50–90 tiles from a city station, with a street
 * (at least `minStreet` long) to the city and a line to that station. Built on a copy of `base` (track not laid).
 */
function findSite(base: World, homes: number, rows: number, minStreet = 0): Site | null {
  const stations = cityStations(base).slice(0, 3);
  const { width, height } = base.grid;
  for (const city of stations) {
    const cands: (Pt & { d: number })[] = [];
    for (let y = 2; y < height - subH(rows) - 2; y += 3) for (let x = 9; x < width - homes - 8; x += 3) {
      const d = Math.abs(x - city.x) + Math.abs(y - city.y);
      if (d >= 50 && d <= 90) cands.push({ x, y, d });
    }
    cands.sort((a, b) => a.d - b.d);
    let tries = 0;
    for (const c of cands) {
      if (!suburbFits(base, c.x, c.y, homes, rows, 8)) continue;
      if (++tries > 80) break;
      const w = cloneWorld(base);
      if (!w.placeBuilding(city.x, city.y, BUILDING_STATION, 0)) break;
      const sub = buildSuburb(w, c.x, c.y, homes, rows);
      if (!sub) continue;
      const street = joinByStreet(w, sub);
      if (street === null || street < minStreet) continue;
      const path = trackPath(w, stationEnds(w, city).east, sub.eastEnd, sub.reserved);
      if (path) return { world: w, sub, city, street, path };
    }
  }
  return null;
}

// ── Measures ─────────────────────────────────────────────────────────────────

const mean = (w: World, tiles: number[]) => tiles.reduce((s, i) => s + w.layers.accessibility[i], 0) / Math.max(1, tiles.length);
const levels = (w: World, tiles: number[]) => tiles.reduce((s, i) => s + w.layers.devLevel[i], 0);
function cityMedianAccess(w: World, skip: Set<number>): number {
  const a: number[] = [];
  for (let k = 0; k < w.layers.zone.length; k++) if (w.layers.zone[k] === ZONE_R && w.layers.devLevel[k] && !skip.has(k)) a.push(w.layers.accessibility[k]);
  a.sort((p, q) => p - q);
  return a.length ? a[a.length >> 1] : 0;
}
function freightOn(w: World, track: number[]): number {
  const t = w.traffic!;
  let sum = 0;
  for (const def of MARKET_DEFS) {
    if (def.rides) continue;
    const m = (t as unknown as Record<string, { volume: Float32Array } | undefined>)[def.key];
    if (m) for (const i of track) sum += m.volume[t.tiles + i] ?? 0;
  }
  return sum;
}
/** Whether any plain track tile joins three or four ways (a platform end's own links aside). */
function hasJunction(w: World): boolean {
  for (let i = 0; i < w.layers.rail.length; i++) {
    if (!(w.layers.rail[i] & RAIL_GROUND) || w.layers.building[i] !== BUILDING_NONE) continue;
    let m = railLinks(w, i), n = 0;
    while (m) { n += m & 1; m >>= 1; }
    if (n > 2) return true;
  }
  return false;
}
const maxLoad = (w: World, tiles: number[]) => tiles.reduce((m, i) => Math.max(m, railLoad(w.traffic!, i)), 0);
/** Plain track tiles of a path (two links in a straight line), away from its ends. */
function straightTiles(w: World, path: number[]): number[] {
  const { width } = w.grid, out: number[] = [];
  for (let k = 3; k < path.length - 3; k++) {
    const a = path[k - 1], b = path[k], c = path[k + 1];
    if (b - a === c - b && w.layers.roadClass[b] === ROAD_NONE && Math.abs(b - a) <= width) out.push(b);
  }
  return out;
}
/** A home's tax per tick at its level, as EconomySystem reckons it (the city's tax level included). */
function homeTax(w: World, i: number): number {
  const lv = w.layers.landValue[i], floor = BALANCE.tax.landValueFloor;
  const edu = 1 + (w.layers.education[i] / 255) * (BALANCE.education.taxMultiplier - 1);
  const sick = 1 - (w.layers.sickness[i] / 255) * BALANCE.healthcare.taxPenalty;
  return w.layers.devLevel[i] * w.budget.taxRates.R * (floor + (1 - floor) * (lv / 128)) * edu * sick * taxIncomeMult(w.budget.taxLevel);
}

/** The rail probe on copies of a saved city, under the BALANCE numbers in force. */
export function railResult(world: World, days = 180): RailResult {
  const res: RailResult = {
    population: world.stats.population, lineTiles: null, streetTiles: null, suburbAccess: null, streetAccess: null, cityAccess: null,
    railLevels: null, streetLevels: null, freightOnTrack: null, junction3: null, junction4: null, bigResidents: null, oneLine: null, twoLines: null,
    pays: null, surplusPerDay: null, lineCostDays: null,
  };
  const site = findSite(world, 16, 1, MIN_STREET);
  if (!site) return { ...res, note: 'no suburb site with a street and a line to the city' };
  const { width } = world.grid, ticks = BALANCE.ticksPerDay;
  res.streetTiles = site.street;
  res.lineTiles = site.path.length - 2;                         // the two end tiles join the platforms
  const homes = site.sub.homes, homeSet = new Set(homes);

  // The twin: the street only.
  const twin = cloneWorld(site.world), m0 = twin.budget.money, st = startSim(twin);
  for (let d = 0; d < days; d++) st.tick(ticks);
  res.surplusPerDay = Math.round((twin.budget.money - m0) / days);
  res.lineCostDays = res.surplusPerDay > 0 ? Math.round(starterLineCost() / res.surplusPerDay) : null;
  res.streetAccess = Math.round(mean(twin, homes));
  res.streetLevels = levels(twin, homes);

  // With the line.
  const rail = cloneWorld(site.world);
  if (!layPath(rail, site.path)) return { ...res, note: 'track refused' };
  const sr = startSim(rail);
  for (let d = 0; d < days; d++) sr.tick(ticks);
  res.suburbAccess = Math.round(mean(rail, homes));
  res.railLevels = levels(rail, homes);
  res.cityAccess = cityMedianAccess(rail, homeSet);
  const track: number[] = [];
  for (let i = 0; i < rail.layers.rail.length; i++) if (rail.layers.rail[i] & RAIL_GROUND) track.push(i);
  res.freightOnTrack = r2(freightOn(rail, track));

  // The suburb at full size: its taxes and fares against the line's upkeep.
  const full = cloneWorld(rail);
  for (const i of homes) full.layers.devLevel[i] = BALANCE.growth.maxLevel;
  full.grid.markAllDirty();
  startSim(full);
  const tax = homes.reduce((s, i) => s + homeTax(full, i), 0);
  const fares = full.traffic!.rail.boardings * BALANCE.rail.fare;
  // Graded on a fixed starter line (owner 2026-11-18), not the probe's own line, whose length depends on the map.
  const upkeep = starterLineUpkeep();
  res.pays = upkeep > 0 ? r2((tax + fares) / upkeep) : null;

  // Junctions, on the full suburb: a 3-way and a 4-way spur (three tiles each) on plain track,
  // well apart and clear of all other track, so they make no shortcut; traffic settled again.
  const plain = straightTiles(full, site.path);
  const pos = new Map(site.path.map((i, k) => [i, k]));
  const across = (i: number) => { const k = pos.get(i)!; return Math.abs(site.path[k] - site.path[k - 1]) === 1 ? width : 1; };
  const spurOk = (i: number, step: number) => {
    for (let k = 1; k <= 3; k++) {
      const j = i + step * k;
      if (j < 0 || j >= full.layers.rail.length || !free(full, j)) return false;
      if (step === 1 && Math.floor(j / width) !== Math.floor(i / width)) return false;
      for (const n of [j - 1, j + 1, j - width, j + width]) {
        if (n < 0 || n >= full.layers.rail.length || n === i || n === j - step) continue;
        if (full.layers.rail[n]) return false;
      }
    }
    return true;
  };
  const apart = (i: number, js: number[]) => js.every(j => Math.abs(pos.get(i)! - pos.get(j)!) > 6);
  let j3 = -1, j4 = -1;
  for (const i of plain) if (spurOk(i, across(i))) { j3 = i; break; }
  if (j3 >= 0) for (const i of plain) if (apart(i, [j3]) && spurOk(i, across(i)) && spurOk(i, -across(i))) { j4 = i; break; }
  const ref = j4 >= 0 ? plain.find(i => apart(i, [j3, j4])) ?? -1 : -1;
  if (ref >= 0) {
    const jw = cloneWorld(full);
    const lay = (i: number, step: number) => { for (let k = 1; k <= 3; k++) { const j = i + step * k; jw.layTrack(j % width, Math.floor(j / width)); } };
    lay(j3, across(j3)); lay(j4, across(j4)); lay(j4, -across(j4));
    startSim(jw);
    const base = railLoad(jw.traffic!, ref);
    if (base > 0) { res.junction3 = r2(0.5 * railLoad(jw.traffic!, j3) / base); res.junction4 = r2(0.5 * railLoad(jw.traffic!, j4) / base); }
  }

  // A big suburb at full size on one line, then two.
  const big = findSite(world, 40, 2, MIN_STREET);
  if (big) {
    const bw = big.world, bhomes = big.sub.homes;
    for (const i of bhomes) bw.layers.devLevel[i] = BALANCE.growth.maxLevel;
    bw.grid.markAllDirty();
    res.bigResidents = bhomes.length * (BALANCE.growth.popPerLevel[BALANCE.growth.maxLevel] ?? 0);
    if (layPath(bw, big.path)) {
      startSim(bw);
      const line1 = straightTiles(bw, big.path);
      res.oneLine = r2(maxLoad(bw, line1));
      // The second line: from another city station to the suburb's west station, on its own
      // track (no tile beside the first line, so they never cross or join). The first city
      // station that gives such a line, of the six nearest the jobs.
      const firstEnd = stationEnds(bw, big.city).east;
      for (const city2 of cityStations(bw).filter(c => Math.abs(c.x - big.city.x) + Math.abs(c.y - big.city.y) > 8).slice(0, 6)) {
        const tw = cloneWorld(bw);
        if (!tw.placeBuilding(city2.x, city2.y, BUILDING_STATION, 0) || !tw.placeBuilding(big.sub.west.x, big.sub.west.y, BUILDING_STATION, 0)) continue;
        const p2 = trackPath(tw, stationEnds(tw, city2).east, big.sub.westEnd);
        if (!p2 || !layPath(tw, p2)) continue;
        if (hasJunction(tw)) continue;
        if (stationEnds(tw, city2).east === firstEnd) continue;
        startSim(tw);
        res.twoLines = r2(Math.max(maxLoad(tw, line1), maxLoad(tw, straightTiles(tw, p2))));
        break;
      }
    }
  }
  if (res.oneLine !== null && res.twoLines === null) res.note = (res.note ? res.note + ' ' : '') + 'no room for a second line';
  res.nuisance = railNuisance(world);
  res.stationGrowth = stationGrowthResult(world);
  return res;
}

// ── Track nuisance (rail.nuisance) ───────────────────────────────────────────

export interface RailNuisance {
  /** Home tiles within 2 tiles of the run, counted once per track tile (a home beside three tiles counts three times). */
  homes: number;
  /** PC for 20 tiles of ground track on the run, quoted tile by tile, and that ÷ the PC cap. */
  groundPc: number;
  groundBars: number;
  /** Elevated ÷ ground on the same run; subway's PC; ground track on a run with no home within 6 tiles (null: no such run). */
  elevatedRatio: number | null;
  subwayPc: number;
  emptyPc: number | null;
}

function homesNear(w: World, i: number, r: number): number {
  const { width, height } = w.grid, x = i % width, y = (i - x) / width;
  let n = 0;
  for (let yy = Math.max(0, y - r); yy <= Math.min(height - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(width - 1, x + r); xx++) {
    const j = yy * width + xx; if (w.layers.zone[j] === ZONE_R && w.layers.devLevel[j]) n++;
  }
  return n;
}
const trackPc = (w: World, tiles: number[], level: number) => tiles.reduce((s, i) => s + pcQuote(w, { type: 'track', tx: i % w.grid.width, ty: Math.floor(i / w.grid.width), level }).cost, 0);

/** Track nuisance on the city as it stands: the 20-tile straight run of free land with the most homes within 2 tiles. */
export function railNuisance(w: World): RailNuisance | null {
  const { width, height } = w.grid;
  let busy: number[] | null = null, most = 0, empty: number[] | null = null;
  const consider = (run: number[]) => {
    const n = run.reduce((s, i) => s + homesNear(w, i, 2), 0);
    if (n > most) { most = n; busy = run; }
    if (!empty && run.every(i => homesNear(w, i, 6) === 0)) empty = run;
  };
  const scan = (outer: number, inner: number, at: (a: number, b: number) => number) => {
    for (let a = 0; a < outer; a++) {
      let run: number[] = [];
      for (let b = 0; b < inner; b++) {
        const i = at(a, b);
        if (free(w, i) && trackBlocker(w, i % width, Math.floor(i / width), RAIL_GROUND) === null) { run.push(i); if (run.length >= 20) consider(run.slice(-20)); } else run = [];
      }
    }
  };
  scan(height, width, (y, x) => y * width + x);
  scan(width, height, (x, y) => y * width + x);
  if (!busy) return null;
  const run: number[] = busy, g = trackPc(w, run, RAIL_GROUND);
  return { homes: most, groundPc: r2(g), groundBars: Math.round(g / pcCap(w) * 1000) / 1000, elevatedRatio: g > 0 ? r2(trackPc(w, run, RAIL_ELEVATED) / g) : null, subwayPc: r2(trackPc(w, run, RAIL_SUBWAY)), emptyPc: empty ? r2(trackPc(w, empty, RAIL_GROUND)) : null };
}

// ── Growth near stations (rail.stationGrowth) ────────────────────────────────

/** Built homes the station bonus reaches (stationGrowthMask), around any station of the line. */
function homesByStations(w: World): number[] {
  const mask = stationGrowthMask(w);
  if (!mask) return [];
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] && w.layers.zone[i] === ZONE_R && w.layers.devLevel[i] > 0) out.push(i);
  return out;
}

export interface StationGrowth {
  /** Homes the station bonus reaches, around either station of the line, that got to level 3 in at least one run. */
  homes: number;
  /** Mean days to level 3 for those homes over every seed (a run where one never gets there counts as `days`): bonus off, and on. */
  daysOff: number;
  daysOn: number;
  /** 1 − on ÷ off: how much sooner they get there. */
  sooner: number | null;
}

/**
 * The suburb and its line, as railResult builds them, run `settle` days in the
 * full sim so services, education and riders are in place. Then every home the
 * station bonus reaches (stationGrowthMask: the suburb's station and the city's)
 * is emptied, and only the growth system runs from there,
 * `days` days, once per seed with the station bonus off and once as shipped.
 * Growth alone is cheap, so enough seeds can be run for a ×1.25 to show above
 * the noise of a handful of homes; everything else stays as it was settled.
 * Every home the growth system touches shares one random stream, so the two
 * runs of a seed soon draw different rolls: the seeds, not the pairing, beat
 * the noise (20 seeds swung one city from 1% to 18%; at 100 it moves a few points).
 * Homes that never reach level 3 in any run are held back by something else
 * (a service or education gate) and are left out.
 */
export function stationGrowthResult(world: World, days = 360, seeds = 100, settle = 30): StationGrowth | null {
  const cfg = BALANCE.rail.stationGrowth as { radius: number; mult: number };
  const site = findSite(world, 16, 1, MIN_STREET);
  if (!site) return null;
  const w = cloneWorld(site.world);
  if (!layPath(w, site.path)) return null;
  const sim = startSim(w);
  for (let d = 0; d < settle; d++) sim.tick(BALANCE.ticksPerDay);
  const near = homesByStations(w);
  if (!near.length) return null;
  for (const h of near) w.layers.devLevel[h] = 0;
  const L = w.layers, saved = { dev: L.devLevel.slice(), abandoned: L.abandoned.slice(), distress: L.distress.slice() }, tick0 = w.tick;
  const ti = BALANCE.growth.tickInterval, passes = Math.round(days * BALANCE.ticksPerDay / ti), perDay = BALANCE.ticksPerDay / ti;
  // Days to level 3 for each home, or -1 if it never got there.
  const run = (mult: number, seed: number): number[] => {
    L.devLevel.set(saved.dev); L.abandoned.set(saved.abandoned); L.distress.set(saved.distress);
    w.tick = Math.ceil(tick0 / ti) * ti;
    w.rng = mulberry32(seed);
    const growth = new ZoneGrowthSystem(), first = new Map<number, number>(), was = cfg.mult;
    cfg.mult = mult;
    try {
      for (let p = 1; p <= passes && first.size < near.length; p++) {
        growth.update(w);
        w.tick += ti;
        for (const h of near) if (!first.has(h) && L.devLevel[h] >= 3) first.set(h, p / perDay);
      }
    } finally { cfg.mult = was; }
    return near.map(h => first.get(h) ?? -1);
  };
  const offRuns: number[][] = [], onRuns: number[][] = [];
  for (let k = 1; k <= seeds; k++) { offRuns.push(run(1, k)); onRuns.push(run(cfg.mult, k)); }
  // A home that never gets there, bonus or not, is held back by something else
  // (a service or education gate, say) and says nothing about the bonus.
  const grows = near.map((_, j) => offRuns.some(r => r[j] >= 0) || onRuns.some(r => r[j] >= 0));
  const n = grows.filter(Boolean).length;
  if (!n) return { homes: 0, daysOff: days, daysOn: days, sooner: null };
  const mean = (runs: number[][]) => { let t = 0; for (const r of runs) r.forEach((d, j) => { if (grows[j]) t += d < 0 ? days : d; }); return t / (runs.length * n); };
  const off = mean(offRuns), on = mean(onRuns);
  return { homes: n, daysOff: r2(off), daysOn: r2(on), sooner: off > 0 ? r2(1 - on / off) : null };
}

/** On a fresh map: a real-money Planner's bank at day 180 and 360, against a starter line. */
export function railFresh(size = 128, seed = 7): RailFresh {
  const run = playPersona(PERSONAS.find(p => p.id === 'planner')!, freshWorld(size, seed), true, 360, { realMoney: true });
  const d = run.rec.days;
  const at = (day: number) => Math.round(d[Math.min(d.length - 1, day - 1)]?.money ?? 0);
  return { bank180: at(180), bank360: at(360), starterCost: starterLineCost() };
}
