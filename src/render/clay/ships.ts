// Ships on the sea lanes of seaports (art/clay-set/seaport.html, picks C1–C4).
//
// Ships are traffic, like the cars on roads: now and then one fades in on the
// port's shipRoute (sim/seaport.ts), sails a stretch of it in or out, and fades
// away; and now and then one lies at the docks a while with the cranes working,
// fading in and out there too. They are sparse, and busier ports see more.
// Nothing here is simulated: what is about is worked out from the clock, the
// route and how many ships a day the port's trade makes, so it costs nothing
// off screen and needs no saving. Ships are drawn above the water and below
// every building (the cranes reach over them), and are clipped out of bridge
// tiles so they pass under.

/** A point on the map, in tiles. */
export interface Pt { x: number; y: number }

/** Where a ship lies when docked: the middle of the berth and which way the quay runs (a unit vector). */
export interface Berth { x: number; y: number; qx: number; qy: number }

export type ShipType = 'container' | 'freighter';

export interface ShipState {
  x: number; y: number;
  /** Unit vector the bow points along. */
  hx: number; hy: number;
  /** Speed as a share of full speed, 0–1 (the wake follows it). */
  sp: number;
  type: ShipType;
  /** Seconds since the ship tied up, while it lies at the docks; -1 while it sails. */
  work: number;
  /** Opacity, 0–1: ships fade in and out like the cars. */
  a: number;
}

/** Tiles a second, the time a ship lies at the docks, a fade, and the most of a lane one ship is seen on. */
export const SHIP_SPEED = 1.2;
export const SHIP_DOCKED_S = 24;
export const SHIP_FADE_S = 1.5;
const RUN_TILES = 9;
/** Passing ships keep this far off the berth (tiles), so they fade out before the quay. */
const BERTH_CLEAR = 4;
/** Seconds of game time in a day at 1× (8 ticks of 500 ms), to space ships by shipsPerDay. */
export const DAY_S = 4;

/** `edge`: how far along the path it comes onto the map (it starts a few tiles off). */
export interface ShipPath { pts: Pt[]; len: number[]; total: number; edge: number }

/**
 * The way in: from a few tiles off the map, along the route (which runs from the
 * docks out to the edge, so it is walked backwards), to the berth. Corners are
 * rounded off so ships don't turn on the spot.
 */
export function shipPath(route: readonly number[], width: number, height: number, berth: Pt): ShipPath {
  const pts: Pt[] = [];
  for (let k = route.length - 1; k >= 0; k--) { const i = route[k]; pts.push({ x: (i % width) + 0.5, y: Math.floor(i / width) + 0.5 }); }
  if (pts.length > 0) {
    // Start out beyond the edge the route ends on.
    const e = pts[0], out = 4;
    const off = e.x < 1 ? { x: -out, y: 0 } : e.x > width - 1 ? { x: out, y: 0 } : e.y < 1 ? { x: 0, y: -out } : e.y > height - 1 ? { x: 0, y: out } : { x: 0, y: 0 };
    pts.unshift({ x: e.x + off.x, y: e.y + off.y });
  }
  pts.push({ x: berth.x, y: berth.y });
  let p = pts;
  for (let pass = 0; pass < 2; pass++) {
    if (p.length < 3) break;
    const q: Pt[] = [p[0]];
    for (let k = 0; k < p.length - 1; k++) {
      const a = p[k], b = p[k + 1];
      if (k > 0) q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      if (k < p.length - 2) q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  const len = [0];
  for (let k = 1; k < p.length; k++) len.push(len[k - 1] + Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y));
  const path = { pts: p, len, total: len[len.length - 1], edge: 0 };
  while (path.edge < path.total) {
    const q = along(path, path.edge);
    if (q.x >= 0 && q.x <= width && q.y >= 0 && q.y <= height) break;
    path.edge += 0.25;
  }
  return path;
}

/** The point `s` tiles along the path, and the way it runs there. */
export function along(path: ShipPath, s: number): { x: number; y: number; dx: number; dy: number } {
  const { pts, len, total } = path;
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, dx: 1, dy: 0 };
  s = Math.max(0, Math.min(total, s));
  let k = 1;
  while (k < len.length - 1 && len[k] < s) k++;
  const a = pts[k - 1], b = pts[k], seg = len[k] - len[k - 1] || 1, f = (s - len[k - 1]) / seg;
  const dx = (b.x - a.x) / seg, dy = (b.y - a.y) / seg;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx, dy };
}

