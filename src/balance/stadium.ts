// Balance Lab: the stadium suite (owner-approved targets, 2026-11-20). Not part of the game.
//
// On each saved city big enough to build one: the stadium on free land as near
// the middle of the homes as it fits, with a free ring round it and a street
// touching that ring. Three runs of `events` events each:
//   AS IS     the city's streets untouched, against a twin with no stadium
//             (the crowd, the jam it makes, what it costs and what lasts);
//   AVENUES   every street within `AVENUE_RADIUS` tiles made an avenue;
//   PREPARED  what a player does after watching an event, twice: the avenues,
//             every street the first event's crowd jammed (anywhere: the jam
//             forms where routes from across the city meet, often 20–40 tiles
//             out) made an avenue, then every street still jammed once that is
//             done (one more event) as well, an avenue ring round the stadium and avenue spurs
//             straight out from each side to the nearest road (more ways in).
//   RAIL      PREPARED plus a subway (owner 2026-11-20: show the jam can be
//             solved): two stations by the stadium, and a line from each end of
//             them into each quarter round the stadium that had homes stuck
//             (east, west, south, north), to the middle of its homes: where the fans come from;
//             then, after one more event, the streets the crowd jams with the rail in (round the
//             far stations, often) made avenues too.
// The stadium.* targets (targets.ts) read the result.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_NONE, BUILDING_STADIUM, ROAD_AVENUE, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_NONE, ZONE_R } from '../sim/constants';
import { footprintTiles } from '../sim/buildingShapes';
import { eventOn, eventIntensity, eventTicketIncome, eventVenue, stuckInEventJam, type EventResult } from '../sim/eventDays';
import { railLoad, railNode, roadCapacity, trafficVolume } from '../sim/TrafficData';
import { pcCap } from '../sim/politics';
import { BUILDING_SUBWAY_STATION, RAIL_SUBWAY } from '../sim/constants';
import { trackBlocker } from '../sim/rail';
import { cloneWorld, startSim } from './world';

/** Streets made avenues within this many tiles of the stadium (AVENUES and PREPARED). */
export const AVENUE_RADIUS = 10;
/** The crowd's jam is measured on streets and avenues within this many tiles. */
export const JAM_RADIUS = 12;
const SPUR_MAX = 20;
const YEAR_DAYS = 360;
const SETTLE = 2 * BALANCE.ticksPerDay;

export interface StadiumRun {
  events: Pick<EventResult, 'wanted' | 'arrived' | 'stuckResidents' | 'pc' | 'declined'>[];
  /** Mean political capital an event cost ÷ the city's PC cap. */
  pcShare: number;
  /** Mean best turnout ÷ seats. */
  fill: number;
  /** Mean fans who wanted to come at the peak ÷ seats. */
  wantedShare: number;
  /** Tickets less the stadium's upkeep, a game day, over whole event cycles (start of the first event to the start of the last). */
  netPerDay: number | null;
  /** Residents stuck at the peak of the first event, by distance from the stadium (tiles): ≤5, ≤10, ≤20, ≤40, further. */
  stuckBy: number[];
  /** At that peak: the most fans on any tile of subway track, and the most load (riders ÷ capacity) on one. */
  railFans: number;
  railLoad: number;
}

