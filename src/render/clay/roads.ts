/**
 * Clay roads and the little cars that show how busy they are.
 *
 * Roads (drawn into the chunk layer): three classes that read differently.
 *   street   narrow, two lanes, dashed centre line, pavement, grass verge
 *   avenue   fills the tile, four lanes, planted median
 *   highway  fills the tile, darker, barriers instead of pavement, solid edges
 * Junctions of three or more arms get zebra crossings and stop lines. A road on
 * water is a bridge: parapets, a side face with arches, piers, a shadow.
 * Everything a tile draws stays inside that tile (bar a hairline lip). It reads
 * its four neighbours' drawn classes, which in turn read theirs, so the chunk
 * cache watches road classes two tiles beyond a chunk's edge.
 *
 * Traffic (drawn every frame): no vehicle travels the map. Each lane is a
 * conveyor of evenly spaced slots sliding along it, and a slot shows a car only
 * where the tile under it is busy enough, so every road tile shows its own load:
 * a few cars when quiet, bumper to bumper with brake lights when over capacity.
 * `roadTrafficCars` is pure and tested; the rest needs a canvas.
 */
import { ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY } from '../../sim/constants';
import { RebakeBudget } from '../RebakeBudget';

type Ctx = CanvasRenderingContext2D;

/** Carriageway width and pavement (for a highway: barrier) width, in tiles, by road class. */
const WIDTH = [0, 0.5, 0.84, 0.9];
const KERB = [0, 0.1, 0.08, 0.035];
const ASPHALT = ['', '#63676e', '#585c63', '#42464d'];
const C = {
  pavement: '#b7b1a4', pavementLip: '#8f897c', barrier: '#cfcac0',
  line: '#ece5d2', yellow: '#e6c14a', median: '#5f9a4e', medianDark: '#3f7a3a', bush: '#7cb866',
  parapet: '#c9c2b3', parapetPost: '#e2dccd', bridgeSide: '#8a8377', bridgeDark: '#6d675e',
  waterShadow: 'rgba(10,25,45,0.35)', arch: 'rgba(12,28,48,0.7)',
};
/** Below this tile size roads are plain shapes: no markings, crossings or bridge detail. */
const DETAIL_MIN_TILE = 9;

/** N, E, S, W as [dx, dy, bit]. `around` arrays use the same order. */
const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]] as const;

/**
 * The class a tile is drawn as. A narrower road laid across a wider one (a
 * street dragged over an avenue) would pinch the wider road, so a tile with
 * the same wider class on two opposite sides is drawn as that class.
 */
export function drawnRoadClass(cls: number, around: readonly number[]): number {
  let out = cls;
  if (around[0] === around[2] && WIDTH[around[0]] > WIDTH[out]) out = around[0];
  if (around[1] === around[3] && WIDTH[around[1]] > WIDTH[out]) out = around[1];
  return out;
}

interface Arm {
  dx: number; dy: number;
  /** Carriageway width of this arm: the narrower of the two roads that meet. */
  w: number;
  kerb: number;
  /** The class the arm is marked as (the narrower road's). */
  cls: number;
  /** The neighbouring tile's class. */
  next: number;
}

/** A bridge's parapet: at least 0.07 of a tile, but never wider than the tile allows. */
const bridgeKerb = (kerb: number, width: number): number => Math.min(Math.max(kerb, 0.07), 0.5 - width / 2);

function armsOf(cls: number, around: readonly number[], bridge: boolean): Arm[] {
  const arms: Arm[] = [];
  for (let k = 0; k < 4; k++) {
    const next = around[k];
    if (next === ROAD_NONE) continue;
    const highway = cls === ROAD_HIGHWAY || next === ROAD_HIGHWAY;
    const kerb = highway ? KERB[ROAD_HIGHWAY] : KERB[cls];
    arms.push({
      dx: DIRS[k][0], dy: DIRS[k][1],
      w: Math.min(WIDTH[cls], WIDTH[next]),
      kerb: bridge ? bridgeKerb(kerb, Math.max(WIDTH[cls], WIDTH[next])) : kerb,
      cls: WIDTH[next] < WIDTH[cls] ? next : cls,
      next,
    });
  }
  return arms;
}

