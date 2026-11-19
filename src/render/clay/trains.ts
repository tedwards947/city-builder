/**
 * Trains (art/clay-set/rail2.html, the owner's picks): drawn top-down in code like the road cars,
 * ¾ of a tile a car, in the H1–H3 liveries (M1–M4 underground), on the right-hand of the two tracks
 * drawn on each rail tile. They keep running round the track (clay/trainNet.ts, which decides where
 * every train is); this file draws them and tells the sound where they are.
 */
import type { World } from '../../sim/World';
import { RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY } from '../../sim/constants';
import { TRACK_OFFSET, islandOffset, DECK_HEIGHT } from './rail';
import { TrainNet, edgeAt, CAR_LEN, CAR_GAP, CARS, CROSS, type Train, type Edge, type TrainPhase } from './trainNet';

export { buildRuns, type Run } from './trainRuns';
export { CAR_LEN, CAR_GAP, CARS, TrainNet, type TrainPhase } from './trainNet';

type Ctx = CanvasRenderingContext2D;
export const CAR_WID = 0.2;

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

// ── The one net per world, moved on by the clock ──

const nets = new WeakMap<World, { net: TrainNet; edits: number; sig: number; now: number }>();

/** A signature of the track (and the stations and ramps on it): the net is rebuilt when it changes. */
function trackSig(world: World): number {
  const rail = world.layers.rail, b = world.layers.building, road = world.layers.roadClass;
  let sig = 0;
  for (let i = 0; i < rail.length; i++) if (rail[i] || b[i] >= 14) sig = (Math.imul(sig ^ (i * 8 + rail[i]), 0x9e3779b1) ^ b[i] ^ (road[i] << 12)) | 0;
  return sig;
}

/** The world's train net, rebuilt (keeping its trains where the track is still there) when the track has changed. */
export function trainNetFor(world: World): TrainNet {
  const c = nets.get(world), edits = world.grid.edits;
  if (c && c.edits === edits) return c.net;
  const sig = trackSig(world);
  if (c && c.sig === sig) { c.edits = edits; return c.net; }
  const net = new TrainNet(world);
  if (c) carryOver(c.net, net); else net.populate();
  net.view = c?.net.view ?? null;
  nets.set(world, { net, edits, sig, now: c?.now ?? -1 });
  return net;
}

/** Moves the world's trains on to `now` (ms; the same clock for every caller) and returns its net. */
function advance(world: World, now: number): TrainNet {
  const net = trainNetFor(world), c = nets.get(world)!;
  if (c.now < 0) c.now = now;
  if (now > c.now) {
    // At most a second at a time (a hidden tab pauses them), in steps of a tenth.
    let dt = Math.min(1, (now - c.now) / 1000);
    while (dt > 1e-6) { const h = Math.min(0.1, dt); net.step(h); dt -= h; }
    c.now = now;
  }
  return net;
}

/** After the track changed: each train goes on from the same place on the new track, if its track is still there. */
function carryOver(from: TrainNet, to: TrainNet): void {
  for (const t of from.trains) {
    const [x, y, dx, dy] = edgeAt(t.edge, t.s);
    let best: Edge | null = null, bs = 0, bd = 0.3;
    for (const e of to.edges) {
      if (e.level !== t.edge.level || e.ramp !== t.edge.ramp || x < e.x0 - 0.5 || x > e.x1 + 0.5 || y < e.y0 - 0.5 || y > e.y1 + 0.5) continue;
      for (let k = 1; k < e.P.length; k++) {
        const a = e.P[k - 1], b = e.P[k], ux = b[0] - a[0], uy = b[1] - a[1], L2 = ux * ux + uy * uy || 1;
        const f = Math.max(0, Math.min(1, ((x - a[0]) * ux + (y - a[1]) * uy) / L2)), px = a[0] + ux * f, py = a[1] + uy * f;
        const d = Math.hypot(x - px, y - py), L = Math.sqrt(L2);
        if (d < bd && (ux * dx + uy * dy) / L > 0.5) { bd = d; best = e; bs = e.D[k - 1] + f * L; }
      }
    }
    if (best) to.adopt(t, best, bs);
  }
}

// ── Drawing ──

