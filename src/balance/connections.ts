// Connections suite (CONNECTIONS_DESIGN.md, phase 5): join a saved city's outside connections the
// way a player would and see what comes through. On copies of the city, each run `days` long and
// then one measured day:
//   base    nothing joined (the loads and industry to compare with);
//   one     the highway point nearest the city joined by the shortest highway over empty land to
//           the nearest road;
//   two     the two nearest highway points joined;
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
import { BUILDING_NONE, RAIL_ELEVATED, RAIL_GROUND, ROAD_HIGHWAY, ROAD_NONE, TERRAIN_WATER, ZONE_I, ZONE_NONE } from '../sim/constants';
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
}

export interface ConnectionsResult {
  population: number;
  note?: string;
  /** The nearest highway point joined (absent if none can be reached). */
  one?: HighwayRun & { exportIncomePerDay: number };
  /** The two nearest joined: the first and second point. */
  two?: [HighwayRun, HighwayRun];
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
export function connectionsResult(world: World, days = 10): ConnectionsResult {
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
  const base = play(cloneWorld(start), days, meets, [], []);
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
  }
  if (highways.length > 1) {
    const w2 = cloneWorld(start);
    layHighways(w2, highways.slice(0, 2));
    const two = play(w2, days, meets, [], [highways[0].path[0], highways[1].path[0]]);
    result.two = [run(0, two, 0), run(1, two, 1)];
  }
  if (rails.length === 0) result.rail = { note: 'no rail point can be joined to the city\'s ground track' };
  else {
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
