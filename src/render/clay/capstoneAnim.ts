// Capstone flights (CAPSTONE_DESIGN.md, the owner's picks 2026-11-21): looks only, nothing in the sim.
//
//   POLICE HELICOPTER  Spins up on the HQ's roof pad, lifts to about 70 m and patrols: it flies to
//                      the worst crime spot near the HQ (layers.crime), circles it with its
//                      searchlight on, then a second spot, comes home and lands. Every minute or so.
//   AIR AMBULANCE      Waits on the hospital's roof pad until a home nearby is very sick or has just
//                      had a death (layers.sickness, layers.recentDeath), flies there, lands on the
//                      street beside it for a pickup, climbs and flies home.
//   WATER BOMBER       While anything burns (layers.fire) and the Fire HQ works: leaves the hangar
//                      apron, taxis along the tarmac and up the taxiway, takes off down the strip,
//                      flies to the nearest fire, makes a low pass dropping a white mist, comes back
//                      in from the far end, lands, rolls out and taxis home. Then a rest before the next.
//
// A flight is planned once, as timed waypoints in tile units (x, y on the ground; z metres up), and
// played back from the clock, so frames cost little. While one is out its aircraft is not drawn parked
// (capstoneArt asks `aircraftHome`). With reduced motion on, nothing flies.

import type { World } from '../../sim/World';
import { BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL } from '../../sim/constants';
import { capstoneWorking } from '../../sim/capstones';
import { shapeBox } from './bigBuildings';
import { capstoneSpots, drawAircraft } from './capstoneArt';

type Ctx = CanvasRenderingContext2D;
interface Wp { t: number; x: number; y: number; z: number; rotor: number; light?: boolean; mist?: boolean }
interface Flight { craft: string; len: number; heli: boolean; wps: Wp[]; start: number }

const HM = 0.04;   // screen tiles a metre up (docs/SCALE.md)
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const flights = new Map<number, Flight>();      // by the building's anchor tile
const nextTry = new Map<number, number>();      // seconds: when to think about the next flight

