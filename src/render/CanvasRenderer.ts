import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import { CHUNK_SIZE } from '../sim/Grid';
import { resolvePalette, type ColorPalette } from './CharacterPalette';
import { SpriteRegistry } from './SpriteRegistry';
import type { VibeState } from './SpriteTypes';
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

export class CanvasRenderer {
  readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  private _chunkCanvases: (HTMLCanvasElement | null)[] = [];
  private _chunkCtxs: (CanvasRenderingContext2D | null | undefined)[] = [];
  private _lastTick = -1;
  private _lastChunkCount = 0;
  private _lastZoom = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(world: World, camera: Camera, hoverTile: { tx: number; ty: number } | null, trafficOverlay = false, crimeOverlay = false, fireOverlay = false, serviceCoveragePreview: Set<number> | null = null, now = 0): void {
    if (camera.zoom < 0.1) return;

    const ctx = this.ctx;
    const { width: cw, height: ch } = this.canvas;
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, cw, ch);

    const p = resolvePalette(world.character, BALANCE.character.axisMax);
    const vibe: VibeState = {
      egalitarian: world.character.egalitarian,
      green: world.character.green,
      planned: world.character.planned,
      isNight: false,
    };

    if (world.tick !== this._lastTick) {
      this._lastTick = world.tick;
      world.grid.markAllDirty();
    }
    
    const bounds = camera.visibleTileBounds(world.grid);

    const ts = TILE_SIZE * camera.zoom;
    const tsi = Math.ceil(ts) + 1;

    // Only invalidate all chunks if zoom changes significantly (> 1%)
    if (Math.abs(camera.zoom - this._lastZoom) > 0.01) {
      this._lastZoom = camera.zoom;
      world.grid.markAllDirty();
    }
    const totalChunks = world.grid.chunkCols * world.grid.chunkRows;
    if (totalChunks !== this._lastChunkCount) {
      if (this._chunkCanvases.length > totalChunks) {
        this._chunkCanvases.length = totalChunks;
        this._chunkCtxs.length = totalChunks;
      } else {
        let limit = 0;
        while (this._chunkCanvases.length < totalChunks && limit++ < 10000) {
          this._chunkCanvases.push(null);
          this._chunkCtxs.push(undefined);
        }
      }
      this._lastChunkCount = totalChunks;
      world.grid.markAllDirty();
    }

    const cxMin = (bounds.x0 / CHUNK_SIZE) | 0;
    const cyMin = (bounds.y0 / CHUNK_SIZE) | 0;
    const cxMax = Math.min(world.grid.chunkCols - 1, (bounds.x1 / CHUNK_SIZE) | 0);
    const cyMax = Math.min(world.grid.chunkRows - 1, (bounds.y1 / CHUNK_SIZE) | 0);