const hash = (n: number) => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Seconds between chances of a passing ship on each lane, and of a ship at the docks. */
export function shipPeriods(shipsPerDay: number): { lane: number; dock: number } {
  return { lane: clamp(DAY_S * 8 / shipsPerDay, 16, 60), dock: clamp(DAY_S * 16 / shipsPerDay, 40, 120) };
}

/**
 * The ships about a port at time `t` (seconds): at most one coming in, one
 * going out and one at the docks. `seed` (0–1) staggers ports. `sent` is
 * seconds since the ?debug=true "Send ship" button, or -1: then each lane runs
 * one ship from that moment, trade or not.
 */
export function shipsAt(path: ShipPath, berth: Berth, t: number, shipsPerDay: number, seed: number, sent = -1): ShipState[] {
  const out: ShipState[] = [];
  if (path.pts.length < 2 || (!(shipsPerDay > 0) && sent < 0)) return out;
  const per = shipsPerDay > 0 ? shipPeriods(shipsPerDay) : { lane: 1e9, dock: 1e9 };
  const sd = Math.floor(seed * 1e6);
  // Where one lane's clock is: [ship number, seconds into its turn], or null when this turn has no ship.
  const turn = (lane: number, period: number, life: number): [number, number] | null => {
    if (sent >= 0) return sent < life ? [-1 - lane, sent] : null;
    const clock = t + (seed + lane * 0.37) * period, n = Math.floor(clock / period), c = clock - n * period;
    return c < life && hash(n * 3 + lane + sd) < 0.75 ? [n, c] : null;
  };
  const fade = (c: number, life: number) => clamp(Math.min(c, life - c) / SHIP_FADE_S, 0, 1);
  const type = (n: number, lane: number): ShipType => hash(n * 11 + lane * 5 + sd + 1) < 0.5 ? 'container' : 'freighter';

  // Passing ships, in on one lane and out on the other, on the right-hand side of the channel.
  const from = path.edge + 2.5, to = path.total - BERTH_CLEAR, room = to - from;   // whole hulls on the map
  if (room >= 2) {
    const run = Math.min(RUN_TILES, room), life = run / SHIP_SPEED;
    for (const lane of [0, 1]) {
      const tc = turn(lane, per.lane, life);
      if (!tc) continue;
      const [n, c] = tc, start = from + hash(n * 7 + lane + sd + 2) * (room - run);
      const s = lane === 0 ? start + c * SHIP_SPEED : start + run - c * SHIP_SPEED;
      const p = along(path, s), hx = lane === 0 ? p.dx : -p.dx, hy = lane === 0 ? p.dy : -p.dy;
      out.push({ x: p.x - hy * 0.2, y: p.y + hx * 0.2, hx, hy, sp: 1, type: type(n, lane), work: -1, a: fade(c, life) });
    }
  }
  // A ship at the docks, lying along the quay while the cranes work.
  const tc = turn(2, per.dock, SHIP_DOCKED_S);
  if (tc) {
    const [n, c] = tc, f = hash(n * 13 + sd + 3) < 0.5 ? 1 : -1;
    out.push({ x: berth.x, y: berth.y, hx: berth.qx * f, hy: berth.qy * f, sp: 0, type: type(n, 2), work: c, a: fade(c, SHIP_DOCKED_S) });
  }
  return out;
}

// ── Drawing ─────────────────────────────────────────────────────────────────

const BOX = ['#c75b3c', '#3f74a8', '#d8a640', '#5a8f5a', '#8a8f96', '#b54a6a', '#2f6f73', '#e08a3c'];
const shade = (hex: string, f: number) => { const n = parseInt(hex.slice(1), 16); const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))); return `rgb(${c(16)},${c(8)},${c(0)})`; };

/** A block standing on the ship: outline in ship coords (f along from the middle, s across), base height and height in tiles. */
interface Part { poly: [number, number][]; z: number; h: number; top: string; side: string; win?: number }

const rect = (f0: number, s0: number, f1: number, s1: number): [number, number][] => [[f0, s0], [f1, s0], [f1, s1], [f0, s1]];

/** Length and beam in tiles. */
export const SHIP_SIZE: Record<ShipType, { L: number; B: number }> = { container: { L: 3.8, B: 0.8 }, freighter: { L: 3.2, B: 0.7 } };

