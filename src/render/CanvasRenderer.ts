import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import { CHUNK_SIZE } from '../sim/Grid';
import { resolvePalette, resolveTilePalette, type ColorPalette } from './CharacterPalette';
import type { VibeState } from './SpriteTypes';
import { loadClaySprites, beginClayFrame, pickClaySprite, drawClaySprite, collectClayEffects, drawClayEffects, drawClayFire, drawClaySmolder, type ClayEffect } from './clay/ClaySprites';
import { BALANCE } from '../data/balance';
import {
  TERRAIN_GRASS, TERRAIN_WATER,
  ZONE_NONE, ZONE_R, ZONE_C, ZONE_I,
  ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY,
  VEG_NONE,
  BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';

// Pre-computed color string caches indexed by Uint8 value (0–255).
const _pollutionColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.65, (v / 255) * 0.85);
  return `rgba(160,80,0,${alpha.toFixed(3)})`;
});
const _crimeOverlayColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.7, (v / 255) * 0.9);
  return `rgba(255,0,0,${alpha.toFixed(3)})`;
});
const _fireOverlayColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.7, (v / 255) * 0.9);
  return `rgba(255,128,0,${alpha.toFixed(3)})`;
});
const _crimeIndicatorColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.8, (v / 255) * 1.2);
  return `rgba(255,0,0,${alpha.toFixed(3)})`;
});
const _sicknessColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.85, (v / 255) * 1.1);
  return `rgba(0,200,180,${alpha.toFixed(3)})`;
});
const _deathColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.9, (v / BALANCE.healthcare.deathVisualDuration) * 0.9);
  return `rgba(220,220,240,${alpha.toFixed(3)})`;
});
const _deathAccentColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.9, (v / BALANCE.healthcare.deathVisualDuration) * 0.9);
  return `rgba(180,180,200,${alpha.toFixed(3)})`;
});

const CHUNK_PX = CHUNK_SIZE * TILE_SIZE;
// Zoom smoothing (see render()).
const ZOOM_SETTLE_MS = 120;               // zoom must hold still this long before chunks are redrawn at the new size
const CHUNK_RESIZES_PER_FRAME = 6;        // chunks redrawn per frame only to change size
const CHUNK_FIRST_DRAWS_PER_FRAME = 24;   // chunks drawn for the first time per frame
/** How long a burned-out lot keeps smouldering on screen (render-only, real time). */
const SMOULDER_MS = 20000;

