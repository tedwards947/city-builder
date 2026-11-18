// Ships on the sea lanes of seaports: painted clay ships (art/clay-set/raw-port/sheet-4.png,
// cut by port-sheet.mjs), drawn as traffic like the cars on roads.
//
// The camera never turns and a painted ship has only four looks (side-on either
// way, bow-on, stern-on), so a ship never turns where you can see it: now and
// then one fades in on a straight run of the port's shipRoute (sim/seaport.ts),
// sails along it and fades out before the run ends. Now and then one lies at
// the docks a while, along the quay, with the cranes working. Ships are sparse,
// and busier ports see more. Nothing here is simulated: what is about is worked
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

/** Tiles a second, the time a ship lies at the docks, a fade, and the most of a run one ship sails. */
export const SHIP_SPEED = 0.8;
export const SHIP_DOCKED_S = 24;
export const SHIP_FADE_S = 1.5;
const RUN_TILES = 7;
/** A run must be this long (tiles, centre to centre) for a ship to sail it. */
const MIN_RUN = 2.5;
/** Lane tiles left out at each end: by the docks (passing ships keep clear of the berth) and at the map's edge (whole hulls on the map). */
const CLEAR_DOCKS = 3, CLEAR_EDGE = 1;

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

/** Seconds between chances of a passing ship on each lane, and of a ship at the docks (a game day is 4 s at 1×). */
export function shipPeriods(shipsPerDay: number): { lane: number; dock: number } {
  return { lane: clamp(32 / shipsPerDay, 16, 60), dock: clamp(64 / shipsPerDay, 40, 120) };
}

/**
 * The ships about a port at time `t` (seconds): at most one coming in, one
 * going out and one at the docks. `seed` (0–1) staggers ports. `sent` is
 * seconds since the ?debug=true "Send ship" button, or -1: then each lane runs
 * one ship from that moment, trade or not.
 */
export function shipsAt(runs: readonly Run[], berth: Berth, t: number, shipsPerDay: number, seed: number, sent = -1): ShipState[] {
  const out: ShipState[] = [];
  if (!(shipsPerDay > 0) && sent < 0) return out;
  const per = shipsPerDay > 0 ? shipPeriods(shipsPerDay) : { lane: 1e9, dock: 1e9 };
  const sd = Math.floor(seed * 1e6);
  // Where one lane's clock is: [ship number, seconds into its turn], or null when this turn has no ship.
  const turn = (lane: number, period: number, life: number): [number, number] | null => {
    if (sent >= 0) return sent < life ? [-1 - lane, sent] : null;
    const clock = t + (seed + lane * 0.37) * period, n = Math.floor(clock / period), c = clock - n * period;
    return c < life && hash(n * 3 + lane + sd) < 0.75 ? [n, c] : null;
  };
  const fade = (c: number, life: number) => clamp(Math.min(c, life - c) / SHIP_FADE_S, 0, 1);
  // The freighter only has a side-on look, so it only sails east or west.
  const type = (n: number, lane: number, side: boolean): ShipType => side && hash(n * 11 + lane * 5 + sd + 1) < 0.4 ? 'freighter' : 'container';

  // Passing ships: lane 0 comes in (against the run), lane 1 goes out, each on its right-hand side.
  for (const lane of [0, 1]) {
    if (runs.length === 0) break;
    // The run is picked per ship, so its life (the run's length) is only known once the ship number is.
    const tc = turn(lane, per.lane, RUN_TILES / SHIP_SPEED);
    if (!tc) continue;
    const [n, c] = tc;
    const r = runs[Math.floor(hash(n * 5 + lane + sd + 4) * runs.length)];
    const go = Math.min(RUN_TILES, r.len), life = go / SHIP_SPEED;
    if (c >= life) continue;
    const start = hash(n * 7 + lane + sd + 2) * (r.len - go);
    const s = lane === 1 ? start + c * SHIP_SPEED : r.len - start - c * SHIP_SPEED;
    const hx = lane === 1 ? r.dx : -r.dx, hy = lane === 1 ? r.dy : -r.dy;
    out.push({ x: r.x + r.dx * s - hy * 0.2, y: r.y + r.dy * s + hx * 0.2, hx, hy, type: type(n, lane, hx !== 0), work: -1, a: fade(c, life) });
  }
  // A ship at the docks, lying along the quay while the cranes work.
  const tc = turn(2, per.dock, SHIP_DOCKED_S);
  if (tc) {
    const [n, c] = tc, f = hash(n * 13 + sd + 3) < 0.5 ? 1 : -1;
    out.push({ x: berth.x, y: berth.y, hx: berth.qx * f, hy: berth.qy * f, type: type(n, 2, berth.qx !== 0), work: c, a: fade(c, SHIP_DOCKED_S) });
  }
  return out;
}

/** The painted sprite for a ship, and whether to mirror it (the side-on pictures face east). */
export function shipSprite(st: ShipState): { name: string; flip: boolean } {
  if (st.hx !== 0) return { name: st.type === 'freighter' ? 'freighter-side' : 'ship-side', flip: st.hx < 0 };
  return { name: st.hy > 0 ? 'ship-south' : 'ship-north', flip: false };
}
