// Balance Lab: the stadium suite (owner, 2026-11-20: toned down; replaces the
// "real teeth" targets of #444). Not part of the game.
//
// On each saved city big enough to build one: the stadium on free land as near
// the middle of the homes as it fits, with a free ring round it and a street
// touching that ring (room a player would leave). Two runs of `events` events:
//   AS BUILT   the city's roads and rail as the player left them;
//   ONE LINE   plus one subway line: a station by the stadium and one at the
//              middle of the biggest quarter of homes round it (a subway, since
//              these cities are too built up for ground track; each one-tile
//              entrance clears a home or shop lot, as a player would). No
//              avenues, rings or spurs: an ordinary network with a station at
//              the stadium should cope (owner 2026-11-20).
// The stadium.* targets (targets.ts) read the result.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_NONE, BUILDING_STADIUM, BUILDING_SUBWAY_STATION, RAIL_SUBWAY, ROAD_HIGHWAY, ROAD_NONE, TERRAIN_WATER, ZONE_NONE, ZONE_R } from '../sim/constants';
import { footprintTiles } from '../sim/buildingShapes';
import { eventOn, eventTicketIncome, eventVenue, type EventResult } from '../sim/eventDays';
import { trackBlocker } from '../sim/rail';
import { pcCap } from '../sim/politics';
import { cloneWorld, startSim } from './world';

const SETTLE = 2 * BALANCE.ticksPerDay;

export interface StadiumRun {
  events: Pick<EventResult, 'wanted' | 'arrived' | 'stuckResidents' | 'pc' | 'declined' | 'smooth' | 'reward'>[];
  /** Mean fans who wanted to come at the peak ÷ seats, and mean best turnout ÷ seats. */
  wantedShare: number;
  fill: number;
  /** Mean residents stuck (a bad event for their home) ÷ the population. */
  stuckShare: number;
  /** Mean political capital an event cost (the jam), earned (a smooth event) and the net, each ÷ the PC cap. */
  pcLoss: number;
  pcReward: number;
  pcNet: number;
  /** Events that went smoothly, and homes that lost a level over all of them. */
  smooth: number;
  declined: number;
  /** Tickets less the stadium's upkeep, a game day, over whole event cycles (start of the first event to the start of the last). */
  netPerDay: number | null;
}

export interface StadiumResult {
  population: number;
  cap: number;
  site: { x: number; y: number } | null;
  note?: string;
  asBuilt?: StadiumRun;
  /** ONE LINE: the line laid (track tiles), or why there is none. */
  oneLine?: StadiumRun & { line: number } | { note: string };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const isRoad = (w: World, i: number) => w.layers.roadClass[i] !== ROAD_NONE && w.layers.roadClass[i] !== ROAD_HIGHWAY;
const free = (w: World, i: number) => w.layers.terrain[i] !== TERRAIN_WATER && w.layers.building[i] === BUILDING_NONE && w.layers.roadClass[i] === ROAD_NONE && w.layers.devLevel[i] === 0 && w.layers.zone[i] === ZONE_NONE && w.layers.rail[i] === 0;

interface Site { x: number; y: number; foot: number[]; ring: number[] }

/** The stadium's tiles, and the ring of tiles one step outside its bounding box (plus the box's corners it leaves empty). */
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

// ── One subway line ──────────────────────────────────────────────────────────

const STATION_NEAR = 8;      // the stadium's station: its entrance within this many tiles of the stadium
const STATION_FAR = 15;      // the other station: at least this far from the stadium's
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

const SIDES = [
  { name: 'east', rot: 0, dir: [1, 0] }, { name: 'west', rot: 0, dir: [-1, 0] },
  { name: 'south', rot: 1, dir: [0, 1] }, { name: 'north', rot: 1, dir: [0, -1] },
] as const;

/**
 * One subway line on `w` (before the stadium is placed): a station by the
 * stadium and one at the middle of the quarter round it (east, west, south or
 * north) with the most home levels STATION_FAR or more out. Track tiles laid, 0 if none.
 */
function oneLinePlan(w: World, s: Site, why: string[]): number {
  const { width } = w.grid;
  const keep = new Set([...s.foot, ...s.ring]);
  const xs = s.foot.map(i => i % width), ys = s.foot.map(i => (i - (i % width)) / width);
  const sx = (Math.min(...xs) + Math.max(...xs)) / 2, sy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const quarter = (x: number, y: number) => { const dx = x - sx, dy = y - sy; return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'east' : 'west') : (dy >= 0 ? 'south' : 'north'); };
  const mass: Record<string, { x: number; y: number; w: number }> = {};
  for (let q = 0; q < w.index.zonedCount; q++) {
    const i = w.index.zoned[q];
    if (w.layers.zone[i] !== ZONE_R || !w.layers.devLevel[i]) continue;
    const x = i % width, y = (i - x) / width;
    if (Math.max(Math.abs(x - sx), Math.abs(y - sy)) < STATION_FAR) continue;
    const m = (mass[quarter(x, y)] ??= { x: 0, y: 0, w: 0 }), lv = w.layers.devLevel[i];
    m.x += x * lv; m.y += y * lv; m.w += lv;
  }
  for (const side of [...SIDES].sort((a, b) => (mass[b.name]?.w ?? 0) - (mass[a.name]?.w ?? 0))) {
    const m = mass[side.name];
    if (!m) continue;
    const home = entranceSites(w, sx, sy, keep, side.rot).find(p => p.d <= STATION_NEAR + 3);
    if (!home) { why.push(`${side.name}: no station site by the stadium`); continue; }
    const start = w.grid.idx(home.x + 2 * side.dir[0], home.y + 2 * side.dir[1]);
    const hubKeep = new Set(keep);
    for (let k = -2; k <= 2; k++) hubKeep.add(w.grid.idx(home.x + k * (side.rot ? 0 : 1), home.y + k * (side.rot ? 1 : 0)));
    for (const far of entranceSites(w, m.x / m.w, m.y / m.w, hubKeep, side.rot).filter(p => Math.max(Math.abs(p.x - home.x), Math.abs(p.y - home.y)) >= STATION_FAR).slice(0, FAR_TRIES)) {
      const end = w.grid.idx(far.x - 2 * side.dir[0], far.y - 2 * side.dir[1]);
      const path = tunnel(w, start, end);
      if (!path) continue;
      if (!w.placeBuilding(home.x, home.y, BUILDING_SUBWAY_STATION, side.rot)) break;
      if (!w.placeBuilding(far.x, far.y, BUILDING_SUBWAY_STATION, side.rot)) { why.push('far station refused'); return 0; }
      if (!path.every(i => (w.layers.rail[i] & RAIL_SUBWAY) !== 0 || w.layTrack(i % width, (i - (i % width)) / width, RAIL_SUBWAY))) { why.push('tunnel refused'); return 0; }
      return path.length;
    }
    why.push(`${side.name}: no line`);
  }
  return 0;
}

