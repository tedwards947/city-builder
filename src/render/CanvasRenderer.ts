// Draws a frame: the cached chunk layer, then everything that sits on top of
// it and changes from frame to frame.
//
// This file is the order of the passes and the passes themselves. The parts
// with their own rules live elsewhere:
//   ChunkCache.ts      when a chunk of the static layer is redrawn
//   chunkPainter.ts    what the static layer looks like, and its signature
//   flatTiles.ts       the flat look used in the static layer
//   clay/*             sprites, trees, roads and cars, badges, routes

import { TERRAIN_WATER } from '../sim/constants';
import { tileSetEdges, clusterTiles, type TilePoint } from './clay/tileOutline';
import { isLargeBuilding, placementRules, footprintTiles, footprintEdge } from '../sim/buildingShapes';
import { buildingKindForPlacing, placementAnchor } from '../input/InputController';
import { shapeBox, shapeTiles, drawBigStandIn, footprintBand } from './clay/bigBuildings';
import { layoutRequestBadges, drawRequestBadge, drawRequestOutcome, type RequestBadge, type RequestOutcome } from './clay/requestBadges';
import type { PcPreview } from '../ui/pcPreview';
import type { World } from '../sim/World';
import type { Camera, TileBounds } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import { resolvePalette } from './CharacterPalette';
import type { VibeState } from './SpriteTypes';
import { ChunkCache } from './ChunkCache';
import { chunkPainter, CLAY_TREE_MIN_TILE } from './chunkPainter';
import { drawnRoadAt, drawnRoadsAround } from './drawnRoads';
import { loadClaySprites, beginClayFrame, pickClaySprite, drawClaySprite, LOOK_NO_POWER, collectClayEffects, drawClayEffects, drawClayFire, drawClaySmolder, type ClayEffect } from './clay/ClaySprites';
import { loadWildTrees, wildTreesReady, beginWildTreeFrame, drawWildTrees, wildDensity, wildVariant } from './clay/wildTrees';
import { roadTrafficCars, beginTrafficFrame, drawTrafficCars, type TrafficCar } from './clay/roads';
import { trafficVolume, roadCapacity } from '../sim/TrafficData';
import { findProblemClusters, drawProblemBadge, pinRadius, crimeProblem, healthProblem, lotProblemMask, CRIME_BADGE_MIN, SICKNESS_BADGE_MIN, type ProblemCluster, type BadgeKind } from './clay/problemPins';
import { drawCommuteRoutes } from './clay/commuteRoute';
import { BALANCE } from '../data/balance';
import { ZONE_NONE, ZONE_R, ROAD_NONE, VEG_NONE, BUILDING_NONE } from '../sim/constants';

/** A whole-map tint the renderer can draw over the tiles. */
export type MapOverlay = 'none' | 'crime' | 'fire' | 'vibe';

/** Everything about a frame besides the world and the camera. All optional. */
export interface RenderOptions {
  /** The tile under the pointer: outlined, and with the inspect tool its trips are drawn. */
  hoverTile?: { tx: number; ty: number } | null;
  /** The selected tool's name (decides the hover outline's colour and the inspect routes). */
  tool?: string;
  overlay?: MapOverlay;
  /** Tile indices to highlight as the reach of the service building about to be placed. */
  coveragePreview?: Set<number> | null;
  /** The frame's time in ms. Drives animation and zoom smoothing. */
  now?: number;
  /** A road about to be built (auto road mode): its tiles in order, start first. */
  roadPreview?: RoadPreview | null;
  /** Lots about to be zoned (zone fill mode). */
  zonePreview?: ZonePreview | null;
  /** Political capital at the pointer: fall-off rings, homes that object, and the PC price. */
  pcPreview?: PcPreview | null;
  /** Resident requests that have just been met or missed, to mark for a moment. */
  requestOutcomes?: readonly RequestOutcome[];
  /** Areas to outline (tiles, inclusive corners), each at `alpha` 0–1: where the camera just jumped to, or the request under the pointer. */
  areaHighlights?: readonly AreaHighlight[];
}

/** `tiles`, when given, is what gets outlined (a cluster of homes); otherwise the rectangle. */
export interface AreaHighlight { x0: number; y0: number; x1: number; y1: number; alpha: number; tiles?: readonly TilePoint[] }

export interface ZonePreview {
  tiles: ReadonlyArray<{ tx: number; ty: number }>;
  /** False draws it in red: the city cannot pay for it. */
  ok: boolean;
  /** CSS colour of the zone being painted. */
  color: string;
  /** Short text shown beside `at`, e.g. the price. */
  label?: string;
  at: { tx: number; ty: number };
  /** Political capital for the same tag: its text, and whether the city can cover it. */
  pc?: PcTag;
}

/** The political-capital part of a price tag. */
export interface PcTag {
  text: string;
  ok: boolean;
  /** A second line, e.g. why the action is refused. */
  note?: string;
  /** The note is a warning about something still allowed: drawn in amber. */
  warn?: boolean;
}

export interface RoadPreview {
  tiles: ReadonlyArray<{ tx: number; ty: number }>;
  /** False draws it in red: the city cannot pay for it. */
  ok: boolean;
  /** Short text shown beside the end tile, e.g. the price. */
  label?: string;
  /** Political capital for the same tag. */
  pc?: PcTag;
}

// Overlay colour by layer value (0–255).
const _crimeOverlayColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.7, (v / 255) * 0.9);
  return `rgba(255,0,0,${alpha.toFixed(3)})`;
});
const _fireOverlayColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.7, (v / 255) * 0.9);
  return `rgba(255,128,0,${alpha.toFixed(3)})`;
});

/** The key shown bottom-left while an overlay is on: [swatch colour, label]. */
const OVERLAY_LEGENDS: Record<Exclude<MapOverlay, 'none'>, readonly (readonly [string, string])[]> = {
  crime: [['rgba(255,0,0,0.1)', 'Low'], ['rgba(255,0,0,0.4)', 'Moderate'], ['rgba(255,0,0,0.8)', 'High']],
  fire:  [['#333', 'None'], ['rgba(255,64,0,0.4)', 'Moderate'], ['rgba(255,128,0,0.8)', 'High']],
  vibe:  [['rgba(0,200,0,0.4)', 'Green'], ['rgba(200,100,0,0.4)', 'Industrial'], ['rgba(0,100,200,0.4)', 'Social']],
};