const partCache = new Map<string, Part[]>();
function shipParts(type: ShipType, cargo: number): Part[] {
  const key = type + cargo;
  const hit = partCache.get(key);
  if (hit) return hit;
  const { L, B } = SHIP_SIZE[type], hl = L / 2, hb = B / 2;
  const hull: [number, number][] = [[-hl, -hb], [hl - 0.45, -hb], [hl, 0], [hl - 0.45, hb], [-hl, hb]];
  const hullC = type === 'freighter' ? '#2f5a3f' : '#2f4a6b';
  const parts: Part[] = [
    { poly: hull, z: -0.03, h: 0.1, top: '#a8352f', side: '#a8352f' },
    { poly: hull, z: 0.07, h: 0.15, top: type === 'freighter' ? '#9a8f7a' : '#8d9196', side: hullC },
    { poly: rect(-hl + 0.08, -hb * 0.76, -hl + 0.55, hb * 0.76), z: 0.22, h: 0.45, top: '#f2f0ea', side: '#dcd8ce', win: 3 },
    { poly: rect(-hl + 0.17, -0.09, -hl + 0.36, 0.09), z: 0.67, h: 0.18, top: '#c94a3a', side: type === 'freighter' ? '#2a2a2a' : '#c94a3a' },
  ];
  if (type === 'freighter') {
    for (let k = 0; k < 3; k++) parts.push({ poly: rect(-hl + 0.8 + k * 0.72, -0.24, -hl + 1.32 + k * 0.72, 0.24), z: 0.22, h: 0.06, top: '#3f6b4f', side: '#2f5a3f' });
    for (const m of [-hl + 0.7, -hl + 2.15]) parts.push({ poly: rect(m - 0.035, -0.035, m + 0.035, 0.035), z: 0.22, h: 0.6, top: '#d8a640', side: '#b08830' });
  } else {
    for (let k = 0, f = -hl + 0.68; f + 0.33 < hl - 0.5; k++, f += 0.37) {
      const n = (cargo * 31 + k * 7) >>> 0, h = 0.16 * (1 + Math.floor(hash(n) * 3)), col = BOX[Math.floor(hash(n + 5) * BOX.length)];
      parts.push({ poly: rect(f, -hb * 0.84, f + 0.33, hb * 0.84), z: 0.22, h, top: shade(col, 1.12), side: col });
    }
  }
  partCache.set(key, parts);
  return parts;
}

/**
 * Draws one ship. `ox, oy` is the screen position of tile corner (0, 0) and
 * `tile` the tile size in pixels; heights rise straight up the screen, like
 * every clay sprite. `t` is seconds, for the bobbing, smoke and wake. `cargo`
 * picks the box colours.
 */