const hash = (a: number, b: number): number => {
  let h = Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Whether the aircraft of the capstone at `anchor` is at home (draw it parked). */
export function aircraftHome(anchor: number): boolean { return !flights.has(anchor); }

// ── Route building ──────────────────────────────────────────────────────────
class Route {
  wps: Wp[] = [];
  constructor(x: number, y: number, z: number, rotor = 0) { this.wps.push({ t: 0, x, y, z, rotor }); }
  get last(): Wp { return this.wps[this.wps.length - 1]; }
  /** Moves to (x, y, z) at `speed` tiles a second (or over `dur` seconds when given). */
  to(x: number, y: number, z: number, o: { speed?: number; dur?: number; rotor?: number; light?: boolean; mist?: boolean } = {}): this {
    const p = this.last, d = Math.hypot(x - p.x, y - p.y);
    const dur = o.dur ?? Math.max(0.3, d / (o.speed ?? 1));
    this.wps.push({ t: p.t + dur, x, y, z, rotor: o.rotor ?? p.rotor, light: o.light, mist: o.mist });
    return this;
  }
  wait(dur: number, o: { rotor?: number; light?: boolean } = {}): this { const p = this.last; return this.to(p.x, p.y, p.z, { dur, rotor: o.rotor ?? p.rotor, light: o.light }); }
  /** One loop round (cx, cy) at radius r, over `dur` seconds, searchlight on. */
  orbit(cx: number, cy: number, r: number, z: number, dur: number): this {
    const n = 10, a0 = Math.atan2(this.last.y - cy, this.last.x - cx);
    for (let k = 1; k <= n; k++) { const a = a0 + (k / n) * Math.PI * 2; this.to(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, { dur: dur / n, light: true }); }
    return this;
  }
}

interface Spot { x: number; y: number; v: number }
/**
 * The highest-scoring tile within `radius` of (cx, cy), every tile looked at (a few thousand, and only
 * when a flight is planned); ties go to a tile picked by `seed`, so patrols vary.
 */
function hottest(world: World, cx: number, cy: number, radius: number, seed: number, score: (i: number) => number, avoid?: Spot): Spot | null {
  const { width, height } = world.grid;
  let best: Spot | null = null, bestKey = -1;
  for (let y = Math.max(1, Math.floor(cy - radius)); y <= Math.min(height - 2, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(1, Math.floor(cx - radius)); x <= Math.min(width - 2, Math.ceil(cx + radius)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < 8) continue;
      const v = score(y * width + x);
      if (v <= 0) continue;
      const key = v * 4 + hash(seed, y * width + x) * 3.99;
      if (key > bestKey) { bestKey = key; best = { x, y, v }; }
    }
  }
  return best;
}

function planPolice(world: World, ax: number, ay: number, seed: number): Flight {
  const s = capstoneSpots(BUILDING_POLICE_HQ)!, px = ax + s.pad!.x, py = ay + s.pad!.y, pz = s.pad!.z, cruise = pz + 40;
  const crime = (i: number) => world.layers.crime[i];
  let t1 = hottest(world, ax + 2, ay + 2, 32, seed, crime);
  if (!t1 || t1.v < 30) { const a = hash(seed, 99) * Math.PI * 2; t1 = { x: px + Math.cos(a) * 12, y: py + Math.sin(a) * 12, v: 0 }; }
  let t2 = hottest(world, ax + 2, ay + 2, 32, seed + 1, crime, t1);
  if (!t2 || t2.v < 30) { const a = hash(seed, 98) * Math.PI * 2; t2 = { x: px + Math.cos(a) * 9, y: py + Math.sin(a) * 9, v: 0 }; }
  const r = new Route(px, py, pz, 0).wait(3, { rotor: 1 }).to(px, py, cruise, { dur: 3.5 });
  r.to(t1.x + 1.2, t1.y, cruise, { speed: 2.4 }).orbit(t1.x, t1.y, 1.2, cruise, 9);
  r.to(t2.x + 1.2, t2.y, cruise, { speed: 2.4 }).orbit(t2.x, t2.y, 1.2, cruise, 8);
  r.to(px, py, cruise, { speed: 2.4 }).to(px, py, pz, { dur: 4 }).wait(3, { rotor: 0 });
  return { craft: 'heli-police', len: 13, heli: true, wps: r.wps, start: 0 };
}

function planMedevac(world: World, ax: number, ay: number, seed: number): Flight | null {
  const s = capstoneSpots(BUILDING_GENERAL_HOSPITAL)!, px = ax + s.pad!.x, py = ay + s.pad!.y, pz = s.pad!.z, cruise = pz + 38;
  const L = world.layers, { width } = world.grid;
  const need = (i: number) => (L.zone[i] === 1 && L.devLevel[i] > 0 ? (L.recentDeath[i] > 0 ? 255 : L.sickness[i]) : 0);
  const home = hottest(world, ax + 3, ay + 2, 40, seed, need);
  if (!home || home.v < 70) return null;
  // Land on a street beside the home if there is one, else on the home's own tile.
  let lx = home.x, ly = home.y;
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (L.roadClass[(home.y + dy) * width + home.x + dx] > 0) { lx = home.x + dx; ly = home.y + dy; break; }
  lx += 0.5; ly += 0.5;
  const r = new Route(px, py, pz, 0).wait(2.5, { rotor: 1 }).to(px, py, cruise, { dur: 3 });
  r.to(lx, ly, cruise, { speed: 3 }).to(lx, ly, 0, { dur: 4 }).wait(6, { rotor: 0.45 }).to(lx, ly, 0, { dur: 1, rotor: 1 }).to(lx, ly, cruise, { dur: 3.5 });
  r.to(px, py, cruise, { speed: 3 }).to(px, py, pz, { dur: 3.5 }).wait(3, { rotor: 0 });
  return { craft: 'heli-medevac', len: 13, heli: true, wps: r.wps, start: 0 };
}

function planBomber(world: World, ax: number, ay: number, W: number, seed: number): Flight | null {
  const L = world.layers, { width, height } = world.grid;
  // The nearest burning tile (the whole map, only when a flight is being planned).
  let fx = -1, fy = -1, best = Infinity;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (L.fire[y * width + x] === 0) continue;
    const d = Math.hypot(x - ax, y - ay);
    if (d < best) { best = d; fx = x + 0.5; fy = y + 0.5; }
  }
  if (fx < 0) return null;
  const s = capstoneSpots(BUILDING_FIRE_HQ)!, A = s.apron!, X = (v: number) => ax + v, Y = (v: number) => ay + v;
  const taxiY = Y(A.taxiY), twX = X(0.9), rwY = Y(0.5), endX = X(W - 0.5);
  const r = new Route(X(A.x), Y(A.y), 0).wait(1.5);
  r.to(X(A.x), taxiY, 0, { speed: 0.8 }).to(twX, taxiY, 0, { speed: 1.1 }).to(twX, rwY, 0, { speed: 1 }).wait(1);
  r.to(X(0.9 + 0.55 * (W - 1.8)), rwY, 0, { dur: 3.2 }).to(endX, rwY, 18, { dur: 1.4 });
  // Out to the fire, a low pass over it with the mist, and back round to the far end of the strip.
  const ux = fx - endX, uy = fy - rwY, ul = Math.hypot(ux, uy) || 1, nx = ux / ul, ny = uy / ul;
  r.to(fx - nx * 4, fy - ny * 4, 60, { speed: 4 }).to(fx - nx * 1.6, fy - ny * 1.6, 26, { dur: 1.2 });
  r.to(fx + nx * 1.6, fy + ny * 1.6, 24, { dur: 1.1, mist: true }).to(fx + nx * 4.5, fy + ny * 4.5, 50, { dur: 1.4 });
  r.to(X(W + 5), rwY, 45, { speed: 4 }).to(X(W - 1.4), rwY, 0, { dur: 2.6 });
  r.to(twX, rwY, 0, { dur: 3.6 }).to(twX, taxiY, 0, { speed: 1 }).to(X(A.x), taxiY, 0, { speed: 1.1 }).to(X(A.x), Y(A.y), 0, { speed: 0.8 });
  void seed;
  return { craft: 'plane-bomber', len: 20, heli: false, wps: r.wps, start: 0 };
}