export interface StadiumResult {
  population: number;
  cap: number;
  site: { x: number; y: number } | null;
  note?: string;
  asIs?: StadiumRun & {
    /** Best share, over the peak's traffic passes, of streets and avenues within JAM_RADIUS the crowd alone takes over capacity. */
    jam: number;
    /** Two days after the last event, against the twin: residents (share) and PC (share of the cap). */
    residents: number;
    pc: number;
  };
  avenues?: StadiumRun & { pcCut: number | null };
  prepared?: StadiumRun & { pcCut: number | null; paybackYears: number | null };
  /** PREPARED plus rail: the lines laid (track tiles each), what it saves and fills. */
  rail?: StadiumRun & { pcCut: number | null; lines: number[] } | { note: string };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const isRoad = (w: World, i: number) => w.layers.roadClass[i] !== ROAD_NONE && w.layers.roadClass[i] !== ROAD_HIGHWAY;
const free = (w: World, i: number) => w.layers.terrain[i] !== TERRAIN_WATER && w.layers.building[i] === BUILDING_NONE && w.layers.roadClass[i] === ROAD_NONE && w.layers.devLevel[i] === 0 && w.layers.zone[i] === ZONE_NONE && w.layers.rail[i] === 0;

interface Site { x: number; y: number; foot: number[]; ring: number[] }

/** The stadium's tiles, its bounding box and the ring of tiles one step outside the box (plus the box's corners it leaves empty). */
function geometry(w: World, x: number, y: number): Site | null {
  const { width, height } = w.grid;
  const foot = footprintTiles(width, height, x, y, BUILDING_STADIUM, 0);
  if (!foot) return null;
  const fs = new Set(foot);
  const xs = foot.map(i => i % width), ys = foot.map(i => (i - (i % width)) / width);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  if (x0 < 0 || y0 < 0 || x1 >= width || y1 >= height) return null;
  const ring: number[] = [];
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const i = yy * width + xx; if (!fs.has(i)) ring.push(i); }
  return { x, y, foot, ring };
}

function bestSite(w: World): Site | null {
  const { width, height } = w.grid;
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < w.layers.zone.length; k++) if (w.layers.zone[k] === ZONE_R && w.layers.devLevel[k] >= 2) { sx += k % width; sy += Math.floor(k / width); n++; }
  if (!n) return null;
  const cx = sx / n, cy = sy / n;
  let best: Site | null = null, bd = Infinity;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const d = Math.abs(x + 2 - cx) + Math.abs(y + 2 - cy);
    if (d >= bd) continue;
    const g = geometry(w, x, y);
    if (!g || !g.foot.every(i => free(w, i)) || !g.ring.every(i => free(w, i) || (isRoad(w, i) && w.layers.rail[i] === 0))) continue;
    if (!g.ring.some(i => isRoad(w, i)) || !w.checkPlacement(x, y, BUILDING_STADIUM, 0).ok) continue;
    best = g; bd = d;
  }
  return best;
}

// ── Rail ─────────────────────────────────────────────────────────────────────
// A subway, since a city that needs this is too built up for ground track: a
// station entrance is one tile (a home or shop lot is cleared for it, as a
// player would), its platform runs west–east underneath, and the tunnel goes
// under anything.

const STATION_NEAR = 8;      // the stadium's station: its entrance within this many tiles of the stadium
const STATION_FAR = 15;      // the other stations: at least this far from the stadium's
const FAR_TRIES = 8;

/** Subway entrances (platform west–east at rot 0, north–south at rot 1) beside a street, on land with no building, road or merged lot, nearest (cx, cy) first; none on `keep`. */
function entranceSites(w: World, cx: number, cy: number, keep: Set<number>, rot: number): { x: number; y: number; d: number }[] {
  const { width, height } = w.grid;
  const [ax, ay] = rot === 0 ? [1, 0] : [0, 1];
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = 3; y < height - 3; y++) for (let x = 3; x < width - 3; x++) {
    const i = y * width + x;
    if (keep.has(i) || w.layers.terrain[i] === TERRAIN_WATER || w.layers.building[i] !== BUILDING_NONE || w.layers.roadClass[i] !== ROAD_NONE || w.layers.lot[i] !== 0) continue;
    if (![i - 1, i + 1, i - width, i + width].some(j => isRoad(w, j))) continue;
    let ok = true;
    for (let k = -2; k <= 2 && ok; k++) if (trackBlocker(w, x + k * ax, y + k * ay, RAIL_SUBWAY) !== null) ok = false;
    if (!ok || !w.checkPlacement(x, y, BUILDING_SUBWAY_STATION, rot).ok) continue;
    out.push({ x, y, d: Math.max(Math.abs(x - cx), Math.abs(y - cy)) });
  }
  return out.sort((a, b) => a.d - b.d);
}

