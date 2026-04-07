// Canvas 2D renderer. The Renderer interface is: render(world, camera, hoverTile).
// A PixiRenderer / WebGLRenderer can be dropped in without touching game code.

import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { Projection, TILE_SIZE } from './Projection';
import { resolvePalette } from './CharacterPalette';
import { BALANCE } from '../data/balance';
import {
  TERRAIN_GRASS, TERRAIN_WATER,
  ZONE_NONE, ZONE_R, ZONE_C,
  ROAD_NONE, ROAD_AVENUE, ROAD_HIGHWAY,
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

  render(world: World, camera: Camera, hoverTile: { tx: number; ty: number } | null, trafficOverlay = false, serviceCoveragePreview: Set<number> | null = null): void {
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

        if (zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
          if (isAbandoned) {
            // Abandoned: dim zone patch + dark derelict building + boarded-up X marks.
            const zoneColor = zone === ZONE_R ? p.zoneR : zone === ZONE_C ? p.zoneC : p.zoneI;
            ctx.fillStyle = zoneColor;
            ctx.globalAlpha = 0.35;
            ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
            ctx.globalAlpha = 1;
            if (dev > 0) {
              const inset = Math.max(1, Math.floor(ts * (0.35 - dev * 0.08)));
              const bx = sxi + inset, by = syi + inset;
              const bw = tsi - inset * 2, bh = tsi - inset * 2;
              // Derelict building body — dark gray
              ctx.fillStyle = '#2a2a2a';
              ctx.fillRect(bx, by, bw, bh);
              // Boarded-up X — two diagonal lines in lighter gray
              if (ts > 6) {
                ctx.strokeStyle = '#555';
                ctx.lineWidth = Math.max(1, ts * 0.06);
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + bw, by + bh);
                ctx.moveTo(bx + bw, by);
                ctx.lineTo(bx, by + bh);
                ctx.stroke();
              }
            }
          } else {
            const zoneColor = zone === ZONE_R ? p.zoneR : zone === ZONE_C ? p.zoneC : p.zoneI;
            ctx.fillStyle = zoneColor;
            ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
            if (dev > 0) {
              const bldPalette = zone === ZONE_R ? p.buildingR : zone === ZONE_C ? p.buildingC : p.buildingI;
              ctx.fillStyle = bldPalette[dev - 1];
              const inset = Math.max(1, Math.floor(ts * (0.35 - dev * 0.08)));
              ctx.fillRect(sxi + inset, syi + inset, tsi - inset * 2, tsi - inset * 2);
            }
          }
        }

        if (road !== ROAD_NONE) {
          if (trafficOverlay) {
            const cong = world.layers.congestion[i];
            const t = cong / 255;
            let r: number, g: number;
            if (t <= 0.5) {
              r = Math.round(t * 2 * 220);
              g = 180 + Math.round(t * 2 * 20);
            } else {
              r = 220;
              g = Math.round(200 * (1 - (t - 0.5) * 2));
            }
            ctx.fillStyle = `rgb(${r},${g},0)`;
          } else if (road === ROAD_HIGHWAY) {
            ctx.fillStyle = p.roadHighway;
          } else if (road === ROAD_AVENUE) {
            ctx.fillStyle = p.roadAvenue;
          } else {
            ctx.fillStyle = p.road;
          }
          ctx.fillRect(sxi, syi, tsi, tsi);

          if (ts > 6) {
            const overlayMark = trafficOverlay ? 'rgba(0,0,0,0.25)' : null;
            if (road === ROAD_HIGHWAY) {
              ctx.fillStyle = overlayMark ?? p.roadHighwayLine;
              ctx.fillRect(sxi + Math.floor(ts * 0.45), syi, 1, tsi);
              ctx.fillRect(sxi, syi + Math.floor(ts * 0.45), tsi, 1);
            } else if (road === ROAD_AVENUE) {
              ctx.fillStyle = overlayMark ?? p.roadAvenueEdge;
              ctx.fillRect(sxi + Math.floor(ts * 0.15), syi, 1, tsi);
              ctx.fillRect(sxi + Math.floor(ts * 0.80), syi, 1, tsi);
              ctx.fillRect(sxi, syi + Math.floor(ts * 0.15), tsi, 1);
              ctx.fillRect(sxi, syi + Math.floor(ts * 0.80), tsi, 1);
            } else {
              ctx.fillStyle = overlayMark ?? p.roadEdge;
              ctx.fillRect(sxi + Math.floor(ts * 0.45), syi, 1, tsi);
              ctx.fillRect(sxi, syi + Math.floor(ts * 0.45), tsi, 1);
            }
          }
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
          ctx.fillStyle = '#0a1a0a';
          ctx.fillRect(sxi, syi, tsi, tsi);
          ctx.fillStyle = p.park;
          ctx.fillRect(sxi, syi, tsi, tsi);
          if (ts > 6) {
            ctx.fillStyle = p.parkTree;
            const tr = Math.max(2, Math.floor(ts * 0.22));
            const cx4 = sxi + Math.floor(tsi * 0.35);
            const cy4 = syi + Math.floor(tsi * 0.4);
            ctx.beginPath(); ctx.arc(cx4, cy4, tr, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sxi + Math.floor(tsi * 0.68), cy4, tr, 0, Math.PI * 2); ctx.fill();
          }
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
}
