/**
 * Trains (art/clay-set/rail2.html, the owner's picks): drawn top-down in code like the road
 * cars, ¾ of a tile a car, in the H1–H3 liveries, on the right-hand of the two tracks drawn on
 * each rail tile. Nothing is simulated: like the road cars, what runs comes from the clock and
 * the rail load (sim/TrafficData.ts `railLoad`), so it costs nothing off screen.
 *
 * The track is cut into runs: chains of tiles with exactly two joins, ended by junctions and
 * dead ends (a loop is one run). Trains are ephemeral, like the road cars (owner): passing
 * trains appear, run a short leg and fade, more of them the busier the run; at a station a
 * train appears a few tiles out, slows in, waits and pulls out, then fades.
 */
import type { World } from '../../sim/World';
import { railLinks, LINK_N, LINK_E, LINK_S, LINK_W } from '../../sim/rail';
import { railLoad } from '../../sim/TrafficData';
import { RAIL_GROUND, RAIL_SUBWAY, BUILDING_SUBWAY_STATION } from '../../sim/constants';
import { subwayPlatform } from '../../sim/buildingShapes';
import { TRACK_OFFSET } from './rail';

type Ctx = CanvasRenderingContext2D;
const SIDES = [LINK_N, LINK_E, LINK_S, LINK_W];
const STEP: Record<number, [number, number]> = { [LINK_N]: [0, -1], [LINK_E]: [1, 0], [LINK_S]: [0, 1], [LINK_W]: [-1, 0] };
const OPP: Record<number, number> = { [LINK_N]: LINK_S, [LINK_E]: LINK_W, [LINK_S]: LINK_N, [LINK_W]: LINK_E };

/** A run of track as a sampled centre line in tile units, with distance along it. */
export interface Run {
  P: [number, number][];
  D: number[];
  len: number;
  /** Tile indices along the run (for its load). */
  tiles: number[];
  /** Distance along the run of the middle of a station platform on it, if any. */
  stop: number | null;
  /** Bounding box in tiles, for culling. */
  x0: number; y0: number; x1: number; y1: number;
  seed: number;
}

function edgeMid(tx: number, ty: number, side: number): [number, number] {
  const [dx, dy] = STEP[side]; return [tx + 0.5 + dx / 2, ty + 0.5 + dy / 2];
}
/** Points across one tile from side a to side b (a straight or a quarter turn round their shared corner). */
function across(tx: number, ty: number, a: number, b: number, out: [number, number][]): void {
  const p = edgeMid(tx, ty, a), q = edgeMid(tx, ty, b);
  if (OPP[a] === b) { out.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], q); return; }
  const cx = tx + ((a | b) & LINK_E ? 1 : 0), cy = ty + ((a | b) & LINK_S ? 1 : 0);
  const A1 = Math.atan2(p[1] - cy, p[0] - cx);
  let A2 = Math.atan2(q[1] - cy, q[0] - cx);
  if (A2 - A1 > Math.PI) A2 -= 2 * Math.PI; if (A1 - A2 > Math.PI) A2 += 2 * Math.PI;
  for (let k = 0; k <= 8; k++) { const A = A1 + (A2 - A1) * k / 8; out.push([cx + 0.5 * Math.cos(A), cy + 0.5 * Math.sin(A)]); }
}

/** The subway platform tiles of every subway station (they are plain subway track otherwise). */
function subwayPlatformTiles(world: World): Set<number> {
  const out = new Set<number>(), w = world.grid.width;
  for (const b of world.buildings) if (b.kind === BUILDING_SUBWAY_STATION) for (const [dx, dy] of subwayPlatform(b.kind, b.rot ?? 0)) out.add((b.ty + dy) * w + b.tx + dx);
  return out;
}