/** The shortest tunnel from tile a to tile b (both included) where subway track may go. */
function tunnel(w: World, a: number, b: number): number[] | null {
  const { width, height } = w.grid;
  const prev = new Int32Array(width * height).fill(-2);
  prev[a] = -1;
  let q = [a];
  while (q.length) {
    const nq: number[] = [];
    for (const i of q) {
      if (i === b) { const path: number[] = []; for (let k = i; k >= 0; k = prev[k]) path.push(k); return path.reverse(); }
      const x = i % width, y = (i - x) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = yy * width + xx;
        if (prev[j] !== -2 || (j !== b && trackBlocker(w, xx, yy, RAIL_SUBWAY) !== null)) continue;
        prev[j] = i; nq.push(j);
      }
    }
    q = nq;
  }
  return null;
}

// The four lines: out of the west–east station's east and west ends, and the north–south station's south and north ends.
const SIDES = [
  { name: 'east', rot: 0, dir: [1, 0] }, { name: 'west', rot: 0, dir: [-1, 0] },
  { name: 'south', rot: 1, dir: [0, 1] }, { name: 'north', rot: 1, dir: [0, -1] },
] as const;

/**
 * Two subway stations by the stadium (platforms west–east and north–south) and
 * up to four lines, one into each quarter round the stadium that had homes stuck
 * (east, west, south, north), to a station at the middle of that quarter's homes, on `w` before the stadium is
 * placed. Track tiles of each line laid.
 */
function railPlan(w: World, s: Site, stuck: number[], why: string[] = []): number[] {
  const { width } = w.grid;
  const keep = new Set([...s.foot, ...s.ring]);
  const xs = s.foot.map(i => i % width), ys = s.foot.map(i => (i - (i % width)) / width);
  const sx = (Math.min(...xs) + Math.max(...xs)) / 2, sy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const hub: Record<number, { x: number; y: number }> = {};
  for (const rot of [0, 1]) {
    const site = entranceSites(w, sx, sy, keep, rot).find(p => p.d <= STATION_NEAR + 3);
    if (site && w.placeBuilding(site.x, site.y, BUILDING_SUBWAY_STATION, rot)) hub[rot] = site;
    else why.push(`no ${rot ? 'north–south' : 'west–east'} station site by the stadium`);
  }
  // Each stuck home goes to the quarter its direction from the stadium is nearest.
  const quarter = (i: number) => { const dx = i % width - sx, dy = (i - (i % width)) / width - sy; return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'east' : 'west') : (dy >= 0 ? 'south' : 'north'); };
  const lines: number[] = [];
  for (const side of SIDES) {
    const home = hub[side.rot];
    if (!home) continue;
    // Where that quarter's fans come from: its homes STATION_FAR or more out, weighted by level.
    let gx = 0, gy = 0, wsum = 0;
    for (let q = 0; q < w.index.zonedCount; q++) {
      const i = w.index.zoned[q];
      if (w.layers.zone[i] !== ZONE_R || !w.layers.devLevel[i] || quarter(i) !== side.name) continue;
      const x = i % width, y = (i - x) / width;
      if (Math.max(Math.abs(x - sx), Math.abs(y - sy)) < STATION_FAR) continue;
      gx += x * w.layers.devLevel[i]; gy += y * w.layers.devLevel[i]; wsum += w.layers.devLevel[i];
    }
    if (stuck.filter(i => quarter(i) === side.name).length < 3 || wsum === 0) { why.push(`${side.name}: no stuck homes or no homes out there`); continue; }
    gx /= wsum; gy /= wsum;
    const start = w.grid.idx(home.x + 2 * side.dir[0], home.y + 2 * side.dir[1]);
    let tried = 0, laid = false;
    for (const far of entranceSites(w, gx, gy, keep, side.rot).filter(p => Math.max(Math.abs(p.x - home.x), Math.abs(p.y - home.y)) >= STATION_FAR).slice(0, FAR_TRIES)) {
      tried++;
      const end = w.grid.idx(far.x - 2 * side.dir[0], far.y - 2 * side.dir[1]);
      const path = tunnel(w, start, end);
      if (!path || !w.placeBuilding(far.x, far.y, BUILDING_SUBWAY_STATION, side.rot)) continue;
      if (!path.every(i => (w.layers.rail[i] & RAIL_SUBWAY) !== 0 || w.layTrack(i % width, (i - (i % width)) / width, RAIL_SUBWAY))) { why.push(`${side.name}: tunnel refused`); break; }
      lines.push(path.length);
      laid = true;
      break;
    }
    if (!laid) why.push(`${side.name}: ${tried} far sites tried`);
  }
  return lines;
}

