/**
 * The track cut into runs for the trains (clay/trains.ts, clay/trainNet.ts): chains of tiles with
 * exactly two joins, ended by junctions and dead ends (a loop is one run), each a sampled centre
 * line in tile units with distance along it.
 */
import type { World } from '../../sim/World';
import { railLinks, LINK_N, LINK_E, LINK_S, LINK_W } from '../../sim/rail';
import { RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY, BUILDING_SUBWAY_STATION, BUILDING_STATION, BUILDING_STATION_ELEVATED } from '../../sim/constants';
import { stationPlatform } from '../../sim/buildingShapes';

export const SIDES = [LINK_N, LINK_E, LINK_S, LINK_W];
export const STEP: Record<number, [number, number]> = { [LINK_N]: [0, -1], [LINK_E]: [1, 0], [LINK_S]: [0, 1], [LINK_W]: [-1, 0] };
export const OPP: Record<number, number> = { [LINK_N]: LINK_S, [LINK_E]: LINK_W, [LINK_S]: LINK_N, [LINK_W]: LINK_E };

/** A run of track as a sampled centre line in tile units, with distance along it. */
export interface Run {
  P: [number, number][];
  D: number[];
  len: number;
  /** Tile indices along the run (for its load). */
  tiles: number[];
  /** Distance along the run of the middle of a station platform on it, if any. */
  stop: number | null;
  /** Stretches of the run (from, to) through straight stations, where the tracks spread round the island (clay/rail.ts). */
  wide: [number, number][];
  /** Bounding box in tiles, for culling. */
  x0: number; y0: number; x1: number; y1: number;
  seed: number;
}

export function edgeMid(tx: number, ty: number, side: number): [number, number] {
  const [dx, dy] = STEP[side]; return [tx + 0.5 + dx / 2, ty + 0.5 + dy / 2];
}
/** Points across one tile from side a to side b (a straight or a quarter turn round their shared corner). */
export function across(tx: number, ty: number, a: number, b: number, out: [number, number][]): void {
  const p = edgeMid(tx, ty, a), q = edgeMid(tx, ty, b);
  if (OPP[a] === b) { out.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], q); return; }
  const cx = tx + ((a | b) & LINK_E ? 1 : 0), cy = ty + ((a | b) & LINK_S ? 1 : 0);
  const A1 = Math.atan2(p[1] - cy, p[0] - cx);
  let A2 = Math.atan2(q[1] - cy, q[0] - cx);
  if (A2 - A1 > Math.PI) A2 -= 2 * Math.PI; if (A1 - A2 > Math.PI) A2 += 2 * Math.PI;
  for (let k = 0; k <= 8; k++) { const A = A1 + (A2 - A1) * k / 8; out.push([cx + 0.5 * Math.cos(A), cy + 0.5 * Math.sin(A)]); }
}

/** The platform tiles of every station of `kind` whose platform is plain track of its level (a subway station's, underground; an elevated station's, overhead). */
function platformTiles(world: World, kind: number): Set<number> {
  const out = new Set<number>(), w = world.grid.width;
  for (const b of world.buildings) if (b.kind === kind) for (const [dx, dy] of stationPlatform(b.kind, b.rot ?? 0)) out.add((b.ty + dy) * w + b.tx + dx);
  return out;
}

/** Cuts one level's track (RAIL_GROUND, RAIL_ELEVATED or RAIL_SUBWAY) into runs. Pure apart from reading the world. */
export function buildRuns(world: World, level: number = RAIL_GROUND): Run[] {
  const { width, height } = world.grid, rail = world.layers.rail, n = width * height;
  const links = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (rail[i] & level) links[i] = railLinks(world, i, level);
  const stops = level === RAIL_SUBWAY ? platformTiles(world, BUILDING_SUBWAY_STATION) : level === RAIL_ELEVATED ? platformTiles(world, BUILDING_STATION_ELEVATED) : null;
  const isPlatform = (t: number): boolean => stops ? stops.has(t) : level === RAIL_GROUND && world.buildingPartRoleAt(t % width, (t - (t % width)) / width) === 'platform';
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
    // Straight stations along the run: each group of their tiles, from half a tile before the first to half after the last.
    const wide: [number, number][] = [];
    const along = (t: number): number => {   // distance along the run nearest tile t's centre
      const cx = t % width + 0.5, cy = (t - (t % width)) / width + 0.5; let best = 0, bd = Infinity;
      P.forEach(([x, y], k) => { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = D[k]; } });
      return best;
    };
    if (level === RAIL_GROUND || level === RAIL_ELEVATED) {
      let g0 = -1;
      for (let k = 0; k <= tiles.length; k++) {
        const on = k < tiles.length && (level === RAIL_GROUND ? world.layers.building[tiles[k]] === BUILDING_STATION : stops!.has(tiles[k]));
        if (on && g0 < 0) g0 = k;
        if (!on && g0 >= 0) { const a = along(tiles[g0]), b = along(tiles[k - 1]); wide.push([Math.min(a, b) - 0.5, Math.max(a, b) + 0.5]); g0 = -1; }
      }
    }
    if (D[D.length - 1] >= 1) runs.push({ P, D, len: D[D.length - 1], tiles, stop, wide, x0, y0, x1, y1, seed: (start * 2654435761 + sideIdx(side) * 40503) >>> 0 });
  };
  // Runs start at junctions and dead ends…
  for (let i = 0; i < n; i++) { const m = links[i]; if (!m || count(m) === 2) continue; for (const s of SIDES) if (m & s && !used[i * 4 + sideIdx(s)]) walk(i, s); }
  // …and what is left is loops.
  for (let i = 0; i < n; i++) { const m = links[i]; if (count(m) !== 2) continue; for (const s of SIDES) if (m & s && !used[i * 4 + sideIdx(s)]) walk(i, s); }
  return runs;
}