/** Cuts one level's track (RAIL_GROUND, RAIL_ELEVATED or RAIL_SUBWAY) into runs. Pure apart from reading the world. */
export function buildRuns(world: World, level: number = RAIL_GROUND): Run[] {
  const { width, height } = world.grid, rail = world.layers.rail, n = width * height;
  const links = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (rail[i] & level) links[i] = railLinks(world, i, level);
  const subwayStops = level === RAIL_SUBWAY ? subwayPlatformTiles(world) : null;
  const isPlatform = (t: number): boolean => subwayStops ? subwayStops.has(t) : level === RAIL_GROUND && world.buildingPartRoleAt(t % width, (t - (t % width)) / width) === 'platform';
  const count = (m: number): number => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
  const used = new Uint8Array(n * 4);   // each (tile, side) walked once
  const sideIdx = (s: number): number => SIDES.indexOf(s);
  const runs: Run[] = [];
  const walk = (start: number, side: number): void => {
    // From tile `start` leave by `side`, through two-join tiles, until a junction, a dead end or back to the start.
    const pts: [number, number][] = [], tiles: number[] = [];
    let i = start, out = side, guard = 0;
    used[i * 4 + sideIdx(out)] = 1;
    let tx = i % width, ty = (i - tx) / width;
    // Half of the first tile: from its centre out (a junction or dead end starts here).
    pts.push([tx + 0.5, ty + 0.5], edgeMid(tx, ty, out)); tiles.push(i);
    for (;;) {
      const [dx, dy] = STEP[out]; tx += dx; ty += dy; const j = ty * width + tx, inn = OPP[out];
      used[j * 4 + sideIdx(inn)] = 1; tiles.push(j);
      const m = links[j];
      if (count(m) !== 2 || j === start || ++guard > n) { pts.push([tx + 0.5, ty + 0.5]); break; }
      out = m & ~inn; used[j * 4 + sideIdx(out)] = 1;
      across(tx, ty, inn, out, pts);
      i = j;
    }
    // Distances, and the middle of any platform along the run.
    const P: [number, number][] = [pts[0]], D = [0];
    for (const p of pts.slice(1)) { const q = P[P.length - 1], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < 1e-6) continue; P.push(p); D.push(D[D.length - 1] + d); }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of P) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    let stop: number | null = null, first = -1, last = -1;
    tiles.forEach((t, k) => { if (isPlatform(t)) { if (first < 0) first = k; last = k; } });
    if (first >= 0) {   // tile k's centre is about k tiles along (the first tile counts a half)
      stop = Math.min(D[D.length - 1], (first + last) / 2 + 0.0);
    }
    if (D[D.length - 1] >= 1) runs.push({ P, D, len: D[D.length - 1], tiles, stop, x0, y0, x1, y1, seed: (start * 2654435761 + sideIdx(side) * 40503) >>> 0 });
  };
  // Runs start at junctions and dead ends…
  for (let i = 0; i < n; i++) { const m = links[i]; if (!m || count(m) === 2) continue; for (const s of SIDES) if (m & s && !used[i * 4 + sideIdx(s)]) walk(i, s); }
  // …and what is left is loops.
  for (let i = 0; i < n; i++) { const m = links[i]; if (count(m) !== 2) continue; for (const s of SIDES) if (m & s && !used[i * 4 + sideIdx(s)]) walk(i, s); }
  return runs;
}

const caches = new Map<number, { world: World; edits: number; sig: number; runs: Run[] }>();
function runsFor(world: World, level: number): Run[] {
  const edits = world.grid.edits, cache = caches.get(level);
  if (cache && cache.world === world && cache.edits === edits) return cache.runs;
  // Grid edits count every redrawn tile; rebuild only when the track itself (or a station on it) changed.
  const rail = world.layers.rail, b = world.layers.building, road = world.layers.roadClass;
  let sig = 0;
  for (let i = 0; i < rail.length; i++) if (rail[i]) sig = (Math.imul(sig ^ (i * 8 + rail[i]), 0x9e3779b1) ^ b[i] ^ (road[i] << 12)) | 0;
  if (!cache || cache.world !== world || cache.sig !== sig) { const c = { world, edits, sig, runs: buildRuns(world, level) }; caches.set(level, c); return c.runs; }
  cache.edits = edits;
  return cache.runs;
}

function at(r: Run, s: number): [number, number, number, number] {
  const { P, D } = r; s = Math.max(0, Math.min(r.len - 1e-6, s));
  let lo = 0, hi = D.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] <= s) lo = m; else hi = m; }
  const f = (s - D[lo]) / (D[hi] - D[lo] || 1), a = P[lo], b = P[hi];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, b[0] - a[0], b[1] - a[1]];
}