function avenues(w: World, s: Site): void {
  const { width, height } = w.grid;
  const xs = s.foot.map(i => i % width), ys = s.foot.map(i => (i - (i % width)) / width);
  for (let y = Math.max(0, Math.min(...ys) - AVENUE_RADIUS); y <= Math.min(height - 1, Math.max(...ys) + AVENUE_RADIUS); y++)
    for (let x = Math.max(0, Math.min(...xs) - AVENUE_RADIUS); x <= Math.min(width - 1, Math.max(...xs) + AVENUE_RADIUS); x++)
      if (w.layers.roadClass[y * width + x] === ROAD_STREET) w.setRoad(x, y, ROAD_AVENUE);
}

/** The ring as avenue, and from the middle of each side an avenue straight out to the first road (if one is within SPUR_MAX over free land). */
function prepare(w: World, s: Site, jammed: Set<number>): void {
  const { width, height } = w.grid;
  avenues(w, s);
  for (const i of jammed) if (w.layers.roadClass[i] === ROAD_STREET) w.setRoad(i % width, (i - (i % width)) / width, ROAD_AVENUE);
  for (const i of s.ring) w.setRoad(i % width, (i - (i % width)) / width, ROAD_AVENUE);
  const xs = s.ring.map(i => i % width), ys = s.ring.map(i => (i - (i % width)) / width);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
  for (const [sx, sy, dx, dy] of [[mx, y0, 0, -1], [mx, y1, 0, 1], [x0, my, -1, 0], [x1, my, 1, 0]]) {
    const path: [number, number][] = [];
    for (let k = 1; k <= SPUR_MAX; k++) {
      const x = sx + dx * k, y = sy + dy * k;
      if (x < 0 || y < 0 || x >= width || y >= height) break;
      const i = y * width + x;
      if (isRoad(w, i)) { for (const [px, py] of path) w.setRoad(px, py, ROAD_AVENUE); if (w.layers.roadClass[i] === ROAD_STREET) w.setRoad(x, y, ROAD_AVENUE); break; }
      if (!free(w, i)) break;
      path.push([x, y]);
    }
  }
}

/** Share of streets and avenues near the stadium the crowd alone takes over capacity, on the last traffic pass. */
function crowdJam(w: World, s: Site): number {
  const t = w.traffic;
  if (!t) return 0;
  const { width, height } = w.grid;
  const xs = s.foot.map(i => i % width), ys = s.foot.map(i => (i - (i % width)) / width);
  let roads = 0, over = 0;
  for (let y = Math.max(0, Math.min(...ys) - JAM_RADIUS); y <= Math.min(height - 1, Math.max(...ys) + JAM_RADIUS); y++)
    for (let x = Math.max(0, Math.min(...xs) - JAM_RADIUS); x <= Math.min(width - 1, Math.max(...xs) + JAM_RADIUS); x++) {
      const i = y * width + x;
      if (!isRoad(w, i)) continue;
      roads++;
      const cap = roadCapacity(w.layers.roadClass[i]), v = trafficVolume(t, i);
      if (v >= cap && v - t.event.volume[i] < cap) over++;
    }
  return roads > 0 ? over / roads : 0;
}