// ── Running events ───────────────────────────────────────────────────────────

/** Run `w` (stadium built) until `events` events have ended. */
function play(w: World, events: number, cap: number): StadiumRun {
  const sim = startSim(w);
  const out: StadiumRun['events'] = [];
  const starts: number[] = [], ticketsAtStart: number[] = [];
  let last = w.lastEvent, was = false, tickets = 0, pop = 0;
  const ev = BALANCE.leisure.event;
  const limit = ev.firstGap + events * (ev.duration + ev.gapMax) + 10;
  for (let k = 0; k < limit && out.length < events; k++) {
    sim.tick(1);
    const on = eventOn(w);
    if (on && !was) { starts.push(w.tick); ticketsAtStart.push(tickets); }
    was = on;
    tickets += eventTicketIncome(w);
    if (w.lastEvent && w.lastEvent !== last) {
      last = w.lastEvent;
      pop += w.stats.population;
      out.push({ wanted: r3(last.wanted), arrived: r3(last.arrived), stuckResidents: last.stuckResidents, pc: r3(last.pc), declined: last.declined, smooth: last.smooth, reward: r3(last.reward) });
    }
  }
  sim.tick(SETTLE);
  const seats = ev.seats || 1, n = Math.max(1, out.length);
  const mean = (f: (e: StadiumRun['events'][number]) => number) => out.reduce((a, e) => a + f(e), 0) / n;
  let netPerDay: number | null = null;
  if (starts.length >= 2) {
    const m = starts.length - 1, ticks = starts[m] - starts[0];
    const upkeep = BALANCE.buildings[BUILDING_STADIUM]?.maintenance ?? 0;
    netPerDay = r3(((ticketsAtStart[m] - ticketsAtStart[0]) / ticks - upkeep) * BALANCE.ticksPerDay);
  }
  return {
    events: out, wantedShare: r3(mean(e => e.wanted) / seats), fill: r3(mean(e => e.arrived) / seats),
    stuckShare: r3(mean(e => e.stuckResidents) / Math.max(1, pop / n)),
    pcLoss: r3(mean(e => e.pc) / cap), pcReward: r3(mean(e => e.reward) / cap), pcNet: r3(mean(e => e.reward - e.pc) / cap),
    smooth: out.filter(e => e.smooth).length, declined: out.reduce((a, e) => a + e.declined, 0), netPerDay,
  };
}

/** The probe (see the top of this file) on copies of `saved`. */
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
  const a = build();
  if (!a) return { ...res, note: 'placement refused' };
  res.asBuilt = play(a, events, cap);
  let line = 0;
  const why: string[] = [];
  const l = build(w => { line = oneLinePlan(w, s, why); });
  res.oneLine = !l || !line ? { note: l ? `no line could be laid: ${why.join('; ')}` : 'placement refused' } : { ...play(l, events, cap), line };
  return res;
}