/** How long a burned-out lot keeps smouldering on screen (render-only, real time). */
const SMOULDER_MS = 20000;
/** Tile size (px) from which roads show cars. */
const TRAFFIC_MIN_TILE = 12;
/** Tile size (px) from which roads show every car; below it, half of them. */
const TRAFFIC_FULL_TILE = 20;
/** Tile size (px) from which problems show as a badge per building; below it, one pin per district. */
const PROBLEM_BADGE_MIN_TILE = 30;
/** Below this tile size, districts of one or two lots get no pin. */
const PROBLEM_SMALL_PIN_MIN_TILE = 10;
const PROBLEM_PIN_REFRESH_MS = 400;
const BADGE_KINDS: readonly BadgeKind[] = ['crime', 'health', 'power', 'water', 'commute', 'cutoff', 'road', 'death'];

export class CanvasRenderer {
  readonly ctx: CanvasRenderingContext2D;
  /** The static layer (terrain, roads, flat buildings), cached per chunk. */
  readonly chunks = new ChunkCache(chunkPainter);
  private readonly canvas: HTMLCanvasElement;

  private _clayEffects: ClayEffect[] = [];
  /** Lots whose markers / fire are drawn after every sprite: [tileIndex, sx, sy] triples. */
  private _markerQueue: number[] = [];
  private _utilityQueue: number[] = [];
  private _fireQueue: number[] = [];
  private _pins: ProblemCluster[] = [];
  private _pinsWorld: World | null = null;
  private _pinsTick = -1;
  private _pinsAt = 0;
  // Every badge and pin drawn last frame as (x, y, radius, kind index, count), for `badgeAt`.
  private _badges: number[] = [];
  // Every resident-request badge drawn last frame, for `requestAt`.
  private _requestBadges: RequestBadge[] = [];
  private _trafficCars: TrafficCar[] = [];
  private _vibe: VibeState = { egalitarian: 0, green: 0, planned: 0, isNight: false };
  /** When each visible tile was last seen burning (ms), for the smoulder afterwards. Render-only. */
  private _lastBurn = new Map<number, number>();
  private _lastBurnWorld: World | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    loadClaySprites();
    loadWildTrees();
  }

  /**
   * The badge or pin under canvas point (x, y) in the last frame drawn, topmost
   * first, or null. `count` is the number of lots a district pin stands for.
   */
  /** The resident-request badge under a point of the canvas (CSS pixels), if any. */
  requestAt(x: number, y: number): RequestBadge | null {
    for (const b of this._requestBadges) {
      if (Math.hypot(b.x - x, b.y - y) <= b.r + 4) return b;
    }
    return null;
  }

  badgeAt(x: number, y: number): { kind: BadgeKind; count: number } | null {
    const b = this._badges;
    for (let q = b.length - 5; q >= 0; q -= 5) {
      const dx = x - b[q], dy = y - b[q + 1], r = b[q + 2] + 2;
      if (dx * dx + dy * dy <= r * r) return { kind: BADGE_KINDS[b[q + 3]], count: b[q + 4] };
    }
    return null;
  }

  /** Draws one frame. The passes run back to front. */
  render(world: World, camera: Camera, options: RenderOptions = {}): void {
    if (camera.zoom < 0.1) return;
    const { hoverTile = null, tool = 'none', overlay = 'none', coveragePreview = null, now = 0, roadPreview = null, zonePreview = null, pcPreview = null } = options;

    const ctx = this.ctx;
    const { width: cw, height: ch } = this.canvas;
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, cw, ch);

    const bounds = camera.visibleTileBounds(world.grid);
    const ts = TILE_SIZE * camera.zoom;

    // 1. The static layer.
    this.chunks.update(world, bounds, camera.zoom, now);
    this.chunks.draw(ctx, world, camera, bounds);

    // 2. Trees, sprites, overlay tints, cars, then smoke and fire above them.
    this._drawLots(ctx, world, camera, bounds, ts, overlay, now);

    // 3. Problem badges and district pins.
    this._drawBadges(ctx, world, camera, ts, now, cw, ch);
    this._drawRequests(ctx, world, camera, ts, options.requestOutcomes ?? []);
    for (const h of options.areaHighlights ?? []) this._drawAreaHighlight(ctx, camera, ts, h);

    // 4. The inspected lot's trips to work and shops (or to homes), along the roads.
    if (tool === 'inspect' && hoverTile && world.grid.inBounds(hoverTile.tx, hoverTile.ty)) {
      const i = world.grid.idx(hoverTile.tx, hoverTile.ty);
      if (world.layers.zone[i] !== ZONE_NONE && world.layers.devLevel[i] > 0 && world.layers.abandoned[i] === 0) {
        drawCommuteRoutes(ctx, world, i, ts, camera.worldToScreenX(0), camera.worldToScreenY(0));
      }
    }

    // 5. Guides: tile grid, overlay key, coverage preview, hover outline, map edge.
    if (camera.zoom >= 1.2) this._drawTileGrid(ctx, camera, bounds);
    if (overlay !== 'none') this._drawOverlayLegend(ctx, overlay, camera.viewportH);
    if (pcPreview !== null) this._drawPcPreview(ctx, camera, ts, pcPreview);
    if (coveragePreview !== null) this._drawCoveragePreview(ctx, world, camera, bounds, ts, coveragePreview);
    if (roadPreview !== null) this._drawRoadPreview(ctx, world, camera, ts, roadPreview);
    if (zonePreview !== null) this._drawZonePreview(ctx, camera, ts, zonePreview);
    if (hoverTile && world.grid.inBounds(hoverTile.tx, hoverTile.ty)) this._drawHover(ctx, world, camera, ts, hoverTile, tool, pcPreview !== null && !pcPreview.ok, pcPreview?.warning === true);

    const tlsx = camera.worldToScreenX(0);
    const tlsy = camera.worldToScreenY(0);
    const brsx = camera.worldToScreenX(world.grid.width * TILE_SIZE);
    const brsy = camera.worldToScreenY(world.grid.height * TILE_SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tlsx, tlsy, brsx - tlsx, brsy - tlsy);
  }

  /**
   * Everything drawn per visible tile each frame: wild trees, the clay sprite
   * and its tint, the overlay tint and traffic cars; then, above all of those,
   * smoke and fire. Also queues the lots that `_drawBadges` will look at.
   */
  private _drawLots(ctx: CanvasRenderingContext2D, world: World, camera: Camera, bounds: TileBounds, ts: number, overlay: MapOverlay, now: number): void {
    const p = resolvePalette(world.character, BALANCE.character.axisMax);
    const tsi = Math.ceil(ts) + 1;
    const crimeOverlay = overlay === 'crime', fireOverlay = overlay === 'fire', vibeOverlay = overlay === 'vibe';
    const hasOverlay = overlay !== 'none';
    const clayTile = Math.ceil(ts);
    beginClayFrame(clayTile, now);
    beginWildTreeFrame(clayTile, now);
    beginTrafficFrame(clayTile, now);
    const clayEffects = this._clayEffects;
    clayEffects.length = 0;
    const markerQueue = this._markerQueue;
    const fireQueue = this._fireQueue;
    markerQueue.length = 0;
    const utilityQueue = this._utilityQueue;
    utilityQueue.length = 0;
    fireQueue.length = 0;
    if (this._lastBurnWorld !== world) { this._lastBurnWorld = world; this._lastBurn.clear(); }

    // Clay trees replace the chunk layer's flat ones. Each chunk draws flat
    // trees only below CLAY_TREE_MIN_TILE, and chunks can briefly be at
    // different sizes around a zoom, so the choice is made per tile from the
    // size ITS chunk was drawn at: the two never show together.
    const clayTrees = wildTreesReady();
    if (clayTrees) this._drawForestFloor(ctx, world, camera, bounds);

    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const i = world.grid.idx(tx, ty);

        const zone       = world.layers.zone[i];
        const building   = world.layers.building[i];
        const fireV      = world.layers.fire[i];
        const road       = world.layers.roadClass[i];

        if (clayTrees && this._clayTreesAt(world, tx, ty) && this._hasTree(world, i)) {
          let around = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if ((dx !== 0 || dy !== 0) && world.grid.inBounds(tx + dx, ty + dy) && this._hasTree(world, world.grid.idx(tx + dx, ty + dy))) around++;
          }
          drawWildTrees(ctx, world.layers.vegetation[i], wildVariant(tx, ty), wildDensity(around),
            Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx))), Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty))), clayTile);
        }

        // Skip entirely empty tiles to save CPU (But include roads!)
        if (zone === ZONE_NONE && building === BUILDING_NONE && fireV === 0 && road === ROAD_NONE && !hasOverlay) continue;

        const fireRiskV  = world.layers.fireRisk[i];
        const crimeV     = world.layers.crime[i];
        const congestion = world.layers.congestion[i];
        const dev        = world.layers.devLevel[i];
        const visualVariant = world.layers.visualVariant[i];

        const sx  = camera.worldToScreenX(Projection.tileToWorldX(tx));
        const sy  = camera.worldToScreenY(Projection.tileToWorldY(ty));
        const sxi = Math.floor(sx);
        const syi = Math.floor(sy);
        // Zoomed in, every lot is checked for a missing road, power or water, empty ones too.
        if (ts >= PROBLEM_BADGE_MIN_TILE && zone !== ZONE_NONE) utilityQueue.push(i, sxi, syi);

        // 1. Draw Sprite (Buildings/Houses)
        // Localized Vibe for sprite selection
        // (One object reused for every tile: nothing keeps it.)
        const localVibe = this._vibe;
        localVibe.egalitarian = (world.layers.vibeEgalitarian[i] - 128) / 128;
        localVibe.green       = (world.layers.vibeGreen[i] - 128) / 128;
        localVibe.planned     = (world.layers.vibePlanned[i] - 128) / 128;

        // Clay image sprites. Until they load (or where no image exists) the
        // chunk layer's flat drawing shows through.
        const isAbandoned = world.layers.abandoned[i] !== 0;
        // A building on several tiles is drawn once, at its draw tile (clay/bigBuildings.ts).
        const big = building !== BUILDING_NONE && isLargeBuilding(building);
        if (big) {
          const anchor = world.buildingAnchorAt(i), box = shapeBox(building);
          if (i === anchor + box.drawDx + box.drawDy * world.grid.width) this._drawBigBuilding(ctx, world, camera, anchor, building, now);
        }
        const clay = big ? undefined : pickClaySprite(zone, building, dev, localVibe, isAbandoned, visualVariant);

        if (clay) {
          // The lot ID picks the design (low bits) and the ground tone (higher bits).
          // A lot without power shows it on the building itself (lights out).
          const look = building === BUILDING_NONE && !isAbandoned && world.layers.power[i] === 0 ? LOOK_NO_POWER : 0;
          drawClaySprite(ctx, clay, sxi, syi, clayTile, visualVariant >> 3, look);
          if (building === BUILDING_NONE) {
            // The plot hides the chunk layer's status tints, so repeat them here.
            let tint: string | null = null;
            if (isAbandoned) tint = 'rgba(24,18,12,0.38)';
            else if (look) tint = null;
            else if (world.layers.sewage[i] === 0 && dev >= 2) tint = p.noSewageTint;
            else if (world.layers.services[i] === 0 && dev >= 2) tint = p.noServicesTint;
            if (tint) {
              ctx.fillStyle = tint;
              ctx.fillRect(sxi, syi, clayTile, clayTile);
            }
          }
          if (!isAbandoned && fireV === 0 && ts >= 10) collectClayEffects(clay, sxi, syi, clayTile, i, clayEffects);
          // The plot also hides the chunk layer's crime / sickness / death markers:
          // queue them to be redrawn above every sprite.
          if (building === BUILDING_NONE && dev > 0) markerQueue.push(i, sxi, syi);
        }

        // 2. Draw Overlays
        if (vibeOverlay) {
            const vg = world.layers.vibeGreen[i];
            const ve = world.layers.vibeEgalitarian[i];
            // Green vibe -> Green color
            // Industrial vibe -> Orange/Brown
            // Egalitarian -> Blue tint
            const r = vg < 128 ? 200 : 0;
            const g = vg > 128 ? 200 : 100;
            const b = ve > 128 ? 200 : 0;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
            ctx.fillRect(sxi, syi, tsi, tsi);
        }

        if (crimeOverlay && crimeV > 10) {
          ctx.fillStyle = _crimeOverlayColors[crimeV];
          ctx.fillRect(sxi, syi, tsi, tsi);
        }

        if (fireOverlay && fireRiskV > 10) {
          ctx.fillStyle = _fireOverlayColors[fireRiskV];
          ctx.fillRect(sxi, syi, tsi, tsi);
        }

        // Fire and its aftermath are drawn after every sprite, so flames are
        // not hidden by the building in front.
        if (fireV > 0) {
          this._lastBurn.set(i, now);
          fireQueue.push(i, sxi, syi);
        } else if (this._lastBurn.has(i)) {
          if (now - this._lastBurn.get(i)! > SMOULDER_MS) this._lastBurn.delete(i);
          else fireQueue.push(i, sxi, syi);
        }

        if (ts >= TRAFFIC_MIN_TILE && road !== ROAD_NONE && congestion > 8) {
          // Each road tile shows its own load as cars in its lanes (see clay/roads.ts).
          const traffic = world.traffic;
          const volume = traffic ? trafficVolume(traffic, i) : 0;
          const load = traffic ? volume / roadCapacity(road) : congestion / 255;
          const cars = this._trafficCars;
          // Cars only a few pixels long are thinned by half: they cost as much to draw and say no more.
          const count = roadTrafficCars(tx, ty, drawnRoadAt(world, tx, ty), drawnRoadsAround(world, tx, ty), load,
            volume > 0 ? traffic!.goods.volume[i] / volume : 0, now / 1000, cars, ts < TRAFFIC_FULL_TILE ? 0.5 : 1);
          drawTrafficCars(ctx, cars, count, sxi, syi, clayTile);
        }
      }

    }

    // Big buildings whose draw tile is off screen but whose body is not.
    for (const b of world.buildings) {
      if (!isLargeBuilding(b.kind)) continue;
      const box = shapeBox(b.kind), dx = b.tx + box.drawDx, dy = b.ty + box.drawDy;
      if (dx >= bounds.x0 && dx <= bounds.x1 && dy >= bounds.y0 && dy <= bounds.y1) continue;   // drawn in the loop
      if (b.tx + box.maxX < bounds.x0 || b.tx + box.minX > bounds.x1 || b.ty + box.maxY < bounds.y0 || b.ty + box.minY > bounds.y1) continue;
      this._drawBigBuilding(ctx, world, camera, world.grid.idx(b.tx, b.ty), b.kind, now);
    }

    // Smoke, steam and flares rise over everything behind them.
    if (clayEffects.length > 0) drawClayEffects(ctx, clayEffects, now * 0.001);

    for (let q = 0; q < fireQueue.length; q += 3) {
      const i = fireQueue[q], fx = fireQueue[q + 1], fy = fireQueue[q + 2];
      const fireV = world.layers.fire[i];
      const seed = ((i * 2654435761) >>> 0) / 4294967296;
      if (fireV > 0) drawClayFire(ctx, fx, fy, clayTile, now * 0.001, seed, fireV / BALANCE.fire.burnDuration);
      else drawClaySmolder(ctx, fx, fy, clayTile, now * 0.001, seed, 1 - (now - this._lastBurn.get(i)!) / SMOULDER_MS);
    }
  }

  /**
   * The water's edge within reach of the pointer, as a bright line where water
   * meets land: where a building that needs water can go. Stronger (and
   * pulsing) while the spot under the pointer has no water beside it.
   */
  private _drawShoreHint(ctx: CanvasRenderingContext2D, world: World, at: { tx: number; ty: number }, X: (tx: number) => number, Y: (ty: number) => number, urgent: boolean): void {
    const R = 18, terrain = world.layers.terrain, grid = world.grid;
    const isWater = (x: number, y: number) => grid.inBounds(x, y) && terrain[grid.idx(x, y)] === TERRAIN_WATER;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = urgent ? 3 : 2;
    ctx.strokeStyle = `rgba(120,220,255,${urgent ? 0.7 + 0.3 * Math.sin(performance.now() / 180) : 0.55})`;
    ctx.beginPath();
    for (let y = at.ty - R; y <= at.ty + R; y++) {
      for (let x = at.tx - R; x <= at.tx + R; x++) {
        if (!grid.inBounds(x, y) || isWater(x, y)) continue;      // from the land side
        if (isWater(x, y - 1)) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + 1), Y(y)); }
        if (isWater(x, y + 1)) { ctx.moveTo(X(x), Y(y + 1)); ctx.lineTo(X(x + 1), Y(y + 1)); }
        if (isWater(x - 1, y)) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 1)); }
        if (isWater(x + 1, y)) { ctx.moveTo(X(x + 1), Y(y)); ctx.lineTo(X(x + 1), Y(y + 1)); }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** The code-drawn stand-in for a building on several tiles, anchored at tile index `anchor`. */
  private _drawBigBuilding(ctx: CanvasRenderingContext2D, world: World, camera: Camera, anchor: number, kind: number, now: number): void {
    const width = world.grid.width, ax = anchor % width, ay = (anchor - ax) / width;
    // A building that stands at the water's edge (the pump) shows a pipe running into the water.
    let water: { x: number; y: number } | null = null;
    if (placementRules(kind).needsWaterEdge) {
      const tiles = footprintTiles(width, world.grid.height, ax, ay, kind);
      if (tiles) for (const i of footprintEdge(width, world.grid.height, tiles)) {
        if (world.layers.terrain[i] === TERRAIN_WATER) { water = { x: i % width, y: (i - (i % width)) / width }; break; }
      }
    }
    drawBigStandIn(ctx, kind, shapeTiles(kind, ax, ay),
      tx => Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx))), ty => Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty))), now * 0.001, water);
  }

  /**
   * Problem indicators (see clay/problemPins.ts): zoomed in, a badge on each
   * seriously affected building; zoomed out, one pin per troubled district.
   * Records what it drew for `badgeAt`.
   */
  private _drawBadges(ctx: CanvasRenderingContext2D, world: World, camera: Camera, ts: number, now: number, cw: number, ch: number): void {
    const markerQueue = this._markerQueue, utilityQueue = this._utilityQueue;
    const badges = this._badges;
    badges.length = 0;
    const badge = (x: number, y: number, r: number, kind: BadgeKind, count: number): void => {
      drawProblemBadge(ctx, x, y, r, kind, count);
      badges.push(x, y, r, BADGE_KINDS.indexOf(kind), count);
    };
    if (ts >= PROBLEM_BADGE_MIN_TILE) {
      const r = ts * 0.16;
      for (let q = 0; q < markerQueue.length; q += 3) {
        const i = markerQueue[q], x = markerQueue[q + 1], y = markerQueue[q + 2];
        if (crimeProblem(world, i, CRIME_BADGE_MIN)) badge(x + ts * 0.8, y + ts * 0.2, r, 'crime', 1);
        if (healthProblem(world, i, SICKNESS_BADGE_MIN)) badge(x + ts * 0.2, y + ts * 0.2, r, 'health', 1);
        if (world.layers.recentDeath[i] > 0 && world.layers.zone[i] === ZONE_R) badge(x + ts * 0.2, y + ts * 0.8, r, 'death', 1);
      }
      // No road, no power, no water, commute: along the front of the lot. With
      // no road the rest are symptoms and only the road badge shows.
      for (let q = 0; q < utilityQueue.length; q += 3) {
        const m = lotProblemMask(world, utilityQueue[q]), x = utilityQueue[q + 1], y = utilityQueue[q + 2];
        if (m & 64) { badge(x + ts * 0.5, y + ts * 0.8, r, 'road', 1); continue; }
        const power = (m & 4) !== 0, water = (m & 8) !== 0;
        if (power) badge(x + ts * (water ? 0.34 : 0.5), y + ts * 0.8, r, 'power', 1);
        if (water) badge(x + ts * (power ? 0.62 : 0.5), y + ts * 0.8, r, 'water', 1);
        if (m & 32) badge(x + ts * 0.85, y + ts * 0.5, r, 'cutoff', 1);
        else if (m & 16) badge(x + ts * 0.85, y + ts * 0.5, r, 'commute', 1);
      }
    } else {
      // Districts are regrouped when the sim has ticked, at most a few times a second.
      if (this._pinsWorld !== world || (world.tick !== this._pinsTick && now - this._pinsAt > PROBLEM_PIN_REFRESH_MS)) {
        this._pins = findProblemClusters(world);
        this._pinsWorld = world; this._pinsTick = world.tick; this._pinsAt = now;
      }
      for (const pin of this._pins) {
        // When tiles are tiny, a lot or two on its own is not worth a pin.
        if (ts < PROBLEM_SMALL_PIN_MIN_TILE && pin.count < 3) continue;
        let x = camera.worldToScreenX(pin.x * TILE_SIZE);
        const y = camera.worldToScreenY(pin.y * TILE_SIZE), r = pinRadius(pin.count);
        // A district with two problems has both pins in the same place: step aside.
        for (let tries = 0, q = 0; tries < 6 && q < badges.length; q += 5) {
          const reach = (r + badges[q + 2]) * 0.85;
          if (Math.abs(badges[q + 1] - y) < reach && Math.abs(badges[q] - x) < reach) { x = badges[q] + r + badges[q + 2]; q = -5; tries++; }
        }
        if (x < -r || y < -r || x > cw + r || y > ch + r) continue;
        badge(x, y, r, pin.kind, pin.count);
      }
    }
  }

  private _drawTileGrid(ctx: CanvasRenderingContext2D, camera: Camera, bounds: TileBounds): void {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gridX0 = camera.worldToScreenX(Projection.tileToWorldX(bounds.x0));
    const gridX1 = camera.worldToScreenX(Projection.tileToWorldX(bounds.x1 + 1));
    const gridY0 = camera.worldToScreenY(Projection.tileToWorldY(bounds.y0));
    const gridY1 = camera.worldToScreenY(Projection.tileToWorldY(bounds.y1 + 1));
    for (let ty = bounds.y0; ty <= bounds.y1 + 1; ty++) {
      const sy = camera.worldToScreenY(Projection.tileToWorldY(ty));
      ctx.moveTo(gridX0, Math.floor(sy) + 0.5);
      ctx.lineTo(gridX1, Math.floor(sy) + 0.5);
    }
    for (let tx = bounds.x0; tx <= bounds.x1 + 1; tx++) {
      const sx = camera.worldToScreenX(Projection.tileToWorldX(tx));
      ctx.moveTo(Math.floor(sx) + 0.5, gridY0);
      ctx.lineTo(Math.floor(sx) + 0.5, gridY1);
    }
    ctx.stroke();
  }

  private _drawOverlayLegend(ctx: CanvasRenderingContext2D, overlay: Exclude<MapOverlay, 'none'>, viewportH: number): void {
    const lx = 12, ly = viewportH - 30;
    ctx.globalAlpha = 1.0;
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';
    let lxOff = lx;
    for (const [color, label] of OVERLAY_LEGENDS[overlay]) {
      ctx.fillStyle = color;
      ctx.fillRect(lxOff, ly, 10, 10);
      ctx.fillStyle = '#ccc';
      ctx.fillText(label, lxOff + 14, ly + 5);
      lxOff += 14 + ctx.measureText(label).width + 14;
    }
  }

  private _drawCoveragePreview(ctx: CanvasRenderingContext2D, world: World, camera: Camera, bounds: TileBounds, ts: number, coverage: Set<number>): void {
    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const i = world.grid.idx(tx, ty);
        if (!coverage.has(i)) continue;
        const sx = camera.worldToScreenX(Projection.tileToWorldX(tx));
        const sy = camera.worldToScreenY(Projection.tileToWorldY(ty));
        const isRoad = world.layers.roadClass[i] !== ROAD_NONE;
        ctx.fillStyle = isRoad
          ? 'rgba(80, 200, 255, 0.55)'
          : 'rgba(80, 200, 255, 0.22)';
        ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(ts) + 1, Math.ceil(ts) + 1);
      }
    }
  }

  /** A bright dashed outline and a light wash over an area: "here". */
  private _drawAreaHighlight(ctx: CanvasRenderingContext2D, camera: Camera, ts: number, h: AreaHighlight): void {
    if (h.alpha <= 0) return;
    const x = Math.round(camera.worldToScreenX(h.x0 * TILE_SIZE)), y = Math.round(camera.worldToScreenY(h.y0 * TILE_SIZE));
    const w = Math.round((h.x1 - h.x0 + 1) * ts), hh = Math.round((h.y1 - h.y0 + 1) * ts);
    ctx.save();
    ctx.globalAlpha = Math.min(1, h.alpha);
    ctx.fillStyle = 'rgba(125,216,192,0.14)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 6]);
    ctx.strokeStyle = '#9ff3dc';
    if (h.tiles && h.tiles.length > 0) {
      const X = (tx: number) => Math.round(camera.worldToScreenX(tx * TILE_SIZE)), Y = (ty: number) => Math.round(camera.worldToScreenY(ty * TILE_SIZE));
      for (const t of h.tiles) ctx.fillRect(X(t.x), Y(t.y), X(t.x + 1) - X(t.x), Y(t.y + 1) - Y(t.y));
      this._strokeTileSet(ctx, h.tiles, X, Y);
    } else {
      ctx.fillRect(x, y, w, hh);
      ctx.strokeRect(x + 0.5, y + 0.5, w, hh);
    }
    ctx.restore();
  }

  /** Strokes the outline of a set of tiles with the current line style. */
  private _strokeTileSet(ctx: CanvasRenderingContext2D, tiles: readonly TilePoint[], X: (tx: number) => number, Y: (ty: number) => number): void {
    ctx.beginPath();
    for (const e of tileSetEdges(tiles)) { ctx.moveTo(X(e.x0) + 0.5, Y(e.y0) + 0.5); ctx.lineTo(X(e.x1) + 0.5, Y(e.y1) + 0.5); }
    ctx.stroke();
  }

  /**
   * Resident requests: a faint dashed outline round each asking area, a badge
   * at its centre (merged where they would overlap), and a tick or cross where
   * one has just ended. Records the badges for `requestAt`.
   */
  private _drawRequests(ctx: CanvasRenderingContext2D, world: World, camera: Camera, ts: number, outcomes: readonly RequestOutcome[]): void {
    const requests = world.politics.requests;
    this._requestBadges = [];
    if (requests.length === 0 && outcomes.length === 0) return;
    const X = (tx: number) => camera.worldToScreenX(tx * TILE_SIZE), Y = (ty: number) => camera.worldToScreenY(ty * TILE_SIZE);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(125,216,192,0.55)';
    const gridWidth = world.grid.width;
    for (const r of requests) {
      const tiles = clusterTiles(r, gridWidth);
      if (tiles) this._strokeTileSet(ctx, tiles, tx => Math.round(X(tx)), ty => Math.round(Y(ty)));
      else ctx.strokeRect(Math.round(X(r.x0)) + 0.5, Math.round(Y(r.y0)) + 0.5, Math.round((r.x1 - r.x0 + 1) * ts), Math.round((r.y1 - r.y0 + 1) * ts));
    }
    ctx.setLineDash([]);
    this._requestBadges = layoutRequestBadges(requests, world.tick, (tx, ty) => ({ x: X(tx), y: Y(ty) }), undefined, gridWidth);
    // A request badge that would sit on a problem badge or pin steps aside, to the right.
    const taken = this._badges;
    for (const b of this._requestBadges) {
      for (let tries = 0, q = 0; tries < 6 && q < taken.length; q += 5) {
        const reach = (b.r + 4 + taken[q + 2]) * 0.9;
        if (Math.abs(taken[q + 1] - b.y) < reach && Math.abs(taken[q] - b.x) < reach) { b.x = taken[q] + taken[q + 2] + b.r + 6; q = -5; tries++; }
      }
    }
    for (const b of this._requestBadges) drawRequestBadge(ctx, b);
    for (const o of outcomes) drawRequestOutcome(ctx, X(o.tx), Y(o.ty), o.met, o.age);
  }

  /** The road about to be built in auto road mode: its tiles tinted, the start outlined, the price by the end. */
  private _drawRoadPreview(ctx: CanvasRenderingContext2D, world: World, camera: Camera, ts: number, preview: RoadPreview): void {
    const { tiles, ok, label } = preview;
    if (tiles.length === 0) return;
    const size = Math.ceil(ts) + 1;
    const fill = ok ? 'rgba(255,255,255,0.45)' : 'rgba(255,90,90,0.5)';
    const blocked = 'rgba(255,90,90,0.25)';
    for (const { tx, ty } of tiles) {
      const sx = Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx)));
      const sy = Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty)));
      // A tile no road can go on (a building) is skipped when building: show it fainter and red.
      ctx.fillStyle = world.isBuildable(tx, ty, true) ? fill : blocked;
      ctx.fillRect(sx, sy, size, size);
    }
    const start = tiles[0], end = tiles[tiles.length - 1];
    ctx.strokeStyle = ok ? '#fff' : '#f66';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      Math.floor(camera.worldToScreenX(Projection.tileToWorldX(start.tx))) + 1,
      Math.floor(camera.worldToScreenY(Projection.tileToWorldY(start.ty))) + 1,
      Math.ceil(ts) - 1, Math.ceil(ts) - 1,
    );
    if (label) this._drawPriceTag(ctx, camera, ts, end, label, ok, preview.pc);
  }

  /** The lots a zone fill would zone: tinted in the zone's colour and outlined, the price by the pointer. */
  private _drawZonePreview(ctx: CanvasRenderingContext2D, camera: Camera, ts: number, preview: ZonePreview): void {
    const { tiles, ok, color, label, at } = preview;
    const size = Math.ceil(ts);
    ctx.lineWidth = 1;
    for (const { tx, ty } of tiles) {
      const sx = Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx)));
      const sy = Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty)));
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ok ? color : '#ff5a5a';
      ctx.fillRect(sx, sy, size + 1, size + 1);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? 'rgba(255,255,255,0.7)' : '#f66';
      ctx.strokeRect(sx + 0.5, sy + 0.5, size, size);
    }
    if (label && tiles.length > 0) this._drawPriceTag(ctx, camera, ts, at, label, ok, preview.pc);
  }

  /**
   * A small price label to the right of a tile: money in green, then political
   * capital in teal, each red if the city cannot cover it, and an optional
   * second line saying why.
   */
  private _drawPriceTag(ctx: CanvasRenderingContext2D, camera: Camera, ts: number, at: { tx: number; ty: number }, label: string, ok: boolean, pc?: PcTag): void {
    const x = camera.worldToScreenX(Projection.tileToWorldX(at.tx)) + ts + 8;
    const y = camera.worldToScreenY(Projection.tileToWorldY(at.ty)) + ts / 2;
    const FONT = '600 12px system-ui, sans-serif', SMALL = '500 10px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = FONT;
    const pcText = pc?.text ?? '';
    const sep = label && pcText ? ' · ' : '';
    const wLabel = ctx.measureText(label + sep).width;
    const wPc = ctx.measureText(pcText).width;
    const note = pc?.note ?? '';
    ctx.font = SMALL;
    const wNote = note ? ctx.measureText(note).width : 0;
    const w = Math.max(wLabel + wPc, wNote), h = note ? 34 : 20;
    ctx.fillStyle = 'rgba(10,18,28,0.88)';
    ctx.fillRect(x - 5, y - 10, w + 10, h);
    if (pc && !pc.ok) {
      ctx.strokeStyle = '#e07070';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 4.5, y - 9.5, w + 9, h - 1);
    }
    ctx.font = FONT;
    ctx.fillStyle = ok ? '#7dd87d' : '#f77';
    ctx.fillText(label + sep, x, y);
    if (pcText) {
      ctx.fillStyle = pc!.ok ? '#7dd8c0' : '#f77';
      ctx.fillText(pcText, x + wLabel, y);
    }
    if (note) {
      ctx.font = SMALL;
      ctx.fillStyle = pc?.warn ? '#ffd166' : '#9ab';
      ctx.fillText(note, x, y + 15);
    }
  }

  /**
   * Political capital at the pointer. Homes that object are tinted red, darker
   * the more they mind. Round an unpopular building go its fall-off bands as
   * stepped outlines (manhattan distance, like service coverage): solid where
   * homes mind most, then dashed, then dotted. The price goes in the tag.
   */
  private _drawPcPreview(ctx: CanvasRenderingContext2D, camera: Camera, ts: number, preview: PcPreview): void {
    const { at, rings, tints, ok } = preview;
    const X = (tx: number) => Math.round(camera.worldToScreenX(Projection.tileToWorldX(tx)));
    const Y = (ty: number) => Math.round(camera.worldToScreenY(Projection.tileToWorldY(ty)));
    for (const { tx, ty, strength } of tints) {
      ctx.fillStyle = `rgba(224,72,72,${(0.18 + 0.42 * strength).toFixed(3)})`;
      ctx.fillRect(X(tx), Y(ty), X(tx + 1) - X(tx), Y(ty + 1) - Y(ty));
    }
    const DASH = [[], [7, 5], [2, 5]];
    ctx.lineWidth = 2;
    const big = preview.building && isLargeBuilding(preview.building.kind) ? preview.building : null;
    rings.forEach(({ within: r }, n) => {
      ctx.setLineDash(DASH[Math.min(n, DASH.length - 1)]);
      ctx.strokeStyle = `rgba(232,110,110,${ok ? 0.95 - 0.2 * Math.min(n, 2) : 1})`;
      ctx.beginPath();
      if (big) {
        // A building on several tiles: the ring is measured from its nearest tile, so it wraps the footprint.
        for (const e of footprintBand(big.kind, r)) { ctx.moveTo(X(big.tx + e.x0), Y(big.ty + e.y0)); ctx.lineTo(X(big.tx + e.x1), Y(big.ty + e.y1)); }
        ctx.stroke();
        return;
      }
      // Down the right-hand steps of the diamond, then back up the left.
      ctx.moveTo(X(at.tx), Y(at.ty - r));
      for (let dy = -r; dy <= r; dy++) {
        const x = X(at.tx + (r - Math.abs(dy)) + 1);
        ctx.lineTo(x, Y(at.ty + dy));
        ctx.lineTo(x, Y(at.ty + dy + 1));
      }
      for (let dy = r; dy >= -r; dy--) {
        const x = X(at.tx - (r - Math.abs(dy)));
        ctx.lineTo(x, Y(at.ty + dy + 1));
        ctx.lineTo(x, Y(at.ty + dy));
      }
      ctx.closePath();
      ctx.stroke();
    });
    ctx.setLineDash([]);
    if (preview.label || preview.money) {
      this._drawPriceTag(ctx, camera, ts, at, preview.money ?? '', true, { text: preview.label, ok, note: preview.note, warn: preview.warning });
    }
  }

  private _drawHover(ctx: CanvasRenderingContext2D, world: World, camera: Camera, ts: number, hoverTile: { tx: number; ty: number }, tool: string, refused = false, warn = false): void {
    const sx = camera.worldToScreenX(Projection.tileToWorldX(hoverTile.tx));
    const sy = camera.worldToScreenY(Projection.tileToWorldY(hoverTile.ty));
    
    const isRoadTool = ['road', 'avenue', 'highway'].includes(tool);
    const isBuildable = world.isBuildable(hoverTile.tx, hoverTile.ty, isRoadTool);
    
    // Red when nothing can go here, or when the action would be refused for lack of political capital.
    const ok = isBuildable && !refused;
    // Amber: allowed, but with a warning (a service building off the road network).
    ctx.strokeStyle = !ok ? '#f66' : warn ? '#ffd166' : '#fff';
    ctx.lineWidth = 2;
    // Looking at or bulldozing a building on several tiles: outline all of it, whichever tile is under the pointer.
    const i = world.grid.idx(hoverTile.tx, hoverTile.ty), kind = world.layers.building[i];
    if ((tool === 'inspect' || tool === 'bulldoze') && kind !== BUILDING_NONE && isLargeBuilding(kind)) {
      const width = world.grid.width;
      const tiles = world.buildingTilesAt(hoverTile.tx, hoverTile.ty).map(k => ({ x: k % width, y: Math.floor(k / width) }));
      const X = (tx: number) => Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx))), Y = (ty: number) => Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty)));
      if (refused) {
        ctx.fillStyle = 'rgba(224,112,112,0.3)';
        for (const p of tiles) ctx.fillRect(X(p.x), Y(p.y), X(p.x + 1) - X(p.x), Y(p.y + 1) - Y(p.y));
      }
      if (tool === 'inspect') ctx.strokeStyle = '#fff';
      this._strokeTileSet(ctx, tiles, X, Y);
      return;
    }
    // Placing a building on several tiles: outline where it would stand (anchor under the pointer), red if it cannot go there.
    const placing = buildingKindForPlacing(tool);
    if (placing !== undefined && isLargeBuilding(placing)) {
      // The pointer holds the middle of the footprint.
      const a = placementAnchor(placing, hoverTile.tx, hoverTile.ty);
      const tiles = shapeTiles(placing, a.tx, a.ty);
      const X = (tx: number) => Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx))), Y = (ty: number) => Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty)));
      const check = world.checkPlacement(a.tx, a.ty, placing);
      const can = check.ok && !refused;
      // A kind that must stand beside water (the pump): light up the shore near the pointer.
      if (placementRules(placing).needsWaterEdge) this._drawShoreHint(ctx, world, hoverTile, X, Y, check.noWater);
      // Each tile says whether it is the problem: water, a building, a road, or off the map.
      for (const p of tiles) {
        if (!world.grid.inBounds(p.x, p.y)) continue;
        const blocked = check.blocked.includes(world.grid.idx(p.x, p.y));
        ctx.fillStyle = blocked ? 'rgba(224,72,72,0.5)' : refused ? 'rgba(224,112,112,0.3)' : 'rgba(255,255,255,0.16)';
        ctx.fillRect(X(p.x), Y(p.y), X(p.x + 1) - X(p.x), Y(p.y + 1) - Y(p.y));
      }
      ctx.strokeStyle = !can ? '#f66' : warn ? '#ffd166' : '#fff';
      this._strokeTileSet(ctx, tiles, X, Y);
      return;
    }
    if (refused) {
      ctx.fillStyle = 'rgba(224,112,112,0.3)';
      ctx.fillRect(Math.floor(sx) + 1, Math.floor(sy) + 1, Math.ceil(ts) - 1, Math.ceil(ts) - 1);
    }
    ctx.strokeRect(Math.floor(sx) + 1, Math.floor(sy) + 1, Math.ceil(ts) - 1, Math.ceil(ts) - 1);
  }

  /** Whether the chunk holding this tile was drawn large enough that its trees are clay sprites, not flat ones. */
  private _clayTreesAt(world: World, tx: number, ty: number): boolean {
    return this.chunks.tileSizeAt(world, tx, ty) >= CLAY_TREE_MIN_TILE;
  }

  /** True if the tile shows a wild tree (vegetation on otherwise untouched land). */
  private _hasTree(world: World, i: number): boolean {
    const L = world.layers;
    return L.vegetation[i] !== VEG_NONE && L.roadClass[i] === ROAD_NONE && L.building[i] === BUILDING_NONE && L.zone[i] === ZONE_NONE;
  }

  /**
   * A darker floor under forests: every tree tile that touches another, with
   * the outer corners rounded. One fill, so nothing darkens twice.
   */
  private _drawForestFloor(ctx: CanvasRenderingContext2D, world: World, camera: Camera, bounds: TileBounds): void {
    const { width, height } = world.grid;
    const tree = (tx: number, ty: number): boolean => tx >= 0 && ty >= 0 && tx < width && ty < height && this._clayTreesAt(world, tx, ty) && this._hasTree(world, ty * width + tx);
    const radius = TILE_SIZE * camera.zoom * 0.45;
    ctx.beginPath();
    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        if (!tree(tx, ty)) continue;
        const n = tree(tx, ty - 1), s = tree(tx, ty + 1), w = tree(tx - 1, ty), e = tree(tx + 1, ty);
        if (!n && !s && !w && !e) continue; // a lone tree has no floor
        const x0 = Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx)));
        const y0 = Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty)));
        const x1 = Math.floor(camera.worldToScreenX(Projection.tileToWorldX(tx + 1)));
        const y1 = Math.floor(camera.worldToScreenY(Projection.tileToWorldY(ty + 1)));
        ctx.roundRect(x0, y0, x1 - x0, y1 - y0, [n || w ? 0 : radius, n || e ? 0 : radius, s || e ? 0 : radius, s || w ? 0 : radius]);
      }
    }
    ctx.fillStyle = 'rgba(38,84,40,0.4)';
    ctx.fill();
  }
}