    for (let cy = cyMin; cy <= cyMax; cy++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const chunkId = cy * world.grid.chunkCols + cx;
        if (!world.grid.dirtyChunks.has(chunkId)) continue;
        const chunkCtx = this._getOrCreateChunkCtx(chunkId, ts);
        if (chunkCtx !== null) {
          this._renderChunk(chunkCtx, world, cx, cy, p, ts, vibe);
        }
      }
    }

    for (let cy = cyMin; cy <= cyMax; cy++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const chunkId = cy * world.grid.chunkCols + cx;
        const chunkCanvas = this._chunkCanvases[chunkId];
        if (chunkCanvas === null) continue;
        const dstX = Math.floor(camera.worldToScreenX(cx * CHUNK_PX));
        const dstY = Math.floor(camera.worldToScreenY(cy * CHUNK_PX));
        ctx.globalAlpha = 1.0;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(chunkCanvas, dstX, dstY);
      }
    }

    const hasOverlay = trafficOverlay || crimeOverlay || fireOverlay;
    let iterations = 0;

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
        const spriteKey = this._getSpriteKey(zone, building, dev);
        const sprite = SpriteRegistry.instance.findBest(spriteKey, vibe, visualVariant);

        if (sprite) {
          ctx.save();
          ctx.translate(sxi, syi);
          sprite.draw(ctx, ts, now * 0.001, p, vibe);
          ctx.restore();
        }

        // 2. Draw Overlays
        if (trafficOverlay && road !== ROAD_NONE) {
          const t = congestion / 255;
          let r: number, g: number;
          if (t <= 0.5) {
            r = Math.round(t * 2 * 220);
            g = 180 + Math.round(t * 2 * 20);
          } else {
            r = 220;
            g = Math.round(200 * (1 - (t - 0.5) * 2));
          }
          ctx.fillStyle = `rgb(${r},${g},0)`;
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

        if (fireV > 0) {
          this._drawFire(ctx, sxi, syi, tsi, ts, now);
        }

        if (!trafficOverlay && ts > 20 && road !== ROAD_NONE && congestion > 15) {
          this._drawRoadVehicles(ctx, world, tx, ty, sxi, syi, ts, congestion, now);
        }
      }

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

    if (trafficOverlay || crimeOverlay || fireOverlay) {
      const lx = 12, ly = ch - 70;
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'middle';

      if (trafficOverlay) {
        const stops: [string, string][] = [
          ['rgb(0,180,0)',   'Free'],
          ['rgb(220,200,0)', 'Moderate'],
          ['rgb(220,0,0)',   'Gridlock'],
        ];
        let lxOff = lx;
        for (const [color, label] of stops) {
          ctx.fillStyle = color;
          ctx.fillRect(lxOff, ly, 10, 10);
          ctx.fillStyle = '#ccc';
          ctx.fillText(label, lxOff + 14, ly + 5);
          lxOff += 14 + ctx.measureText(label).width + 14;
        }
      } else if (crimeOverlay) {
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
          ['rgba(255,128,0,0.1)', 'Low'],
          ['rgba(255,128,0,0.4)', 'Moderate'],
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
      ctx.strokeStyle = world.isBuildable(hoverTile.tx, hoverTile.ty) ? '#fff' : '#f66';
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

    world.grid.dirtyChunks.clear();
  }

  private _getSpriteKey(zone: number, building: number, dev: number): string {
    if (building !== BUILDING_NONE) return `BUILDING_${building}`;
    if (zone !== ZONE_NONE) return `ZONE_${zone}_${dev}`;
    return '';
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

    let chunkSizePx = Math.ceil(CHUNK_SIZE * ts) + 1;
    if (ts < 2.0) {
      chunkSizePx = Math.max(chunkSizePx, CHUNK_SIZE * 2);
    }
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
    p: ColorPalette,
    ts: number,
    vibe: VibeState,
  ): void {
    const drawnSize = Math.ceil(CHUNK_SIZE * ts) + 1;
    chunkCtx.clearRect(0, 0, chunkCtx.canvas.width, chunkCtx.canvas.height);
    chunkCtx.globalAlpha = 1.0;
    chunkCtx.imageSmoothingEnabled = false;

    // Fill background with a base color to avoid gaps between tiles
    chunkCtx.fillStyle = p.grass;
    chunkCtx.fillRect(0, 0, drawnSize, drawnSize);

    const tileX0 = cx * CHUNK_SIZE;
    const tileY0 = cy * CHUNK_SIZE;

    for (let ty = tileY0; ty < tileY0 + CHUNK_SIZE && ty < world.grid.height; ty++) {
      for (let tx = tileX0; tx < tileX0 + CHUNK_SIZE && tx < world.grid.width; tx++) {
        const i = world.grid.idx(tx, ty);
        const terrain    = world.layers.terrain[i];
        
        // Only draw non-grass terrain since we already filled with grass
        if (terrain !== TERRAIN_GRASS) {
          const sxi = Math.floor((tx - tileX0) * ts);
          const syi = Math.floor((ty - tileY0) * ts);
          const exi = Math.floor((tx + 1 - tileX0) * ts);
          const eyi = Math.floor((ty + 1 - tileY0) * ts);
          chunkCtx.fillStyle = terrain === TERRAIN_WATER ? p.water : p.sand;
          chunkCtx.fillRect(sxi, syi, exi - sxi, eyi - syi);
        }
      }
    }

    for (let ty = tileY0; ty < tileY0 + CHUNK_SIZE && ty < world.grid.height; ty++) {
      for (let tx = tileX0; tx < tileX0 + CHUNK_SIZE && tx < world.grid.width; tx++) {
        const i = world.grid.idx(tx, ty);
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

        const spriteKey = this._getSpriteKey(zone, building, dev);
        const sprite = SpriteRegistry.instance.findBest(spriteKey, vibe, visualVariant);

        if (vegetation !== VEG_NONE && road === ROAD_NONE && building === BUILDING_NONE && zone === ZONE_NONE) {

          this._drawTree(chunkCtx, vegetation, sxi, syi, tsi, ts, p);
        }

        if (zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE && !sprite) {
          this._drawZoneBuilding(chunkCtx, zone, dev, sxi, syi, tsi, ts, p, isAbandoned, visualVariant % 4);
        }

        if (road !== ROAD_NONE) {
          this._drawRoad(chunkCtx, world, tx, ty, sxi, syi, tsi, ts, p);
        }

        if (building !== BUILDING_NONE && !sprite) {
          if (building === BUILDING_POWER_PLANT) {
            chunkCtx.fillStyle = '#3a3a3a';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = p.powerPlant;
            const pad = Math.max(1, Math.floor(ts * 0.15));
            chunkCtx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
            chunkCtx.fillStyle = p.powerPlantRoof;
            chunkCtx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, Math.max(1, Math.floor(ts * 0.25)));
            chunkCtx.fillStyle = '#ffe680';
            const ppCx = sxi + Math.floor(tsi / 2) - 1;
            const ppCy = syi + Math.floor(tsi / 2);
            chunkCtx.fillRect(ppCx, ppCy, 2, 2);
          } else if (building === BUILDING_WATER_TOWER) {
            chunkCtx.fillStyle = '#2a3a3a';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = p.waterTower;
            const wpad = Math.max(1, Math.floor(ts * 0.2));
            const tankH = Math.max(2, Math.floor(ts * 0.5));
            chunkCtx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, tankH);
            chunkCtx.fillStyle = p.waterTowerTop;
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
            chunkCtx.fillStyle = p.sewagePlant;
            const sp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, tsi - sp * 2);
            chunkCtx.fillStyle = p.sewagePlantRoof;
            chunkCtx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, Math.max(1, Math.floor(ts * 0.2)));
            chunkCtx.fillStyle = '#6a5010';
            const sewCr = Math.max(1, Math.floor(ts * 0.15));
            const sewCx = sxi + Math.floor(tsi / 2);
            const sewCy = syi + Math.floor(tsi * 0.62);
            chunkCtx.beginPath();
            chunkCtx.arc(sewCx, sewCy, sewCr, 0, Math.PI * 2);
            chunkCtx.fill();
          } else if (building === BUILDING_POLICE) {
            chunkCtx.fillStyle = '#1a2a4a';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = p.police;
            const pp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + pp, syi + pp, tsi - pp * 2, tsi - pp * 2);
            chunkCtx.fillStyle = p.policeBadge;
            const bw = Math.max(2, Math.floor(ts * 0.3));
            const bh = Math.max(2, Math.floor(ts * 0.35));
            chunkCtx.fillRect(sxi + Math.floor((tsi - bw) / 2), syi + Math.floor((tsi - bh) / 2), bw, bh);
          } else if (building === BUILDING_FIRE) {
            chunkCtx.fillStyle = '#3a1010';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = p.fire;
            const fp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + fp, syi + fp, tsi - fp * 2, tsi - fp * 2);
            chunkCtx.fillStyle = p.fireAccent;
            const fw = Math.max(2, Math.floor(ts * 0.25));
            const fireCx = sxi + Math.floor(tsi / 2);
            chunkCtx.fillRect(fireCx - Math.floor(fw / 2), syi + Math.floor(ts * 0.2), fw, Math.floor(ts * 0.5));
            chunkCtx.fillStyle = '#ffcc00';
            chunkCtx.fillRect(fireCx - Math.max(1, Math.floor(fw * 0.4)), syi + Math.floor(ts * 0.35), Math.max(1, Math.floor(fw * 0.8)), Math.floor(ts * 0.3));
          } else if (building === BUILDING_SCHOOL) {
            chunkCtx.fillStyle = '#2a2000';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = p.school;
            const sp2 = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + sp2, syi + sp2, tsi - sp2 * 2, tsi - sp2 * 2);
            chunkCtx.fillStyle = p.schoolAccent;
            const bw2 = Math.max(2, Math.floor(ts * 0.3));
            chunkCtx.fillRect(sxi + Math.floor((tsi - bw2) / 2), syi + Math.floor(ts * 0.1), bw2, Math.max(2, Math.floor(ts * 0.35)));
          } else if (building === BUILDING_HOSPITAL) {
            chunkCtx.fillStyle = '#303030';
            chunkCtx.fillRect(sxi, syi, tsi, tsi);
            chunkCtx.fillStyle = p.hospital;
            const hp = Math.max(1, Math.floor(ts * 0.12));
            chunkCtx.fillRect(sxi + hp, syi + hp, tsi - hp * 2, tsi - hp * 2);
            chunkCtx.fillStyle = p.hospitalCross;
            const arm = Math.max(1, Math.floor(ts * 0.12));
            const hospCx = sxi + Math.floor(tsi / 2);
            const hospCy = syi + Math.floor(tsi / 2);
            const clen = Math.max(2, Math.floor(ts * 0.35));
            chunkCtx.fillRect(hospCx - arm, hospCy - Math.floor(clen / 2), arm * 2, clen);
            chunkCtx.fillRect(hospCx - Math.floor(clen / 2), hospCy - arm, clen, arm * 2);
          } else if (building === BUILDING_PARK) {
            this._drawPark(chunkCtx, sxi, syi, tsi, ts, p, visualVariant % 5);
          }
        }

        if (!isAbandoned && !powered && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = p.noPowerTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }
        if (!isAbandoned && !watered && dev >= 1 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = p.noWaterTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }
        if (!isAbandoned && !sewaged && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = p.noSewageTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }
        if (!isAbandoned && !serviced && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          chunkCtx.fillStyle = p.noServicesTint;
          chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (pollutionV > 8 && terrain !== TERRAIN_WATER) {
          chunkCtx.fillStyle = _pollutionColors[pollutionV];
          chunkCtx.fillRect(sxi, syi, tsi, tsi);
        }
        if (crimeV > 40 && zone !== ZONE_NONE && dev > 0) {
          chunkCtx.fillStyle = _crimeIndicatorColors[crimeV];
          const dotSize = Math.max(2, Math.floor(ts * 0.18));
          chunkCtx.fillRect(sxi + 1, syi + 1, dotSize, dotSize);
          if (crimeV > 120) chunkCtx.fillRect(sxi + tsi - dotSize - 1, syi + 1, dotSize, dotSize);
          if (crimeV > 200) chunkCtx.fillRect(sxi + 1, syi + tsi - dotSize - 1, dotSize, dotSize);
        }
        if (sicknessV > 80 && zone === ZONE_R && dev > 0 && !isAbandoned) {
          chunkCtx.fillStyle = _sicknessColors[sicknessV];
          const cs = Math.max(2, Math.floor(ts * 0.15));
          const sicCx = sxi + tsi - cs - 1;
          const sicCy = syi + tsi - cs - 1;
          const sicArm = Math.max(1, Math.floor(cs * 0.4));
          chunkCtx.fillRect(sicCx - sicArm, sicCy - cs, sicArm * 2, cs * 2);
          chunkCtx.fillRect(sicCx - cs, sicCy - sicArm, cs * 2, sicArm * 2);
        }
        if (recentDeathV > 0 && zone === ZONE_R && dev > 0) {
          chunkCtx.fillStyle = _deathColors[recentDeathV];
          const ds = Math.max(2, Math.floor(ts * 0.18));
          const dx = sxi + 1;
          const dy = syi + tsi - ds - 1;
          chunkCtx.fillRect(dx, dy, ds, ds);
          chunkCtx.fillStyle = _deathAccentColors[recentDeathV];
          const arm2 = Math.max(1, Math.floor(ds * 0.3));
          const dCx = dx + Math.floor(ds / 2);
          const dCy = dy - arm2;
          chunkCtx.fillRect(dCx - arm2, dCy - arm2, arm2 * 2, arm2 * 3);
          chunkCtx.fillRect(dCx - arm2 * 2, dCy, arm2 * 4, arm2);
        }
      }
    }
  }

  private _drawFire(ctx: CanvasRenderingContext2D, sxi: number, syi: number, tsi: number, ts: number, now: number): void {
    const flicker = Math.sin(now * 0.015) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 60, 0, ${flicker})`;
    ctx.fillRect(sxi, syi, tsi, tsi);
    if (ts > 8) {
      ctx.fillStyle = `rgba(255, 200, 0, ${flicker * 0.8})`;
      const pad = ts * 0.2;
      ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
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
      ctx.beginPath(); ctx.arc(sxi + mid, syi + mid, r, 0, Math.PI * 2); ctx.arc(sxi + mid * 0.7, syi + mid * 0.8, r * 0.8, 0, Math.PI * 2); ctx.arc(sxi + mid * 1.3, syi + mid * 1.2, r * 0.7, 0, Math.PI * 2); ctx.fill();
    } else if (vegetation <= 4) {
      const bw = ts * 0.7; const bh = ts * 0.8;
      ctx.beginPath(); ctx.moveTo(sxi + mid, syi + ts * 0.1); ctx.lineTo(sxi + mid - bw / 2, syi + ts * 0.1 + bh); ctx.lineTo(sxi + mid + bw / 2, syi + ts * 0.1 + bh); ctx.closePath(); ctx.fill();
    } else {
      const r = ts * 0.25; const h = ts * 0.7;
      ctx.beginPath(); ctx.ellipse(sxi + mid, syi + mid, r, h / 2, 0, 0, Math.PI * 2); ctx.fill();
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
      if (ts > 10) { ctx.fillStyle = '#aaf'; ctx.beginPath(); ctx.arc(pkCx, pkCy, 1.5, 0, Math.PI * 2); ctx.fill(); }
    } else if (variant === 2) {
      ctx.fillStyle = '#0a3a0a'; ctx.fillRect(sxi + 2, syi + 2, tsi - 4, 2); ctx.fillRect(sxi + 2, syi + tsi - 4, tsi - 4, 2);
      const flowers = ['#f66', '#f6f', '#ff6']; const fSize = Math.max(1, ts * 0.08);
      for (let fi = 0; fi < 3; fi++) { ctx.fillStyle = flowers[fi % flowers.length]; ctx.fillRect(sxi + tsi * (0.2 + fi * 0.3), syi + tsi * 0.5, fSize, fSize); }
    } else if (variant === 3) {
      ctx.fillStyle = '#d2b48c'; const pad = tsi * 0.2; ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
      if (ts > 8) { ctx.fillStyle = '#e55'; ctx.fillRect(sxi + tsi * 0.3, syi + tsi * 0.3, tsi * 0.1, tsi * 0.3); ctx.fillStyle = '#55e'; ctx.fillRect(sxi + tsi * 0.6, syi + tsi * 0.4, 2, tsi * 0.2); }
    } else {
      ctx.fillStyle = '#3d2b1f'; ctx.beginPath(); ctx.arc(sxi + tsi / 2, syi + tsi / 2, tsi * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.parkTree; const tr = Math.max(2, Math.floor(ts * 0.18));
      const pos = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7], [0.5, 0.5]];
      for (const [px, py] of pos) { ctx.beginPath(); ctx.arc(sxi + tsi * px, syi + tsi * py, tr, 0, Math.PI * 2); ctx.fill(); }
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
      if (!isAbandoned && ts >= TILE_SIZE) { ctx.fillStyle = 'rgba(200,200,200,0.4)'; ctx.beginPath(); ctx.arc(chX + bw * 0.07, by - bh * 0.25, bw * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a3a3a'; }
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