export class CanvasRenderer {
  readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  private _chunkCanvases: (HTMLCanvasElement | null)[] = [];
  private _chunkCtxs: (CanvasRenderingContext2D | null)[] = [];
  private _lastChunkCount = 0;
  private _lastZoom = -1;
  // Static-layer cache state, one entry per chunk. A chunk canvas is current
  // when it was drawn at `_chunkRenderTs` and its content signature (see
  // `_chunkSignature`) still matches the world.
  private _chunkSig = new Int32Array(0);
  private _chunkTs = new Float64Array(0);     // tile size the canvas was drawn at; 0 = never
  private _chunkStale = new Uint8Array(0);    // 1 = marked dirty since last checked
  private _chunkRenderTs = 0;                 // tile size chunks are being brought to (see _chunkTs for each chunk's own)
  private _zoomSeen = -1;                     // camera zoom on the previous frame
  private _zoomChangedAt = 0;                 // when it last changed (ms)
  private _lastGrid: World['grid'] | null = null;
  private _clayEffects: ClayEffect[] = [];
  /** Lots whose markers / fire are drawn after every sprite: [tileIndex, sx, sy] triples. */
  private _markerQueue: number[] = [];
  private _fireQueue: number[] = [];
  /** When each visible tile was last seen burning (ms), for the smoulder afterwards. Render-only. */
  private _lastBurn = new Map<number, number>();
  private _lastBurnWorld: World | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    loadClaySprites();
  }

  render(world: World, camera: Camera, hoverTile: { tx: number; ty: number } | null, currentTool: string = 'none', crimeOverlay = false, fireOverlay = false, vibeOverlay = false, serviceCoveragePreview: Set<number> | null = null, now = 0): void {
    if (camera.zoom < 0.1) return;

    const ctx = this.ctx;
    const { width: cw, height: ch } = this.canvas;
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, cw, ch);

    const p = resolvePalette(world.character, BALANCE.character.axisMax);

    const bounds = camera.visibleTileBounds(world.grid);

    const ts = TILE_SIZE * camera.zoom;
    const tsi = Math.ceil(ts) + 1;

    // Chunks are redrawn at a new tile size only when zoom has changed
    // significantly (> 1%) AND has then held still for a moment; until then
    // the cached canvases are drawn scaled. Redrawing every visible chunk on
    // every wheel step is what made zooming stutter.
    if (camera.zoom !== this._zoomSeen) {
      this._zoomSeen = camera.zoom;
      this._zoomChangedAt = now;
    }
    const zoomSettled = now - this._zoomChangedAt >= ZOOM_SETTLE_MS || this._chunkRenderTs === 0;
    if (zoomSettled && Math.abs(camera.zoom - this._lastZoom) > 0.01) {
      this._lastZoom = camera.zoom;
      this._chunkRenderTs = ts;
    }
    const totalChunks = world.grid.chunkCols * world.grid.chunkRows;
    if (world.grid !== this._lastGrid) {
      // A different world (new game / load): nothing cached is valid.
      this._lastGrid = world.grid;
      this._chunkTs.fill(0);
    }
    if (totalChunks !== this._lastChunkCount) {
      this._chunkSig = new Int32Array(totalChunks);
      this._chunkTs = new Float64Array(totalChunks);
      this._chunkStale = new Uint8Array(totalChunks);
      // Create new arrays of the correct size
      const newCanvases = new Array(totalChunks).fill(null);
      const newCtxs = new Array(totalChunks).fill(null);

      // Preserve existing valid instances into the new arrays
      const countToCopy = Math.min(this._chunkCanvases.length, totalChunks);
      for (let i = 0; i < countToCopy; i++) {
        newCanvases[i] = this._chunkCanvases[i];
        newCtxs[i] = this._chunkCtxs[i];
      }

      this._chunkCanvases = newCanvases;
      this._chunkCtxs = newCtxs;
      this._lastChunkCount = totalChunks;
    }

    // Take ownership of the grid's dirty marks. They persist per chunk until
    // that chunk is next on screen, so off-screen changes are not lost.
    const stale = this._chunkStale;
    if (world.grid.dirtyChunks.size > 0) {
      for (const id of world.grid.dirtyChunks) stale[id] = 1;
      world.grid.dirtyChunks.clear();
    }
    const renderTs = this._chunkRenderTs;

    const cxMin = (bounds.x0 / CHUNK_SIZE) | 0;
    const cyMin = (bounds.y0 / CHUNK_SIZE) | 0;
    const cxMax = Math.min(world.grid.chunkCols - 1, (bounds.x1 / CHUNK_SIZE) | 0);
    const cyMax = Math.min(world.grid.chunkRows - 1, (bounds.y1 / CHUNK_SIZE) | 0);

    // Per frame: a few chunks may be redrawn just to change size, and a few
    // more drawn for the first time; the rest wait for the next frame (an
    // undrawn chunk shows the background until its turn). A chunk whose
    // CONTENT changed is always redrawn at once.
    let resizeBudget = zoomSettled ? CHUNK_RESIZES_PER_FRAME : 0;
    let firstDrawBudget = CHUNK_FIRST_DRAWS_PER_FRAME;
    // Mid-zoom, draw new chunks at the size on screen now rather than the
    // stale target: zooming out reveals many, and the old size is far too big.
    const drawTs = zoomSettled ? renderTs : ts;

    for (let cy = cyMin; cy <= cyMax; cy++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const chunkId = cy * world.grid.chunkCols + cx;
        const drawnAt = this._chunkTs[chunkId];
        const have = drawnAt > 0;
        const sized = have && Math.abs(drawnAt / renderTs - 1) <= 0.01;
        if (sized && stale[chunkId] === 0) continue;
        if (!have && firstDrawBudget <= 0) continue;
        // Systems mark every chunk dirty on most ticks, so "dirty" only means
        // "check": redraw only if what the chunk draws actually changed.
        const sig = this._chunkSignature(world, cx, cy);
        const sameContent = have && sig === this._chunkSig[chunkId];
        if (sameContent) {
          stale[chunkId] = 0;
          if (sized) continue;
          // Only the size is off: redraw it when there is budget, else keep scaling it.
          if (resizeBudget <= 0) continue;
          resizeBudget--;
        } else if (!have) {
          firstDrawBudget--;
        }
        const chunkCtx = this._getOrCreateChunkCtx(chunkId, drawTs);
        if (chunkCtx !== null) {
          this._renderChunk(chunkCtx, world, cx, cy, p, drawTs);
          this._chunkSig[chunkId] = sig;
          this._chunkTs[chunkId] = drawTs;
          stale[chunkId] = 0;
        }
      }
    }

    for (let cy = cyMin; cy <= cyMax; cy++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const chunkId = cy * world.grid.chunkCols + cx;
        const chunkCanvas = this._chunkCanvases[chunkId];
        if (!chunkCanvas) continue;
        
        const dstX = Math.floor(camera.worldToScreenX(cx * CHUNK_PX));
        const dstY = Math.floor(camera.worldToScreenY(cy * CHUNK_PX));
        
        // Calculate the actual current width/height the chunk should occupy on screen
        const dstW = Math.ceil((cx + 1) * CHUNK_PX * camera.zoom + camera.x * camera.zoom) - Math.floor(cx * CHUNK_PX * camera.zoom + camera.x * camera.zoom);
        const dstH = Math.ceil((cy + 1) * CHUNK_PX * camera.zoom + camera.y * camera.zoom) - Math.floor(cy * CHUNK_PX * camera.zoom + camera.y * camera.zoom);

        ctx.globalAlpha = 1.0;
        ctx.imageSmoothingEnabled = false;
        // Scale the chunk to exactly match the current zoom/tile scale
        ctx.drawImage(chunkCanvas, dstX, dstY, dstW, dstH);
      }
    }

    const hasOverlay = crimeOverlay || fireOverlay || vibeOverlay;
    let iterations = 0;
    const clayTile = Math.ceil(ts);
    beginClayFrame(clayTile, now);
    const clayEffects = this._clayEffects;
    clayEffects.length = 0;
    const markerQueue = this._markerQueue;
    const fireQueue = this._fireQueue;
    markerQueue.length = 0;
    fireQueue.length = 0;
    if (this._lastBurnWorld !== world) { this._lastBurnWorld = world; this._lastBurn.clear(); }

    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        iterations++;
        const i = world.grid.idx(tx, ty);

        const zone       = world.layers.zone[i];
        const building   = world.layers.building[i];
        const fireV      = world.layers.fire[i];
        const road       = world.layers.roadClass[i];

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

        // 1. Draw Sprite (Buildings/Houses)
        // Localized Vibe for sprite selection
        const localVibe: VibeState = {
            egalitarian: (world.layers.vibeEgalitarian[i] - 128) / 128,
            green:       (world.layers.vibeGreen[i] - 128) / 128,
            planned:     (world.layers.vibePlanned[i] - 128) / 128,
            isNight:     false
        };

        // Clay image sprites. Until they load (or where no image exists) the
        // chunk layer's flat drawing shows through.
        const isAbandoned = world.layers.abandoned[i] !== 0;
        const clay = pickClaySprite(zone, building, dev, localVibe, isAbandoned, visualVariant);

        if (clay) {
          // The lot ID picks the design (low bits) and the ground tone (higher bits).
          drawClaySprite(ctx, clay, sxi, syi, clayTile, visualVariant >> 3);
          if (building === BUILDING_NONE) {
            // The plot hides the chunk layer's status tints, so repeat them here.
            let tint: string | null = null;
            if (isAbandoned) tint = 'rgba(24,18,12,0.38)';
            else if (world.layers.power[i] === 0) tint = p.noPowerTint;
            else if (world.layers.water[i] === 0 && dev >= 1) tint = p.noWaterTint;
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

        if (ts > 20 && road !== ROAD_NONE && congestion > 15) {
          this._drawRoadVehicles(ctx, world, tx, ty, sxi, syi, ts, congestion, now);
        }
      }

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

    for (let q = 0; q < markerQueue.length; q += 3) {
      const i = markerQueue[q];
      this._drawLotMarkers(ctx, markerQueue[q + 1], markerQueue[q + 2], tsi, ts, world.layers.zone[i], world.layers.devLevel[i],
        world.layers.crime[i], world.layers.sickness[i], world.layers.recentDeath[i], world.layers.abandoned[i] !== 0, true);
    }

    if (camera.zoom >= 1.2) {
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

    if (crimeOverlay || fireOverlay || vibeOverlay) {
      const lx = 12, ly = camera.viewportH - 30;
      ctx.globalAlpha = 1.0;
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'middle';

      if (crimeOverlay) {
        const stops: [string, string][] = [
          ['rgba(255,0,0,0.1)', 'Low'],
          ['rgba(255,0,0,0.4)', 'Moderate'],
          ['rgba(255,0,0,0.8)', 'High'],
        ];
        let lxOff = lx;
        for (const [color, label] of stops) {
          ctx.fillStyle = color;
          ctx.fillRect(lxOff, ly, 10, 10);
          ctx.fillStyle = '#ccc';
          ctx.fillText(label, lxOff + 14, ly + 5);
          lxOff += 14 + ctx.measureText(label).width + 14;
        }
      } else if (fireOverlay) {
        const stops: [string, string][] = [
          ['#333', 'None'],
          ['rgba(255,64,0,0.4)', 'Moderate'],
          ['rgba(255,128,0,0.8)', 'High'],
        ];
        let lxOff = lx;
        for (const [color, label] of stops) {
          ctx.fillStyle = color;
          ctx.fillRect(lxOff, ly, 10, 10);
          ctx.fillStyle = '#ccc';
          ctx.fillText(label, lxOff + 14, ly + 5);
          lxOff += 14 + ctx.measureText(label).width + 14;
        }
      } else if (vibeOverlay) {
        const stops: [string, string][] = [
          ['rgba(0,200,0,0.4)', 'Green'],
          ['rgba(200,100,0,0.4)', 'Industrial'],
          ['rgba(0,100,200,0.4)', 'Social'],
        ];
        let lxOff = lx;
        for (const [color, label] of stops) {
          ctx.fillStyle = color;
          ctx.fillRect(lxOff, ly, 10, 10);
          ctx.fillStyle = '#ccc';
          ctx.fillText(label, lxOff + 14, ly + 5);
          lxOff += 14 + ctx.measureText(label).width + 14;
        }
      }
    }


    if (serviceCoveragePreview !== null) {
      for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
        for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
          const i = world.grid.idx(tx, ty);
          if (!serviceCoveragePreview.has(i)) continue;
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

    if (hoverTile && world.grid.inBounds(hoverTile.tx, hoverTile.ty)) {
      const sx = camera.worldToScreenX(Projection.tileToWorldX(hoverTile.tx));
      const sy = camera.worldToScreenY(Projection.tileToWorldY(hoverTile.ty));
      
      const isRoadTool = ['road', 'avenue', 'highway'].includes(currentTool);
      const isBuildable = world.isBuildable(hoverTile.tx, hoverTile.ty, isRoadTool);
      
      ctx.strokeStyle = isBuildable ? '#fff' : '#f66';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.floor(sx) + 1, Math.floor(sy) + 1, Math.ceil(ts) - 1, Math.ceil(ts) - 1);
    }

    const tlsx = camera.worldToScreenX(0);
    const tlsy = camera.worldToScreenY(0);
    const brsx = camera.worldToScreenX(world.grid.width * TILE_SIZE);
    const brsy = camera.worldToScreenY(world.grid.height * TILE_SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tlsx, tlsy, brsx - tlsx, brsy - tlsy);
  }

  /**
   * Hash of everything `_renderChunk` reads for one chunk. Values are reduced
   * to what is actually drawn (palette buckets, marker thresholds), so sim
   * noise that does not change the picture does not change the signature.
   * KEEP IN SYNC with `_renderChunk`: a layer read there must be mixed in here.
   */
  private _chunkSignature(world: World, cx: number, cy: number): number {
    const L = world.layers;
    const { width, height } = world.grid;
    const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE;
    const x1 = Math.min(x0 + CHUNK_SIZE, width), y1 = Math.min(y0 + CHUNK_SIZE, height);
    let h = 0x811c9dc5 | 0;

    for (let ty = y0; ty < y1; ty++) {
      for (let i = ty * width + x0, end = ty * width + x1; i < end; i++) {
        const terrain = L.terrain[i], zone = L.zone[i], dev = L.devLevel[i];
        const zoned = zone !== ZONE_NONE;
        const a = terrain | (zone << 4) | (L.roadClass[i] << 8) | (L.building[i] << 12)
                | (L.vegetation[i] << 20) | (dev << 24);
        // Same bucketing as resolveTilePalette.
        const b = Math.round(L.vibeEgalitarian[i] / 12) | (Math.round(L.vibeGreen[i] / 12) << 5)
                | (Math.round(L.vibePlanned[i] / 12) << 10)
                | (L.power[i] !== 0 ? 1 << 15 : 0) | (L.water[i] !== 0 ? 1 << 16 : 0)
                | (L.sewage[i] !== 0 ? 1 << 17 : 0) | (L.services[i] !== 0 ? 1 << 18 : 0)
                | (L.abandoned[i] !== 0 ? 1 << 19 : 0) | (L.visualVariant[i] << 20);
        const pollution = L.pollution[i] > 8 && terrain !== TERRAIN_WATER ? L.pollution[i] : 0;
        const crime     = L.crime[i] > 40 && zoned && dev > 0 ? L.crime[i] : 0;
        const sickness  = L.sickness[i] > 80 && zone === ZONE_R && dev > 0 ? L.sickness[i] : 0;
        const death     = zone === ZONE_R && dev > 0 ? L.recentDeath[i] : 0;
        const c = pollution | (crime << 8) | (sickness << 16) | (death << 24);
        h = Math.imul(h ^ a, 0x9e3779b1); h ^= h >>> 15;
        h = Math.imul(h ^ b, 0x85ebca6b); h ^= h >>> 13;
        h = Math.imul(h ^ c, 0xc2b2ae35); h ^= h >>> 16;
      }
    }

    // Roads join to neighbours across the chunk edge, so the ring of tiles
    // just outside the chunk matters too (road / no road only).
    const R = L.roadClass;
    let ring = 0;
    for (let tx = x0; tx < x1; tx++) {
      ring = (ring << 1 | ring >>> 31) ^ (y0 > 0 && R[(y0 - 1) * width + tx] !== ROAD_NONE ? 1 : 0);
      ring = (ring << 1 | ring >>> 31) ^ (y1 < height && R[y1 * width + tx] !== ROAD_NONE ? 1 : 0);
    }
    // CHUNK_SIZE is 16, so each loop fills exactly one 32-bit word.
    h = Math.imul(h ^ ring, 0x85ebca6b); h ^= h >>> 13;
    ring = 0;
    for (let ty = y0; ty < y1; ty++) {
      ring = (ring << 1 | ring >>> 31) ^ (x0 > 0 && R[ty * width + x0 - 1] !== ROAD_NONE ? 1 : 0);
      ring = (ring << 1 | ring >>> 31) ^ (x1 < width && R[ty * width + x1] !== ROAD_NONE ? 1 : 0);
    }
    h = Math.imul(h ^ ring, 0x9e3779b1);
    return h ^ (h >>> 15);
  }

  private _getOrCreateChunkCtx(chunkId: number, ts: number): CanvasRenderingContext2D | null {
    let canvas = this._chunkCanvases[chunkId];
    let ctx = this._chunkCtxs[chunkId];

    if (!canvas) {
      if (typeof document === 'undefined') return null;
      canvas = document.createElement('canvas');
      this._chunkCanvases[chunkId] = canvas;
      ctx = canvas.getContext('2d');
      this._chunkCtxs[chunkId] = ctx;
    }

    const chunkSizePx = Math.ceil(CHUNK_SIZE * ts) + 1;
    if (canvas.width !== chunkSizePx || canvas.height !== chunkSizePx) {
      canvas.width = chunkSizePx;
      canvas.height = chunkSizePx;
    }

    return ctx || null;
  }

  private _renderChunk(
    chunkCtx: CanvasRenderingContext2D,
    world: World,
    cx: number, cy: number,
    _p: ColorPalette,
    ts: number,
  ): void {
    const tileX0 = cx * CHUNK_SIZE;
    const tileY0 = cy * CHUNK_SIZE;

    // Fill background with a localized grass color to avoid gaps between tiles/chunks
    const basePalette = resolveTilePalette(
        world.layers.vibeEgalitarian[world.grid.idx(tileX0, tileY0)],
        world.layers.vibeGreen[world.grid.idx(tileX0, tileY0)],
        world.layers.vibePlanned[world.grid.idx(tileX0, tileY0)],
        BALANCE.character.axisMax
    );
    chunkCtx.fillStyle = basePalette.grass;
    chunkCtx.fillRect(0, 0, chunkCtx.canvas.width, chunkCtx.canvas.height);

    chunkCtx.globalAlpha = 1.0;
    chunkCtx.imageSmoothingEnabled = false;

    for (let ty = tileY0; ty < tileY0 + CHUNK_SIZE && ty < world.grid.height; ty++) {
      for (let tx = tileX0; tx < tileX0 + CHUNK_SIZE && tx < world.grid.width; tx++) {
        const i = world.grid.idx(tx, ty);
        const terrain = world.layers.terrain[i];
        
        // Resolve localized palette for this tile
        const localP = resolveTilePalette(
            world.layers.vibeEgalitarian[i],
            world.layers.vibeGreen[i],
            world.layers.vibePlanned[i],
            BALANCE.character.axisMax
        );

        const sxi = Math.floor((tx - tileX0) * ts);
        const syi = Math.floor((ty - tileY0) * ts);
        const exi = Math.floor((tx + 1 - tileX0) * ts);
        const eyi = Math.floor((ty + 1 - tileY0) * ts);
        
        // Draw localized terrain
        if (terrain === TERRAIN_WATER) {
            chunkCtx.fillStyle = localP.water;
        } else if (terrain === TERRAIN_GRASS) {
            chunkCtx.fillStyle = localP.grass;
        } else {
            chunkCtx.fillStyle = localP.sand;
        }
        chunkCtx.fillRect(sxi, syi, exi - sxi, eyi - syi);
      }
    }

    for (let ty = tileY0; ty < tileY0 + CHUNK_SIZE && ty < world.grid.height; ty++) {
      for (let tx = tileX0; tx < tileX0 + CHUNK_SIZE && tx < world.grid.width; tx++) {
        const i = world.grid.idx(tx, ty);
        
        // Resolve localized palette again for building pass
        const localP = resolveTilePalette(
            world.layers.vibeEgalitarian[i],
            world.layers.vibeGreen[i],
            world.layers.vibePlanned[i],
            BALANCE.character.axisMax
        );

        const terrain    = world.layers.terrain[i];
        const zone       = world.layers.zone[i];
        const road       = world.layers.roadClass[i];
        const building   = world.layers.building[i];
        const vegetation = world.layers.vegetation[i];
        const dev        = world.layers.devLevel[i];
        const powered    = world.layers.power[i] !== 0;
        const watered    = world.layers.water[i] !== 0;
        const sewaged    = world.layers.sewage[i] !== 0;
        const serviced   = world.layers.services[i] !== 0;
        const pollutionV    = world.layers.pollution[i];
        const crimeV        = world.layers.crime[i];
        const sicknessV     = world.layers.sickness[i];
        const recentDeathV  = world.layers.recentDeath[i];
        const isAbandoned   = world.layers.abandoned[i] !== 0;
        const visualVariant = world.layers.visualVariant[i];

        const sxi = Math.floor((tx - tileX0) * ts);
        const syi = Math.floor((ty - tileY0) * ts);
        const tsi = Math.ceil(ts) + 1;

        if (vegetation !== VEG_NONE && road === ROAD_NONE && building === BUILDING_NONE && zone === ZONE_NONE) {

          this._drawTree(chunkCtx, vegetation, sxi, syi, tsi, ts, localP);
        }

        if (zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          this._drawZoneBuilding(chunkCtx, zone, dev, sxi, syi, tsi, ts, localP, isAbandoned, visualVariant % 4);
        }

        if (road !== ROAD_NONE) {
          this._drawRoad(chunkCtx, world, tx, ty, sxi, syi, tsi, ts, localP);
        }

        if (building !== BUILDING_NONE) {
          if (building === BUILDING_POWER_PLANT) {
            chunkCtx.fillStyle = '#3a3a3a';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = localP.powerPlant;
            const pad = Math.max(1, Math.floor(ts * 0.15));
            chunkCtx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
            chunkCtx.fillStyle = localP.powerPlantRoof;
            chunkCtx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, Math.max(1, Math.floor(ts * 0.25)));
            chunkCtx.fillStyle = '#ffe680';
            const ppCx = sxi + Math.floor(tsi / 2) - 1;
            const ppCy = syi + Math.floor(tsi / 2);
            chunkCtx.fillRect(ppCx, ppCy, 2, 2);
          } else if (building === BUILDING_WATER_TOWER) {
            chunkCtx.fillStyle = '#2a3a3a';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = localP.waterTower;
            const wpad = Math.max(1, Math.floor(ts * 0.2));
            const tankH = Math.max(2, Math.floor(ts * 0.5));
            chunkCtx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, tankH);
            chunkCtx.fillStyle = localP.waterTowerTop;
            chunkCtx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, Math.max(1, Math.floor(ts * 0.12)));
            const legX1 = sxi + Math.floor(ts * 0.3);
            const legX2 = sxi + Math.floor(ts * 0.6);
            const legTop = syi + Math.floor(ts * 0.35) + tankH;
            chunkCtx.fillStyle = '#4a6a7a';
            chunkCtx.fillRect(legX1, legTop, 1, tsi - legTop + syi);
            chunkCtx.fillRect(legX2, legTop, 1, tsi - legTop + syi);
          } else if (building === BUILDING_SEWAGE_PLANT) {
            chunkCtx.fillStyle = '#2a2a1a';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = localP.sewagePlant;
            const sp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, tsi - sp * 2);
            chunkCtx.fillStyle = localP.sewagePlantRoof;
            chunkCtx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, Math.max(1, Math.floor(ts * 0.2)));
            chunkCtx.fillStyle = '#6a5010';
            const sewCr = Math.max(1, Math.floor(ts * 0.15));
            const sewCx = sxi + Math.floor(tsi / 2);
            const sewCy = syi + Math.floor(tsi * 0.62);
            chunkCtx.beginPath();
            chunkCtx.arc(sewCx, sewCy, Math.max(0.1, sewCr), 0, Math.PI * 2);
            chunkCtx.fill();
          } else if (building === BUILDING_POLICE) {
            chunkCtx.fillStyle = '#1a2a4a';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = localP.police;
            const pp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + pp, syi + pp, tsi - pp * 2, tsi - pp * 2);
            chunkCtx.fillStyle = localP.policeBadge;
            const bBadgeW = Math.max(2, Math.floor(ts * 0.3));
            const bBadgeH = Math.max(2, Math.floor(ts * 0.35));
            chunkCtx.fillRect(sxi + Math.floor((tsi - bBadgeW) / 2), syi + Math.floor((tsi - bBadgeH) / 2), bBadgeW, bBadgeH);
          } else if (building === BUILDING_FIRE) {
            chunkCtx.fillStyle = '#3a1010';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = localP.fire;
            const fp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + fp, syi + fp, tsi - fp * 2, tsi - fp * 2);
            chunkCtx.fillStyle = localP.fireAccent;
            const fw = Math.max(2, Math.floor(ts * 0.25));
            const fireCx = sxi + Math.floor(tsi / 2);
            chunkCtx.fillRect(fireCx - Math.floor(fw / 2), syi + Math.floor(ts * 0.2), fw, Math.floor(ts * 0.5));
            chunkCtx.fillStyle = '#ffcc00';
            chunkCtx.fillRect(fireCx - Math.max(1, Math.floor(fw * 0.4)), syi + Math.floor(ts * 0.35), Math.max(1, Math.floor(fw * 0.8)), Math.floor(ts * 0.3));
          } else if (building === BUILDING_SCHOOL) {
            chunkCtx.fillStyle = '#2a2000';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = localP.school;
            const sp2 = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + sp2, syi + sp2, tsi - sp2 * 2, tsi - sp2 * 2);
            chunkCtx.fillStyle = localP.schoolAccent;
            const bw2 = Math.max(2, Math.floor(ts * 0.3));
            chunkCtx.fillRect(sxi + Math.floor((tsi - bw2) / 2), syi + Math.floor(ts * 0.1), bw2, Math.max(2, Math.floor(ts * 0.35)));
          } else if (building === BUILDING_HOSPITAL) {
            chunkCtx.fillStyle = '#303030';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = localP.hospital;
            const hp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + hp, syi + hp, tsi - hp * 2, tsi - hp * 2);
            chunkCtx.fillStyle = localP.hospitalCross;
            const arm = Math.max(1, Math.floor(ts * 0.12));
            const hospCx = sxi + Math.floor(tsi / 2);
            const hospCy = syi + Math.floor(tsi / 2);
            const clen = Math.max(2, Math.floor(ts * 0.35));
            chunkCtx.fillRect(hospCx - arm, hospCy - Math.floor(clen / 2), arm * 2, clen);
            chunkCtx.fillRect(hospCx - Math.floor(clen / 2), hospCy - arm, clen, arm * 2);
          } else if (building === BUILDING_PARK) {
            this._drawPark(chunkCtx, sxi, syi, tsi, ts, localP, visualVariant % 5);
          }
        }

        if (!isAbandoned && !powered && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = localP.noPowerTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }
        if (!isAbandoned && !watered && dev >= 1 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = localP.noWaterTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }
        if (!isAbandoned && !sewaged && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = localP.noSewageTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }
        if (!isAbandoned && !serviced && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = localP.noServicesTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (pollutionV > 8 && terrain !== TERRAIN_WATER) {
          chunkCtx.fillStyle = _pollutionColors[pollutionV];
          chunkCtx.fillRect(sxi, syi, tsi, tsi);
        }
        this._drawLotMarkers(chunkCtx, sxi, syi, tsi, ts, zone, dev, crimeV, sicknessV, recentDeathV, isAbandoned, false);
      }
    }
  }

  /**
   * Crime dots (top corners, bottom-left at the worst), the sickness cross
   * (bottom-right) and the recent-death marker (bottom-left) for one lot.
   * `backed` adds a dark backing so they read on top of a clay sprite.
   */
  private _drawLotMarkers(ctx: CanvasRenderingContext2D, sxi: number, syi: number, tsi: number, ts: number, zone: number, dev: number, crimeV: number, sicknessV: number, recentDeathV: number, isAbandoned: boolean, backed: boolean): void {
    const back = (x: number, y: number, w: number, h: number): void => {
      if (!backed) return;
      ctx.fillStyle = 'rgba(12,14,18,0.6)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    };
    if (crimeV > 40 && zone !== ZONE_NONE && dev > 0) {
      const dotSize = Math.max(2, Math.floor(ts * 0.18));
      const dot = (x: number, y: number): void => {
        back(x, y, dotSize, dotSize);
        ctx.fillStyle = backed ? '#ff3b30' : _crimeIndicatorColors[crimeV];
        ctx.fillRect(x, y, dotSize, dotSize);
      };
      dot(sxi + 1, syi + 1);
      if (crimeV > 120) dot(sxi + tsi - dotSize - 1, syi + 1);
      if (crimeV > 200) dot(sxi + 1, syi + tsi - dotSize - 1);
    }
    if (sicknessV > 80 && zone === ZONE_R && dev > 0 && !isAbandoned) {
      const cs = Math.max(2, Math.floor(ts * 0.15));
      const sicCx = sxi + tsi - cs - 1;
      const sicCy = syi + tsi - cs - 1;
      const sicArm = Math.max(1, Math.floor(cs * 0.4));
      back(sicCx - cs, sicCy - cs, cs * 2, cs * 2);
      ctx.fillStyle = backed ? '#2fe0c8' : _sicknessColors[sicknessV];
      ctx.fillRect(sicCx - sicArm, sicCy - cs, sicArm * 2, cs * 2);
      ctx.fillRect(sicCx - cs, sicCy - sicArm, cs * 2, sicArm * 2);
    }
    if (recentDeathV > 0 && zone === ZONE_R && dev > 0) {
      const ds = Math.max(2, Math.floor(ts * 0.18));
      const dx = sxi + 1;
      const dy = syi + tsi - ds - 1;
      const arm2 = Math.max(1, Math.floor(ds * 0.3));
      const dCx = dx + Math.floor(ds / 2);
      const dCy = dy - arm2;
      back(dx, dCy - arm2, Math.max(ds, arm2 * 3), ds + arm2 * 2);
      ctx.fillStyle = _deathColors[recentDeathV];
      ctx.fillRect(dx, dy, ds, ds);
      ctx.fillStyle = _deathAccentColors[recentDeathV];
      ctx.fillRect(dCx - arm2, dCy - arm2, arm2 * 2, arm2 * 3);
      ctx.fillRect(dCx - arm2 * 2, dCy, arm2 * 4, arm2);
    }
  }

  private _drawRoadVehicles(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number, sxi: number, syi: number, ts: number, congestion: number, now: number): void {
    const carCount = Math.min(6, Math.ceil(congestion / 40));
    const carSize = Math.max(2, ts * 0.12);
    ctx.fillStyle = '#4a6a8a';
    const mid = ts / 2;
    const seed = tx * 13 + ty * 37;
    const timeScale = 0.0016;
    let mask = 0;
    if (ty > 0 && world.layers.roadClass[world.grid.idx(tx, ty - 1)] !== ROAD_NONE) mask |= 1;
    if (tx < world.grid.width - 1 && world.layers.roadClass[world.grid.idx(tx + 1, ty)] !== ROAD_NONE) mask |= 2;
    if (ty < world.grid.height - 1 && world.layers.roadClass[world.grid.idx(tx, ty + 1)] !== ROAD_NONE) mask |= 4;
    if (tx > 0 && world.layers.roadClass[world.grid.idx(tx - 1, ty)] !== ROAD_NONE) mask |= 8;
    const arms: number[] = [];
    if (mask & 1) arms.push(1);
    if (mask & 2) arms.push(2);
    if (mask & 4) arms.push(4);
    if (mask & 8) arms.push(8);
    if (arms.length === 0) return;
    for (let c = 0; c < carCount; c++) {
      const laneVariant = (seed + c) % 2;
      const arm = arms[(seed + Math.floor(c / 2)) % arms.length];
      const cycleOffset = (c * 0.25) + (seed * 0.1);
      let progress = ((now * timeScale) + cycleOffset) % 1.0;
      if (laneVariant === 1) progress = 1.0 - progress;
      const laneOffset = ts * 0.15;
      let carX = sxi + mid, carY = syi + mid;
      if (arm === 1) { carY = syi + (1 - progress) * mid; carX += laneVariant === 0 ? laneOffset : -laneOffset; }
      else if (arm === 2) { carX = sxi + mid + progress * mid; carY += laneVariant === 0 ? laneOffset : -laneOffset; }
      else if (arm === 4) { carY = syi + mid + progress * mid; carX += laneVariant === 0 ? -laneOffset : laneOffset; }
      else if (arm === 8) { carX = sxi + (1 - progress) * mid; carY += laneVariant === 0 ? -laneOffset : laneOffset; }
      ctx.fillRect(carX - carSize / 2, carY - carSize / 2, carSize, carSize);
    }
  }

  private _drawTree(ctx: CanvasRenderingContext2D, vegetation: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette): void {
    const speciesIdx = (vegetation - 1);
    const color = p.treeColors[speciesIdx] || p.treeColors[0];
    ctx.fillStyle = color;
    if (ts < 8) { ctx.fillRect(sxi + 2, syi + 2, tsi - 4, tsi - 4); return; }
    const mid = ts / 2;
    if (vegetation <= 2) {
      const r = ts * 0.35;
      ctx.beginPath(); ctx.arc(sxi + mid, syi + mid, Math.max(0.1, r), 0, Math.PI * 2); ctx.arc(sxi + mid * 0.7, syi + mid * 0.8, Math.max(0.1, r * 0.8), 0, Math.PI * 2); ctx.arc(sxi + mid * 1.3, syi + mid * 1.2, Math.max(0.1, r * 0.7), 0, Math.PI * 2); ctx.fill();
    } else if (vegetation <= 4) {
      const bw = ts * 0.7; const bh = ts * 0.8;
      ctx.beginPath(); ctx.moveTo(sxi + mid, syi + ts * 0.1); ctx.lineTo(sxi + mid - bw / 2, syi + ts * 0.1 + bh); ctx.lineTo(sxi + mid + bw / 2, syi + ts * 0.1 + bh); ctx.closePath(); ctx.fill();
    } else {
      const r = ts * 0.25; const h = ts * 0.7;
      ctx.beginPath(); ctx.ellipse(sxi + mid, syi + mid, Math.max(0.1, r), Math.max(0.1, h / 2), 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  private _drawRoad(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette): void {
    const i = world.grid.idx(tx, ty);
    const road = world.layers.roadClass[i];
    let mask = 0;
    if (ty > 0 && world.layers.roadClass[world.grid.idx(tx, ty - 1)] !== ROAD_NONE) mask |= 1;
    if (tx < world.grid.width - 1 && world.layers.roadClass[world.grid.idx(tx + 1, ty)] !== ROAD_NONE) mask |= 2;
    if (ty < world.grid.height - 1 && world.layers.roadClass[world.grid.idx(tx, ty + 1)] !== ROAD_NONE) mask |= 4;
    if (tx > 0 && world.layers.roadClass[world.grid.idx(tx - 1, ty)] !== ROAD_NONE) mask |= 8;
    let baseColor = p.road;
    let lineColor = p.roadEdge;
    if (road === ROAD_HIGHWAY) { baseColor = p.roadHighway; lineColor = p.roadHighwayLine; }
    else if (road === ROAD_AVENUE) { baseColor = p.roadAvenue; lineColor = p.roadAvenueEdge; }
    const roadWidth = Math.floor(ts * 0.75);
    const off = (ts - roadWidth) / 2;
    const mid = ts / 2;

    // Draw Bridge Underlay if on water
    if (world.layers.terrain[i] === TERRAIN_WATER) {
      ctx.fillStyle = '#5d4037'; // Dark wood
      ctx.fillRect(sxi, syi, tsi, tsi);
      // Plank detail
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < tsi; x += Math.max(2, ts * 0.2)) {
        ctx.moveTo(sxi + x, syi);
        ctx.lineTo(sxi + x, syi + tsi);
      }
      ctx.stroke();
    }

    ctx.fillStyle = baseColor;
    ctx.fillRect(sxi + Math.floor(off), syi + Math.floor(off), roadWidth, roadWidth);
    if (mask & 1) ctx.fillRect(sxi + Math.floor(off), syi, roadWidth, Math.ceil(off) + 1);
    if (mask & 2) ctx.fillRect(sxi + Math.floor(off) + roadWidth - 1, syi + Math.floor(off), Math.ceil(off) + 1, roadWidth);
    if (mask & 4) ctx.fillRect(sxi + Math.floor(off), syi + Math.floor(off) + roadWidth - 1, roadWidth, Math.ceil(off) + 1);
    if (mask & 8) ctx.fillRect(sxi, syi + Math.floor(off), Math.ceil(off) + 1, roadWidth);
    if (ts > 8) {
      ctx.strokeStyle = lineColor; ctx.lineWidth = Math.max(1, Math.floor(ts * 0.05)); ctx.lineCap = 'round';
      if (road === ROAD_STREET) ctx.setLineDash([Math.floor(ts * 0.2), Math.floor(ts * 0.1)]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      if (mask === 5) { ctx.moveTo(sxi + mid, syi); ctx.lineTo(sxi + mid, syi + tsi); }
      else if (mask === 10) { ctx.moveTo(sxi, syi + mid); ctx.lineTo(sxi + tsi, syi + mid); }
      else if (mask !== 0) {
        if (mask & 1) { ctx.moveTo(sxi + mid, syi); ctx.lineTo(sxi + mid, syi + mid); }
        if (mask & 2) { ctx.moveTo(sxi + mid, syi + mid); ctx.lineTo(sxi + tsi, syi + mid); }
        if (mask & 4) { ctx.moveTo(sxi + mid, syi + mid); ctx.lineTo(sxi + mid, syi + tsi); }
        if (mask & 8) { ctx.moveTo(sxi + mid, syi + mid); ctx.lineTo(sxi, syi + mid); }
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
  }

  private _drawZoneBuilding(ctx: CanvasRenderingContext2D, zone: number, dev: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette, isAbandoned: boolean, variant: number): void {
    const zoneColor = zone === ZONE_R ? p.zoneR : zone === ZONE_C ? p.zoneC : p.zoneI;
    if (isAbandoned) { ctx.fillStyle = zoneColor; ctx.globalAlpha = 0.35; ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = zoneColor; ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2); }
    if (dev === 0) return;
    const bldPalette = zone === ZONE_R ? p.buildingR : zone === ZONE_C ? p.buildingC : p.buildingI;
    const bodyColor = isAbandoned ? '#2a2a2a' : bldPalette[dev - 1];
    if (zone === ZONE_R) this._drawResidential(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
    else if (zone === ZONE_C) this._drawCommercial(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
    else if (zone === ZONE_I) this._drawIndustrial(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
    if (isAbandoned && ts > 6) {
      ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1, ts * 0.06); ctx.beginPath();
      const inset = Math.max(1, Math.floor(ts * (0.35 - dev * 0.08)));
      ctx.moveTo(sxi + inset, syi + inset); ctx.lineTo(sxi + tsi - inset, syi + tsi - inset);
      ctx.moveTo(sxi + tsi - inset, syi + inset); ctx.lineTo(sxi + inset, syi + tsi - inset); ctx.stroke();
    }
  }

  private _drawResidential(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
    const inset = Math.max(1, Math.floor(ts * (0.32 - dev * 0.06)));
    const bx = sxi + inset, by = syi + inset; const bw = tsi - inset * 2, bh = tsi - inset * 2;
    ctx.fillStyle = color; ctx.fillRect(bx, by, bw, bh);
    if (ts < 8) return;
    const roofColors = isAbandoned ? ['#1a1a1a'] : ['#5a3a2a', '#3a4a5a', '#7a4a3a', '#4a5a4a'];
    ctx.fillStyle = roofColors[variant % roofColors.length];
    if (dev === 1) {
      if (variant % 2 === 0) { ctx.beginPath(); ctx.moveTo(bx - 1, by + bh * 0.5); ctx.lineTo(bx + bw / 2, by - 1); ctx.lineTo(bx + bw + 1, by + bh * 0.5); ctx.fill(); }
      else { ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.4); }
      if (!isAbandoned && variant % 3 === 0) { ctx.fillStyle = '#333'; ctx.fillRect(bx + bw * 0.7, by - 2, 2, 4); }
    } else if (dev === 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(bx + bw * 0.45, by, bw * 0.1, bh);
      ctx.fillStyle = roofColors[(variant + 1) % roofColors.length]; ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.25);
      if (!isAbandoned) { ctx.fillStyle = '#444'; ctx.fillRect(bx + bw * 0.2, by + bh * 0.4, bw * 0.6, 1); }
    } else {
      ctx.fillStyle = roofColors[variant % roofColors.length]; ctx.fillRect(bx, by, bw, bh * 0.15);
      ctx.fillStyle = color; const pW = bw * 0.5, pH = bh * 0.3; ctx.fillRect(bx + (bw - pW) / 2, by - pH * 0.4, pW, pH);
      ctx.fillStyle = '#222'; ctx.fillRect(bx + (bw - pW) / 2, by - pH * 0.4, pW, 2);
    }
    ctx.fillStyle = isAbandoned ? '#111' : '#3d2b1f';
    const doorW = Math.max(2, bw * 0.2); const doorH = Math.max(3, bh * 0.3);
    ctx.fillRect(bx + (bw - doorW) / 2, by + bh - doorH, doorW, doorH);
    if (!isAbandoned && ts > 12) {
      const winColor = '#ffe680'; const winSize = Math.max(1, ts * 0.08); ctx.fillStyle = winColor;
      if (dev === 1) { ctx.fillRect(bx + bw * 0.2, by + bh * 0.55, winSize, winSize); ctx.fillRect(bx + bw * 0.7, by + bh * 0.55, winSize, winSize); }
      else {
        const rows = dev + 1; const cols = 2 + (variant % 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((variant + r + c) % 5 === 0) continue;
            const wx = bx + (bw / (cols + 1)) * (c + 1) - winSize / 2;
            const wy = by + (bh / (rows + 1)) * (r + 1) - winSize / 2;
            if (wy > by + bh - doorH - 2 && wx > bx + (bw - doorW) / 2 - 2 && wx < bx + (bw + doorW) / 2 + 2) continue;
            ctx.fillRect(wx, wy, winSize, winSize);
            if (ts > 20) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(wx, wy + winSize, winSize, 1); ctx.fillStyle = winColor; }
          }
        }
      }
    }
  }

  private _drawCommercial(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
    const inset = Math.max(1, Math.floor(ts * (0.25 - dev * 0.05)));
    const bx = sxi + inset, by = syi + inset; const bw = tsi - inset * 2, bh = tsi - inset * 2;
    ctx.fillStyle = color; ctx.fillRect(bx, by, bw, bh);
    if (ts < 8) return;
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(bx + bw * 0.1, by + bh * 0.7, bw * 0.8, bh * 0.2);
    if (!isAbandoned && ts > 10) { ctx.fillStyle = variant % 2 === 0 ? '#e07070' : '#7070e0'; ctx.fillRect(bx + bw * 0.2, by + bh * 0.1, bw * 0.6, bh * 0.15); }
    if (!isAbandoned && ts > 12) {
      ctx.fillStyle = '#80e6ff'; const winSize = Math.max(1, ts * 0.1);
      for (let row = 0; row < dev + 1; row++) {
        for (let col = 0; col < 3; col++) { ctx.fillRect(bx + bw * (0.15 + col * 0.25), by + bh * (0.3 + row * 0.15), winSize, winSize * 0.8); }
      }
    }
  }

  private _drawPark(ctx: CanvasRenderingContext2D, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette, variant: number): void {
    ctx.fillStyle = variant === 1 ? '#4a4a4a' : p.park; ctx.fillRect(sxi, syi, tsi, tsi);
    if (ts < 6) return;
    if (variant === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(sxi + tsi * 0.4, syi, tsi * 0.2, tsi);
      ctx.fillStyle = p.parkTree; const tr = Math.max(2, Math.floor(ts * 0.22));
      ctx.beginPath(); ctx.arc(sxi + tsi * 0.25, syi + tsi * 0.3, tr, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sxi + tsi * 0.75, syi + tsi * 0.7, tr, 0, Math.PI * 2); ctx.fill();
      if (ts > 12) { ctx.fillStyle = '#5a3a2a'; ctx.fillRect(sxi + tsi * 0.45, syi + tsi * 0.5, tsi * 0.1, 2); }
    } else if (variant === 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.strokeRect(sxi + 2, syi + 2, tsi - 4, tsi - 4);
      const pkCx = sxi + tsi / 2, pkCy = syi + tsi / 2; ctx.fillStyle = '#8aa'; ctx.fillRect(pkCx - 2, pkCy - 2, 4, 4);
      if (ts > 10) { ctx.fillStyle = '#aaf'; ctx.beginPath(); ctx.arc(pkCx, pkCy, Math.max(0.1, 1.5), 0, Math.PI * 2); ctx.fill(); }
    } else if (variant === 2) {
      ctx.fillStyle = '#0a3a0a'; ctx.fillRect(sxi + 2, syi + 2, tsi - 4, 2); ctx.fillRect(sxi + 2, syi + tsi - 4, tsi - 4, 2);
      const flowers = ['#f66', '#f6f', '#ff6']; const fSize = Math.max(1, ts * 0.08);
      for (let fi = 0; fi < 3; fi++) { ctx.fillStyle = flowers[fi % flowers.length]; ctx.fillRect(sxi + tsi * (0.2 + fi * 0.3), syi + tsi * 0.5, fSize, fSize); }
    } else if (variant === 3) {
      ctx.fillStyle = '#d2b48c'; const pad = tsi * 0.2; ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
      if (ts > 8) { ctx.fillStyle = '#e55'; ctx.fillRect(sxi + tsi * 0.3, syi + tsi * 0.3, tsi * 0.1, tsi * 0.3); ctx.fillStyle = '#55e'; ctx.fillRect(sxi + tsi * 0.6, syi + tsi * 0.4, 2, tsi * 0.2); }
    } else {
      ctx.fillStyle = '#3d2b1f'; ctx.beginPath(); ctx.arc(sxi + tsi / 2, syi + tsi / 2, Math.max(0.1, tsi * 0.3), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.parkTree; const tr = Math.max(2, Math.floor(ts * 0.18));
      const pos = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7], [0.5, 0.5]];
      for (const [px, py] of pos) { ctx.beginPath(); ctx.arc(sxi + tsi * px, syi + tsi * py, Math.max(0.1, tr), 0, Math.PI * 2); ctx.fill(); }
    }
  }

  private _drawIndustrial(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
    const inset = Math.max(1, Math.floor(ts * 0.15));
    const bx = sxi + inset, by = syi + inset; const bw = tsi - inset * 2, bh = tsi - inset * 2;
    ctx.fillStyle = color; ctx.fillRect(bx, by, bw, bh);
    if (ts < 8) return;
    ctx.fillStyle = '#3a3a3a'; const chimneyCount = dev;
    for (let ci = 0; ci < chimneyCount; ci++) {
      const offset = (variant % 2 === 0) ? 0.2 : 0.1; const chX = bx + bw * (offset + ci * 0.3);
      if (chX + bw * 0.15 > bx + bw) break;
      ctx.fillRect(chX, by - bh * 0.15, bw * 0.15, bh * 0.3);
      if (!isAbandoned && ts >= TILE_SIZE) { ctx.fillStyle = 'rgba(200,200,200,0.4)'; ctx.beginPath(); ctx.arc(chX + bw * 0.07, by - bh * 0.25, Math.max(0.1, bw * 0.1), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a3a3a'; }
    }
    ctx.fillStyle = isAbandoned ? '#1a1a1a' : '#4a4a4a';
    const doorW = bw * 0.6; ctx.fillRect(bx + (bw - doorW) / 2, by + bh * 0.5, doorW, bh * 0.4);
    if (ts > 10) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.beginPath();
      const lineCount = dev * 2; for (let li = 1; li <= lineCount; li++) { const ly = by + (bh / (lineCount + 1)) * li; ctx.moveTo(bx, ly); ctx.lineTo(bx + bw, ly); }
      ctx.stroke();
    }
  }
}