interface Livery { body: string; band: string; roof: string; nose: string; panto?: boolean }
/** H1–H3 (heavy rail), on ground and elevated track. */
export const HEAVY_LIVERIES: Livery[] = [
  { body: '#c9473a', band: '#f1e3c4', roof: '#ddd6ca', nose: '#c9473a', panto: true },
  { body: '#2f5d43', band: '#e8b730', roof: '#9aa39d', nose: '#e8b730', panto: true },
  { body: '#eef0f2', band: '#2f4f9b', roof: '#c7ccd2', nose: '#eef0f2', panto: true },
];
/** M1–M4, the subway's (no pantograph). */
export const METRO_LIVERIES: Livery[] = [
  { body: '#24324f', band: '#d6453b', roof: '#b9bec6', nose: '#24324f' },
  { body: '#2c8c8a', band: '#f2f2ee', roof: '#c8d4d3', nose: '#2c8c8a' },
  { body: '#3e4349', band: '#a6d64a', roof: '#8d939a', nose: '#a6d64a' },
  { body: '#7a2834', band: '#d9b45a', roof: '#c9bfb2', nose: '#7a2834' },
];
/** Below this many pixels a tile no trains are drawn (the sound reads it too, to stay quiet when none show). */
export const TRAIN_MIN_TILE = 6;
export const CAR_LEN = 0.75, CAR_WID = 0.2, CARS = 3, CAR_GAP = 0.05;
const SPEED = 2.4, DWELL = 3, FADE = 0.8;

function car(ctx: Ctx, x: number, y: number, ang: number, T: number, lv: Livery, lead: boolean, tail: boolean): void {
  const L = CAR_LEN * T, W = CAR_WID * T, r = W * 0.38, nose = W * 0.48;
  ctx.save(); ctx.translate(x + T * 0.014, y + T * 0.03); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(20,24,28,0.3)'; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, r); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = lv.body; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, [tail ? nose : r * 0.5, lead ? nose : r * 0.5, lead ? nose : r * 0.5, tail ? nose : r * 0.5]); ctx.fill();
  if (T >= 14) {
    ctx.fillStyle = lv.band; ctx.fillRect(-L / 2 + W * 0.3, -W / 2 + W * 0.06, L - W * 0.6, W * 0.1); ctx.fillRect(-L / 2 + W * 0.3, W / 2 - W * 0.16, L - W * 0.6, W * 0.1);
    ctx.globalAlpha *= 0.55; ctx.fillStyle = lv.roof; ctx.beginPath(); ctx.roundRect(-L / 2 + W * 0.45, -W * 0.15, L - W * 0.9, W * 0.3, W * 0.1); ctx.fill(); ctx.globalAlpha /= 0.55;
    if (lv.panto) { ctx.strokeStyle = 'rgba(40,40,44,0.85)'; ctx.lineWidth = Math.max(1, T / 60); ctx.beginPath(); ctx.moveTo(-W * 0.3, -W * 0.2); ctx.lineTo(0, W * 0.2); ctx.lineTo(W * 0.3, -W * 0.2); ctx.stroke(); }
    for (const [end, on] of [[1, lead], [-1, tail]] as const) if (on) {
      ctx.fillStyle = lv.nose; ctx.beginPath(); ctx.roundRect(end > 0 ? L / 2 - W * 0.42 : -L / 2, -W / 2, W * 0.42, W, W * 0.4); ctx.fill();
      ctx.fillStyle = 'rgba(30,40,55,0.85)'; ctx.beginPath(); ctx.roundRect(end > 0 ? L / 2 - W * 0.36 : -L / 2 + W * 0.2, -W * 0.36, W * 0.16, W * 0.72, W * 0.06); ctx.fill();
    }
  }
  ctx.restore();
}

/** Where a train is `u` seconds after it set off along a run of length len (stopping at `stop` if given): front distance and opacity, or null once gone. */
/** What a train is doing: running past ('run'), or at a station slowing in ('in'), stopped ('dwell') or pulling out ('out'). */
export type TrainPhase = 'run' | 'in' | 'dwell' | 'out';