/** Streets anywhere that the event's jam rule counts (at `jam.load` of capacity, the crowd `jam.eventShare` of it), on the last pass. */
function jammedStreets(w: World, into: Set<number>): void {
  const t = w.traffic;
  if (!t) return;
  const jam = BALANCE.leisure.event.jam;
  for (let k = 0; k < w.index.roadCount; k++) {
    const i = w.index.roads[k];
    if (w.layers.roadClass[i] !== ROAD_STREET) continue;
    const cap = roadCapacity(ROAD_STREET);
    if (trafficVolume(t, i) >= jam.load * cap && t.event.volume[i] >= jam.eventShare * cap) into.add(i);
  }
}

interface Played { run: StadiumRun; jam: number; jammed: Set<number>; stuck: number[] }

const BANDS = [5, 10, 20, 40, Infinity];
/** Residents stuck in the event's jam on the last pass, by distance band from the stadium. */
function stuckByDistance(w: World, s: Site, tiles?: number[]): number[] {
  const { width } = w.grid;
  const xs = s.foot.map(i => i % width), ys = s.foot.map(i => (i - (i % width)) / width);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const out = BANDS.map(() => 0);
  for (let q = 0; q < w.index.zonedCount; q++) {
    const i = w.index.zoned[q];
    if (w.layers.zone[i] !== ZONE_R || !w.layers.devLevel[i] || w.layers.abandoned[i] || !stuckInEventJam(w, i)) continue;
    const x = i % width, y = (i - x) / width;
    const d = Math.max(x < x0 ? x0 - x : x > x1 ? x - x1 : 0, y < y0 ? y0 - y : y > y1 ? y - y1 : 0);
    out[BANDS.findIndex(b => d <= b)] += BALANCE.growth.popPerLevel[w.layers.devLevel[i]] ?? 0;
    tiles?.push(i);
  }
  return out;
}

/** Run `w` (stadium built) until `events` events have ended; `twin`, if given, ticks alongside. */
function play(w: World, s: Site, events: number, cap: number, twin?: World): Played {
  const sim = startSim(w), simT = twin ? startSim(twin) : null;
  const out: StadiumRun['events'] = [];
  const starts: number[] = [];
  const jammed = new Set<number>();
  let stuck: number[] = [], railFans = 0, railMax = 0;
  let last = w.lastEvent, was = false, jam = 0, stuckBy: number[] = BANDS.map(() => 0), tickets = 0, ticketsAtStart: number[] = [];
  const limit = BALANCE.leisure.event.firstGap + events * (BALANCE.leisure.event.duration + BALANCE.leisure.event.gapMax) + 10;
  for (let k = 0; k < limit && out.length < events; k++) {
    sim.tick(1); simT?.tick(1);
    const on = eventOn(w);
    if (on && !was) { starts.push(w.tick); ticketsAtStart.push(tickets); }
    was = on;
    tickets += eventTicketIncome(w);
    if (on && out.length === 0 && w.tick % BALANCE.transit.flowInterval === 0 && eventIntensity(w) >= 0.999) {
      const j = crowdJam(w, s);
      if (j >= jam) {
        jam = j; stuck = []; stuckBy = stuckByDistance(w, s, stuck);
        railFans = 0; railMax = 0;
        const t = w.traffic!;
        for (let k = 0; k < w.layers.rail.length; k++) if (w.layers.rail[k] & RAIL_SUBWAY) {
          railFans = Math.max(railFans, t.event.volume[railNode(t, k, RAIL_SUBWAY)]); railMax = Math.max(railMax, railLoad(t, k, RAIL_SUBWAY));
        }
      }
      jammedStreets(w, jammed);
    }
    if (w.lastEvent && w.lastEvent !== last) {
      last = w.lastEvent;
      out.push({ wanted: r3(last.wanted), arrived: r3(last.arrived), stuckResidents: last.stuckResidents, pc: r3(last.pc), declined: last.declined });
    }
  }
  // Two more days, so the homes the last event took down are counted in the population.
  if (twin) { sim.tick(SETTLE); simT!.tick(SETTLE); }
  const seats = BALANCE.leisure.event.seats || 1;
  const mean = (f: (e: StadiumRun['events'][number]) => number) => out.length ? out.reduce((a, e) => a + f(e), 0) / out.length : 0;
  let netPerDay: number | null = null;
  if (starts.length >= 2) {
    const n = starts.length - 1, ticks = starts[n] - starts[0];
    const upkeep = BALANCE.buildings[BUILDING_STADIUM]?.maintenance ?? 0;
    netPerDay = r3(((ticketsAtStart[n] - ticketsAtStart[0]) / ticks - upkeep) * BALANCE.ticksPerDay);
  }
  return { run: { events: out, pcShare: r3(mean(e => e.pc) / cap), fill: r3(mean(e => e.arrived) / seats), wantedShare: r3(mean(e => e.wanted) / seats), netPerDay, stuckBy, railFans: r3(railFans), railLoad: r3(railMax) }, jam: r3(jam), jammed, stuck };
}