/** Adds the road's outline to the path: a centre box plus one strip per arm. */
function roadShape(ctx: Ctx, cls: number, mask: number, arms: Arm[], px: number, py: number, T: number, withKerb: boolean, bridge: boolean): void {
  const ownKerb = withKerb ? (bridge ? bridgeKerb(KERB[cls], WIDTH[cls]) : KERB[cls]) : 0;
  const half = (WIDTH[cls] / 2 + ownKerb) * T, r = half * 0.75;
  const cx = px + T / 2, cy = py + T / 2;
  // A corner of the box is rounded when no arm leaves on either of its sides.
  ctx.roundRect(cx - half, cy - half, half * 2, half * 2,
    [mask & 9 ? 0 : r, mask & 3 ? 0 : r, mask & 6 ? 0 : r, mask & 12 ? 0 : r]);
  for (const a of arms) {
    const hw = (a.w / 2 + (withKerb ? a.kerb : 0)) * T;
    // Arms heading east or south run a pixel past the tile, so no seam shows
    // where a chunk's last column or row is stretched on screen.
    if (a.dx === 0) ctx.rect(cx - hw, a.dy < 0 ? py : cy, hw * 2, T / 2 + (a.dy > 0 ? 1 : 0));
    else ctx.rect(a.dx < 0 ? px : cx, cy - hw, T / 2 + (a.dx > 0 ? 1 : 0), hw * 2);
  }
}

function stroke(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number, colour: string, dash?: number[]): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.setLineDash(dash ?? []);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Draws one road tile whose top-left corner is (px, py) and whose side is T.
 * `cls` and `around` (the N, E, S and W neighbours, ROAD_NONE if none) are
 * drawn classes (see drawnRoadClass); `bridge` is true when the tile is water.
 */