export function trainAt(u: number, len: number, stop: number | null): { s: number; a: number; phase: TrainPhase } | null {
  const s0 = 0.4, s1 = len - 0.4; if (s1 <= s0 || u < 0) return null;
  if (stop === null) { const s = s0 + SPEED * u; if (s > s1) return null; return { s, a: Math.min(1, u / FADE, (s1 - s) / (SPEED * FADE)), phase: 'run' }; }
  const front = Math.min(s1, stop + (CARS * (CAR_LEN + CAR_GAP)) / 2);   // the train's middle at the platform's
  const dIn = Math.max(0, front - s0), tIn = 2 * dIn / SPEED, dOut = s1 - front, tOut = 2 * Math.max(dOut, 0.01) / SPEED;
  if (u < tIn) { const f = u / tIn; return { s: s0 + dIn * (1 - (1 - f) * (1 - f)), a: Math.min(1, u / FADE), phase: 'in' }; }
  if (u < tIn + DWELL) return { s: front, a: 1, phase: 'dwell' };
  const g = (u - tIn - DWELL) / tOut; if (g > 1) return null;
  return { s: front + dOut * g * g, a: Math.min(1, (1 - g) * tOut / FADE), phase: 'out' };
}

/** Seconds between trains each way on a run: one a minute on an empty line, down to one every 12 s when full. */
export function headway(load: number): number {
  return 60 / (1 + 4 * Math.min(1, Math.max(0, load)));
}

/** A short leg of a passing train: how far it runs before fading, in tiles. */
export const LEG = 5;
/** Platform approach and departure: a station train appears this far before the platform's middle and fades this far after. */
export const APPROACH = 4;
/** Passing trains a run shows each way, per 10 tiles, when its line is full (like the road cars: none on an empty line). */
const PASSING_PER_10 = 1.5;

/** Where a passing train is `u` seconds into its leg: distance along the leg and opacity, or null once gone. */
export function legAt(u: number): { s: number; a: number } | null {
  const dur = LEG / SPEED; if (u < 0 || u > dur) return null;
  return { s: SPEED * u, a: Math.min(1, u / FADE, (dur - u) / FADE) };
}

