// Traffic overlay — drawn over the map when the traffic overlay is on.
//
//   Roads:  coloured by volume / capacity, and the scale keeps going past
//           100% so an overloaded road reads differently from a full one.
//   Track:  (every level: elevated with a white edge, subway dashed)
//           a dark line with riders streaming along it as dots, both ways:
//           more dots, more riders. A full line is a line doing its job, so
//           the dots stay white up to 100%, turn amber when busy (100–115%)
//           and red past 115%, where they also slow and bunch. Only an
//           overloaded junction gets a disc with a "!". Zoomed far out, where
//           dots would be too small, the line itself takes those colours.
//   Stations: a label with the riders using the station per tick, or "no road".
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
import { ROAD_NONE, ZONE_NONE, RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY } from '../sim/constants';
import { buildingTrace } from './buildingTrace';
import { railLinks, rampOther, stationPeak } from '../sim/rail';
import { rampLevel } from '../sim/buildingShapes';
import { t } from '../i18n';
import {
  type TrafficData, type TrafficField, type MarketKey, MARKET_DEFS,
  bestAccessRoad, neighbourIndex, shownRoadLoad, railLoad, railVolume, NODES_PER_TILE,
} from '../sim/TrafficData';
import { BALANCE } from '../data/balance';

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

// Rail riders (owner's pick E, 2026-11-21): a full line is working, so load only shows past 100%.
const RAIL_BUSY = 1.0;        // amber from here…
const RAIL_OVER = 1.15;       // …red from here (the junction disc too)
const RIDER = '#f4f7fa', RIDER_BUSY = 'rgb(245,170,30)', RIDER_OVER = 'rgb(235,45,35)';
const TRACK = 'rgb(56,66,82)', TRACK_SUBWAY = 'rgb(84,96,116)';
/** Dot colour for track at this load. */
export function riderColor(load: number): string {
  return load >= RAIL_OVER ? RIDER_OVER : load >= RAIL_BUSY ? RIDER_BUSY : RIDER;
}
/** How fast the dots move at this load (1 = free running): busy lines slow down, overloaded ones crawl. */
function riderSpeed(load: number): number {
  return load >= RAIL_OVER ? 0.3 : load >= RAIL_BUSY ? 0.6 : 1;
}
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  leisure: '#7fd6c2',
  event: '#ffd166',
};
const MARKET_LABEL: Record<MarketKey, string> = {
  shopping: 'Shopping',
  jobs: 'To work',
  goods: 'Fetching goods',
  exports: 'Exports to a port',
  visitors: 'Visitors',
  leisure: 'Leisure',
  event: 'Event',
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

/**
 * The map tile a route node is on. A field has four nodes per tile: the road
 * (the tile's own index) and the track on each rail level (tile index + 1, 2
 * or 3 × the tile count), so a route that rides a train holds numbers past
 * the end of the map. Use this before
 * turning a node of `routeFrom` into x and y.
 */
export function routeTile(field: TrafficField, node: number): number {
  return node % (field.dist.length / NODES_PER_TILE);
}

/**
 * The NODES from `start` to the destination on `field`, in travel order: road
 * tiles, and track nodes where the trip rides a train (see `routeTile`).
 */
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
          const ratio = data ? shownRoadLoad(data, i, road, (L.rail[i] & RAIL_GROUND) !== 0) : L.congestion[i] / 255;
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

    this._drawRail(ctx, world, camera, data, bounds, ts);

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

  /**
   * Track by load, junctions as discs, and a label on every station. Before
   * the first traffic pass (no data) the track is drawn empty.
   */
  private _drawRail(
    ctx: Ctx, world: World, camera: Camera, data: TrafficData | null,
    bounds: { x0: number; y0: number; x1: number; y1: number }, ts: number,
  ): void {
    if (world.railVersion === 0) return;
    const { width } = world.grid;
    const rail = world.layers.rail;
    const half = ts / 2;
    const line = Math.max(4, ts * 0.42);
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];                         // N, E, S, W: the LINK_ bits in order
    const junctions: { x: number; y: number; load: number }[] = [];
    // Dots need room: below this a dot would be a speck, so the line itself carries the load colours.
    const dots = ts >= 8;
    // Each half of a tile's track (centre → edge, or a ramp's centre → its other end) the riders flow along.
    const flows: { x: number; y: number; vx: number; vy: number; load: number; vol: number; sub: boolean }[] = [];
    ctx.lineCap = 'round';
    // Lowest level first: subway (a thinner, dashed line with a dark edge), ground, then elevated
    // (with a white edge, so it reads as passing over). Two passes per level, so one tile's edge
    // never covers its neighbour's colour.
    for (const level of [RAIL_SUBWAY, RAIL_GROUND, RAIL_ELEVATED]) {
      const wide = level === RAIL_SUBWAY ? line * 0.7 : line;
      ctx.setLineDash(level === RAIL_SUBWAY ? [Math.max(3, ts * 0.3), Math.max(2, ts * 0.2)] : []);
      ctx.lineCap = level === RAIL_SUBWAY ? 'butt' : 'round';
      for (const pass of [0, 1]) {
        if (pass === 0 && level === RAIL_SUBWAY) ctx.setLineDash([]);
        if (pass === 1 && level === RAIL_SUBWAY) ctx.setLineDash([Math.max(3, ts * 0.3), Math.max(2, ts * 0.2)]);
        for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
          for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
            const i = ty * width + tx;
            if (!(rail[i] & level)) continue;
            const links = railLinks(world, i, level);
            const load = data ? railLoad(data, i, level) : 0;
            const cx = camera.worldToScreenX(Projection.tileToWorldX(tx)) + half;
            const cy = camera.worldToScreenY(Projection.tileToWorldY(ty)) + half;
            const top = dots || load < RAIL_BUSY ? (level === RAIL_SUBWAY ? TRACK_SUBWAY : TRACK) : riderColor(load);
            ctx.strokeStyle = pass === 1 ? top : level === RAIL_ELEVATED ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)';
            const vol = pass === 1 && dots && data ? railVolume(data, i, level) : 0;
            ctx.lineWidth = pass === 0 ? wide + 3 : wide;
            ctx.beginPath();
            if (links === 0) { ctx.moveTo(cx - 0.01, cy); ctx.lineTo(cx + 0.01, cy); }
            for (let d = 0; d < 4; d++) {
              if (!(links & (1 << d))) continue;
              ctx.moveTo(cx, cy);
              ctx.lineTo(cx + DX[d] * half, cy + DY[d] * half);
              if (vol > 0) flows.push({ x: cx, y: cy, vx: DX[d], vy: DY[d], load, vol, sub: level === RAIL_SUBWAY });
            }
            // A ramp joins its two ends across the levels: draw each end up to the middle of the ramp.
            const kind = world.layers.building[i];
            if (kind !== 0 && rampLevel(kind) !== 0) {
              const other = rampOther(world, i);
              const mine = other && other.level === RAIL_GROUND ? rampLevel(kind) : RAIL_GROUND;   // the level of this end
              if (other && mine === level) {
                const ox = other.tile % width - tx, oy = (other.tile - other.tile % width) / width - ty;
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + ox * half, cy + oy * half);
                if (vol > 0) flows.push({ x: cx, y: cy, vx: ox, vy: oy, load, vol, sub: level === RAIL_SUBWAY });
              }
            }
            ctx.stroke();
            const count = (links & 1) + ((links >> 1) & 1) + ((links >> 2) & 1) + ((links >> 3) & 1);
            if (pass === 1 && count >= 3) junctions.push({ x: cx, y: cy, load });
          }
        }
      }
    }
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    this._drawRiders(ctx, flows, half, line, reducedMotion ? 0 : performance.now() / 1000);
    // Only an overloaded junction is marked: the one place worth fixing.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const j of junctions) {
      if (j.load < RAIL_OVER) continue;
      const r = Math.max(5, ts * 0.42);
      ctx.beginPath(); ctx.arc(j.x, j.y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(j.x, j.y, r, 0, Math.PI * 2);
      ctx.fillStyle = RIDER_OVER; ctx.fill();
      ctx.font = `bold ${Math.max(10, Math.round(r * 1.5))}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText('!', j.x, j.y + 1);
    }
    // Stations: riders boarding, at the middle of the building.
    const stations = data?.rail.stations ?? [];
    if (stations.length > 0) {
      ctx.font = `bold ${Math.max(11, Math.min(15, Math.round(ts * 0.34)))}px sans-serif`;
      for (const s of stations) {
        const ax = s.anchor % width, ay = (s.anchor - ax) / width;
        const tiles = world.buildingTilesAt(ax, ay);
        if (tiles.length === 0) continue;
        let sx = 0, sy = 0;
        for (const k of tiles) { sx += k % width; sy += (k - (k % width)) / width; }
        const mx = sx / tiles.length, my = sy / tiles.length;
        if (mx < bounds.x0 - 2 || mx > bounds.x1 + 2 || my < bounds.y0 - 2 || my > bounds.y1 + 2) continue;
        const x = camera.worldToScreenX(Projection.tileToWorldX(mx)) + half;
        const y = camera.worldToScreenY(Projection.tileToWorldY(my)) + half;
        const cut = s.roads.length === 0;
        // Riders getting on, off or passing through (a station people only arrive at boards nobody).
        const riders = stationPeak(world, ax, ay)?.riders ?? 0;
        const text = cut ? t('ui.trafficOverlay.stationNoRoad')
          : t('ui.trafficOverlay.stationRiders', { n: Math.round(riders).toLocaleString('en-US') });
        const w = ctx.measureText(text).width + 14, h = 20;
        ctx.fillStyle = cut ? 'rgba(150,25,25,0.95)' : riders >= 0.5 ? 'rgba(15,60,120,0.95)' : 'rgba(40,44,52,0.95)';
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 10); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillText(text, x, y + 1);
      }
    }
    ctx.textAlign = 'start';
  }

  /**
   * Riders as dots streaming along each half-tile of track, in two lanes (one each way, on the
   * right of the direction of travel). The phase depends only on the time, so a dot leaving one
   * tile's edge arrives at its neighbour's at the same moment. More riders, more dots; past
   * 100% they turn amber, past 115% red, and they slow down and bunch.
   */
  private _drawRiders(ctx: Ctx, flows: { x: number; y: number; vx: number; vy: number; load: number; vol: number; sub: boolean }[],
    half: number, line: number, sec: number): void {
    if (flows.length === 0) return;
    const r = Math.max(1.2, Math.min(2.6, half * 0.1)), off = line * 0.24;
    const most = Math.max(1, Math.floor(half / (r * 2.2)));               // dots a lane can hold without touching
    const unit = BALANCE.rail.capacity;
    for (const f of flows) {
      const len = Math.hypot(f.vx, f.vy), ux = f.vx / len, uy = f.vy / len;
      // A full line fills about three quarters of the lane; an overloaded one packs it.
      const n = Math.max(1, Math.min(Math.round(most * len), Math.round(f.vol / unit * most * 0.8 * len)));
      const phase = sec * 1.2 * riderSpeed(f.load) / len;
      const rr = f.sub ? r * 0.8 : r;
      ctx.fillStyle = riderColor(f.load);
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const a = j / n + phase, u = a - Math.floor(a);
        // Outbound (along the half, its lane on the right: (−uy, ux)) and inbound (back towards the centre, the other side).
        const ox = f.x + f.vx * half * u - uy * off, oy = f.y + f.vy * half * u + ux * off;
        const ix = f.x + f.vx * half * (1 - u) + uy * off, iy = f.y + f.vy * half * (1 - u) - ux * off;
        ctx.moveTo(ox + rr, oy); ctx.arc(ox, oy, rr, 0, Math.PI * 2);
        ctx.moveTo(ix + rr, iy); ctx.arc(ix, iy, rr, 0, Math.PI * 2);
      }
      ctx.fill();
    }
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
        this._drawRoute(ctx, camera, width, routeFrom(m.field, hover).map(v => routeTile(m.field, v)), MARKET_COLOR[m.def.key], ts);
      });
    } else if (zone !== ZONE_NONE && isOrigin(hover)) {
      markets.forEach((m, k) => {
        // A building that sends trips: the route they take…
        if (m.def.origin === zone) {
          this._drawRoute(ctx, camera, width, routeFrom(m.field, bestAccessRoad(world, hover, m.field)).map(v => routeTile(m.field, v)), MARKET_COLOR[m.def.key], ts);
        }
        // …and one that receives them: who drives to the road tiles at its door.
        if (m.def.dest === zone) {
          for (let d = 0; d < 4; d++) {
            const ri = neighbourIndex(hover, d, width, height);
            if (ri >= 0 && m.field.doorCap[ri] > 0) targets[k].push(ri);
          }
        }
      });
    } else {
      // A building (station, airport, …): its riders or visitors, and where its trips go.
      const trace = buildingTrace(world, data, hover);
      if (trace) markets.forEach((m, k) => {
        for (const start of trace.routes[k]) {
          this._drawRoute(ctx, camera, width, routeFrom(m.field, start).map(v => routeTile(m.field, v)), MARKET_COLOR[m.def.key], ts);
        }
        targets[k].push(...trace.targets[k]);
      });
    }
    if (targets.every(t => t.length === 0)) return;

    // Catchments are cached until the hover target or the traffic pass changes.
    const n = width * height;
    const key = `${hover}:${data.version}:${n}`;
    if (key !== this._upKey) {
      this._upKey = key;
      markets.forEach((m, k) => {
        // One entry per node (road and track), so a catchment carries on through a train ride.
        const nodes = m.field.dist.length;
        if (!this._up[k] || this._up[k].length !== nodes) this._up[k] = new Uint8Array(nodes);
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

  /** A line through the route's tile centres (`path` holds map tiles, not nodes), with arrowheads in driving direction. */
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
      ['Track', [
        [RIDER, 'Riders, both ways (more dots, more riders)'], [RIDER_BUSY, 'Busy: 100–115% full'], [RIDER_OVER, 'Over 115%: slow, bunched; ! at a junction'],
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
