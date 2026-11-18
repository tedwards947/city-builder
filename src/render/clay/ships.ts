// Ships on the sea lanes of seaports: painted clay ships (art/clay-set/raw-port/sheet-4.png,
// cut by port-sheet.mjs), drawn as traffic like the cars on roads.
//
// The owner's picks from art/clay-set/ships.html: ships 2.25 tiles long (A3+),
// passing only out at sea (B4), a wake, a gentle bob and ripples (C3), and rare:
// one ship about a port at a time (D1). The camera never turns and a painted
// ship has only four looks, so a ship never turns where you can see it: it fades
// in on a long straight run of the port's shipRoute (sim/seaport.ts) well away
// from the port, sails along it and fades out before the run ends. Or it lies at
// the docks a while, under the cranes, while they work. Nothing is simulated: what is about is worked
// out from the clock, the route and the port's ships a day, so it costs nothing
// off screen and needs no saving. Ships are drawn above the water and below every
// building (the cranes reach over them), and are clipped out of bridge tiles.

/** Where a ship lies when docked: the middle of the berth and which way the quay runs (a unit vector along x or y). */
export interface Berth { x: number; y: number; qx: number; qy: number }

export type ShipType = 'container' | 'freighter';

export interface ShipState {
  /** Middle of the ship, in tiles. */
  x: number; y: number;
  /** The way the bow points: one of (±1, 0), (0, ±1). */
  hx: number; hy: number;
  type: ShipType;
  /** Seconds since the ship tied up, while it lies at the docks; -1 while it sails. */
  work: number;
  /** Opacity, 0–1: ships fade in and out like the cars. */
  a: number;
}

/** A straight stretch of a sea lane, walked from (x, y) for `len` tiles along (dx, dy). */
export interface Run { x: number; y: number; dx: number; dy: number; len: number }

/** A ship's length in tiles; the sprites are baked at this size (port-sheet.mjs). */
export const SHIP_LENGTH = 2.25;
/** Tiles a second, the time a ship lies at the docks, a fade, and the most of a run one ship sails. */
export const SHIP_SPEED = 0.8;
export const SHIP_DOCKED_S = 24;
export const SHIP_FADE_S = 1.5;
const RUN_TILES = 12;
/** A run must be this long (tiles, centre to centre) for a ship to sail it. */
const MIN_RUN = 4;
/** Lane tiles left out at each end: by the docks (passing ships stay out at sea) and at the map's edge (whole hulls on the map). */
const CLEAR_DOCKS = 8, CLEAR_EDGE = 2;

/**
 * The straight runs of a route (water tiles from the docks out to the map's
 * edge, stepping four ways), long enough for a ship, with the ends by the docks
 * and the map's edge left out. Each run is walked outwards, away from the docks.
 */
export function shipRuns(route: readonly number[], width: number): Run[] {
  const tiles = route.slice(CLEAR_DOCKS, route.length - CLEAR_EDGE).map(i => ({ x: (i % width) + 0.5, y: Math.floor(i / width) + 0.5 }));
  const runs: Run[] = [];
  let k = 0;
  while (k < tiles.length - 1) {
    const dx = tiles[k + 1].x - tiles[k].x, dy = tiles[k + 1].y - tiles[k].y;
    let e = k + 1;
    while (e < tiles.length - 1 && tiles[e + 1].x - tiles[e].x === dx && tiles[e + 1].y - tiles[e].y === dy) e++;
    if (e - k >= MIN_RUN) runs.push({ x: tiles[k].x, y: tiles[k].y, dx, dy, len: e - k });
    k = e;
  }
  return runs;
}

const hash = (n: number) => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Seconds between chances of a ship about a port: one at a time, every half minute at the busiest. */
export function shipPeriod(shipsPerDay: number): number {
  return clamp(64 / shipsPerDay, 30, 90);
}

/**
 * The ship about a port at time `t` (seconds), if any: one at a time, either
 * passing out at sea or lying at the docks. `seed` (0–1) staggers ports.
 * `sent` is seconds since the ?debug=true "Send ship" button, or -1: then a
 * passing ship and a docked one both show from that moment, trade or not.
 */