/** How a car shows on a pass: its opacity there and how far up the elevated deck it is (0–1). */
function carLook(world: World, e: Edge, x: number, y: number, level: number): { a: number; lift: number } | null {
  const W = world.grid.width, i = Math.floor(y) * W + Math.floor(x), kind = world.layers.building[i];
  let u = -1;
  if (kind === BUILDING_RAMP_ELEVATED || kind === BUILDING_RAMP_SUBWAY) {
    const an = world.buildingAnchorAt(i), r = world.buildingRotAt(an) & 3, ax = an % W + 0.5, ay = (an - (an % W)) / W + 0.5;
    const [px, py] = [[1, 0], [0, 1], [-1, 0], [0, -1]][r];
    u = Math.max(0, Math.min(2, 0.5 + (x - ax) * px + (y - ay) * py));
  }
  const onLevel = e.ramp ? RAIL_GROUND : e.level;
  if (kind === BUILDING_RAMP_SUBWAY && u >= 0) {
    // Down into the tunnel: gone from the surface by the deep end, and the other way round underground.
    const g = Math.max(0, Math.min(1, 1.5 - u));
    if (level === RAIL_GROUND && onLevel === RAIL_GROUND) return g > 0 ? { a: g, lift: 0 } : null;
    if (level === RAIL_SUBWAY && (e.ramp === RAIL_SUBWAY || e.level === RAIL_SUBWAY)) return 1 - g > 0 ? { a: 1 - g, lift: 0 } : null;
    return null;
  }
  if (onLevel !== level) return null;
  if (kind === BUILDING_RAMP_ELEVATED && u >= 0) return { a: 1, lift: u / 2 };
  return { a: 1, lift: level === RAIL_ELEVATED ? 1 : 0 };
}

/** The point `back` tiles behind a train's front, on its right-hand track, and the edge it is on. */
function trackPoint(t: Train, back: number): { x: number; y: number; e: Edge } {
  const { e, s } = TrainNet.locate(t, back), [x, y, tx, ty] = edgeAt(e, s);
  let o = TRACK_OFFSET;
  for (const [a, b] of e.wide) if (s > a && s < b) o = islandOffset((s - a) * 3 / (b - a));
  // Coming back from a dead end it starts on the other track and crosses over, each car where the first did.
  if (t.crossPending) o = -o;
  else if (!Number.isNaN(t.crossAt)) o *= -1 + 2 * Math.max(0, Math.min(1, (t.odo - back - t.crossAt) / CROSS));
  return { x: x - ty * o, y: y + tx * o, e };
}

function drawTrain(ctx: Ctx, world: World, t: Train, level: number, lv: Livery, sx: number, sy: number, T: number): void {
  for (let c = CARS - 1; c >= 0; c--) {
    const mid = c * (CAR_LEN + CAR_GAP) + CAR_LEN / 2;
    const f = trackPoint(t, mid - CAR_LEN * 0.32), r = trackPoint(t, mid + CAR_LEN * 0.32), m = TrainNet.locate(t, mid);
    const [mx, my] = edgeAt(m.e, m.s);
    const look = carLook(world, m.e, mx, my, level);
    if (!look) continue;
    ctx.save(); ctx.globalAlpha *= t.alpha * look.a;
    // Both bogies on the right-hand track; the body spans the chord between them, as a real car does round a bend.
    car(ctx, sx + (f.x + r.x) / 2 * T, sy + (f.y + r.y) / 2 * T - look.lift * DECK_HEIGHT * T, Math.atan2(f.y - r.y, f.x - r.x), T, lv, c === 0, c === CARS - 1);
    ctx.restore();
  }
}

const near = (t: Train, bx0: number, by0: number, bx1: number, by1: number): boolean => {
  const [x, y] = edgeAt(t.edge, t.s); return x > bx0 - 4 && x < bx1 + 5 && y > by0 - 4 && y < by1 + 5;
};

/**
 * Draws one level's trains (the cars on it: a train on a ramp is part on each). (sx, sy) is the screen
 * position of tile (0, 0); T the tile size in pixels; the view covers tiles [bx0, bx1] × [by0, by1].
 */
export function drawTrains(ctx: Ctx, world: World, sx: number, sy: number, T: number, now: number, bx0: number, by0: number, bx1: number, by1: number, level: number = RAIL_GROUND): void {
  if (T < TRAIN_MIN_TILE) return;
  const net = advance(world, now);
  net.view = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
  const liveries = level === RAIL_SUBWAY ? METRO_LIVERIES : HEAVY_LIVERIES;
  for (const t of net.trains) if (near(t, bx0, by0, bx1, by1)) drawTrain(ctx, world, t, level, liveries[t.livery % liveries.length], sx, sy, T);
}

/** A train for the sound: the middle of the train in tiles, its opacity, its phase and a stable id. */
export interface TrainInView { x: number; y: number; a: number; phase: TrainPhase; key: string }

/** The trains on one level in view (read only: nothing is drawn). For the sound (audio/). */
export function trainsInView(world: World, now: number, bx0: number, by0: number, bx1: number, by1: number, level: number = RAIL_GROUND): TrainInView[] {
  const net = advance(world, now), out: TrainInView[] = [], half = (CARS * (CAR_LEN + CAR_GAP) - CAR_GAP) / 2;
  for (const t of net.trains) {
    const m = TrainNet.locate(t, half), [x, y] = edgeAt(m.e, m.s);
    if (x < bx0 - 1 || x > bx1 + 2 || y < by0 - 1 || y > by1 + 2) continue;
    const look = carLook(world, m.e, x, y, level);
    if (!look) continue;
    out.push({ x, y, a: t.alpha * look.a, phase: t.phase, key: 't' + t.id });
  }
  return out;
}
