/**
 * Trains (art/clay-set/rail2.html, the owner's picks): drawn top-down in code like the road
 * cars, ¾ of a tile a car, in the H1–H3 liveries, on the right-hand of the two tracks drawn on
 * each rail tile. Nothing is simulated: like the road cars, what runs comes from the clock and
 * the rail load (sim/TrafficData.ts `railLoad`), so it costs nothing off screen.
 *
 * The track is cut into runs: chains of tiles with exactly two joins, ended by junctions and
 * dead ends (a loop is one run). Trains go both ways along each run, more often the busier it
 * is. A train fades in near one end and fades out near the other, and where the run passes
 * through a station's platform it slows in, waits and pulls out again.
 */
import type { World } from '../../sim/World';
import { railLinks, LINK_N, LINK_E, LINK_S, LINK_W } from '../../sim/rail';
import { railLoad } from '../../sim/TrafficData';
import { RAIL_GROUND } from '../../sim/constants';
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

/** Cuts the ground track into runs. Pure apart from reading the world. */
export function buildRuns(world: World): Run[] {
  const { width, height } = world.grid, rail = world.layers.rail, n = width * height;
  const links = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (rail[i] & RAIL_GROUND) links[i] = railLinks(world, i);
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
    tiles.forEach((t, k) => { if (world.buildingPartRoleAt(t % width, (t - (t % width)) / width) === 'platform') { if (first < 0) first = k; last = k; } });
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

let cache: { world: World; edits: number; sig: number; runs: Run[] } | null = null;
function runsFor(world: World): Run[] {
  const edits = world.grid.edits;
  if (cache && cache.world === world && cache.edits === edits) return cache.runs;
  // Grid edits count every redrawn tile; rebuild only when the track itself (or a station on it) changed.
  const rail = world.layers.rail, b = world.layers.building, road = world.layers.roadClass;
  let sig = 0;
  for (let i = 0; i < rail.length; i++) if (rail[i]) sig = (Math.imul(sig ^ (i * 8 + rail[i]), 0x9e3779b1) ^ b[i] ^ (road[i] << 12)) | 0;
  if (!cache || cache.world !== world || cache.sig !== sig) cache = { world, edits, sig, runs: buildRuns(world) };
  else cache.edits = edits;
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
/** H1–H3 (heavy rail); the subway's M1–M4 come with the subway. */
export const HEAVY_LIVERIES: Livery[] = [
  { body: '#c9473a', band: '#f1e3c4', roof: '#ddd6ca', nose: '#c9473a', panto: true },
  { body: '#2f5d43', band: '#e8b730', roof: '#9aa39d', nose: '#e8b730', panto: true },
  { body: '#eef0f2', band: '#2f4f9b', roof: '#c7ccd2', nose: '#eef0f2', panto: true },
];
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
export function trainAt(u: number, len: number, stop: number | null): { s: number; a: number } | null {
  const s0 = 0.4, s1 = len - 0.4; if (s1 <= s0 || u < 0) return null;
  if (stop === null) { const s = s0 + SPEED * u; if (s > s1) return null; return { s, a: Math.min(1, u / FADE, (s1 - s) / (SPEED * FADE)) }; }
  const front = Math.min(s1, stop + (CARS * (CAR_LEN + CAR_GAP)) / 2);   // the train's middle at the platform's
  const dIn = Math.max(0, front - s0), tIn = 2 * dIn / SPEED, dOut = s1 - front, tOut = 2 * Math.max(dOut, 0.01) / SPEED;
  if (u < tIn) { const f = u / tIn; return { s: s0 + dIn * (1 - (1 - f) * (1 - f)), a: Math.min(1, u / FADE) }; }
  if (u < tIn + DWELL) return { s: front, a: 1 };
  const g = (u - tIn - DWELL) / tOut; if (g > 1) return null;
  return { s: front + dOut * g * g, a: Math.min(1, (1 - g) * tOut / FADE) };
}

/** Seconds between trains each way on a run: one a minute on an empty line, down to one every 12 s when full. */
export function headway(load: number): number {
  return 60 / (1 + 4 * Math.min(1, Math.max(0, load)));
}

/**
 * Draws the trains. (sx, sy) is the screen position of tile (0, 0); T the tile size in pixels;
 * the view covers tiles [bx0, bx1] × [by0, by1].
 */
export function drawTrains(ctx: Ctx, world: World, sx: number, sy: number, T: number, now: number, bx0: number, by0: number, bx1: number, by1: number): void {
  if (T < 6) return;
  const runs = runsFor(world), d = world.traffic, t = now * 0.001;
  for (const r of runs) {
    if (r.x1 < bx0 - 1 || r.x0 > bx1 + 1 || r.y1 < by0 - 1 || r.y0 > by1 + 1) continue;
    let load = 0; for (const i of r.tiles) load = Math.max(load, d ? railLoad(d, i) : 0);
    const P = headway(load);
    const dur = r.len / SPEED * 2 + DWELL + 2;
    for (const dir of [1, -1]) {
      const phase = ((r.seed >>> (dir > 0 ? 3 : 11)) % 1000) / 1000 * P;
      const stop = r.stop === null ? null : dir > 0 ? r.stop : r.len - r.stop;
      for (let k = Math.floor((t - dur - phase) / P); k <= Math.floor((t - phase) / P); k++) {
        const pos = trainAt(t - (k * P + phase), r.len, stop); if (!pos) continue;
        const lv = HEAVY_LIVERIES[(((k * 7919) ^ r.seed ^ (dir > 0 ? 0 : 0x5bd1)) >>> 0) % HEAVY_LIVERIES.length];
        ctx.save(); ctx.globalAlpha *= pos.a;
        for (let c = CARS - 1; c >= 0; c--) {
          const mid = pos.s - c * (CAR_LEN + CAR_GAP) - CAR_LEN / 2;
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
    }
  }
}
