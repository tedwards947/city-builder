// Outside connections (CONNECTIONS_DESIGN.md, sim/connections.ts), as drawn.
//
//   THE STUB    Beyond the map edge at each point, a few tiles of highway or ground
//               track drawn with the same pieces as on the map, on a faint verge,
//               fading into the dark. A point not yet joined shows its stub dimmed.
//   THE SIGN    Beside the first stub tile: a green board with a highway and an arrow
//               pointing out to the region, or a blue one with a train.
//   THE POINT   On the map, the point's own tile. Not yet joined, it has a faint dashed
//               amber outline; while the player holds the highway tool (highway points)
//               or the track tool (rail points) it pulses brighter, as "build here".
//               Once joined, the road or track on it runs on into the stub (chunkPainter
//               adds the off-map side through offMapSide).
//
// Points change only on a new city or a load, and whether one is joined comes from the
// tile itself, so nothing here needs a cache.

import type { World } from '../../sim/World';
import { connectionOn, edgeOf, isJoined, type ConnectionKind } from '../../sim/connections';
import { ROAD_HIGHWAY, ROAD_NONE } from '../../sim/constants';
import { drawClayRoad } from './roads';
import { drawRailTile } from './rail';

type Ctx = CanvasRenderingContext2D;

/** Tiles of stub beyond the edge; the last ones fade out. */
const STUB_TILES = 4;
/** Outward step per edge (EDGE_N, E, S, W). */
const OUT: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const BG = '#0d1b2a';
const VERGE = 'rgba(116,140,96,0.32)';
const HINT = '#ffc94a', HINT_EDGE = 'rgba(20,16,4,0.85)';
const SIGN = { highway: '#2f7d4a', rail: '#2c5d9e' } as const;

/**
 * The edge whose off-map side the road or track on tile `i` runs on to: the tile is a
 * point of this kind. -1 otherwise. Cheap for tiles away from the edge.
 */
export function offMapSide(world: World, i: number, kind: ConnectionKind): number {
  const { width, height } = world.grid;
  const edge = edgeOf(width, height, i);
  if (edge < 0) return -1;
  const c = connectionOn(world, i);
  return c && c.kind === kind ? c.edge : -1;
}

/**
 * Every point's stub and sign, off the map. `ox, oy`: screen position of tile (0, 0);
 * `T`: pixels a tile. Drawn after the chunk layer, before the map's edge line.
 */
export function drawConnectionStubs(ctx: Ctx, world: World, ox: number, oy: number, T: number, cw: number, ch: number): void {
  if (world.connections.length === 0) return;
  const { width } = world.grid;
  const span = (STUB_TILES + 2) * T;
  for (const c of world.connections) {
    const tx = c.tile % width, ty = (c.tile - tx) / width;
    const [dx, dy] = OUT[c.edge];
    const ex = ox + (tx + 0.5) * T, ey = oy + (ty + 0.5) * T;   // the point's tile centre
    if (ex < -span || ey < -span || ex > cw + span || ey > ch + span) continue;
    const joined = isJoined(world, c);
    const along = dx !== 0;   // the stub runs east–west
    ctx.save();
    ctx.globalAlpha = joined ? 1 : 0.55;

    // The verge under the stub: a tile and a half wide.
    const x0 = Math.min(ex + dx * T * 0.5, ex + dx * (STUB_TILES + 0.5) * T), y0 = Math.min(ey + dy * T * 0.5, ey + dy * (STUB_TILES + 0.5) * T);
    ctx.fillStyle = VERGE;
    if (along) ctx.fillRect(x0, ey - T * 0.75, STUB_TILES * T, T * 1.5);
    else ctx.fillRect(ex - T * 0.75, y0, T * 1.5, STUB_TILES * T);

    // The road or track, the same pieces as on the map, joined both ways along the stub.
    for (let k = 1; k <= STUB_TILES; k++) {
      const px = Math.floor(ox + (tx + dx * k) * T), py = Math.floor(oy + (ty + dy * k) * T), Ti = Math.ceil(T);
      if (c.kind === 'highway') {
        const H = ROAD_HIGHWAY, N = ROAD_NONE;
        drawClayRoad(ctx, H, along ? [N, H, N, H] : [H, N, H, N], false, px, py, Ti);
      } else {
        drawRailTile(ctx, along ? 2 | 8 : 1 | 4, px, py, Ti);
      }
    }

    // Fade out into the dark: clear at the map edge, solid by the stub's end.
    const fx0 = ex + dx * T * 0.5, fy0 = ey + dy * T * 0.5, fx1 = ex + dx * (STUB_TILES + 0.5) * T, fy1 = ey + dy * (STUB_TILES + 0.5) * T;
    const g = ctx.createLinearGradient(fx0, fy0, fx1, fy1);
    g.addColorStop(0, 'rgba(13,27,42,0)'); g.addColorStop(0.35, 'rgba(13,27,42,0.1)'); g.addColorStop(1, BG);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    // Two pixels past the end too: the road's arms run a pixel past their tile.
    if (along) ctx.fillRect(x0 - 2, ey - T, STUB_TILES * T + 4, T * 2);
    else ctx.fillRect(ex - T, y0 - 2, T * 2, STUB_TILES * T + 4);

    // The sign, beside the first stub tile (right of a north–south stub, above an east–west one).
    if (T >= 7) drawSign(ctx, c.kind, c.edge, ex + dx * T * 1.6 + (along ? 0 : T * 1.05), ey + dy * T * 1.6 + (along ? -T * 1.05 : 0), T, joined);
    ctx.restore();
  }
}

