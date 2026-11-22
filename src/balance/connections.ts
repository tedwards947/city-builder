// Connections suite (CONNECTIONS_DESIGN.md, phase 5): join a saved city's outside connections the
// way a player would and see what comes through. On copies of the city, each run `days` long and
// then one measured day:
//   base    nothing joined (the loads and industry to compare with);
//   one     the highway point nearest the city joined by the shortest highway over empty land to
//           the nearest road;
//   exports only when no industry is within reach of that point: the same point joined, with an
//           industry district built beside its highway near the point, run `exportDays`;
//   two     the two nearest highway points joined;
//   with attractions (information only, 20k+ cities with none): one and two again, with the tourism
//           probe's museum, big park and plaza placed, so the points bring tourists too;
//   rail    the rail point nearest the city's ground track joined to it by ground track (across
//           streets as level crossings, clearing the zoned lots in the way).
// The design target (owner 2026-11-20): one joined highway point jams its entry road at peak, two
// don't; exports pay a little; industry does not change; rail brings plenty in without loading roads.

import { BALANCE } from '../data/balance';
import type { World } from '../sim/World';
import { connectionStatus } from '../sim/connections';
import { openRails } from '../sim/connectionRail';
import { connectionExportIncome, connectionTradeAt } from '../sim/connectionTraffic';
import { railLoad, roadCapacity, trafficVolume } from '../sim/TrafficData';
import { BUILDING_NONE, BUILDING_STATION, BUILDING_POWER_PLANT, BUILDING_SEWAGE_PLANT, BUILDING_WATER_TOWER, RAIL_ELEVATED, RAIL_GROUND, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_I, ZONE_NONE } from '../sim/constants';
import { findLot } from './town';
import { cityStations, layPath, stationEnds, trackPath } from './rail';
import { cityPull } from '../sim/leisureTraffic';
import { placeAttractions } from './leisure';
import { cloneWorld, startSim } from './world';

const D = BALANCE.ticksPerDay;
const r2 = (x: number) => Math.round(x * 100) / 100;

export interface HighwayRun {
  /** Road class of the city road the highway meets (1 street, 2 avenue, 3 highway). */
  meetsClass: number;
  /** Peak load (volume ÷ capacity) over the measured day of the road the highway meets, without and with the point joined. */
  meetBefore: number;
  meetPeak: number;
  /** Per tick, averaged over the measured day. */
  visitorsIn: number;
  dayTrippers: number;
  trucks: number;
  residentsOut: number;
}

export interface RailRun {
  /** Riders a tick it brings in (tourists and day-trippers), averaged over the measured day. */
  inPerTick: number;
  /** Peak load of the track from the point to the city's line. */
  trackPeak: number;
  /** Road tiles at or above capacity at peak, without and with the rail point joined. */
  jammedBefore: number;
  jammedAfter: number;
  /** Developed lots cleared for the track. */
  cleared: number;
  /**
   * The city had no ground track to join, so the probe built a surface line: from the rail point through 2–3
   * stations near the jobs. The streets within a few tiles of its stations: their peak load and how many are at
   * capacity, without and with the line.
   */
  built?: { stations: number; trackTiles: number; nearStreets: number; nearPeakBefore: number; nearPeakAfter: number; nearJammedBefore: number; nearJammedAfter: number };
}

export interface ConnectionsResult {
  population: number;
  note?: string;
  /** The nearest highway point joined (absent if none can be reached). */
  one?: HighwayRun & { exportIncomePerDay: number };
  /** The two nearest joined: the first and second point. */
  two?: [HighwayRun, HighwayRun];
  /**
   * The export case, when no industry is within reach of the nearest point: the same point joined, with an industry
   * district built beside its highway near the point (`exportDays` long run). Industrial levels in the district at the end.
   */
  exportsBuilt?: { levels: number; trucks: number; exportIncomePerDay: number } | { note: string };
  /**
   * Information only (PM 2026-11-21): a city of 20k or more with no attraction, run again with the tourism probe's
   * museum, big park and plaza placed (its own base for the loads before joining), one and two points joined.
   */
  withAttractions?: { placed: number; one: HighwayRun; two?: [HighwayRun, HighwayRun] };
  /** Industrial levels after the run, nothing joined and the nearest highway point joined. */
  industry?: { base: number; one: number };
  rail?: RailRun | { note: string };
}