export function drawClayRoad(ctx: Ctx, cls: number, around: readonly number[], bridge: boolean, px: number, py: number, T: number): void {
  if (cls === ROAD_NONE) return;
  const arms = armsOf(cls, around, bridge);
  let mask = 0;
  for (let k = 0; k < 4; k++) if (around[k] !== ROAD_NONE) mask |= DIRS[k][2];
  const junction = arms.length >= 3;
  const detail = T >= DETAIL_MIN_TILE;
  const cx = px + T / 2, cy = py + T / 2;
  const shape = (withKerb: boolean, ox: number, oy: number, colour: string): void => {
    ctx.beginPath();
    roadShape(ctx, cls, mask, arms, px + ox, py + oy, T, withKerb, bridge);
    ctx.fillStyle = colour;
    ctx.fill();
  };

  if (bridge && detail) {
    // Shadow on the water.
    shape(true, T * 0.07, T * 0.12, C.waterShadow);
  }

  // Pavement (a highway's barrier, a bridge's parapet) with a darker lip below it, then asphalt.
  if (detail && !bridge) shape(true, 0, T * 0.025, C.pavementLip);
  shape(true, 0, 0, bridge ? C.parapet : cls === ROAD_HIGHWAY ? C.barrier : C.pavement);
  shape(false, 0, 0, ASPHALT[cls]);
  if (!detail) return;

  if (bridge) {
    // What shows of the structure: the long south face of an east-west span,
    // with an arch, and the piers of a north-south one. Kept inside the tile
    // (a full-width road leaves only a thin strip), since chunks clip at tile edges.
    for (const a of arms) {
      const hw = (a.w / 2 + a.kerb) * T;
      if (a.dy === 0) {
        const x0 = a.dx < 0 ? px : cx, top = cy + hw - T * 0.05, bottom = Math.min(py + T, cy + hw + T * 0.13);
        ctx.fillStyle = C.bridgeSide; ctx.fillRect(x0, top, T / 2 + (a.dx > 0 ? 1 : 0), bottom - top);
        ctx.fillStyle = C.arch;
        ctx.beginPath(); ctx.ellipse(x0 + T / 4, bottom, T * 0.15, (bottom - top) * 0.75, 0, Math.PI, Math.PI * 2); ctx.fill();
      } else {
        const y = cy + a.dy * T * 0.25, out = Math.min(T * 0.06, T / 2 - hw);
        if (out < 1) continue;
        ctx.fillStyle = C.bridgeDark;
        ctx.fillRect(cx - hw - out, y - T * 0.07, out, T * 0.14);
        ctx.fillRect(cx + hw, y - T * 0.07, out, T * 0.14);
      }
    }
  }

  // Lane markings along each arm, clipped to the asphalt. They stop at a
  // junction's box; round a corner each line stops where it meets its partner
  // on the other arm (inner lines early, outer lines late), so nothing crosses.
  const lw = Math.max(1, T * 0.03);
  const corner = arms.length === 2 && arms[0].dx !== arms[1].dx && arms[0].dy !== arms[1].dy;
  for (const a of arms) {
    const boxStart = junction ? WIDTH[cls] / 2 : 0;
    if (boxStart < 0.5) {
      ctx.save();
      ctx.beginPath();
      roadShape(ctx, cls, mask, arms, px, py, T, false, bridge);
      ctx.clip();
      const other = corner ? (a === arms[0] ? arms[1] : arms[0]) : null;
      const seg = (off: number, width: number, colour: string, dash?: number[]): void => {
        // Distance from the centre, along the arm, at which this line begins.
        let start = boxStart;
        if (other) start = (a.dx !== 0 ? other.dy : other.dx) * off - width / 2 / T;
        if (a.dx === 0) stroke(ctx, cx + off * T, cy + a.dy * start * T, cx + off * T, cy + a.dy * T / 2 + (a.dy > 0 ? 1 : 0), width, colour, dash);
        else stroke(ctx, cx + a.dx * start * T, cy + off * T, cx + a.dx * T / 2 + (a.dx > 0 ? 1 : 0), cy + off * T, width, colour, dash);
      };
      if (a.cls === ROAD_STREET) {
        seg(0, lw, C.line, [T * 0.14, T * 0.1]);
      } else if (a.cls === ROAD_AVENUE) {
        if (bridge) { seg(-0.02, lw * 0.8, C.yellow); seg(0.02, lw * 0.8, C.yellow); }
        else { seg(0, T * 0.1, C.medianDark); seg(-0.006, T * 0.075, C.median); }
        seg(-a.w * 0.27, lw, C.line, [T * 0.12, T * 0.12]);
        seg(a.w * 0.27, lw, C.line, [T * 0.12, T * 0.12]);
      } else {
        seg(0, T * 0.06, C.barrier);
        seg(-0.035, lw * 0.8, C.yellow); seg(0.035, lw * 0.8, C.yellow);
        seg(-a.w * 0.26, lw, C.line, [T * 0.16, T * 0.14]);
        seg(a.w * 0.26, lw, C.line, [T * 0.16, T * 0.14]);
        seg(-a.w * 0.47, lw * 0.8, C.line); seg(a.w * 0.47, lw * 0.8, C.line);
      }
      ctx.restore();
    }
    // Bushes along an avenue's median.
    if (cls === ROAD_AVENUE && a.cls === ROAD_AVENUE && !junction && !bridge) {
      for (const d of [0.14, 0.38]) {
        const bx = cx + a.dx * d * T, by = cy + a.dy * d * T;
        ctx.fillStyle = C.medianDark; ctx.beginPath(); ctx.arc(bx, by + T * 0.012, T * 0.05, 0, 7); ctx.fill();
        ctx.fillStyle = C.bush; ctx.beginPath(); ctx.arc(bx - T * 0.008, by - T * 0.012, T * 0.042, 0, 7); ctx.fill();
      }
    }
    // Parapet posts along a bridge.
    if (bridge) {
      const off = (a.w / 2 + a.kerb / 2) * T, s = Math.max(1.5, T * 0.05);
      ctx.fillStyle = C.parapetPost;
      for (const d of [0.06, 0.22, 0.38]) for (const side of [-1, 1]) {
        const bx = a.dx === 0 ? cx + side * off : cx + a.dx * d * T, by = a.dx === 0 ? cy + a.dy * d * T : cy + side * off;
        ctx.fillRect(bx - s / 2, by - s / 2, s, s);
      }
    }
  }

  // Junctions: a zebra crossing and a stop line on each arm, all inside this tile.
  if (junction && cls !== ROAD_HIGHWAY) {
    const d0 = Math.min(WIDTH[cls] / 2 + 0.03, 0.33), len = 0.12, stop = d0 + len + 0.015, stopLen = 0.025;
    for (const a of arms) {
      if (a.next === ROAD_HIGHWAY) continue;
      const hw = a.w / 2;
      // A fresh patch of asphalt under the crossing, so no lane line runs through it.
      ctx.fillStyle = ASPHALT[a.cls];
      if (a.dx === 0) ctx.fillRect(cx - hw * T, cy + (a.dy > 0 ? d0 - 0.01 : -0.5) * T, a.w * T, (0.51 - d0) * T);
      else ctx.fillRect(cx + (a.dx > 0 ? d0 - 0.01 : -0.5) * T, cy - hw * T, (0.51 - d0) * T, a.w * T);
      ctx.fillStyle = C.line;
      const stripes = Math.max(3, Math.round(a.w / 0.085)), pitch = a.w / stripes;
      for (let k = 0; k < stripes; k++) {
        const o = -hw + (k + 0.25) * pitch;
        if (a.dx === 0) ctx.fillRect(cx + o * T, cy + (a.dy > 0 ? d0 : -d0 - len) * T, pitch * 0.5 * T, len * T);
        else ctx.fillRect(cx + (a.dx > 0 ? d0 : -d0 - len) * T, cy + o * T, len * T, pitch * 0.5 * T);
      }
      // The stop line spans the half that carries traffic toward the box (drive on the right).
      const side = a.dx === 0 ? -a.dy : a.dx;
      if (a.dx === 0) ctx.fillRect(cx + (side > 0 ? 0.02 : -hw) * T, cy + (a.dy > 0 ? stop : -stop - stopLen) * T, (hw - 0.02) * T, stopLen * T);
      else ctx.fillRect(cx + (a.dx > 0 ? stop : -stop - stopLen) * T, cy + (side > 0 ? 0.02 : -hw) * T, stopLen * T, (hw - 0.02) * T);
    }
  }
}

