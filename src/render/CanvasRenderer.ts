// Canvas 2D renderer. The Renderer interface is: render(world, camera, hoverTile).
// A PixiRenderer / WebGLRenderer can be dropped in without touching game code.

import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import {
  TERRAIN_GRASS, TERRAIN_WATER, TERRAIN_SAND,
  ZONE_NONE, ZONE_R, ZONE_C,
  ROAD_NONE,
  BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';

const COLORS = {
  [TERRAIN_GRASS]: '#3a5a3a',
  [TERRAIN_WATER]: '#1e4a6e',
  [TERRAIN_SAND]:  '#b8a878',
  zoneR: '#6fd86f',
  zoneC: '#4a6ea0',
  zoneI: '#a07a3a',
  buildingR: ['#9fe89f', '#c0f0c0', '#dff8df'],
  buildingC: ['#5f8fd0', '#8faee0', '#b8ceff'],
  buildingI: ['#c89850', '#e0b060', '#f0c870'],
  road: '#555',
  roadEdge: '#333',
  powerPlant: '#d04040',
  powerPlantRoof: '#702020',
  waterTower: '#2a9ad0',
  waterTowerTop: '#1a6a90',
  sewagePlant: '#8a6a20',
  sewagePlantRoof: '#5a4010',
  police: '#2040a0',
  policeBadge: '#8090e0',
  fire: '#c03010',
  fireAccent: '#ff6030',
  school: '#b09010',
  schoolAccent: '#ffe060',
  hospital: '#c0c0c0',
  hospitalCross: '#e04040',
  park: '#2a6a2a',
  parkTree: '#50b050',
  noPowerTint: 'rgba(20, 10, 40, 0.45)',
  noWaterTint: 'rgba(10, 60, 80, 0.35)',
  noSewageTint: 'rgba(80, 60, 0, 0.35)',
  noServicesTint: 'rgba(60, 0, 80, 0.30)',
} as const;

export class CanvasRenderer {
  readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(world: World, camera: Camera, hoverTile: { tx: number; ty: number } | null): void {
    const ctx = this.ctx;
    const { width: cw, height: ch } = this.canvas;
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, cw, ch);

    const bounds = camera.visibleTileBounds(world.grid);
    const ts = TILE_SIZE * camera.zoom;

    for (let ty = bounds.y0; ty <= bounds.y1; ty++) {
      for (let tx = bounds.x0; tx <= bounds.x1; tx++) {
        const i = world.grid.idx(tx, ty);
        const terrain  = world.layers.terrain[i];
        const zone     = world.layers.zone[i];
        const road     = world.layers.roadClass[i];
        const building = world.layers.building[i];
        const dev      = world.layers.devLevel[i];
        const powered    = world.layers.power[i] !== 0;
        const watered    = world.layers.water[i] !== 0;
        const sewaged    = world.layers.sewage[i] !== 0;
        const serviced   = world.layers.services[i] !== 0;
        const pollutionV = world.layers.pollution[i];
        const { x: wx, y: wy } = Projection.tileToWorld(tx, ty);
        const { sx, sy } = camera.worldToScreen(wx, wy);
        const sxi = Math.floor(sx), syi = Math.floor(sy);
        const tsi = Math.ceil(ts) + 1;

        ctx.fillStyle = COLORS[terrain as 0 | 1 | 2];
        ctx.fillRect(sxi, syi, tsi, tsi);

        if (zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          const zoneColor = zone === ZONE_R ? COLORS.zoneR : zone === ZONE_C ? COLORS.zoneC : COLORS.zoneI;
          ctx.fillStyle = zoneColor;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
          if (dev > 0) {
            const palette = zone === ZONE_R ? COLORS.buildingR : zone === ZONE_C ? COLORS.buildingC : COLORS.buildingI;
            ctx.fillStyle = palette[dev - 1];
            const inset = Math.max(1, Math.floor(ts * (0.35 - dev * 0.08)));
            ctx.fillRect(sxi + inset, syi + inset, tsi - inset * 2, tsi - inset * 2);
          }
        }

        if (road !== ROAD_NONE) {
          ctx.fillStyle = COLORS.road;
          ctx.fillRect(sxi, syi, tsi, tsi);
          if (ts > 6) {
            ctx.fillStyle = COLORS.roadEdge;
            ctx.fillRect(sxi + Math.floor(ts * 0.45), syi, 1, tsi);
            ctx.fillRect(sxi, syi + Math.floor(ts * 0.45), tsi, 1);
          }
        }

        if (building === BUILDING_POWER_PLANT) {
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = COLORS.powerPlant;
          const pad = Math.max(1, Math.floor(ts * 0.15));
          ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
          ctx.fillStyle = COLORS.powerPlantRoof;
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
          ctx.fillStyle = COLORS.waterTower;
          const wpad = Math.max(1, Math.floor(ts * 0.2));
          const tankH = Math.max(2, Math.floor(ts * 0.5));
          ctx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, tankH);
          ctx.fillStyle = COLORS.waterTowerTop;
          ctx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, Math.max(1, Math.floor(ts * 0.12)));
          if (ts > 10) {
            // Legs
            const legX1 = sxi + Math.floor(ts * 0.3);
            const legX2 = sxi + Math.floor(ts * 0.6);
            const legTop = syi + Math.floor(ts * 0.35) + tankH;
            ctx.fillStyle = '#4a6a7a';
            ctx.fillRect(legX1, legTop, 1, tsi - legTop + syi);
            ctx.fillRect(legX2, legTop, 1, tsi - legTop + syi);
          }
        }

        if (!powered && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = COLORS.noPowerTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (!watered && dev >= 1 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = COLORS.noWaterTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (building === BUILDING_SEWAGE_PLANT) {
          ctx.fillStyle = '#2a2a1a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = COLORS.sewagePlant;
          const sp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, tsi - sp * 2);
          ctx.fillStyle = COLORS.sewagePlantRoof;
          ctx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, Math.max(1, Math.floor(ts * 0.2)));
          if (ts > 10) {
            // Circular tank indicator
            ctx.fillStyle = '#6a5010';
            const cr = Math.max(1, Math.floor(ts * 0.15));
            const cx = sxi + Math.floor(tsi / 2);
            const cy = syi + Math.floor(tsi * 0.62);
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (!sewaged && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = COLORS.noSewageTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        if (building === BUILDING_POLICE) {
          ctx.fillStyle = '#1a2a4a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = COLORS.police;
          const pp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + pp, syi + pp, tsi - pp * 2, tsi - pp * 2);
          if (ts > 8) {
            ctx.fillStyle = COLORS.policeBadge;
            const bw = Math.max(2, Math.floor(ts * 0.3));
            const bh = Math.max(2, Math.floor(ts * 0.35));
            ctx.fillRect(sxi + Math.floor((tsi - bw) / 2), syi + Math.floor((tsi - bh) / 2), bw, bh);
          }
        }

        if (building === BUILDING_FIRE) {
          ctx.fillStyle = '#3a1010';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = COLORS.fire;
          const fp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + fp, syi + fp, tsi - fp * 2, tsi - fp * 2);
          if (ts > 8) {
            // Flame shape: two rectangles suggesting a flame
            ctx.fillStyle = COLORS.fireAccent;
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
          ctx.fillStyle = COLORS.school;
          const sp2 = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + sp2, syi + sp2, tsi - sp2 * 2, tsi - sp2 * 2);
          if (ts > 8) {
            // Bell shape at top
            ctx.fillStyle = COLORS.schoolAccent;
            const bw2 = Math.max(2, Math.floor(ts * 0.3));
            ctx.fillRect(sxi + Math.floor((tsi - bw2) / 2), syi + Math.floor(ts * 0.1), bw2, Math.max(2, Math.floor(ts * 0.35)));
          }
        }

        if (building === BUILDING_HOSPITAL) {
          ctx.fillStyle = '#303030';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = COLORS.hospital;
          const hp = Math.max(1, Math.floor(ts * 0.12));
          ctx.fillRect(sxi + hp, syi + hp, tsi - hp * 2, tsi - hp * 2);
          if (ts > 8) {
            // Red cross
            ctx.fillStyle = COLORS.hospitalCross;
            const arm = Math.max(1, Math.floor(ts * 0.12));
            const cx3 = sxi + Math.floor(tsi / 2);
            const cy3 = syi + Math.floor(tsi / 2);
            const clen = Math.max(2, Math.floor(ts * 0.35));
            ctx.fillRect(cx3 - arm, cy3 - Math.floor(clen / 2), arm * 2, clen);
            ctx.fillRect(cx3 - Math.floor(clen / 2), cy3 - arm, clen, arm * 2);
          }
        }

        if (building === BUILDING_PARK) {
          ctx.fillStyle = '#0a1a0a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = COLORS.park;
          ctx.fillRect(sxi, syi, tsi, tsi);
          if (ts > 6) {
            // Two tree circles
            ctx.fillStyle = COLORS.parkTree;
            const tr = Math.max(2, Math.floor(ts * 0.22));
            const cx4 = sxi + Math.floor(tsi * 0.35);
            const cy4 = syi + Math.floor(tsi * 0.4);
            ctx.beginPath(); ctx.arc(cx4, cy4, tr, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sxi + Math.floor(tsi * 0.68), cy4, tr, 0, Math.PI * 2); ctx.fill();
          }
        }

        if (!serviced && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          ctx.fillStyle = COLORS.noServicesTint;
          ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
        }

        // Pollution overlay: visible on any non-water tile above a low threshold.
        if (pollutionV > 8 && terrain !== 1) {
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
}
