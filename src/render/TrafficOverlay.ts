// Traffic overlay — drawn over the map when the traffic overlay is on.
//
//   Roads:  coloured by volume / capacity, and the scale keeps going past
//           100% so an overloaded road reads differently from a full one.
//   Zones:  tinted by commute (accessibility): short → long → cut off.
//   Hover:  a building shows the route its trips take (homes: to shops and
//           to work; shops: to the industry they fetch goods from); a road
//           shows the buildings that feed it and where its traffic goes next.
//           One colour per market, so new kinds of trip need no changes here.
//
// Reads world.traffic (TransitSystem's last pass) and never writes to the sim.

import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import { ROAD_NONE, ZONE_NONE } from '../sim/constants';
import {
  type TrafficData, type TrafficField, type MarketKey, MARKET_DEFS,
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

// Trace colour per market (see TrafficData.MARKET_DEFS).
const MARKET_COLOR: Record<MarketKey, string> = {
  shopping: '#4cc9f0',
  jobs: '#ffb703',
  goods: '#b6f36a',
  exports: '#f28cff',
  visitors: '#ff8fa3',
};
const MARKET_LABEL: Record<MarketKey, string> = {
  shopping: 'Shopping',
  jobs: 'To work',
  goods: 'Fetching goods',
  exports: 'Exports to a port',
  visitors: 'Visitors',
};

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
  // Per market: road tiles whose traffic passes the hovered target.
  private _up: Uint8Array[] = [];
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

    const markets = data.markets;
    // Per market: the road tiles whose catchment to show.
    const targets: number[][] = markets.map(() => []);

    if (L.roadClass[hover] !== ROAD_NONE) {
      // A road: who feeds it, and where its traffic goes from here.
      markets.forEach((m, k) => {
        if (m.volume[hover] <= 0) return;
        targets[k].push(hover);
        this._drawRoute(ctx, camera, width, routeFrom(m.field, hover), MARKET_COLOR[m.def.key], ts);
      });
    } else if (zone !== ZONE_NONE && isOrigin(hover)) {
      markets.forEach((m, k) => {
        // A building that sends trips: the route they take…
        if (m.def.origin === zone) {
          this._drawRoute(ctx, camera, width, routeFrom(m.field, bestAccessRoad(world, hover, m.field)), MARKET_COLOR[m.def.key], ts);
        }
        // …and one that receives them: who drives to the road tiles at its door.
        if (m.def.dest === zone) {
          for (let d = 0; d < 4; d++) {
            const ri = neighbourIndex(hover, d, width, height);
            if (ri >= 0 && m.field.doorCap[ri] > 0) targets[k].push(ri);
          }
        }
      });
    }
    if (targets.every(t => t.length === 0)) return;

    // Catchments are cached until the hover target or the traffic pass changes.
    const n = width * height;
    const key = `${hover}:${data.version}:${n}`;
    if (key !== this._upKey) {
      this._upKey = key;
      markets.forEach((m, k) => {
        if (!this._up[k] || this._up[k].length !== n) this._up[k] = new Uint8Array(n);
        this._markAll(m.field, targets[k], this._up[k]);
      });
    }

    const pad = Math.max(1, Math.round(ts * 0.12));
    ctx.lineWidth = Math.max(1.5, ts * 0.12);
    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const i = ty * width + tx;
        const z = L.zone[i];
        if (z === ZONE_NONE || !isOrigin(i)) continue;
        // Does this building's traffic pass through a target? First market that says yes wins.
        let color: string | null = null;
        for (let k = 0; k < markets.length && color === null; k++) {
          const m = markets[k];
          if (targets[k].length === 0 || m.def.origin !== z) continue;
          const r = bestAccessRoad(world, i, m.field);
          if (r >= 0 && this._up[k][r] === 1) color = MARKET_COLOR[m.def.key];
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
      const dx = Math.sign(cx(path[k + 1]) - x0), dy = Math.sign(cy(path[k + 1]) - y0);
      const mx = x0 + dx * ts / 2, my = y0 + dy * ts / 2;
      ctx.beginPath();
      ctx.moveTo(mx + dx * a, my + dy * a);
      ctx.lineTo(mx - dx * a * 0.6 - dy * a * 0.8, my - dy * a * 0.6 + dx * a * 0.8);
      ctx.lineTo(mx - dx * a * 0.6 + dy * a * 0.8, my - dy * a * 0.6 - dx * a * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    const end = path[path.length - 1];
    ctx.beginPath();
    ctx.arc(cx(end), cy(end), Math.max(3, ts * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
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
      ['Hover', MARKET_DEFS.map((def): [string, string] => [MARKET_COLOR[def.key], MARKET_LABEL[def.key]])],
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