const nbrs = (i: number, width: number, n: number): number[] => {
  const x = i % width;
  return [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i < n - width ? i + width : -1];
};

/**
 * Shortest path over empty land from `start` to a tile `goal` accepts: the tiles to lay (start
 * first) and the goal tile met, or null. `rail`: may cross streets and avenues (level crossings),
 * zoned lots (cleared) and subway track.
 */
export function joinPath(w: World, start: number, goal: (j: number) => boolean, rail = false): { path: number[]; meets: number } | null {
  const { width, height } = w.grid, n = width * height, L = w.layers;
  const passable = (i: number) => L.terrain[i] !== TERRAIN_WATER && L.building[i] === BUILDING_NONE
    && (rail ? (L.rail[i] & (RAIL_GROUND | RAIL_ELEVATED)) === 0 : L.rail[i] === 0)
    && (L.roadClass[i] === ROAD_NONE || (rail && L.roadClass[i] !== ROAD_HIGHWAY))
    && (rail || L.devLevel[i] === 0);
  const prev = new Int32Array(n).fill(-2);
  prev[start] = -1;
  let q = [start];
  while (q.length) {
    const nq: number[] = [];
    for (const i of q) {
      for (const j of nbrs(i, width, n)) {
        if (j < 0 || prev[j] !== -2) continue;
        if (goal(j)) {
          const path: number[] = [];
          for (let k = i; k !== -1; k = prev[k]) path.push(k);
          return { path: path.reverse(), meets: j };
        }
        if (passable(j)) { prev[j] = i; nq.push(j); }
      }
    }
    q = nq;
  }
  return null;
}

function industryLevels(w: World): number {
  let levels = 0;
  for (let k = 0; k < w.index.zonedCount; k++) {
    const i = w.index.zoned[k];
    if (w.layers.zone[i] === ZONE_I && !w.layers.abandoned[i]) levels += w.layers.devLevel[i];
  }
  return levels;
}

type Plan = { path: number[]; meets: number };

/** Lay a highway along each plan. */
function layHighways(w: World, plans: Plan[]): void {
  for (const p of plans) for (const i of p.path) w.setRoad(i % w.grid.width, Math.floor(i / w.grid.width), ROAD_HIGHWAY);
  w.grid.markAllDirty();
}

/**
 * An industry district by the highway near its point, as a player exporting by highway would build one: up to three
 * streets off the highway from six tiles in, three apart, with two power plants, a water tower and a sewage plant at
 * the middle one's far end and industry zoned along both sides. The zoned tiles, or null if there is no room.
 */