/** The board: posts, a panel with a white rim, a highway or a train, and an arrow out to the region. */
function drawSign(ctx: Ctx, kind: ConnectionKind, edge: number, cx: number, cy: number, T: number, joined: boolean): void {
  const w = T * 0.86, h = T * 0.54, top = cy - h * 0.8, left = cx - w / 2;
  ctx.globalAlpha = joined ? 1 : 0.7;
  // Posts and their shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, top + h + T * 0.22, w * 0.42, T * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9aa0a6';
  const pw = Math.max(1, T * 0.04);
  ctx.fillRect(left + w * 0.22 - pw / 2, top + h - 1, pw, T * 0.22);
  ctx.fillRect(left + w * 0.78 - pw / 2, top + h - 1, pw, T * 0.22);
  // Panel.
  const r = Math.max(1, T * 0.06);
  ctx.fillStyle = '#f2f2ee';
  ctx.beginPath(); ctx.roundRect(left, top, w, h, r); ctx.fill();
  const b = Math.max(1, T * 0.035);
  ctx.fillStyle = SIGN[kind];
  ctx.beginPath(); ctx.roundRect(left + b, top + b, w - b * 2, h - b * 2, Math.max(0.5, r - b)); ctx.fill();
  // The picture on the left half.
  const ix = left + w * 0.3, iy = top + h / 2, s = h * 0.32;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff';
  if (kind === 'highway') {
    // Two carriageways narrowing to the horizon.
    ctx.beginPath();
    ctx.moveTo(ix - s * 1.1, iy + s); ctx.lineTo(ix - s * 0.15, iy - s); ctx.lineTo(ix - s * 0.02, iy - s); ctx.lineTo(ix - s * 0.4, iy + s); ctx.closePath();
    ctx.moveTo(ix + s * 1.1, iy + s); ctx.lineTo(ix + s * 0.15, iy - s); ctx.lineTo(ix + s * 0.02, iy - s); ctx.lineTo(ix + s * 0.4, iy + s); ctx.closePath();
    ctx.fill();
  } else {
    // A train seen from the front: body, window, lamps.
    ctx.beginPath(); ctx.roundRect(ix - s * 0.75, iy - s, s * 1.5, s * 1.75, s * 0.35); ctx.fill();
    ctx.fillStyle = SIGN.rail;
    ctx.fillRect(ix - s * 0.5, iy - s * 0.7, s, s * 0.6);
    ctx.beginPath(); ctx.arc(ix - s * 0.4, iy + s * 0.35, s * 0.14, 0, Math.PI * 2); ctx.arc(ix + s * 0.4, iy + s * 0.35, s * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ix - s * 0.8, iy + s * 0.9, s * 1.6, Math.max(0.6, s * 0.12));
  }
  // The arrow on the right half, pointing the way the region lies.
  const ax = left + w * 0.72, ay = iy, a = h * 0.3, [ux, uy] = OUT[edge];
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(uy, ux));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(a, 0); ctx.lineTo(0, -a * 0.8); ctx.lineTo(0, -a * 0.32); ctx.lineTo(-a, -a * 0.32); ctx.lineTo(-a, a * 0.32); ctx.lineTo(0, a * 0.32); ctx.lineTo(0, a * 0.8); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The points not yet joined, outlined on the map. `placing`: the kind whose road or
 * track the player is placing, whose points pulse; null for a faint steady outline.
 */
export function drawConnectionHints(ctx: Ctx, world: World, ox: number, oy: number, T: number, now: number, placing: ConnectionKind | null): void {
  const { width } = world.grid;
  for (const c of world.connections) {
    if (isJoined(world, c)) continue;
    const live = placing === c.kind;
    const tx = c.tile % width, ty = (c.tile - tx) / width;
    const x = ox + tx * T, y = oy + ty * T;
    const pulse = live ? 0.5 + 0.5 * Math.sin(now / 260) : 0;
    const lw = Math.max(1.5, T * (live ? 0.09 : 0.05)), inset = lw / 2 + 0.5;
    ctx.save();
    ctx.globalAlpha = live ? 0.75 + 0.25 * pulse : 0.55;
    if (live) {   // a soft glow under the outline
      ctx.fillStyle = `rgba(255,201,74,${0.12 + 0.18 * pulse})`;
      ctx.fillRect(x, y, T, T);
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = HINT_EDGE; ctx.lineWidth = lw + 2;
    ctx.strokeRect(x + inset, y + inset, T - inset * 2, T - inset * 2);
    ctx.strokeStyle = HINT; ctx.lineWidth = lw;
    ctx.setLineDash(live ? [] : [Math.max(2, T * 0.18), Math.max(2, T * 0.12)]);
    ctx.strokeRect(x + inset, y + inset, T - inset * 2, T - inset * 2);
    ctx.restore();
  }
}