const hash = (a: number, b: number, c: number): number => {
  let h = Math.imul(a ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};

/** Called for each train there is now: its run and direction, its front's distance along the run, opacity, a stable id and its phase. */
export type TrainVisitor = (r: Run, dir: number, front: number, a: number, key: number, phase: TrainPhase) => void;

/**
 * Every train on one level whose run reaches the view, now: the one place that decides what runs
 * (drawTrains draws from it; the sound listens with trainsInView). Passing trains appear, run a
 * short leg and fade, as many as the line's load asks for; at a station a train slows in, waits
 * and pulls out. `key` stays the same for one train for as long as it is there.
 */
export function forEachTrain(world: World, now: number, bx0: number, by0: number, bx1: number, by1: number, level: number, fn: TrainVisitor): void {
  const runs = runsFor(world, level), d = world.traffic, t = now * 0.001;
  for (const r of runs) {
    if (r.x1 < bx0 - 1 || r.x0 > bx1 + 1 || r.y1 < by0 - 1 || r.y0 > by1 + 1) continue;
    let load = 0; for (const i of r.tiles) load = Math.max(load, d ? railLoad(d, i, level) : 0);
    load = Math.min(1, Math.max(0, load));
    for (const dir of [1, -1]) {
      // Station trains: appear APPROACH tiles out, slow in, wait, pull out, fade APPROACH tiles on.
      const stop = r.stop === null ? null : dir > 0 ? r.stop : r.len - r.stop;
      let zone0 = Infinity, zone1 = -Infinity;
      if (stop !== null) {
        const a0 = Math.max(0, stop - APPROACH), a1 = Math.min(r.len, stop + APPROACH);
        zone0 = a0; zone1 = a1;
        const P = headway(load), dur = 2 * APPROACH / SPEED * 2 + DWELL + 2, phase = hash(r.seed, 1, dir) * P;
        for (let k = Math.floor((t - dur - phase) / P); k <= Math.floor((t - phase) / P); k++) {
          const pos = trainAt(t - (k * P + phase), a1 - a0, stop - a0); if (pos) fn(r, dir, a0 + pos.s, pos.a, k, pos.phase);
        }
      }
      // Passing trains: short legs at random places along the run, as many as the load asks for, kept clear of the station.
      if (r.len < LEG + 1) continue;
      const want = r.len / 10 * PASSING_PER_10 * load, slots = Math.ceil(want), cycle = LEG / SPEED + 1;
      for (let j = 0; j < slots; j++) {
        const phase = hash(r.seed, j + 7, dir) * cycle, c = Math.floor((t + phase) / cycle), u = t + phase - c * cycle;
        if (j === slots - 1 && hash(r.seed, j, c * 2 + (dir > 0 ? 0 : 1)) > want - j) continue;   // the last slot runs only part of the time
        const s0 = hash(r.seed ^ c, j, dir) * (r.len - LEG);
        if (s0 < zone1 && s0 + LEG > zone0) continue;
        const pos = legAt(u); if (pos) fn(r, dir, s0 + pos.s, pos.a, c * 31 + j, 'run');
      }
    }
  }
}

/**
 * Draws one level's trains (see forEachTrain). (sx, sy) is the screen position of tile (0, 0); T the
 * tile size in pixels; the view covers tiles [bx0, bx1] × [by0, by1]; `lift` raises elevated trains onto the deck.
 */
export function drawTrains(ctx: Ctx, world: World, sx: number, sy: number, T: number, now: number, bx0: number, by0: number, bx1: number, by1: number, level: number = RAIL_GROUND, lift = 0): void {
  if (T < TRAIN_MIN_TILE) return;
  const liveries = level === RAIL_SUBWAY ? METRO_LIVERIES : HEAVY_LIVERIES;
  forEachTrain(world, now, bx0, by0, bx1, by1, level, (r, dir, front, a, k) => {
    drawTrain(ctx, r, dir, front, a, liveries[Math.floor(hash(r.seed, k, dir) * liveries.length)], sx, sy - lift, T);
  });
}

/** A train for the sound: the middle of the train in tiles, its opacity, its phase and a stable id. */
export interface TrainInView { x: number; y: number; a: number; phase: TrainPhase; key: string }

/** The trains on one level whose run reaches the view (read only: nothing is drawn). For the sound (audio/). */
export function trainsInView(world: World, now: number, bx0: number, by0: number, bx1: number, by1: number, level: number = RAIL_GROUND): TrainInView[] {
  const out: TrainInView[] = [], half = CARS * (CAR_LEN + CAR_GAP) / 2;
  forEachTrain(world, now, bx0, by0, bx1, by1, level, (r, dir, front, a, key, phase) => {
    const [x, y] = at(r, dir > 0 ? front - half : r.len - (front - half));
    if (x < bx0 - 1 || x > bx1 + 2 || y < by0 - 1 || y > by1 + 2) return;
    out.push({ x, y, a, phase, key: `${level}:${r.seed}:${dir}:${phase === 'run' ? 'p' : 's'}${key}` });
  });
  return out;
}

/** One train of CARS cars with its front `front` tiles along run r (taken in direction dir). */
function drawTrain(ctx: Ctx, r: Run, dir: number, front: number, a: number, lv: Livery, sx: number, sy: number, T: number): void {
  ctx.save(); ctx.globalAlpha *= a;
  for (let c = CARS - 1; c >= 0; c--) {
    const mid = front - c * (CAR_LEN + CAR_GAP) - CAR_LEN / 2;
    // Both bogies on the right-hand track; the body spans the chord between them, as a real car does round a bend.
    const bog = (q: number): [number, number] => {
      const s = dir > 0 ? q : r.len - q, [x, y, tx0, ty0] = at(r, s), m = Math.hypot(tx0, ty0) || 1, tx = tx0 / m * dir, ty = ty0 / m * dir;
      return [x - ty * TRACK_OFFSET, y + tx * TRACK_OFFSET];
    };
    const [fx, fy] = bog(mid + CAR_LEN * 0.32), [rx, ry] = bog(mid - CAR_LEN * 0.32);
    car(ctx, sx + (fx + rx) / 2 * T, sy + (fy + ry) / 2 * T, Math.atan2(fy - ry, fx - rx), T, lv, c === 0, c === CARS - 1);
  }
  ctx.restore();
}