export function shipsAt(runs: readonly Run[], berth: Berth, t: number, shipsPerDay: number, seed: number, sent = -1): ShipState[] {
  const sd = Math.floor(seed * 1e6);
  const fade = (c: number, life: number) => clamp(Math.min(c, life - c) / SHIP_FADE_S, 0, 1);
  // The freighter only has a side-on look, so it only sails east or west or lies at a quay running that way.
  const type = (n: number, side: boolean): ShipType => side && hash(n * 11 + sd + 1) < 0.4 ? 'freighter' : 'container';
  const passing = (n: number, c: number, inward: boolean): ShipState | null => {
    if (runs.length === 0) return null;
    const r = runs[Math.floor(hash(n * 5 + sd + 4) * runs.length)];
    const go = Math.min(RUN_TILES, r.len), life = go / SHIP_SPEED;
    if (c >= life) return null;
    const start = hash(n * 7 + sd + 2) * (r.len - go);
    const s = inward ? r.len - start - c * SHIP_SPEED : start + c * SHIP_SPEED;
    const hx = inward ? -r.dx : r.dx, hy = inward ? -r.dy : r.dy;
    // Keep to the right of the lane.
    return { x: r.x + r.dx * s - hy * 0.25, y: r.y + r.dy * s + hx * 0.25, hx, hy, type: type(n, hx !== 0), work: -1, a: fade(c, life) };
  };
  const docked = (n: number, c: number): ShipState | null => {
    if (c >= SHIP_DOCKED_S) return null;
    const f = hash(n * 13 + sd + 3) < 0.5 ? 1 : -1;
    return { x: berth.x, y: berth.y, hx: berth.qx * f, hy: berth.qy * f, type: type(n, berth.qx !== 0), work: c, a: fade(c, SHIP_DOCKED_S) };
  };
  if (sent >= 0) return [passing(-1, sent, true), docked(-2, sent)].filter((x): x is ShipState => x !== null);
  if (!(shipsPerDay > 0)) return [];
  const P = shipPeriod(shipsPerDay), clock = t + seed * P, n = Math.floor(clock / P), c = clock - n * P;
  const roll = hash(n * 3 + sd);
  // A quarter of the turns have no ship; of the rest, about a third lie at the docks, or all of them if no run is long enough.
  const st = roll < 0.25 ? null : roll < 0.5 || runs.length === 0 ? docked(n, c) : passing(n, c, roll < 0.75);
  return st ? [st] : [];
}

/** How far a ship bobs up and down at time `t`, as a share of a tile: a gentle swell, out of step from ship to ship. */
export function shipBob(st: ShipState, t: number): number {
  return Math.sin(t * 1.6 + st.x * 1.7 + st.y * 1.3) * 0.018;
}

/**
 * The water round a ship, drawn under it: a wake spreading from the stern while
 * it sails, ripples round the hull while it lies at the docks. (x, y) is the
 * ship's middle on screen; `tile` the tile size in pixels.
 */
export function drawShipWater(ctx: CanvasRenderingContext2D, st: ShipState, x: number, y: number, tile: number, t: number): void {
  if (tile < 6) return;
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff';
  if (st.work < 0) {
    const half = SHIP_LENGTH * 0.42 * tile, bx = x - st.hx * half, by = y - st.hy * half;
    const px = -st.hy, py = st.hx, len = 1.6 * tile, spread = 0.5 * tile;
    ctx.globalAlpha = st.a * 0.5; ctx.lineWidth = Math.max(1, tile * 0.04);
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx - st.hx * len + px * spread, by - st.hy * len + py * spread);
    ctx.moveTo(bx, by); ctx.lineTo(bx - st.hx * len - px * spread, by - st.hy * len - py * spread);
    ctx.stroke();
    ctx.globalAlpha = st.a * 0.3;
    ctx.beginPath(); ctx.ellipse(bx - st.hx * 0.45 * tile, by - st.hy * 0.45 * tile, st.hx ? 0.5 * tile : 0.13 * tile, st.hy ? 0.5 * tile : 0.13 * tile, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // Two rings slowly widening round the hull.
    const along = st.hx !== 0;
    ctx.lineWidth = Math.max(1, tile * 0.03);
    for (let k = 0; k < 2; k++) {
      const f = ((t * 0.25 + k * 0.5) % 1);
      ctx.globalAlpha = st.a * 0.3 * (1 - f);
      const rx = (along ? SHIP_LENGTH * 0.55 : 0.35) * tile * (1 + f * 0.25), ry = (along ? 0.35 : SHIP_LENGTH * 0.55) * tile * (1 + f * 0.25);
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

/** The painted sprite for a ship, and whether to mirror it (the side-on pictures face east). */
export function shipSprite(st: ShipState): { name: string; flip: boolean } {
  if (st.hx !== 0) return { name: st.type === 'freighter' ? 'freighter-side' : 'ship-side', flip: st.hx < 0 };
  return { name: st.hy > 0 ? 'ship-south' : 'ship-north', flip: false };
}