/** The probe (see the top of this file) on copies of `world`. */
export function stadiumResult(saved: World, events = 3): StadiumResult {
  const world = cloneWorld(saved);
  startSim(world).tick(2 * BALANCE.ticksPerDay);
  const cap = pcCap(world);
  const res: StadiumResult = { population: world.stats.population, cap: Math.round(cap), site: null };
  if (world.stats.population < (BALANCE.leisure.kinds[BUILDING_STADIUM]?.unlockPopulation ?? 0)) return { ...res, note: 'too small for a stadium' };
  const s = bestSite(world);
  if (!s) return { ...res, note: 'no free site with a road beside it' };
  res.site = { x: s.x, y: s.y };
  const build = (prep?: (w: World) => void): World | null => {
    const w = cloneWorld(world);
    prep?.(w);
    return w.placeBuilding(s.x, s.y, BUILDING_STADIUM, 0) && eventVenue(w).roads.length > 0 ? w : null;
  };
  const a = build(), twin = cloneWorld(world);
  if (!a) return { ...res, note: 'placement refused' };
  const p0 = twin.stats.population, pc0a = a.budget.politicalCapital, pc0t = twin.budget.politicalCapital;
  const asIs = play(a, s, events, cap, twin);
  res.asIs = {
    ...asIs.run, jam: asIs.jam,
    residents: r3((a.stats.population - twin.stats.population) / Math.max(1, p0)),
    pc: r3(((a.budget.politicalCapital - pc0a) - (twin.budget.politicalCapital - pc0t)) / cap),
  };
  const cut = (r: StadiumRun) => asIs.run.pcShare > 0 ? r3(1 - r.pcShare / asIs.run.pcShare) : null;
  const av = build(w => avenues(w, s));
  if (av) { const r = play(av, s, events, cap).run; res.avenues = { ...r, pcCut: cut(r) }; }
  // A second look: the jam the first fix left (one event with it), fixed too.
  const look = build(w => prepare(w, s, asIs.jammed));
  const seen = new Set(asIs.jammed);
  if (look) for (const i of play(look, s, 1, cap).jammed) seen.add(i);
  const pr = build(w => prepare(w, s, seen));
  if (pr) {
    const r = play(pr, s, events, cap).run;
    const cost = BALANCE.buildings[BUILDING_STADIUM]?.cost ?? 0;
    res.prepared = { ...r, pcCut: cut(r), paybackYears: r.netPerDay !== null && r.netPerDay > 0 ? r3(cost / r.netPerDay / YEAR_DAYS) : null };
  }
  let lines: number[] = [];
  const why: string[] = [];
  const withRail = (jams: Set<number>) => build(w => { why.length = 0; lines = railPlan(w, s, asIs.stuck, why); prepare(w, s, jams); });
  // The rail moves the jam (to the far stations' streets): one more look, and those streets fixed too.
  const railLook = withRail(seen), railSeen = new Set(seen);
  if (railLook && lines.length) for (const i of play(railLook, s, 1, cap).jammed) railSeen.add(i);
  const rl = withRail(railSeen);
  if (!rl || !lines.length) res.rail = { note: rl ? `no line could be laid: ${why.join('; ')}` : 'placement refused' };
  else { const r = play(rl, s, events, cap).run; res.rail = { ...r, pcCut: cut(r), lines }; }
  return res;
}
