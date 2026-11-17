// Buildings that stand on several tiles (see BIG_BUILDINGS_DESIGN.md).
//
// A big building is drawn once, when the lot loop reaches its DRAW TILE: the
// first tile of its lowest row. Tiles draw top row first, so by then every
// neighbour behind it is down, and those in front come later and overlap it.
// Until real art exists it is a code-drawn stand-in: the chunk layer lays a
// plain slab on each of its tiles, and this file adds the outline and a few
// clay shapes (stacks, tanks, pools) across the whole footprint.

import { buildingShape, shapeRoles, type ShapeOffset } from '../../sim/buildingShapes';
import {
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_SEAPORT,
} from '../../sim/constants';
import { tileSetEdges, type TilePoint, type TileEdge } from './tileOutline';

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

/** The bounding box and draw tile of a kind's shape, turned `rot` quarter turns. Cached until the kind's shape changes. */
export function shapeBox(kind: number, rot = 0): ShapeBox {
  const shape = buildingShape(kind, rot), key = kind * 4 + (rot & 3);
  const hit = boxes.get(key);
  if (hit && hit.shape === shape) return hit.box;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const [dx, dy] of shape) { if (dx < minX) minX = dx; if (dx > maxX) maxX = dx; if (dy < minY) minY = dy; if (dy > maxY) maxY = dy; }
  let drawDx = Infinity;
  for (const [dx, dy] of shape) if (dy === maxY && dx < drawDx) drawDx = dx;
  const box = { minX, minY, maxX, maxY, drawDx, drawDy: maxY };
  boxes.set(key, { shape, box });
  return box;
}