// ── Playback ────────────────────────────────────────────────────────────────
interface Pose { x: number; y: number; z: number; rotor: number; left: boolean; light: boolean; mist: boolean; done: boolean }
function pose(f: Flight, t: number): Pose {
  const w = f.wps;
  if (t >= w[w.length - 1].t) { const p = w[w.length - 1]; return { ...p, left: false, light: false, mist: false, done: true }; }
  let k = 1; while (k < w.length - 1 && w[k].t < t) k++;
  const a = w[k - 1], b = w[k], u = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
  // Facing: the way it last moved sideways.
  let left = false;
  for (let j = k; j > 0; j--) { const dx = w[j].x - w[j - 1].x; if (Math.abs(dx) > 1e-3) { left = dx < 0; break; } }
  const e = f.heli ? u * u * (3 - 2 * u) : u;
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: a.z + (b.z - a.z) * e, rotor: a.rotor + (b.rotor - a.rotor) * u, left, light: !!b.light, mist: !!b.mist, done: false };
}

function think(world: World, sec: number): void {
  for (const b of world.buildings) {
    if (b.kind !== BUILDING_POLICE_HQ && b.kind !== BUILDING_GENERAL_HOSPITAL && b.kind !== BUILDING_FIRE_HQ) continue;
    const anchor = b.ty * world.grid.width + b.tx;
    if (flights.has(anchor)) continue;
    const at = nextTry.get(anchor);
    if (at === undefined) { nextTry.set(anchor, sec + 6 + hash(anchor, 1) * 20); continue; }
    if (sec < at) continue;
    const box = shapeBox(b.kind, 0), ax = b.tx + box.minX, ay = b.ty + box.minY, seed = anchor * 31 + Math.floor(sec);
    let f: Flight | null = null;
    if (capstoneWorking(world, b)) {
      if (b.kind === BUILDING_POLICE_HQ) f = planPolice(world, ax, ay, seed);
      else if (b.kind === BUILDING_GENERAL_HOSPITAL) f = planMedevac(world, ax, ay, seed);
      else f = planBomber(world, ax, ay, box.maxX - box.minX + 1, seed);
    }
    if (f) { f.start = sec; flights.set(anchor, f); }
    // Police: a patrol every minute or so; the others look again soon when there was nothing to fly to.
    nextTry.set(anchor, sec + (f ? 0 : b.kind === BUILDING_POLICE_HQ ? 20 : 8));
  }
}

