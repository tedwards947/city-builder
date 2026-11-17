// Buildings that stand on several tiles (see BIG_BUILDINGS_DESIGN.md).
//
// A big building is drawn once, when the lot loop reaches its DRAW TILE: the
// first tile of its lowest row. Tiles draw top row first, so by then every
// neighbour behind it is down, and those in front come later and overlap it.
// Until real art exists it is a code-drawn stand-in: the chunk layer lays a
// plain slab on each of its tiles, and this file adds the outline and a few
// clay shapes (stacks, tanks, pools) across the whole footprint.

import { buildingShape, type ShapeOffset } from '../../sim/buildingShapes';
import {
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT,
} from '../../sim/constants';
import { tileSetEdges, type TilePoint } from './tileOutline';

/** The slab every big building's tiles get in the chunk layer. */
export const BIG_SLAB = '#b7b0a2';
const SLAB_EDGE = '#8d8679', SLAB_RIM = '#cfc9bc';

export interface ShapeBox {
  /** Bounding box of the shape, as offsets from the anchor (inclusive). */
  minX: number; minY: number; maxX: number; maxY: number;
  /** The draw tile, as an offset from the anchor: lowest row, leftmost tile in it. */
  drawDx: number; drawDy: number;
}

const boxes = new Map<number, { shape: readonly ShapeOffset[]; box: ShapeBox }>();

/** The bounding box and draw tile of a kind's shape. Cached until the kind's shape changes. */
export function shapeBox(kind: number): ShapeBox {
  const shape = buildingShape(kind);
  const hit = boxes.get(kind);
  if (hit && hit.shape === shape) return hit.box;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const [dx, dy] of shape) { if (dx < minX) minX = dx; if (dx > maxX) maxX = dx; if (dy < minY) minY = dy; if (dy > maxY) maxY = dy; }
  let drawDx = Infinity;
  for (const [dx, dy] of shape) if (dy === maxY && dx < drawDx) drawDx = dx;
  const box = { minX, minY, maxX, maxY, drawDx, drawDy: maxY };
  boxes.set(kind, { shape, box });
  return box;
}

/** The tiles of a `kind` building anchored at (ax, ay). */
export function shapeTiles(kind: number, ax: number, ay: number): TilePoint[] {
  return buildingShape(kind).map(([dx, dy]) => ({ x: ax + dx, y: ay + dy }));
}

type Style = 'power' | 'water' | 'sewage' | 'generic';
// The small kinds are listed so a test shape on one draws in style.
const STYLE: Record<number, Style> = {
  [BUILDING_POWER_PLANT]: 'power', [BUILDING_WATER_TOWER]: 'water', [BUILDING_SEWAGE_PLANT]: 'sewage',
  [BUILDING_LARGE_POWER_PLANT]: 'power', [BUILDING_LARGE_WATER_PLANT]: 'water', [BUILDING_LARGE_SEWAGE_PLANT]: 'sewage',
};

function box3d(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rise: number, top: string, side: string): void {
  ctx.fillStyle = 'rgba(30,26,20,0.22)';
  ctx.fillRect(x + rise * 0.35, y + rise * 0.2, w, h);       // shadow
  ctx.fillStyle = side;
  ctx.fillRect(x, y - rise, w, h + rise);
  ctx.fillStyle = top;
  ctx.fillRect(x, y - rise, w, h);
}