// ── Traffic ─────────────────────────────────────────────────────────────────

/** 0 car, 1 van, 2 truck. */
export type CarKind = 0 | 1 | 2;
export interface TrafficCar {
  /** Centre, in tiles from the tile's top-left corner. */
  x: number; y: number;
  /** Heading: one of (1,0), (-1,0), (0,1), (0,-1). */
  dx: number; dy: number;
  kind: CarKind;
  /** Index into the car colours. */
  colour: number;
  braking: boolean;
}

export const CAR_COLOURS = ['#e9e6dc', '#d65a4a', '#4f86c6', '#e3b94a', '#5aa868', '#8d949c', '#3b4048', '#c98bb5'];
/** Slots per tile length is 1 / SLOT_SPACING. */
const SLOT_SPACING = 0.36;
/** A truck's length in tiles: 9 m (docs/SCALE.md). */
export const TRUCK_LEN = 9 / 17;
/** Free-flow speed in tiles per second, by road class: streets slow, highways fast. */
const SPEED = [0, 0.4, 0.75, 1.3];
/** A road over capacity crawls at this share of its free-flow speed. */
const JAM_SPEED = 0.25;

/**
 * How fast cars move on a tile, in tiles per second. Only two states per class
 * (free or jammed): cars change speed, and so are reshuffled, only where the
 * class or the jam changes, not at every small change in load.
 */
export function trafficSpeed(cls: number, load: number): number {
  return (SPEED[cls] ?? 0) * (load > 1 ? JAM_SPEED : 1);
}
/** Share of slots filled at 100% load; a road over capacity fills them all. */
const FILL_AT_CAPACITY = 0.62;
/** Lane centres, in tiles from the road's centre line, by road class. */
const LANES: readonly (readonly number[])[] = [[], [0.12], [0.15, 0.31], [0.16, 0.34]];

