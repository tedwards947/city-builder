// Canvas 2D renderer. The Renderer interface is: render(world, camera, hoverTile).
// A PixiRenderer / WebGLRenderer can be dropped in without touching game code.

import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import { resolvePalette, type ColorPalette } from './CharacterPalette';
import { BALANCE } from '../data/balance';
import {
  TERRAIN_GRASS, TERRAIN_WATER,
  ZONE_NONE, ZONE_R, ZONE_C, ZONE_I,
  ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY,
  VEG_NONE,
  BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';

export class CanvasRenderer {
  readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(world: World, camera: Camera, hoverTile: { tx: number; ty: number } | null, trafficOverlay = false, serviceCoveragePreview: Set<number> | null = null, now = 0): void {
    const ctx = this.ctx;
    const { width: cw, height: ch } = this.canvas;
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, cw, ch);

    // Resolve palette from character profile — the "sprite variant lookup" hook.
    const p = resolvePalette(world.character, BALANCE.character.axisMax);

    const bounds = camera.visibleTileBounds(world.grid);
    const ts = TILE_SIZE * camera.zoom;

    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const i = world.grid.idx(tx, ty);
        const terrain  = world.layers.terrain[i];
        const zone     = world.layers.zone[i];
        const road     = world.layers.roadClass[i];
        const building = world.layers.building[i];
        const vegetation = world.layers.vegetation[i];
        const dev      = world.layers.devLevel[i];
        const powered    = world.layers.power[i] !== 0;
        const watered    = world.layers.water[i] !== 0;
        const sewaged    = world.layers.sewage[i] !== 0;
        const serviced   = world.layers.services[i] !== 0;
        const pollutionV = world.layers.pollution[i];
        const isAbandoned = world.layers.abandoned[i] !== 0;
        const { x: wx, y: wy } = Projection.tileToWorld(tx, ty);
        const { sx, sy } = camera.worldToScreen(wx, wy);
        const sxi = Math.floor(sx), syi = Math.floor(sy);
        const tsi = Math.ceil(ts) + 1;

        ctx.fillStyle = terrain === TERRAIN_GRASS ? p.grass : terrain === TERRAIN_WATER ? p.water : p.sand;
        ctx.fillRect(sxi, syi, tsi, tsi);

        if (vegetation !== VEG_NONE && road === ROAD_NONE && building === BUILDING_NONE && zone === ZONE_NONE) {
          this._drawTree(ctx, vegetation, sxi, syi, tsi, ts, p);
        }

        if (zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          const variant = (tx + ty * 31) % 4;
          this._drawZoneBuilding(ctx, zone, dev, sxi, syi, tsi, ts, p, isAbandoned, variant);
        }

        if (road !== ROAD_NONE) {
          this._drawRoad(world, tx, ty, sxi, syi, tsi, ts, p, trafficOverlay, now);
        }

        if (building === BUILDING_POWER_PLANT) {
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.powerPlant;
          const pad = Math.max(1, Math.floor(ts * 0.15));
          ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
          ctx.fillStyle = p.powerPlantRoof;
          ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, Math.max(1, Math.floor(ts * 0.25)));
          if (ts > 10) {
            ctx.fillStyle = '#ffe680';
            const cx = sxi + Math.floor(tsi / 2) - 1;
            const cy = syi + Math.floor(tsi / 2);
            ctx.fillRect(cx, cy, 2, 2);
          }
        }

        if (building === BUILDING_WATER_TOWER) {
          ctx.fillStyle = '#2a3a3a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.waterTower;
          const wpad = Math.max(1, Math.floor(ts * 0.2));
          const tankH = Math.max(2, Math.floor(ts * 0.5));
          ctx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, tankH);
          ctx.fillStyle = p.waterTowerTop;
          ctx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, Math.max(1, Math.floor(ts * 0.12)));
          if (ts > 10) {
            const legX1 = sxi + Math.floor(ts * 0.3);
            const legX2 = sxi + Math.floor(ts * 0.6);
            const legTop = syi + Math.floor(ts * 0.35) + tankH;
            ctx.fillStyle = '#4a6a7a';
            ctx.fillRect(legX1, legTop, 1, tsi - legTop + syi);
            ctx.fillRect(legX2, legTop, 1, tsi - legTop + syi);
          }
        }

        if (!isAbandoned && !powered && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = p.noPowerTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (!isAbandoned && !watered && dev >= 1 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = p.noWaterTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (building === BUILDING_SEWAGE_PLANT) {
          ctx.fillStyle = '#2a2a1a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.sewagePlant;
          const sp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, tsi - sp * 2);
          ctx.fillStyle = p.sewagePlantRoof;
          ctx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, Math.max(1, Math.floor(ts * 0.2)));
          if (ts > 10) {
            ctx.fillStyle = '#6a5010';
            const cr = Math.max(1, Math.floor(ts * 0.15));
            const cx = sxi + Math.floor(tsi / 2);
            const cy = syi + Math.floor(tsi * 0.62);
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (!isAbandoned && !sewaged && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = p.noSewageTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (building === BUILDING_POLICE) {
          ctx.fillStyle = '#1a2a4a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.police;
          const pp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + pp, syi + pp, tsi - pp * 2, tsi - pp * 2);
          if (ts > 8) {
            ctx.fillStyle = p.policeBadge;
            const bw = Math.max(2, Math.floor(ts * 0.3));
            const bh = Math.max(2, Math.floor(ts * 0.35));
            ctx.fillRect(sxi + Math.floor((tsi - bw) / 2), syi + Math.floor((tsi - bh) / 2), bw, bh);
          }
        }

        if (building === BUILDING_FIRE) {
          ctx.fillStyle = '#3a1010';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.fire;
          const fp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + fp, syi + fp, tsi - fp * 2, tsi - fp * 2);
          if (ts > 8) {
            ctx.fillStyle = p.fireAccent;
            const fw = Math.max(2, Math.floor(ts * 0.25));
            const cx2 = sxi + Math.floor(tsi / 2);
            ctx.fillRect(cx2 - Math.floor(fw / 2), syi + Math.floor(ts * 0.2), fw, Math.floor(ts * 0.5));
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(cx2 - Math.max(1, Math.floor(fw * 0.4)), syi + Math.floor(ts * 0.35), Math.max(1, Math.floor(fw * 0.8)), Math.floor(ts * 0.3));
          }
        }

        if (building === BUILDING_SCHOOL) {
          ctx.fillStyle = '#2a2000';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.school;
          const sp2 = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + sp2, syi + sp2, tsi - sp2 * 2, tsi - sp2 * 2);
          if (ts > 8) {
            ctx.fillStyle = p.schoolAccent;
            const bw2 = Math.max(2, Math.floor(ts * 0.3));
            ctx.fillRect(sxi + Math.floor((tsi - bw2) / 2), syi + Math.floor(ts * 0.1), bw2, Math.max(2, Math.floor(ts * 0.35)));
          }
        }

        if (building === BUILDING_HOSPITAL) {
          ctx.fillStyle = '#303030';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.hospital;
          const hp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + hp, syi + hp, tsi - hp * 2, tsi - hp * 2);
          if (ts > 8) {
            ctx.fillStyle = p.hospitalCross;
            const arm = Math.max(1, Math.floor(ts * 0.12));
            const cx3 = sxi + Math.floor(tsi / 2);
            const cy3 = syi + Math.floor(tsi / 2);
            const clen = Math.max(2, Math.floor(ts * 0.35));
            ctx.fillRect(cx3 - arm, cy3 - Math.floor(clen / 2), arm * 2, clen);
            ctx.fillRect(cx3 - Math.floor(clen / 2), cy3 - arm, clen, arm * 2);
          }
        }

        if (building === BUILDING_PARK) {
          const variant = (tx + ty * 37) % 5;
          this._drawPark(ctx, sxi, syi, tsi, ts, p, variant);
        }

        if (!isAbandoned && !serviced && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = p.noServicesTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        // Pollution overlay: visible on any non-water tile above a low threshold.
        if (pollutionV > 8 && terrain !== TERRAIN_WATER) {
          const alpha = Math.min(0.65, (pollutionV / 255) * 0.85);
          ctx.fillStyle = `rgba(160, 80, 0, ${alpha.toFixed(3)})`;
          ctx.fillRect(sxi, syi, tsi, tsi);
        }
      }
    }

    if (camera.zoom >= 1.2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let ty = bounds.y0; ty <= bounds.y1 + 1; ty++) {
        const { y: wy } = Projection.tileToWorld(0, ty);
        const { sy } = camera.worldToScreen(0, wy);
        const x0 = camera.worldToScreen(Projection.tileToWorld(bounds.x0, 0).x, 0).sx;
        const x1 = camera.worldToScreen(Projection.tileToWorld(bounds.x1 + 1, 0).x, 0).sx;
        ctx.moveTo(x0, Math.floor(sy) + 0.5);
        ctx.lineTo(x1, Math.floor(sy) + 0.5);
      }
      for (let tx = bounds.x0; tx <= bounds.x1 + 1; tx++) {
        const { x: wx } = Projection.tileToWorld(tx, 0);
        const { sx } = camera.worldToScreen(wx, 0);
        const y0 = camera.worldToScreen(0, Projection.tileToWorld(0, bounds.y0).y).sy;
        const y1 = camera.worldToScreen(0, Projection.tileToWorld(0, bounds.y1 + 1).y).sy;
        ctx.moveTo(Math.floor(sx) + 0.5, y0);
        ctx.lineTo(Math.floor(sx) + 0.5, y1);
      }
      ctx.stroke();
    }

    if (trafficOverlay) {
      // Traffic legend — bottom-left corner, above toolbar
      const lx = 12, ly = ch - 70;
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'middle';
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
    }

    // Service building coverage preview — draw before hover cursor so cursor renders on top.
    if (serviceCoveragePreview !== null) {
      for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
        for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
          const i = world.grid.idx(tx, ty);
          if (!serviceCoveragePreview.has(i)) continue;
          const { x: wx, y: wy } = Projection.tileToWorld(tx, ty);
          const { sx, sy } = camera.worldToScreen(wx, wy);
          const isRoad = world.layers.roadClass[i] !== ROAD_NONE;
          ctx.fillStyle = isRoad
            ? 'rgba(80, 200, 255, 0.55)'   // brighter on roads — shows the coverage flow
            : 'rgba(80, 200, 255, 0.22)';  // softer on zones — shows the reach
          ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(ts) + 1, Math.ceil(ts) + 1);
        }
      }
    }

    if (hoverTile && world.grid.inBounds(hoverTile.tx, hoverTile.ty)) {
      const { x: wx, y: wy } = Projection.tileToWorld(hoverTile.tx, hoverTile.ty);
      const { sx, sy } = camera.worldToScreen(wx, wy);
      ctx.strokeStyle = world.isBuildable(hoverTile.tx, hoverTile.ty) ? '#fff' : '#f66';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.floor(sx) + 1, Math.floor(sy) + 1, Math.ceil(ts) - 1, Math.ceil(ts) - 1);
    }

    const tl = camera.worldToScreen(0, 0);
    const br = camera.worldToScreen(world.grid.width * TILE_SIZE, world.grid.height * TILE_SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy);
  }

  private _drawTree(ctx: CanvasRenderingContext2D, vegetation: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette): void {
    const speciesIdx = (vegetation - 1);
    const color = p.treeColors[speciesIdx] || p.treeColors[0];
    ctx.fillStyle = color;

    if (ts < 8) {
      ctx.fillRect(sxi + 2, syi + 2, tsi - 4, tsi - 4);
      return;
    }

    const mid = ts / 2;
    // Map species 1-6 to a few distinct styles.
    // 1, 2: Fluffy (current)
    // 3, 4: Pine (conical)
    // 5, 6: Tall/Slim
    if (vegetation <= 2) {
      // Fluffy
      const r = ts * 0.35;
      ctx.beginPath();
      ctx.arc(sxi + mid, syi + mid, r, 0, Math.PI * 2);
      ctx.arc(sxi + mid * 0.7, syi + mid * 0.8, r * 0.8, 0, Math.PI * 2);
      ctx.arc(sxi + mid * 1.3, syi + mid * 1.2, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (vegetation <= 4) {
      // Pine (Triangle-ish)
      const bw = ts * 0.7;
      const bh = ts * 0.8;
      ctx.beginPath();
      ctx.moveTo(sxi + mid, syi + ts * 0.1);
      ctx.lineTo(sxi + mid - bw/2, syi + ts * 0.1 + bh);
      ctx.lineTo(sxi + mid + bw/2, syi + ts * 0.1 + bh);
      ctx.closePath();
      ctx.fill();
    } else {
      // Tall/Slim
      const r = ts * 0.25;
      const h = ts * 0.7;
      ctx.beginPath();
      ctx.ellipse(sxi + mid, syi + mid, r, h/2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private _drawRoad(
    world: World,
    tx: number,
    ty: number,
    sxi: number,
    syi: number,
    tsi: number,
    ts: number,
    p: ColorPalette,
    trafficOverlay: boolean,
    now: number
  ): void {
    const ctx = this.ctx;
    const i = world.grid.idx(tx, ty);
    const road = world.layers.roadClass[i];
    const congestion = world.layers.congestion[i];

    // Connectivity mask: 1=N, 2=E, 4=S, 8=W
    let mask = 0;
    if (ty > 0 && world.layers.roadClass[world.grid.idx(tx, ty - 1)] !== ROAD_NONE) mask |= 1;
    if (tx < world.grid.width - 1 && world.layers.roadClass[world.grid.idx(tx + 1, ty)] !== ROAD_NONE) mask |= 2;
    if (ty < world.grid.height - 1 && world.layers.roadClass[world.grid.idx(tx, ty + 1)] !== ROAD_NONE) mask |= 4;
    if (tx > 0 && world.layers.roadClass[world.grid.idx(tx - 1, ty)] !== ROAD_NONE) mask |= 8;

    let baseColor = p.road;
    let lineColor = p.roadEdge;

    if (trafficOverlay) {
      const t = congestion / 255;
      let r: number, g: number;
      if (t <= 0.5) {
        r = Math.round(t * 2 * 220);
        g = 180 + Math.round(t * 2 * 20);
      } else {
        r = 220;
        g = Math.round(200 * (1 - (t - 0.5) * 2));
      }
      baseColor = `rgb(${r},${g},0)`;
      lineColor = 'rgba(0,0,0,0.25)';
    } else if (road === ROAD_HIGHWAY) {
      baseColor = p.roadHighway;
      lineColor = p.roadHighwayLine;
    } else if (road === ROAD_AVENUE) {
      baseColor = p.roadAvenue;
      lineColor = p.roadAvenueEdge;
    }

    // Road body: draw a center hub and arms connecting to neighbors.
    const roadWidth = Math.floor(ts * 0.75);
    const off = (ts - roadWidth) / 2;
    const mid = ts / 2;

    ctx.fillStyle = baseColor;
    ctx.fillRect(sxi + Math.floor(off), syi + Math.floor(off), roadWidth, roadWidth);
    if (mask & 1) ctx.fillRect(sxi + Math.floor(off), syi, roadWidth, Math.ceil(off) + 1);
    if (mask & 2) ctx.fillRect(sxi + Math.floor(off) + roadWidth - 1, syi + Math.floor(off), Math.ceil(off) + 1, roadWidth);
    if (mask & 4) ctx.fillRect(sxi + Math.floor(off), syi + Math.floor(off) + roadWidth - 1, roadWidth, Math.ceil(off) + 1);
    if (mask & 8) ctx.fillRect(sxi, syi + Math.floor(off), Math.ceil(off) + 1, roadWidth);

    // Decorative road markings
    if (ts > 8) {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(1, Math.floor(ts * 0.05));
      ctx.lineCap = 'round';

      if (road === ROAD_STREET && !trafficOverlay) {
        ctx.setLineDash([Math.floor(ts * 0.2), Math.floor(ts * 0.1)]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      if (mask === 5) {
        ctx.moveTo(sxi + mid, syi);
        ctx.lineTo(sxi + mid, syi + tsi);
      } else if (mask === 10) {
        ctx.moveTo(sxi, syi + mid);
        ctx.lineTo(sxi + tsi, syi + mid);
      } else if (mask !== 0) {
        if (mask & 1) { ctx.moveTo(sxi + mid, syi); ctx.lineTo(sxi + mid, syi + mid); }
        if (mask & 2) { ctx.moveTo(sxi + mid, syi + mid); ctx.lineTo(sxi + tsi, syi + mid); }
        if (mask & 4) { ctx.moveTo(sxi + mid, syi + mid); ctx.lineTo(sxi + mid, syi + tsi); }
        if (mask & 8) { ctx.moveTo(sxi + mid, syi + mid); ctx.lineTo(sxi, syi + mid); }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Live Traffic Indicators (Blue Cars)
    if (!trafficOverlay && ts > 10 && congestion > 15) {
      const carCount = Math.min(6, Math.ceil(congestion / 40));
      const carSize = Math.max(2, ts * 0.12);
      ctx.fillStyle = '#4a6a8a'; // Blue-ish car color

      // Use deterministic seed per tile
      const seed = tx * 13 + ty * 37;
      const timeScale = 0.0016; // Speed of movement (reduced by 20% from 0.002)
      
      for (let c = 0; c < carCount; c++) {
        const laneVariant = (seed + c) % 2; // 0 = outbound, 1 = inbound
        const armVariant = (seed + Math.floor(c / 2)) % 4;
        
        // Ensure we only pick an arm that exists
        const arms = [];
        if (mask & 1) arms.push(1);
        if (mask & 2) arms.push(2);
        if (mask & 4) arms.push(4);
        if (mask & 8) arms.push(8);
        if (arms.length === 0) continue;

        const arm = arms[armVariant % arms.length];
        
        // Progress cycles from 0 to 1
        const cycleOffset = (c * 0.25) + (seed * 0.1);
        let progress = ((now * timeScale) + cycleOffset) % 1.0;
        if (laneVariant === 1) progress = 1.0 - progress; // Move in opposite direction

        let cx = sxi + mid, cy = syi + mid;
        const laneOffset = ts * 0.15; // Offset from center line to lane center

        if (arm === 1) { // North
          cy = syi + (1 - progress) * mid;
          cx += (laneVariant === 0 ? laneOffset : -laneOffset);
        } else if (arm === 2) { // East
          cx = sxi + mid + progress * mid;
          cy += (laneVariant === 0 ? laneOffset : -laneOffset);
        } else if (arm === 4) { // South
          cy = syi + mid + progress * mid;
          cx += (laneVariant === 0 ? -laneOffset : laneOffset);
        } else if (arm === 8) { // West
          cx = sxi + (1 - progress) * mid;
          cy += (laneVariant === 0 ? -laneOffset : laneOffset);
        }

        ctx.fillRect(cx - carSize / 2, cy - carSize / 2, carSize, carSize);
      }
    }
  }

  private _drawZoneBuilding(
    ctx: CanvasRenderingContext2D,
    zone: number,
    dev: number,
    sxi: number,
    syi: number,
    tsi: number,
    ts: number,
    p: ColorPalette,
    isAbandoned: boolean,
    variant: number
  ): void {
    const zoneColor = zone === ZONE_R ? p.zoneR : zone === ZONE_C ? p.zoneC : p.zoneI;

    if (isAbandoned) {
      ctx.fillStyle = zoneColor;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = zoneColor;
      ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
    }

    if (dev === 0) return;

    const bldPalette = zone === ZONE_R ? p.buildingR : zone === ZONE_C ? p.buildingC : p.buildingI;
    const bodyColor = isAbandoned ? '#2a2a2a' : bldPalette[dev - 1];

    if (zone === ZONE_R) {
      this._drawResidential(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
    } else if (zone === ZONE_C) {
      this._drawCommercial(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
    } else if (zone === ZONE_I) {
      this._drawIndustrial(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
    }

    if (isAbandoned && ts > 6) {
      // Boarded-up X
      ctx.strokeStyle = '#555';
      ctx.lineWidth = Math.max(1, ts * 0.06);
      ctx.beginPath();
      const inset = Math.max(1, Math.floor(ts * (0.35 - dev * 0.08)));
      ctx.moveTo(sxi + inset, syi + inset);
      ctx.lineTo(sxi + tsi - inset, syi + tsi - inset);
      ctx.moveTo(sxi + tsi - inset, syi + inset);
      ctx.lineTo(sxi + inset, syi + tsi - inset);
      ctx.stroke();
    }
  }

  private _drawResidential(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
    const inset = Math.max(1, Math.floor(ts * (0.32 - dev * 0.06)));
    const bx = sxi + inset, by = syi + inset;
    const bw = tsi - inset * 2, bh = tsi - inset * 2;

    // Main house body
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    // Roof Logic - More varied styles and colors
    const roofColors = isAbandoned ? ['#1a1a1a'] : ['#5a3a2a', '#3a4a5a', '#7a4a3a', '#4a5a4a'];
    ctx.fillStyle = roofColors[variant % roofColors.length];

    if (dev === 1) {
      // Level 1: Quaint cottages / Small houses
      // Draw a front-facing gable or a hip roof
      if (variant % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(bx - 1, by + bh * 0.5);
        ctx.lineTo(bx + bw / 2, by - 1);
        ctx.lineTo(bx + bw + 1, by + bh * 0.5);
        ctx.fill();
      } else {
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.4);
      }
      
      // Small chimney for houses
      if (!isAbandoned && variant % 3 === 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(bx + bw * 0.7, by - 2, 2, 4);
      }
    } else if (dev === 2) {
      // Level 2: Duplexes / Townhouses
      // Split the building visually into two halves or add an extension
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(bx + bw * 0.45, by, bw * 0.1, bh); // Vertical split line
      
      ctx.fillStyle = roofColors[(variant + 1) % roofColors.length];
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.25); // Flat roof with trim
      
      // Small balcony/porch detail
      if (!isAbandoned) {
        ctx.fillStyle = '#444';
        ctx.fillRect(bx + bw * 0.2, by + bh * 0.4, bw * 0.6, 1);
      }
    } else {
      // Level 3: Apartment Complexes
      // Add a "penthouse" or utility block on the roof
      ctx.fillStyle = roofColors[variant % roofColors.length];
      ctx.fillRect(bx, by, bw, bh * 0.15);
      
      ctx.fillStyle = color;
      const pW = bw * 0.5, pH = bh * 0.3;
      ctx.fillRect(bx + (bw - pW) / 2, by - pH * 0.4, pW, pH);
      
      ctx.fillStyle = '#222';
      ctx.fillRect(bx + (bw - pW) / 2, by - pH * 0.4, pW, 2); // Tiny flat roof for the top block
    }

    // Door detail
    ctx.fillStyle = isAbandoned ? '#111' : '#3d2b1f';
    const doorW = Math.max(2, bw * 0.2);
    const doorH = Math.max(3, bh * 0.3);
    ctx.fillRect(bx + (bw - doorW) / 2, by + bh - doorH, doorW, doorH);

    // Enhanced Windows
    if (!isAbandoned && ts > 12) {
      const winColor = '#ffe680';
      const winSize = Math.max(1, ts * 0.08);
      
      ctx.fillStyle = winColor;
      if (dev === 1) {
        // Simple two windows
        ctx.fillRect(bx + bw * 0.2, by + bh * 0.55, winSize, winSize);
        ctx.fillRect(bx + bw * 0.7, by + bh * 0.55, winSize, winSize);
      } else {
        // Grid of windows for larger buildings
        const rows = dev + 1;
        const cols = 2 + (variant % 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            // Randomized lights being "off"
            if ((variant + r + c) % 5 === 0) continue;
            
            const wx = bx + (bw / (cols + 1)) * (c + 1) - winSize / 2;
            const wy = by + (bh / (rows + 1)) * (r + 1) - winSize / 2;
            
            // Skip window if it overlaps the door area
            if (wy > by + bh - doorH - 2 && wx > bx + (bw - doorW) / 2 - 2 && wx < bx + (bw + doorW) / 2 + 2) continue;
            
            ctx.fillRect(wx, wy, winSize, winSize);
            
            // Subtle window "sill" or frame
            if (ts > 20) {
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.fillRect(wx, wy + winSize, winSize, 1);
              ctx.fillStyle = winColor;
            }
          }
        }
      }
    }
  }

  private _drawCommercial(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
    const inset = Math.max(1, Math.floor(ts * (0.25 - dev * 0.05)));
    const bx = sxi + inset, by = syi + inset;
    const bw = tsi - inset * 2, bh = tsi - inset * 2;

    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    // Storefront or entrance
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx + bw * 0.1, by + bh * 0.7, bw * 0.8, bh * 0.2);

    // Signage
    if (!isAbandoned && ts > 10) {
      ctx.fillStyle = variant % 2 === 0 ? '#e07070' : '#7070e0';
      ctx.fillRect(bx + bw * 0.2, by + bh * 0.1, bw * 0.6, bh * 0.15);
    }

    // Windows
    if (!isAbandoned && ts > 12) {
      ctx.fillStyle = '#80e6ff'; // cool office light
      const winSize = Math.max(1, ts * 0.1);
      for (let row = 0; row < dev + 1; row++) {
        for (let col = 0; col < 3; col++) {
           ctx.fillRect(bx + bw * (0.15 + col * 0.25), by + bh * (0.3 + row * 0.15), winSize, winSize * 0.8);
        }
      }
    }
  }

  private _drawPark(ctx: CanvasRenderingContext2D, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette, variant: number): void {
    // Base grass/ground
    ctx.fillStyle = variant === 1 ? '#4a4a4a' : p.park; // Plaza has stone ground
    ctx.fillRect(sxi, syi, tsi, tsi);

    if (ts < 6) return;

    if (variant === 0) {
      // Style 0: Classic Park (Trees + Path)
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(sxi + tsi * 0.4, syi, tsi * 0.2, tsi); // North-south path
      
      ctx.fillStyle = p.parkTree;
      const tr = Math.max(2, Math.floor(ts * 0.22));
      ctx.beginPath(); ctx.arc(sxi + tsi * 0.25, syi + tsi * 0.3, tr, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sxi + tsi * 0.75, syi + tsi * 0.7, tr, 0, Math.PI * 2); ctx.fill();
      
      if (ts > 12) {
        ctx.fillStyle = '#5a3a2a'; // Tiny bench
        ctx.fillRect(sxi + tsi * 0.45, syi + tsi * 0.5, tsi * 0.1, 2);
      }
    } else if (variant === 1) {
      // Style 1: Urban Plaza (Stone + Fountain/Statue)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sxi + 2, syi + 2, tsi - 4, tsi - 4); // Grid pattern
      
      const cx = sxi + tsi / 2, cy = syi + tsi / 2;
      ctx.fillStyle = '#8aa'; // Central feature base
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      
      if (ts > 10) {
        ctx.fillStyle = '#aaf'; // Water/Fountain
        ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (variant === 2) {
      // Style 2: Flower Garden (Hedges + Flowers)
      ctx.fillStyle = '#0a3a0a'; // Dark green hedge
      ctx.fillRect(sxi + 2, syi + 2, tsi - 4, 2);
      ctx.fillRect(sxi + 2, syi + tsi - 4, tsi - 4, 2);
      
      const flowers = ['#f66', '#f6f', '#ff6'];
      const fSize = Math.max(1, ts * 0.08);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = flowers[i % flowers.length];
        ctx.fillRect(sxi + tsi * (0.2 + i * 0.3), syi + tsi * 0.5, fSize, fSize);
      }
    } else if (variant === 3) {
      // Style 3: Playground (Sandpit + Equipment)
      ctx.fillStyle = '#d2b48c'; // Tan sand
      const pad = tsi * 0.2;
      ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
      
      if (ts > 8) {
        ctx.fillStyle = '#e55'; // Red slide/equipment
        ctx.fillRect(sxi + tsi * 0.3, syi + tsi * 0.3, tsi * 0.1, tsi * 0.3);
        ctx.fillStyle = '#55e'; // Blue swing/equipment
        ctx.fillRect(sxi + tsi * 0.6, syi + tsi * 0.4, 2, tsi * 0.2);
      }
    } else {
      // Style 4: Wooded Grove (Dense Trees)
      ctx.fillStyle = '#3d2b1f'; // Dirt patch
      ctx.beginPath(); ctx.arc(sxi + tsi / 2, syi + tsi / 2, tsi * 0.3, 0, Math.PI * 2); ctx.fill();
      
      ctx.fillStyle = p.parkTree;
      const tr = Math.max(2, Math.floor(ts * 0.18));
      const pos = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7], [0.5, 0.5]];
      for (const [px, py] of pos) {
        ctx.beginPath(); ctx.arc(sxi + tsi * px, syi + tsi * py, tr, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  private _drawIndustrial(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
    const inset = Math.max(1, Math.floor(ts * 0.15));
    const bx = sxi + inset, by = syi + inset;
    const bw = tsi - inset * 2, bh = tsi - inset * 2;

    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    // Vents / Chimneys
    ctx.fillStyle = '#3a3a3a';
    const chimneyCount = dev;
    for (let i = 0; i < chimneyCount; i++) {
        const offset = (variant % 2 === 0) ? 0.2 : 0.1;
        const cx = bx + bw * (offset + i * 0.3);
        if (cx + bw * 0.15 > bx + bw) break;
        ctx.fillRect(cx, by - bh * 0.15, bw * 0.15, bh * 0.3);
        
        // Smoke (if not abandoned)
        if (!isAbandoned && ts > 16) {
            ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
            ctx.beginPath();
            ctx.arc(cx + bw * 0.07, by - bh * 0.25, bw * 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3a3a3a'; // Reset for next chimney
        }
    }

    // Large bay doors
    ctx.fillStyle = isAbandoned ? '#1a1a1a' : '#4a4a4a';
    const doorW = bw * 0.6;
    ctx.fillRect(bx + (bw - doorW) / 2, by + bh * 0.5, doorW, bh * 0.4);

    // Detail lines
    if (ts > 10) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const lineCount = dev * 2;
      for (let i = 1; i <= lineCount; i++) {
        const ly = by + (bh / (lineCount + 1)) * i;
        ctx.moveTo(bx, ly);
        ctx.lineTo(bx + bw, ly);
      }
      ctx.stroke();
    }
  }
}