/** Draws every capstone aircraft that is out. Call once a frame, above the buildings. */
export function drawCapstoneFlights(ctx: Ctx, world: World, ox: number, oy: number, T: number, now: number): void {
  if (reduced) return;
  const sec = now / 1000;
  think(world, sec);
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  for (const [anchor, f] of flights) {
    const t = sec - f.start, p = pose(f, t);
    if (p.done) {
      flights.delete(anchor);
      nextTry.set(anchor, sec + (f.heli ? (f.craft === 'heli-police' ? 45 : 25) + hash(anchor, Math.floor(sec)) * 30 : 40));
      continue;
    }
    const gx = ox + p.x * T, gy = oy + p.y * T, sy = gy - p.z * HM * T;
    if (gx < -4 * T || gx > cw + 4 * T || sy < -4 * T || gy > ch + 4 * T) continue;
    // Mist: drops sampled back along the pass, falling and spreading as they age.
    if (f.craft === 'plane-bomber') for (let k = 1; k <= 14; k++) {
      const age = k * 0.09, q = pose(f, t - age);
      if (!q.mist) continue;
      const mx = ox + q.x * T, my = oy + q.y * T, mz = Math.max(0, q.z - age * 40);
      ctx.fillStyle = `rgba(235,242,248,${0.5 * (1 - age / 1.4)})`;
      ctx.beginPath(); ctx.ellipse(mx, my - mz * HM * T, (0.12 + age * 0.35) * T, (0.08 + age * 0.2) * T, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Shadow on the ground, smaller and fainter the higher it flies.
    const fade = Math.max(0.25, 1 - p.z / 140), sw = f.len / 17 * T * 0.45 * fade;
    ctx.fillStyle = `rgba(0,0,0,${0.28 * fade})`;
    ctx.beginPath(); ctx.ellipse(gx, gy, sw, sw * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    if (p.light) {
      ctx.fillStyle = 'rgba(255,244,190,0.22)';
      ctx.beginPath(); ctx.moveTo(gx - T * 0.05, sy); ctx.lineTo(gx + T * 0.05, sy); ctx.lineTo(gx + T * 0.55, gy); ctx.lineTo(gx - T * 0.55, gy); ctx.fill();
      ctx.fillStyle = 'rgba(255,244,190,0.3)'; ctx.beginPath(); ctx.ellipse(gx, gy, T * 0.55, T * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    drawAircraft(ctx, f.craft, gx, sy, f.len, T, p.left);
    if (f.heli) drawRotor(ctx, gx + (p.left ? -1 : 1) * 0.6 / 17 * T, sy - 3.1 / 17 * T, T, p.rotor, now);
  }
}

/** A main rotor seen from the side: a blade that sweeps when slow, a pale blur when fast. */
export function drawRotor(ctx: Ctx, x: number, y: number, T: number, spin: number, now: number): void {
  const r = 10.7 / 2 / 17 * T;
  if (spin > 0.6) { ctx.fillStyle = `rgba(70,74,78,${0.18 + 0.12 * spin})`; ctx.beginPath(); ctx.ellipse(x, y, r, Math.max(1, r * 0.07), 0, 0, Math.PI * 2); ctx.fill(); }
  const a = (now / 1000) * (1 + 40 * spin), c = Math.cos(a);
  ctx.strokeStyle = `rgba(40,44,48,${spin > 0.6 ? 0.45 : 0.85})`; ctx.lineWidth = Math.max(1, T * 0.012);
  ctx.beginPath(); ctx.moveTo(x - r * c, y); ctx.lineTo(x + r * c, y); ctx.stroke();
}