const hash = (a: number, b: number, c: number): number => {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Whether slot k of a lane holds a truck: filled, even, and picked for goods. */
function isTruck(k: number, line: number, lane: number, dir: number, axis: number, fill: number, goodsShare: number): boolean {
  if ((k & 1) !== 0 || !(goodsShare > 0)) return false;
  if (hash(k, line * 31 + lane, dir + axis * 5 + 3) >= fill) return false;
  return hash(k, line, lane * 13 + dir + axis * 17) < goodsShare * TRUCK_SHARE;
}
/** Share of the goods traffic on even slots that shows as trucks (the rest are vans). */
const TRUCK_SHARE = 0.7;

/**
 * Writes the cars showing on road tile (tx, ty) at `time` seconds into `out`
 * from index 0 and returns how many. `out` is a pool: its objects are reused
 * from call to call (and added to when it is too short), so nothing is
 * allocated per frame; read only the first `count` entries.
 *
 * `load` is volume / capacity (not capped at 1); `goodsShare` (0–1) is how much
 * of the traffic is goods, which shows as vans and trucks; `density` (0–1)
 * thins the cars, for tile sizes at which they are too small to read.
 */
export function roadTrafficCars(tx: number, ty: number, cls: number, around: readonly number[], load: number, goodsShare: number, time: number, out: TrafficCar[], density = 1): number {
  if (cls === ROAD_NONE || !(load > 0.04)) return 0;
  const fill = Math.min(1, load * FILL_AT_CAPACITY) * density;
  let count = 0;
  const braking = load > 1;
  const speed = trafficSpeed(cls, load);
  for (let axis = 0; axis < 2; axis++) {
    // axis 0: east-west traffic (arms W = around[3], E = around[1]); axis 1: north-south (N = around[0], S = around[2]).
    const first = around[axis === 0 ? 3 : 0], second = around[axis === 0 ? 1 : 2];
    if (first === ROAD_NONE && second === ROAD_NONE) continue;
    const along = axis === 0 ? tx : ty, line = axis === 0 ? ty : tx;
    for (let dir = -1; dir <= 1; dir += 2) {
      const shift = dir * speed * time;
      for (let lane = 0; lane < LANES[cls].length; lane++) {
        const k0 = Math.ceil((along - shift - 0.06) / SLOT_SPACING), k1 = Math.floor((along + 1 - shift + 0.06) / SLOT_SPACING);
        for (let k = k0 - 1; k <= k1 + 1; k++) {
          // A truck (9 m, longer than a slot) takes its slot and the one
          // behind it, so it sits half a slot back and that slot stays empty.
          // Only even slots hold trucks, so trucks never chain.
          if (isTruck(k + dir, line, lane, dir, axis, fill, goodsShare)) continue;
          const truck = isTruck(k, line, lane, dir, axis, fill, goodsShare);
          const s = k * SLOT_SPACING + (hash(k, line, lane + dir * 7 + axis * 31) - 0.5) * 0.1 + shift - along - (truck ? dir * SLOT_SPACING / 2 : 0);
          if (s < 0 || s >= 1) continue; // the tile under the car's centre draws it
          const next = s < 0.5 ? first : second;
          if (next === ROAD_NONE) continue;
          const armClass = WIDTH[next] < WIDTH[cls] ? next : cls;
          const lanes = LANES[armClass];
          if (lane >= lanes.length) continue;
          if (hash(k, line * 31 + lane, dir + axis * 5 + 3) >= fill) continue;
          const h = hash(k, line, lane * 13 + dir + axis * 17);
          // Drive on the right: eastbound south of the centre line, southbound west of it.
          const off = lanes[lane] * dir * (axis === 0 ? 1 : -1);
          let car = out[count];
          if (!car) { car = { x: 0, y: 0, dx: 0, dy: 0, kind: 0, colour: 0, braking: false }; out.push(car); }
          count++;
          car.x = axis === 0 ? s : 0.5 + off;
          car.y = axis === 0 ? 0.5 + off : s;
          car.dx = axis === 0 ? dir : 0;
          car.dy = axis === 0 ? 0 : dir;
          car.kind = truck ? 2 : h < goodsShare ? 1 : h > 0.95 ? 1 : 0;
          car.colour = Math.floor(h * 977) % CAR_COLOURS.length;
          car.braking = braking;
        }
      }
    }
  }
  return count;
}

// One baked picture per look (colour, kind, heading, braking), remembered with
// the tile size it was baked at.
const baked = new Map<number, { canvas: HTMLCanvasElement; tile: number }>();

// Zoom smoothing (see RebakeBudget.ts): while the tile size is changing, a car
// baked at another size is drawn stretched; once the size has held still it is
// re-baked, a few per frame.
const rebake = new RebakeBudget(24);

/** Call once per frame before drawing cars, with the tile size and the frame's time in ms. */
export function beginTrafficFrame(tile: number, now: number): void {
  rebake.begin(tile, now);
}

function bakeCar(T: number, colourIdx: number, kind: CarKind, heading: number, braking: boolean): HTMLCanvasElement {
  const len = (kind === 2 ? TRUCK_LEN : kind === 1 ? 0.3 : 0.25) * T, wid = (kind === 2 ? 0.17 : 0.15) * T;
  const size = Math.ceil(len + T * 0.08);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c) return canvas;
  const colour = CAR_COLOURS[colourIdx];
  c.translate(size / 2, size / 2);
  // Shadow first, unrotated, so it always falls the same way.
  c.save();
  c.translate(T * 0.012, T * 0.028);
  c.rotate(heading * Math.PI / 2);
  c.fillStyle = 'rgba(20,24,28,0.3)';
  c.beginPath(); c.roundRect(-len / 2, -wid / 2, len, wid, wid * 0.4); c.fill();
  c.restore();
  c.rotate(heading * Math.PI / 2);
  c.fillStyle = kind === 2 ? CAR_COLOURS[0] : colour;
  c.beginPath(); c.roundRect(-len / 2, -wid / 2, len, wid, wid * 0.4); c.fill();
  if (kind === 2) {
    // A truck: pale box, coloured cab with a windscreen.
    c.fillStyle = colour;
    c.beginPath(); c.roundRect(len / 2 - len * 0.28, -wid / 2, len * 0.28, wid, wid * 0.35); c.fill();
    c.fillStyle = 'rgba(30,40,55,0.75)';
    c.beginPath(); c.roundRect(len / 2 - len * 0.2, -wid * 0.36, len * 0.1, wid * 0.72, wid * 0.15); c.fill();
  } else {
    // A dark glasshouse with the roof across its full width, leaving a
    // windscreen in front and a rear window behind.
    c.fillStyle = 'rgba(30,40,55,0.8)';
    c.beginPath(); c.roundRect(-len * 0.27, -wid * 0.37, len * 0.56, wid * 0.74, wid * 0.22); c.fill();
    c.fillStyle = colour;
    c.fillRect(-len * (kind === 1 ? 0.24 : 0.17), -wid * 0.37, len * (kind === 1 ? 0.38 : 0.27), wid * 0.74);
  }
  c.fillStyle = 'rgba(255,255,255,0.28)';
  c.beginPath(); c.roundRect(-len * 0.3, -wid * 0.42, len * 0.6, wid * 0.16, wid * 0.08); c.fill();
  if (braking) {
    c.fillStyle = '#ff4a3d';
    c.fillRect(-len / 2, -wid * 0.42, len * 0.08, wid * 0.26);
    c.fillRect(-len / 2, wid * 0.16, len * 0.08, wid * 0.26);
  }
  return canvas;
}