function drum(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rise: number, top: string, side: string): void {
  ctx.fillStyle = 'rgba(30,26,20,0.22)';
  ctx.beginPath(); ctx.ellipse(cx + rise * 0.35, cy + rise * 0.15, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = side;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI); ctx.lineTo(cx - r, cy - rise); ctx.lineTo(cx + r, cy - rise); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.ellipse(cx, cy - rise, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
}

/**
 * The stand-in for a big building: an outline round its footprint and a few
 * clay shapes for what it is. `tiles` are its tiles; `X` and `Y` map a tile
 * corner to canvas pixels. `t` is seconds, for the little that moves.
 */
export function drawBigStandIn(
  ctx: CanvasRenderingContext2D, kind: number, tiles: readonly TilePoint[],
  X: (tx: number) => number, Y: (ty: number) => number, t: number,
): void {
  if (tiles.length === 0) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of tiles) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
  const tile = X(x0 + 1) - X(x0);
  const edges = tileSetEdges(tiles);

  // The slab's edge, following the shape.
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, tile * 0.07);
  ctx.strokeStyle = SLAB_RIM;
  ctx.beginPath();
  for (const e of edges) { ctx.moveTo(X(e.x0), Y(e.y0)); ctx.lineTo(X(e.x1), Y(e.y1)); }
  ctx.stroke();
  ctx.lineWidth = Math.max(1, tile * 0.03);
  ctx.strokeStyle = SLAB_EDGE;
  ctx.stroke();
  if (tile < 6) return;      // far out, the slab and its edge are all that reads

  // The shapes sit on the anchor's row block: the widest full rectangle is the
  // bounding box for a square; for other shapes, each tile gets a small block.
  const full = tiles.length === (x1 - x0 + 1) * (y1 - y0 + 1);
  const style: Style = STYLE[kind] ?? 'generic';
  if (!full || style === 'generic') {
    for (const p of tiles) {
      const px = X(p.x), py = Y(p.y);
      box3d(ctx, px + tile * 0.22, py + tile * 0.3, tile * 0.56, tile * 0.46, tile * 0.18, '#d8d2c6', '#a59d8e');
    }
    return;
  }
  const L = X(x0), T = Y(y0), W = X(x1 + 1) - L, H = Y(y1 + 1) - T;
  if (style === 'power') {
    // A turbine hall and two striped stacks.
    box3d(ctx, L + W * 0.1, T + H * 0.42, W * 0.5, H * 0.42, H * 0.16, '#c9c3b6', '#8f887b');
    box3d(ctx, L + W * 0.16, T + H * 0.5, W * 0.38, H * 0.1, H * 0.2, '#7f8d9a', '#5f6b76');
    for (const fx of [0.7, 0.86]) {
      const cx = L + W * fx, cy = T + H * 0.72, r = W * 0.055, rise = H * 0.5;
      drum(ctx, cx, cy, r, rise, '#e8e2d6', '#c4bdaf');
      ctx.fillStyle = '#c0574a';
      ctx.fillRect(cx - r, cy - rise * 0.8, r * 2, rise * 0.1);
      ctx.fillStyle = '#4a4640';
      ctx.beginPath(); ctx.ellipse(cx, cy - rise, r * 0.6, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (style === 'water') {
    // Two round tanks and a pump house.
    for (const [fx, fy] of [[0.3, 0.36], [0.68, 0.6]] as const) {
      drum(ctx, L + W * fx, T + H * fy, W * 0.2, H * 0.12, '#8fc3dc', '#5f93ad');
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(L + W * (fx - 0.05), T + H * (fy - 0.16), W * 0.08, W * 0.04, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    box3d(ctx, L + W * 0.14, T + H * 0.68, W * 0.22, H * 0.18, H * 0.1, '#d8d2c6', '#a59d8e');
  } else {
    // Two settling pools with a slowly turning arm, and a shed.
    for (const [fx, fy, turn] of [[0.3, 0.34, 1], [0.68, 0.62, -1]] as const) {
      const cx = L + W * fx, cy = T + H * fy, r = W * 0.2;
      ctx.fillStyle = '#8d8679';
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6f7d5a';
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.86, r * 0.68, 0, 0, Math.PI * 2); ctx.fill();
      const a = t * 0.5 * turn;
      ctx.strokeStyle = '#d8d2c6'; ctx.lineWidth = Math.max(1, tile * 0.04);
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r * 0.82, cy - Math.sin(a) * r * 0.65); ctx.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.65); ctx.stroke();
    }
    box3d(ctx, L + W * 0.12, T + H * 0.7, W * 0.2, H * 0.16, H * 0.1, '#d8d2c6', '#a59d8e');
  }
}