export function drawShip(ctx: CanvasRenderingContext2D, st: ShipState, ox: number, oy: number, tile: number, t: number, cargo: number): void {
  const { L, B } = SHIP_SIZE[st.type];
  const W = (f: number, s: number): [number, number] => [st.x + f * st.hx - s * st.hy, st.y + f * st.hy + s * st.hx];
  const S = (x: number, y: number, z: number): [number, number] => [ox + x * tile, oy + (y - z) * tile];
  const hl = L / 2;

  // The wake: two lines spreading from the stern and a foam trail, stronger with speed.
  if (st.sp > 0.04) {
    const a = Math.min(0.8, st.sp * 0.9);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(235,245,255,${a * 0.5})`; ctx.lineWidth = Math.max(1.5, tile * 0.16);
    ctx.beginPath(); ctx.moveTo(...S(...W(-hl, 0), 0)); ctx.lineTo(...S(...W(-hl - 2.2, 0), 0)); ctx.stroke();
    ctx.lineWidth = Math.max(1, tile * 0.05);
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(235,245,255,${a * (1 - k * 0.3)})`;
      ctx.beginPath(); ctx.moveTo(...S(...W(-hl - k * 0.5, sd * (B / 2 + k * 0.15)), 0)); ctx.lineTo(...S(...W(-hl - k * 0.5 - 0.6, sd * (B / 2 + 0.15 + k * 0.17)), 0)); ctx.stroke();
    }
    // A bow wave.
    ctx.strokeStyle = `rgba(235,245,255,${a * 0.7})`;
    ctx.beginPath(); ctx.moveTo(...S(...W(hl - 0.5, -B / 2 - 0.08), 0)); ctx.lineTo(...S(...W(hl + 0.05, 0), 0)); ctx.lineTo(...S(...W(hl - 0.5, B / 2 + 0.08), 0)); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Far out: a dash in the hull's colour.
  if (tile < 9) {
    ctx.strokeStyle = st.type === 'freighter' ? '#2f5a3f' : '#2f4a6b'; ctx.lineWidth = Math.max(2, B * tile); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...S(...W(-hl + 0.3, 0), 0)); ctx.lineTo(...S(...W(hl - 0.3, 0), 0)); ctx.stroke(); ctx.lineCap = 'butt';
    return;
  }

  const bob = Math.sin(t * 1.3 + cargo) * 0.02;
  const parts = shipParts(st.type, cargo);

  // Shadow on the water, down and to the right like the painted sprites'.
  ctx.beginPath();
  for (const p of parts.slice(0, 3)) {
    const top = Math.max(0, p.z + p.h), steps = Math.ceil(top / 0.08);
    for (let q = 0; q <= steps; q++) {
      const sh = top * q / steps * 0.55;
      p.poly.forEach(([f, s], k) => { const [x, y] = W(f, s); const q = S(x + sh * 0.9, y + sh * 0.35, 0); if (k) ctx.lineTo(...q); else ctx.moveTo(...q); });
      ctx.closePath();
    }
  }
  ctx.fillStyle = 'rgba(8,24,44,0.3)'; ctx.fill('nonzero');

  // The hull first, then what stands on it, back to front.
  const world = parts.map(p => p.poly.map(([f, s]) => W(f, s)));
  const order = parts.map((_, k) => k).sort((a, b) => (a < 2 || b < 2) ? a - b : Math.max(...world[a].map(q => q[1])) - Math.max(...world[b].map(q => q[1])));
  for (const k of order) drawPart(ctx, parts[k], world[k], bob, S);

  if (st.type === 'freighter') {
    // Derricks from the masts.
    ctx.strokeStyle = '#b08830'; ctx.lineWidth = Math.max(1, tile * 0.05);
    for (const m of [-hl + 0.7, -hl + 2.15]) { ctx.beginPath(); ctx.moveTo(...S(...W(m, 0), 0.75 + bob)); ctx.lineTo(...S(...W(m + 0.65, 0), 0.4 + bob)); ctx.stroke(); }
  }
  // Funnel smoke.
  const [fx, fy] = W(-hl + 0.26, 0);
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.45 + k / 4) % 1, [x, y] = S(fx - st.hx * f * 0.5 + f * 0.2, fy - st.hy * f * 0.5, 0.87 + f * 0.6);
    ctx.fillStyle = `rgba(235,235,235,${0.5 * (1 - f)})`; ctx.beginPath(); ctx.arc(x, y, tile * (0.05 + f * 0.16), 0, Math.PI * 2); ctx.fill();
  }
}

function drawPart(ctx: CanvasRenderingContext2D, p: Part, pts: [number, number][], bob: number, S: (x: number, y: number, z: number) => [number, number]): void {
  const z0 = p.z + bob, z1 = z0 + p.h;
  let cx = 0, cy = 0;
  for (const q of pts) { cx += q[0]; cy += q[1]; }
  cx /= pts.length; cy /= pts.length;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    if (ny <= 1e-6) continue;   // faces away from the camera
    const m = Math.hypot(nx, ny);
    ctx.fillStyle = Math.abs(nx) / m > 0.2 ? shade(p.side.startsWith('#') ? p.side : '#808080', 0.88) : p.side;
    ctx.beginPath(); ctx.moveTo(...S(a[0], a[1], z0)); ctx.lineTo(...S(b[0], b[1], z0)); ctx.lineTo(...S(b[0], b[1], z1)); ctx.lineTo(...S(a[0], a[1], z1)); ctx.closePath(); ctx.fill();
    if (p.win) {
      ctx.strokeStyle = 'rgba(40,52,64,0.6)'; ctx.lineWidth = 1;
      for (let w = 1; w <= p.win; w++) {
        const z = z0 + p.h * w / (p.win + 1);
        ctx.beginPath(); ctx.moveTo(...S(a[0] + (b[0] - a[0]) * 0.12, a[1] + (b[1] - a[1]) * 0.12, z)); ctx.lineTo(...S(b[0] - (b[0] - a[0]) * 0.12, b[1] - (b[1] - a[1]) * 0.12, z)); ctx.stroke();
      }
    }
  }
  ctx.fillStyle = p.top;
  ctx.beginPath(); pts.forEach((q, k) => { const s = S(q[0], q[1], z1); if (k) ctx.lineTo(...s); else ctx.moveTo(...s); }); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1; ctx.stroke();
}