/** Draws the first `count` cars from `roadTrafficCars` for the tile whose top-left corner is (sx, sy). */
export function drawTrafficCars(ctx: Ctx, cars: readonly TrafficCar[], count: number, sx: number, sy: number, T: number): void {
  for (let n = 0; n < count; n++) {
    const car = cars[n];
    const heading = car.dx > 0 ? 0 : car.dy > 0 ? 1 : car.dx < 0 ? 2 : 3;
    const key = ((car.colour * 3 + car.kind) * 4 + heading) * 2 + (car.braking ? 1 : 0);
    let entry = baked.get(key);
    if (!entry) {
      entry = { canvas: bakeCar(T, car.colour, car.kind, heading, car.braking), tile: T };
      baked.set(key, entry);
    } else if (entry.tile !== T) {
      // Outside a frame (or at another size) bake at once; inside one, wait
      // for the size to settle and for budget.
      if (rebake.allow(T)) {
        entry.canvas = bakeCar(T, car.colour, car.kind, heading, car.braking);
        entry.tile = T;
      }
    }
    const cx = sx + car.x * T, cy = sy + car.y * T;
    if (entry.tile === T) {
      ctx.drawImage(entry.canvas, Math.round(cx - entry.canvas.width / 2), Math.round(cy - entry.canvas.height / 2));
    } else {
      const k = T / entry.tile, w = entry.canvas.width * k, h = entry.canvas.height * k;
      ctx.drawImage(entry.canvas, cx - w / 2, cy - h / 2, w, h);
    }
  }
}