/** The tiles of a `kind` building anchored at (ax, ay), turned `rot`. In the shape's order, so they line up with shapeRoles(kind). */
export function shapeTiles(kind: number, ax: number, ay: number, rot = 0): TilePoint[] {
  return buildingShape(kind, rot).map(([dx, dy]) => ({ x: ax + dx, y: ay + dy }));
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
 * corner to canvas pixels. `t` is seconds, for the little that moves. `water`
 * is a water tile beside the footprint, if the building draws from one: an
 * intake pipe runs out to it.
 */
export function drawBigStandIn(
  ctx: CanvasRenderingContext2D, kind: number, tiles: readonly TilePoint[],
  X: (tx: number) => number, Y: (ty: number) => number, t: number,
  water: TilePoint | null = null,
): void {
  if (tiles.length === 0) return;
  if (kind === BUILDING_SEAPORT) { drawPortStandIn(ctx, kind, tiles, X, Y, t); return; }
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
    if (water) drawIntake(ctx, L, T, W, H, tile, X(water.x) + tile / 2, Y(water.y) + tile / 2, t, true);
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

const CONTAINERS = ['#c0574a', '#4f7fb5', '#d9a441', '#5a8f6a', '#8d6fb0', '#c97b3f'];

/**
 * The seaport's stand-in: a paved yard with a shed, stacked containers and a
 * gantry crane on its quay, and plank docks on piles out over the water.
 * `tiles` are in the shape's order (shapeTiles), so shapeRoles(kind) says
 * which are docks. Works whichever way the port is turned.
 */
export function drawPortStandIn(
  ctx: CanvasRenderingContext2D, kind: number, tiles: readonly TilePoint[],
  X: (tx: number) => number, Y: (ty: number) => number, t: number,
): void {
  const roles = shapeRoles(kind);
  const yard: TilePoint[] = [], docks: TilePoint[] = [];
  tiles.forEach((p, k) => (roles[k] === 'dock' ? docks : yard).push(p));
  if (yard.length === 0) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of yard) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
  const tile = X(x0 + 1) - X(x0);
  // Which way the docks lie from the yard: a unit step.
  let dx = 0, dy = -1;
  if (docks.length > 0) { const d = docks[0]; dx = d.x < x0 ? -1 : d.x > x1 ? 1 : 0; dy = d.y < y0 ? -1 : d.y > y1 ? 1 : 0; }

  // Docks: a shadow on the water, a plank deck short of the seaward edge, piles and bollards.
  for (const p of docks) {
    const px = X(p.x), py = Y(p.y), T = X(p.x + 1) - px;
    const inset = Math.round(T * 0.18);
    // The deck leaves the seaward side of the tile open.
    const L = px + (dx > 0 ? 0 : dx < 0 ? inset : 0), R = px + T - (dx > 0 ? inset : 0);
    const Tp = py + (dy < 0 ? inset : 0), B = py + T - (dy > 0 ? inset : 0);
    ctx.fillStyle = 'rgba(8,24,44,0.35)';
    ctx.fillRect(L + T * 0.06, Tp + T * 0.1, R - L, B - Tp);
    ctx.fillStyle = '#a98a5c';
    ctx.fillRect(L, Tp, R - L, B - Tp);
    if (T >= 8) {
      // Planks run across the way out to sea.
      ctx.strokeStyle = 'rgba(70,50,28,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath();
      const n = 4;
      for (let k = 1; k < n; k++) {
        if (dx !== 0) { const x = Math.round(L + (R - L) * k / n) + 0.5; ctx.moveTo(x, Tp); ctx.lineTo(x, B); }
        else { const y = Math.round(Tp + (B - Tp) * k / n) + 0.5; ctx.moveTo(L, y); ctx.lineTo(R, y); }
      }
      ctx.stroke();
      ctx.fillStyle = '#5b4630';
      const r = Math.max(1, T * 0.07);
      // Piles at the seaward corners.
      const sx = dx > 0 ? R : dx < 0 ? L : null, sy = dy > 0 ? B : dy < 0 ? Tp : null;
      for (const f of [0.12, 0.88]) {
        const cx = sx ?? L + (R - L) * f, cy = sy ?? Tp + (B - Tp) * f;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // The yard's edge, and a stone quay wall along the side the docks are on.
  const L = X(x0), T = Y(y0), W = X(x1 + 1) - L, H = Y(y1 + 1) - T;
  ctx.lineWidth = Math.max(1, tile * 0.05);
  ctx.strokeStyle = SLAB_EDGE;
  ctx.strokeRect(L + 0.5, T + 0.5, W - 1, H - 1);
  const q = Math.max(2, Math.round(tile * 0.14));
  ctx.fillStyle = '#8a8377';
  if (dy < 0) ctx.fillRect(L, T, W, q); else if (dy > 0) ctx.fillRect(L, T + H - q, W, q);
  else if (dx < 0) ctx.fillRect(L, T, q, H); else ctx.fillRect(L + W - q, T, q, H);
  ctx.fillStyle = SLAB_RIM;
  if (dy < 0) ctx.fillRect(L, T + q, W, 1); else if (dy > 0) ctx.fillRect(L, T + H - q - 1, W, 1);
  else if (dx < 0) ctx.fillRect(L + q, T, 1, H); else ctx.fillRect(L + W - q - 1, T, 1, H);
  if (tile < 6) return;

  // Yard furniture is laid out along the quay (u) and away from it (v), so it turns with the port.
  // at(u, v): u 0–1 along the quay, v 0 at the quay to 1 at the back.
  const along = dx === 0;    // the quay runs left-right
  const at = (u: number, v: number): [number, number] => along
    ? [L + W * u, dy < 0 ? T + H * v : T + H * (1 - v)]
    : [dx < 0 ? L + W * v : L + W * (1 - v), T + H * u];
  // A shed along the back.
  {
    const [ax, ay] = at(0.08, 0.95), [bx, by] = at(0.5, 0.68);
    const x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay);
    box3d(ctx, x, y + tile * 0.1, w, h - tile * 0.1, tile * 0.22, '#c9c3b6', '#8f887b');
    box3d(ctx, x + w * 0.08, y + tile * 0.12, w * 0.84, Math.max(1, h * 0.2), tile * 0.26, '#7f8d9a', '#5f6b76');
  }
  // Container stacks in rows.
  let n = 0;
  for (const v of [0.34, 0.56]) for (const u of [0.1, 0.24, 0.38, 0.6, 0.74, 0.88]) {
    if (v > 0.5 && u < 0.55) { n++; continue; }      // the shed stands there
    const [cx, cy] = at(u, v);
    const w = along ? tile * 0.42 : tile * 0.22, h = along ? tile * 0.22 : tile * 0.42;
    const stack = 1 + ((n * 7 + 3) % 3);
    for (let k = 0; k < stack; k++) {
      const c = CONTAINERS[(n + k * 2) % CONTAINERS.length];
      box3d(ctx, cx - w / 2, cy - h / 2 - k * tile * 0.1, w, h, tile * 0.1, c, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = c; ctx.fillRect(cx - w / 2, cy - h / 2 - (k + 1) * tile * 0.1, w, h);
    }
    n++;
  }
  // A gantry crane on the quay, its trolley sliding slowly out and back.
  {
    const [cx, cy] = at(0.72, 0.1);
    const leg = tile * 0.5, span = tile * 0.9;
    ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = Math.max(1.5, tile * 0.08); ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const s of [-1, 1]) {
      const lx = cx + (along ? s * tile * 0.22 : 0), ly = cy + (along ? 0 : s * tile * 0.22);
      ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - leg);
    }
    // The boom reaches out over the docks.
    const by0 = cy - leg;
    ctx.moveTo(cx - dx * span * 0.4, by0 - dy * span * 0.4);
    ctx.lineTo(cx + dx * span, by0 + dy * span);
    ctx.stroke();
    const slide = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(Math.floor(t * 10) / 10 * 0.5));
    const tx = cx + dx * span * slide, ty = by0 + dy * span * slide;
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + leg * 0.55); ctx.stroke();
    ctx.fillStyle = CONTAINERS[1];
    ctx.fillRect(tx - tile * 0.1, ty + leg * 0.55, tile * 0.2, tile * 0.1);
  }
}