function buildExportDistrict(w: World, p: Plan): number[] | null {
  const W = w.grid.width, n = W * w.grid.height, L = w.layers;
  const first = 6;
  if (p.path.length < first + 8) return null;
  const d = p.path[first + 1] - p.path[first];
  const step = (i: number, o: number) => { const j = i + o; return j < 0 || j >= n || (Math.abs(o) === 1 && Math.floor(j / W) !== Math.floor(i / W)) ? -1 : j; };
  const empty = (i: number) => i >= 0 && L.terrain[i] !== TERRAIN_WATER && L.building[i] === BUILDING_NONE && L.roadClass[i] === ROAD_NONE && L.zone[i] === ZONE_NONE && L.rail[i] === 0;
  for (const o of Math.abs(d) === 1 ? [W, -W] : [1, -1]) {
    // Three streets three tiles apart, each with a row of industry on both sides.
    const streets: number[][] = [];
    for (const k of [first, first + 3, first + 6]) {
      if (p.path[k + 1] - p.path[k] !== d) break;   // the highway turns: stop here
      const street: number[] = [];
      for (let i = step(p.path[k], o); street.length < 20 && empty(i); i = step(i, o)) street.push(i);
      if (street.length >= 10) streets.push(street);
    }
    if (!streets.length) continue;
    for (const st of streets) for (const i of st) w.setRoad(i % W, Math.floor(i / W), ROAD_STREET);
    const mid = streets[Math.floor(streets.length / 2)], end = mid[mid.length - 1];
    for (const kind of [BUILDING_POWER_PLANT, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT]) {
      const at = findLot(w, end % W, Math.floor(end / W), 6);
      if (at) w.placeBuilding(at.x, at.y, kind, 0);
    }
    const zoned: number[] = [];
    for (const st of streets) for (const i of st) for (const side of [step(i, d), step(i, -d)]) {
      if (empty(side) && w.setZone(side % W, Math.floor(side / W), ZONE_I)) zoned.push(side);
    }
    w.grid.markAllDirty();
    return zoned;
  }
  return null;
}

/**
 * A surface line as a player would build one where the city has no track: ground track from the rail point to a
 * straight station near the jobs (with a street along it), then on to up to two more, each at least 16 tiles from the
 * others. The track laid, the stations, and the street tiles within a few tiles of them; null if no station site
 * could be reached.
 */
function buildRailLine(w: World, point: number): { track: number[]; stations: number; near: number[] } | null {
  const W = w.grid.width;
  const cands = cityStations(w).slice(0, 600);
  const track: number[] = [], placed: { x: number; y: number }[] = [];
  let prev = point;
  // Each stop: the best site (nearest the jobs) at least 16 tiles from the others that the track can reach from
  // the line so far; up to 25 sites tried a stop.
  while (placed.length < 3) {
    let tries = 0, found = false;
    for (const s of cands) {
      if (tries >= 25) break;
      if (!placed.every(p => Math.abs(p.x - s.x) + Math.abs(p.y - s.y) >= 16)) continue;
      if (!w.checkPlacement(s.x, s.y, BUILDING_STATION, 0).ok) continue;
      tries++;
      if (!w.placeBuilding(s.x, s.y, BUILDING_STATION, 0)) continue;
      const e = stationEnds(w, s);
      const dist = (i: number) => Math.abs(i % W - prev % W) + Math.abs(Math.floor(i / W) - Math.floor(prev / W));
      const [enter, exit] = dist(e.west) <= dist(e.east) ? [e.west, e.east] : [e.east, e.west];
      const path = trackPath(w, prev, enter);
      if (path && layPath(w, path)) { track.push(...path); placed.push(s); prev = exit; found = true; break; }
      w.clearTile(s.x, s.y);
    }
    if (!found) break;
  }
  const stations = placed.length;
  if (!stations) return null;
  w.grid.markAllDirty();
  const near = new Set<number>();
  for (const s of placed.slice(0, stations)) for (let dy = -3; dy <= 4; dy++) for (let dx = -3; dx <= 5; dx++) {
    const x = s.x + dx, y = s.y + dy;
    if (x < 0 || y < 0 || x >= W || y >= w.grid.height) continue;
    const i = y * W + x, rc = w.layers.roadClass[i];
    if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) near.add(i);
  }
  return { track, stations, near: [...near] };
}

/** Lay ground track along the plan, clearing zoned lots in the way. Developed lots cleared, or null if the track would not go. */
function layRail(w: World, p: Plan): number | null {
  const L = w.layers;
  let cleared = 0;
  for (const i of p.path) {
    if (L.zone[i] !== ZONE_NONE && L.roadClass[i] === ROAD_NONE) { if (L.devLevel[i] > 0) cleared++; w.razeLot(i); L.zone[i] = ZONE_NONE; }
    if (!(L.rail[i] & RAIL_GROUND) && !w.layTrack(i % w.grid.width, Math.floor(i / w.grid.width))) return null;
  }
  w.grid.markAllDirty();
  return cleared;
}

