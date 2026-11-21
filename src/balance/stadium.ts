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
// The stadium.* targets (targets.ts) read the result.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_NONE, BUILDING_STADIUM, ROAD_AVENUE, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_NONE, ZONE_R } from '../sim/constants';
import { footprintTiles } from '../sim/buildingShapes';
import { eventOn, eventIntensity, eventTicketIncome, eventVenue, stuckInEventJam, type EventResult } from '../sim/eventDays';
import { roadCapacity, trafficVolume } from '../sim/TrafficData';
import { pcCap } from '../sim/politics';
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

interface Played { run: StadiumRun; jam: number; jammed: Set<number> }

const BANDS = [5, 10, 20, 40, Infinity];
/** Residents stuck in the event's jam on the last pass, by distance band from the stadium. */
function stuckByDistance(w: World, s: Site): number[] {
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
  }
  return out;
}

/** Run `w` (stadium built) until `events` events have ended; `twin`, if given, ticks alongside. */
function play(w: World, s: Site, events: number, cap: number, twin?: World): Played {
  const sim = startSim(w), simT = twin ? startSim(twin) : null;
  const out: StadiumRun['events'] = [];
  const starts: number[] = [];
  const jammed = new Set<number>();
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
      if (j >= jam) { jam = j; stuckBy = stuckByDistance(w, s); }
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
  return { run: { events: out, pcShare: r3(mean(e => e.pc) / cap), fill: r3(mean(e => e.arrived) / seats), wantedShare: r3(mean(e => e.wanted) / seats), netPerDay, stuckBy }, jam: r3(jam), jammed };
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
  return res;
}