/**
 * The pump's intake: a pipe from the plant out into the water tile beside it,
 * with ripples where it goes under. (L, T, W, H) is the footprint on screen,
 * (wx, wy) the middle of the water tile. `fromMiddle` starts the pipe at the
 * plant's centre (the stand-in); otherwise it comes out from under the slab's edge.
 */
export function drawIntake(
  ctx: CanvasRenderingContext2D, L: number, T: number, W: number, H: number, tile: number,
  wx: number, wy: number, t: number, fromMiddle: boolean, dark = '#5a6670', light = '#8fa0ac',
): void {
  // Leave the footprint through the edge the water tile sits against.
  const ex = Math.max(L, Math.min(L + W, wx)), ey = Math.max(T, Math.min(T + H, wy));
  ctx.lineCap = 'round';
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(2, tile * 0.2);
  ctx.beginPath();
  if (fromMiddle) { ctx.moveTo(L + W / 2, T + H / 2); ctx.lineTo(ex, ey); } else ctx.moveTo(ex, ey);
  ctx.lineTo(wx, wy); ctx.stroke();
  ctx.strokeStyle = light; ctx.lineWidth = Math.max(1, tile * 0.09);
  ctx.stroke();
  const pulse = (t * 0.6) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${(0.5 * (1 - pulse)).toFixed(3)})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(wx, wy, tile * (0.12 + 0.25 * pulse), tile * (0.08 + 0.17 * pulse), 0, 0, Math.PI * 2); ctx.stroke();
}

/** Settling pools in the large sewage plant's art, as fractions of its plot: [centre x, centre y, radius x, radius y, turn]. */
const SEWAGE_POOLS = [[0.282, 0.683, 0.14, 0.1, 1], [0.748, 0.683, 0.14, 0.1, -1]] as const;

/**
 * What moves on a big building's art, drawn by code over the sprite: the
 * sewage plant's skimmer arms and the pump's intake pipe. Smoke and steam go
 * through the sprite's emitters (ClaySprites.ts). Stepped to 10 fps like them.
 */
export function drawBigArtExtras(
  ctx: CanvasRenderingContext2D, kind: number, L: number, T: number, W: number, H: number, tile: number,
  t: number, waterX: number | null, waterY: number | null,
): void {
  const ts = Math.floor(t * 10) / 10;
  if (kind === BUILDING_LARGE_SEWAGE_PLANT && tile >= 8) {
    ctx.lineCap = 'round';
    for (const [fx, fy, rx, ry, turn] of SEWAGE_POOLS) {
      const cx = L + W * fx, cy = T + H * fy, a = ts * 0.4 * turn + fx * 5;
      const dx = Math.cos(a) * W * rx, dy = Math.sin(a) * H * ry;
      ctx.strokeStyle = 'rgba(40,36,28,0.35)'; ctx.lineWidth = Math.max(1, tile * 0.07);
      ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy + tile * 0.03); ctx.lineTo(cx + dx, cy + dy + tile * 0.03); ctx.stroke();
      ctx.strokeStyle = '#cfc8ba'; ctx.lineWidth = Math.max(1, tile * 0.05);
      ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
    }
  }
  if (kind === BUILDING_LARGE_WATER_PLANT && waterX !== null && waterY !== null) {
    drawIntake(ctx, L, T, W, H, tile, waterX, waterY, t, false, '#1f5fb0', '#4f95e6');
  }
}

const bands = new Map<string, { shape: readonly ShapeOffset[]; edges: TileEdge[] }>();

/**
 * The outline of every tile within `r` steps (manhattan) of a `kind`
 * building's footprint, as edges relative to its anchor: the ring homes
 * object within. For one tile this is the stepped diamond. Cached.
 */
export function footprintBand(kind: number, r: number, rot = 0): TileEdge[] {
  const shape = buildingShape(kind, rot), key = kind + ':' + r + ':' + (rot & 3);
  const hit = bands.get(key);
  if (hit && hit.shape === shape) return hit.edges;
  const seen = new Set<string>(), tiles: TilePoint[] = [];
  for (const [sx, sy] of shape) {
    for (let dy = -r; dy <= r; dy++) {
      const reach = r - Math.abs(dy);
      for (let dx = -reach; dx <= reach; dx++) {
        const k = (sx + dx) + ',' + (sy + dy);
        if (!seen.has(k)) { seen.add(k); tiles.push({ x: sx + dx, y: sy + dy }); }
      }
    }
  }
  const edges = tileSetEdges(tiles);
  bands.set(key, { shape, edges });
  return edges;
}