/** Run `days`, then measure one day: peak loads at `watch` road tiles, peak track load on `track`, jammed road tiles, per-tick trade at `points`. */
function play(w: World, days: number, watch: number[], track: number[], points: number[]) {
  const sim = startSim(w);
  sim.tick(days * D);
  const peak = watch.map(() => 0);
  let trackPeak = 0, jammed = 0, exports = 0;
  const trade = points.map(() => ({ visitorsIn: 0, dayTrippers: 0, trucks: 0, residentsOut: 0 }));
  const L = w.layers;
  for (let t = 0; t < D; t++) {
    sim.tick(1);
    exports += connectionExportIncome(w);
    const d = w.traffic;
    if (!d) continue;
    const load = (i: number) => trafficVolume(d, i) / roadCapacity(L.roadClass[i]);
    watch.forEach((i, k) => { peak[k] = Math.max(peak[k], load(i)); });
    for (const i of track) trackPeak = Math.max(trackPeak, railLoad(d, i));
    let j = 0;
    for (let k = 0; k < w.index.roadCount; k++) if (load(w.index.roads[k]) >= 1) j++;
    jammed = Math.max(jammed, j);
    points.forEach((i, k) => {
      const tr = connectionTradeAt(w, i);
      if (!tr) return;
      const p = trade[k];
      p.visitorsIn += tr.visitorsIn / D; p.dayTrippers += tr.dayTrippers / D; p.trucks += tr.exports / D; p.residentsOut += tr.residentsOut / D;
    });
  }
  return { peak, trackPeak, jammed, exportIncomePerDay: exports, trade, industry: industryLevels(w) };
}

