// Traffic overlay — drawn over the map when the traffic overlay is on.
//
//   Roads:  coloured by volume / capacity, and the scale keeps going past
//           100% so an overloaded road reads differently from a full one.
//   Zones:  tinted by commute (accessibility): short → long → cut off.
//   Hover:  a building shows the route its trips take; a road shows the
//           buildings that feed it and where its traffic goes next.
//
// Reads world.traffic (TransitSystem's last pass) and never writes to the sim.

import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import { ROAD_NONE, ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';
import {
  type TrafficData, type TrafficField,
  bestAccessRoad, neighbourIndex, roadCapacity, trafficVolume,
} from '../sim/TrafficData';

type Ctx = CanvasRenderingContext2D;
type RGB = readonly [number, number, number];

// Road load scale: [volume / capacity, colour]. Linear between stops.
const LOAD_STOPS: readonly (readonly [number, RGB])[] = [
  [0,    [0, 170, 60]],
  [0.5,  [225, 205, 0]],
  [1,    [225, 30, 20]],
  [2,    [230, 0, 215]],
  [4,    [95, 20, 170]],
];
const EMPTY_ROAD = 'rgb(70,78,84)';

// Commute scale for zone tiles: [accessibility 0-1, colour].
const COMMUTE_STOPS: readonly (readonly [number, RGB])[] = [
  [0,    [150, 35, 35]],
  [0.5,  [230, 160, 40]],
  [1,    [0, 170, 160]],
];
const COMMUTE_ALPHA = 0.5;

const TO_COMMERCE = '#4cc9f0';
const TO_INDUSTRY = '#ffb703';

function scale(stops: readonly (readonly [number, RGB])[], v: number): string {
  if (v <= stops[0][0]) return rgb(stops[0][1]);
  for (let s = 1; s < stops.length; s++) {
    if (v <= stops[s][0]) {
      const [v0, c0] = stops[s - 1], [v1, c1] = stops[s];
      const t = (v - v0) / (v1 - v0);
      return `rgb(${Math.round(c0[0] + (c1[0] - c0[0]) * t)},${Math.round(c0[1] + (c1[1] - c0[1]) * t)},${Math.round(c0[2] + (c1[2] - c0[2]) * t)})`;
    }
  }
  return rgb(stops[stops.length - 1][1]);
}
function rgb(c: RGB): string { return `rgb(${c[0]},${c[1]},${c[2]})`; }

/** Colour for a road carrying `ratio` = volume / capacity. */
export function loadColor(ratio: number): string {
  return ratio <= 0 ? EMPTY_ROAD : scale(LOAD_STOPS, ratio);
}

/**
 * Mark every road tile whose traffic on `field` passes through `target`
 * (including `target` itself). `out` is 1 for those tiles, 0 elsewhere.
 */
export function markUpstream(field: TrafficField, target: number, out: Uint8Array): void {
  out.fill(0);
  if (!(field.dist[target] < Infinity)) return;
  const { order, parent, count } = field;
  // Increasing travel time: a tile's parent is always handled before it.
  for (let k = 0; k < count; k++) {
    const ri = order[k];
    const p = parent[ri];
    if (ri === target || (p >= 0 && out[p] === 1)) out[ri] = 1;
  }
}

/** Road tiles from `start` to the destination on `field`, in driving order. */
export function routeFrom(field: TrafficField, start: number): number[] {
  const path: number[] = [];
  if (start < 0 || !(field.dist[start] < Infinity)) return path;
  for (let ri = start; ri >= 0 && path.length < 100000; ri = field.parent[ri]) path.push(ri);
  return path;
}

export class TrafficOverlay {
  private _upC = new Uint8Array(0);
  private _upI = new Uint8Array(0);
  private _upKey = '';

  render(ctx: Ctx, world: World, camera: Camera, hoverTile: { tx: number; ty: number } | null): void {
    const { width } = world.grid;
    const L = world.layers;
    const data = world.traffic;
    const bounds = camera.visibleTileBounds(world.grid);
    const ts = TILE_SIZE * camera.zoom;
    const tsi = Math.ceil(ts) + 1;

    ctx.save();
    ctx.globalAlpha = 1;

    // ── Roads by load, zones by commute ───────────────────────────────────────
    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const i = ty * width + tx;
        const road = L.roadClass[i];
        const zone = L.zone[i];
        if (road === ROAD_NONE && zone === ZONE_NONE) continue;
        const sx = Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx)));
        const sy = Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty)));
        if (road !== ROAD_NONE) {
          // Before the first traffic pass there are no volumes: use the saved byte.
          const ratio = data ? trafficVolume(data, i) / roadCapacity(road) : L.congestion[i] / 255;
          ctx.fillStyle = loadColor(ratio);
          ctx.fillRect(sx, sy, tsi, tsi);
        } else {
          ctx.globalAlpha = COMMUTE_ALPHA;
          ctx.fillStyle = scale(COMMUTE_STOPS, L.accessibility[i] / 255);
          ctx.fillRect(sx, sy, tsi, tsi);
          ctx.globalAlpha = 1;
        }
      }
    }

    if (data && hoverTile && world.grid.inBounds(hoverTile.tx, hoverTile.ty)) {
      this._drawTrace(ctx, world, camera, data, hoverTile.ty * width + hoverTile.tx, bounds, ts);
      // The fills above covered the renderer's hover outline; put it back.
      const sx = camera.worldToScreenX(Projection.tileToWorldX(hoverTile.tx));
      const sy = camera.worldToScreenY(Projection.tileToWorldY(hoverTile.ty));
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.floor(sx) + 1, Math.floor(sy) + 1, Math.ceil(ts) - 1, Math.ceil(ts) - 1);
    }

    this._drawLegend(ctx, camera);
    ctx.restore();
  }

  private _drawTrace(
    ctx: Ctx, world: World, camera: Camera, data: TrafficData, hover: number,
    bounds: { x0: number; y0: number; x1: number; y1: number }, ts: number,
  ): void {
    const { width, height } = world.grid;
    const L = world.layers;
    const zone = L.zone[hover];
    const isOrigin = (i: number) => L.devLevel[i] > 0 && L.abandoned[i] === 0;

    // Road tiles whose catchment to show, per map (commerce-bound, industry-bound).
    const targetsC: number[] = [];
    const targetsI: number[] = [];

    if (L.roadClass[hover] !== ROAD_NONE) {
      // A road: who feeds it, and where its traffic goes from here.
      if (data.volRC[hover] + data.volIC[hover] > 0) {
        targetsC.push(hover);
        this._drawRoute(ctx, camera, width, routeFrom(data.toC, hover), TO_COMMERCE, ts);
      }
      if (data.volRI[hover] > 0) {
        targetsI.push(hover);
        this._drawRoute(ctx, camera, width, routeFrom(data.toI, hover), TO_INDUSTRY, ts);
      }
    } else if (zone !== ZONE_NONE && isOrigin(hover)) {
      // A building: the routes its own trips take…
      if (zone === ZONE_R || zone === ZONE_I) {
        this._drawRoute(ctx, camera, width, routeFrom(data.toC, bestAccessRoad(world, hover, data.toC)), TO_COMMERCE, ts);
      }
      if (zone === ZONE_R) {
        this._drawRoute(ctx, camera, width, routeFrom(data.toI, bestAccessRoad(world, hover, data.toI)), TO_INDUSTRY, ts);
      }
      // …and, for a destination, who drives to the road tiles at its door.
      if (zone === ZONE_C || zone === ZONE_I) {
        const field = zone === ZONE_C ? data.toC : data.toI;
        for (let k = 0; k < 4; k++) {
          const ri = neighbourIndex(hover, k, width, height);
          if (ri >= 0 && field.doorCap[ri] > 0) (zone === ZONE_C ? targetsC : targetsI).push(ri);
        }
      }
    }
    if (targetsC.length === 0 && targetsI.length === 0) return;

    // Catchments are cached until the hover target or the traffic pass changes.
    const n = width * height;
    const key = `${hover}:${data.version}:${n}`;
    if (key !== this._upKey) {
      this._upKey = key;
      if (this._upC.length !== n) { this._upC = new Uint8Array(n); this._upI = new Uint8Array(n); }
      this._markAll(data.toC, targetsC, this._upC);
      this._markAll(data.toI, targetsI, this._upI);
    }
    const upC = this._upC, upI = this._upI;

    // For a destination, draw the roads its traffic arrives by, with arrows.
    if (L.roadClass[hover] === ROAD_NONE) {
      if (targetsC.length > 0) this._drawArrivals(ctx, camera, world, data.toC, upC, targetsC, TO_COMMERCE, bounds, ts);
      if (targetsI.length > 0) this._drawArrivals(ctx, camera, world, data.toI, upI, targetsI, TO_INDUSTRY, bounds, ts);
    }

    const pad = Math.max(1, Math.round(ts * 0.12));
    ctx.lineWidth = Math.max(1.5, ts * 0.12);
    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const i = ty * width + tx;
        const z = L.zone[i];
        if (z === ZONE_NONE || !isOrigin(i)) continue;
        // Does this building's traffic pass through a target?
        let color: string | null = null;
        if (targetsC.length > 0 && (z === ZONE_R || z === ZONE_I)) {
          const r = bestAccessRoad(world, i, data.toC);
          if (r >= 0 && upC[r] === 1) color = TO_COMMERCE;
        }
        if (color === null && targetsI.length > 0 && z === ZONE_R) {
          const r = bestAccessRoad(world, i, data.toI);
          if (r >= 0 && upI[r] === 1) color = TO_INDUSTRY;
        }
        if (color === null) continue;
        const sx = Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx)));
        const sy = Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty)));
        ctx.strokeStyle = color;
        ctx.strokeRect(sx + pad, sy + pad, Math.ceil(ts) - pad * 2, Math.ceil(ts) - pad * 2);
      }
    }
  }

  private _markAll(field: TrafficField, targets: number[], out: Uint8Array): void {
    if (targets.length === 0) { out.fill(0); return; }
    if (targets.length === 1) { markUpstream(field, targets[0], out); return; }
    // Several targets (a destination with more than one road at its door).
    out.fill(0);
    const { order, parent, count } = field;
    const isTarget = new Set(targets);
    for (let k = 0; k < count; k++) {
      const ri = order[k];
      const p = parent[ri];
      if (isTarget.has(ri) || (p >= 0 && out[p] === 1)) out[ri] = 1;
    }
  }

  /**
   * Every road that carries traffic toward `targets` (the doors of a hovered
   * destination): lines along the roads, arrows pointing the way it drives,
   * and a dot on each door. `up` marks the road tiles upstream of the doors.
   */
  private _drawArrivals(
    ctx: Ctx, camera: Camera, world: World, field: TrafficField, up: Uint8Array, targets: number[], color: string,
    bounds: { x0: number; y0: number; x1: number; y1: number }, ts: number,
  ): void {
    const { width } = world.grid;
    const data = world.traffic!;
    const { parent } = field;
    const volume = (i: number) => (field === data.toC ? data.volRC[i] + data.volIC[i] : data.volRI[i]);
    const cx = (i: number) => camera.worldToScreenX(Projection.tileToWorldX(i % width)) + ts / 2;
    const cy = (i: number) => camera.worldToScreenY(Projection.tileToWorldY((i - (i % width)) / width)) + ts / 2;
    const lw = Math.max(2, ts * 0.22);

    // One path for all the segments: each tile joined to the next one on its way.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const ri = ty * width + tx;
        if (up[ri] !== 1 || volume(ri) <= 0) continue;
        const p = parent[ri];
        if (p < 0 || up[p] !== 1) continue;   // the door itself, or past it
        ctx.moveTo(cx(ri), cy(ri));
        ctx.lineTo(cx(p), cy(p));
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = lw + 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Arrowheads on a regular pattern of tiles, so every branch gets some.
    const every = Math.max(2, Math.round(48 / ts));
    const a = Math.max(3, ts * 0.34);
    ctx.fillStyle = '#fff';
    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        if ((tx + ty) % every !== 0) continue;
        const ri = ty * width + tx;
        if (up[ri] !== 1 || volume(ri) <= 0) continue;
        const p = parent[ri];
        if (p < 0 || up[p] !== 1) continue;
        this._arrowhead(ctx, cx(ri), cy(ri), Math.sign(cx(p) - cx(ri)), Math.sign(cy(p) - cy(ri)), ts, a);
      }
    }

    for (const door of targets) this._dot(ctx, cx(door), cy(door), color, ts);
  }

  /** An arrowhead on the edge between a tile centred at (x0, y0) and its neighbour in direction (dx, dy). */
  private _arrowhead(ctx: Ctx, x0: number, y0: number, dx: number, dy: number, ts: number, a: number): void {
    const mx = x0 + dx * ts / 2, my = y0 + dy * ts / 2;
    ctx.beginPath();
    ctx.moveTo(mx + dx * a, my + dy * a);
    ctx.lineTo(mx - dx * a * 0.6 - dy * a * 0.8, my - dy * a * 0.6 + dx * a * 0.8);
    ctx.lineTo(mx - dx * a * 0.6 + dy * a * 0.8, my - dy * a * 0.6 - dx * a * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  /** The dot that marks where a route ends. */
  private _dot(ctx: Ctx, x: number, y: number, color: string, ts: number): void {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, ts * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  /** A line through the route's tile centres, with arrowheads in driving direction. */
  private _drawRoute(ctx: Ctx, camera: Camera, width: number, path: number[], color: string, ts: number): void {
    if (path.length === 0) return;
    const cx = (i: number) => camera.worldToScreenX(Projection.tileToWorldX(i % width)) + ts / 2;
    const cy = (i: number) => camera.worldToScreenY(Projection.tileToWorldY((i - (i % width)) / width)) + ts / 2;
    const lw = Math.max(2, ts * 0.22);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const [stroke, w] of [['rgba(0,0,0,0.75)', lw + 2], [color, lw]] as const) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(cx(path[0]), cy(path[0]));
      for (let k = 1; k < path.length; k++) ctx.lineTo(cx(path[k]), cy(path[k]));
      if (path.length === 1) ctx.lineTo(cx(path[0]) + 0.01, cy(path[0]));
      ctx.stroke();
    }

    // Arrowheads every few tiles, and a dot at the destination.
    const every = Math.max(2, Math.round(48 / ts));
    const a = Math.max(3, ts * 0.34);
    ctx.fillStyle = '#fff';
    for (let k = every >> 1; k + 1 < path.length; k += every) {
      const x0 = cx(path[k]), y0 = cy(path[k]);
      this._arrowhead(ctx, x0, y0, Math.sign(cx(path[k + 1]) - x0), Math.sign(cy(path[k + 1]) - y0), ts, a);
    }
    const end = path[path.length - 1];
    this._dot(ctx, cx(end), cy(end), color, ts);
  }

  private _drawLegend(ctx: Ctx, camera: Camera): void {
    const rows: [string, [string, string][]][] = [
      ['Roads', [
        [EMPTY_ROAD, 'Empty'], [loadColor(0.05), 'Free'], [loadColor(0.5), 'Busy'],
        [loadColor(1), 'Full'], [loadColor(2), '2× over'], [loadColor(4), '4× over'],
      ]],
      ['Commute', [
        [scale(COMMUTE_STOPS, 1), 'Short'], [scale(COMMUTE_STOPS, 0.5), 'Long'], [scale(COMMUTE_STOPS, 0), 'Cut off'],
      ]],
      ['Hover', [[TO_COMMERCE, 'To commerce'], [TO_INDUSTRY, 'To industry']]],
    ];
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';
    const rowH = 16;
    const x0 = 12, y0 = camera.viewportH - 30 - (rows.length - 1) * rowH;

    let maxW = 0;
    for (const [, stops] of rows) {
      let w = 62;
      for (const [, label] of stops) w += 14 + ctx.measureText(label).width + 12;
      maxW = Math.max(maxW, w);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x0 - 6, y0 - 5, maxW + 6, rows.length * rowH + 6);

    rows.forEach(([title, stops], r) => {
      const y = y0 + r * rowH;
      ctx.fillStyle = '#999';
      ctx.fillText(title, x0, y + 5);
      let x = x0 + 62;
      for (const [color, label] of stops) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 10, 10);
        ctx.fillStyle = '#ccc';
        ctx.fillText(label, x + 14, y + 5);
        x += 14 + ctx.measureText(label).width + 12;
      }
    });
  }
}