/** The connections probes on a saved city (copies; the city is left as it was). */
export function connectionsResult(world: World, days = 10, exportDays = 30): ConnectionsResult {
  const start = cloneWorld(world);
  startSim(start).tick(2 * D);
  const population = start.stats.population;
  const L = start.layers;
  const status = connectionStatus(start);
  const highways = status.filter((c) => c.kind === 'highway' && !c.joined)
    .map((c) => joinPath(start, c.tile, (j) => L.roadClass[j] !== ROAD_NONE)).filter((p): p is Plan => p !== null)
    .sort((a, b) => a.path.length - b.path.length);
  const rails = status.filter((c) => c.kind === 'rail' && !c.joined)
    .map((c) => joinPath(start, c.tile, (j) => (L.rail[j] & RAIL_GROUND) !== 0, true)).filter((p): p is Plan => p !== null)
    .sort((a, b) => a.path.length - b.path.length);
  if (highways.length === 0 && rails.length === 0) return { population, note: 'no connection point can be joined' };

  const meets = highways.slice(0, 2).map((p) => p.meets);
  // No ground track to join: plan a surface line on a copy first, so the base run watches its station streets too.
  const railPoint = status.find((c) => c.kind === 'rail' && !c.joined);
  const line = rails.length === 0 && railPoint ? (() => { const w = cloneWorld(start); const l = buildRailLine(w, railPoint.tile); return l ? { w, ...l } : null; })() : null;
  const base = play(cloneWorld(start), days, [...meets, ...(line?.near ?? [])], [], []);
  const result: ConnectionsResult = { population };
  const run = (k: number, r: ReturnType<typeof play>, at: number): HighwayRun => ({
    meetsClass: L.roadClass[highways[k].meets], meetBefore: r2(base.peak[k]), meetPeak: r2(r.peak[at]),
    visitorsIn: r2(r.trade[at].visitorsIn), dayTrippers: r2(r.trade[at].dayTrippers), trucks: r2(r.trade[at].trucks), residentsOut: r2(r.trade[at].residentsOut),
  });
  if (highways.length > 0) {
    const w1 = cloneWorld(start);
    layHighways(w1, [highways[0]]);
    const one = play(w1, days, [highways[0].meets], [], [highways[0].path[0]]);
    result.one = { ...run(0, one, 0), exportIncomePerDay: Math.round(one.exportIncomePerDay) };
    result.industry = { base: base.industry, one: one.industry };
    if (!(result.one.trucks > 0)) {
      const we = cloneWorld(start);
      layHighways(we, [highways[0]]);
      const zoned = buildExportDistrict(we, highways[0]);
      if (!zoned) result.exportsBuilt = { note: 'no room for an industry district by the point' };
      else {
        const ex = play(we, exportDays, [], [], [highways[0].path[0]]);
        let levels = 0;
        for (const i of zoned) if (we.layers.zone[i] === ZONE_I && !we.layers.abandoned[i]) levels += we.layers.devLevel[i];
        result.exportsBuilt = { levels, trucks: r2(ex.trade[0].trucks), exportIncomePerDay: Math.round(ex.exportIncomePerDay) };
      }
    }
  }
  if (highways.length > 1) {
    const w2 = cloneWorld(start);
    layHighways(w2, highways.slice(0, 2));
    const two = play(w2, days, meets, [], [highways[0].path[0], highways[1].path[0]]);
    result.two = [run(0, two, 0), run(1, two, 1)];
  }
  if (highways.length > 0 && population >= 20000 && cityPull(start) === 0) {
    const wa = cloneWorld(start);
    const placed = placeAttractions(wa);
    if (placed > 0) {
      const aBase = play(cloneWorld(wa), days, meets, [], []);
      const aRun = (k: number, r: ReturnType<typeof play>, at: number): HighwayRun => ({ ...run(k, r, at), meetBefore: r2(aBase.peak[k]) });
      const w1 = cloneWorld(wa);
      layHighways(w1, [highways[0]]);
      result.withAttractions = { placed, one: aRun(0, play(w1, days, [highways[0].meets], [], [highways[0].path[0]]), 0) };
      if (highways.length > 1) {
        const w2 = cloneWorld(wa);
        layHighways(w2, highways.slice(0, 2));
        const two = play(w2, days, meets, [], [highways[0].path[0], highways[1].path[0]]);
        result.withAttractions.two = [aRun(0, two, 0), aRun(1, two, 1)];
      }
    }
  }
  if (rails.length === 0) {
    if (!railPoint) result.rail = { note: 'no rail point' };
    else if (!line) result.rail = { note: 'no ground track to join, and no line could be built from the rail point to a station site' };
    else if (!openRails(line.w).length) result.rail = { note: 'the line built reaches no station with a road' };
    else {
      const r = play(line.w, days, line.near, line.track, [railPoint.tile]);
      const t = r.trade[0], before = base.peak.slice(meets.length);
      result.rail = {
        inPerTick: r2(t.visitorsIn + t.dayTrippers), trackPeak: r2(r.trackPeak), jammedBefore: base.jammed, jammedAfter: r.jammed, cleared: 0,
        built: {
          stations: line.stations, trackTiles: line.track.length, nearStreets: line.near.length,
          nearPeakBefore: r2(Math.max(0, ...before)), nearPeakAfter: r2(Math.max(0, ...r.peak)),
          nearJammedBefore: before.filter((x) => x >= 1).length, nearJammedAfter: r.peak.filter((x) => x >= 1).length,
        },
      };
    }
  } else {
    const wr = cloneWorld(start);
    const cleared = layRail(wr, rails[0]);
    if (cleared === null) result.rail = { note: 'the track would not go' };
    else if (!openRails(wr).length) result.rail = { note: 'the joined track reaches no station with a road' };
    else {
      const r = play(wr, days, [], rails[0].path, [rails[0].path[0]]);
      const t = r.trade[0];
      result.rail = { inPerTick: r2(t.visitorsIn + t.dayTrippers), trackPeak: r2(r.trackPeak), jammedBefore: base.jammed, jammedAfter: r.jammed, cleared };
    }
  }
  return result;
}
