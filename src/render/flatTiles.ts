// The flat, drawn-with-rectangles look of trees, zone buildings and service
// buildings. It is painted into the chunk layer (see chunkPainter.ts) and is
// what shows when a tile is too small for a clay sprite, while the sprites are
// still loading, and where no sprite exists.

import { TILE_SIZE } from './Projection';
import type { ColorPalette } from './CharacterPalette';
import {
  ZONE_R, ZONE_C, ZONE_I,
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';

export function drawFlatTree(ctx: CanvasRenderingContext2D, vegetation: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette): void {
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

/** A utility or service building (anything in the `building` layer). */
export function drawFlatBuilding(ctx: CanvasRenderingContext2D, building: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette, visualVariant: number): void {
  if (building === BUILDING_POWER_PLANT) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(sxi, syi, tsi, tsi);
    ctx.fillStyle = p.powerPlant;
    const pad = Math.max(1, Math.floor(ts * 0.15));
    ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, tsi - pad * 2);
    ctx.fillStyle = p.powerPlantRoof;
    ctx.fillRect(sxi + pad, syi + pad, tsi - pad * 2, Math.max(1, Math.floor(ts * 0.25)));
    ctx.fillStyle = '#ffe680';
    const ppCx = sxi + Math.floor(tsi / 2) - 1;
    const ppCy = syi + Math.floor(tsi / 2);
    ctx.fillRect(ppCx, ppCy, 2, 2);
  } else if (building === BUILDING_WATER_TOWER) {
    ctx.fillStyle = '#2a3a3a';
    ctx.fillRect(sxi, syi, tsi, tsi);
    ctx.fillStyle = p.waterTower;
    const wpad = Math.max(1, Math.floor(ts * 0.2));
    const tankH = Math.max(2, Math.floor(ts * 0.5));
    ctx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, tankH);
    ctx.fillStyle = p.waterTowerTop;
    ctx.fillRect(sxi + wpad, syi + Math.floor(ts * 0.35), tsi - wpad * 2, Math.max(1, Math.floor(ts * 0.12)));
    const legX1 = sxi + Math.floor(ts * 0.3);
    const legX2 = sxi + Math.floor(ts * 0.6);
    const legTop = syi + Math.floor(ts * 0.35) + tankH;
    ctx.fillStyle = '#4a6a7a';
    ctx.fillRect(legX1, legTop, 1, tsi - legTop + syi);
    ctx.fillRect(legX2, legTop, 1, tsi - legTop + syi);
  } else if (building === BUILDING_SEWAGE_PLANT) {
    ctx.fillStyle = '#2a2a1a';
    ctx.fillRect(sxi, syi, tsi, tsi);
    ctx.fillStyle = p.sewagePlant;
    const sp = Math.max(1, Math.floor(ts * 0.12));
    ctx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, tsi - sp * 2);
    ctx.fillStyle = p.sewagePlantRoof;
    ctx.fillRect(sxi + sp, syi + sp, tsi - sp * 2, Math.max(1, Math.floor(ts * 0.2)));
    ctx.fillStyle = '#6a5010';
    const sewCr = Math.max(1, Math.floor(ts * 0.15));
    const sewCx = sxi + Math.floor(tsi / 2);
    const sewCy = syi + Math.floor(tsi * 0.62);
    ctx.beginPath();
    ctx.arc(sewCx, sewCy, Math.max(0.1, sewCr), 0, Math.PI * 2);
    ctx.fill();
  } else if (building === BUILDING_POLICE) {
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(sxi, syi, tsi, tsi);
    ctx.fillStyle = p.police;
    const pp = Math.max(1, Math.floor(ts * 0.12));
    ctx.fillRect(sxi + pp, syi + pp, tsi - pp * 2, tsi - pp * 2);
    ctx.fillStyle = p.policeBadge;
    const bBadgeW = Math.max(2, Math.floor(ts * 0.3));
    const bBadgeH = Math.max(2, Math.floor(ts * 0.35));
    ctx.fillRect(sxi + Math.floor((tsi - bBadgeW) / 2), syi + Math.floor((tsi - bBadgeH) / 2), bBadgeW, bBadgeH);
  } else if (building === BUILDING_FIRE) {
    ctx.fillStyle = '#3a1010';
    ctx.fillRect(sxi, syi, tsi, tsi);
    ctx.fillStyle = p.fire;
    const fp = Math.max(1, Math.floor(ts * 0.12));
    ctx.fillRect(sxi + fp, syi + fp, tsi - fp * 2, tsi - fp * 2);
    ctx.fillStyle = p.fireAccent;
    const fw = Math.max(2, Math.floor(ts * 0.25));
    const fireCx = sxi + Math.floor(tsi / 2);
    ctx.fillRect(fireCx - Math.floor(fw / 2), syi + Math.floor(ts * 0.2), fw, Math.floor(ts * 0.5));
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(fireCx - Math.max(1, Math.floor(fw * 0.4)), syi + Math.floor(ts * 0.35), Math.max(1, Math.floor(fw * 0.8)), Math.floor(ts * 0.3));
  } else if (building === BUILDING_SCHOOL) {
    ctx.fillStyle = '#2a2000';
    ctx.fillRect(sxi, syi, tsi, tsi);
    ctx.fillStyle = p.school;
    const sp2 = Math.max(1, Math.floor(ts * 0.12));
    ctx.fillRect(sxi + sp2, syi + sp2, tsi - sp2 * 2, tsi - sp2 * 2);
    ctx.fillStyle = p.schoolAccent;
    const bw2 = Math.max(2, Math.floor(ts * 0.3));
    ctx.fillRect(sxi + Math.floor((tsi - bw2) / 2), syi + Math.floor(ts * 0.1), bw2, Math.max(2, Math.floor(ts * 0.35)));
  } else if (building === BUILDING_HOSPITAL) {
    ctx.fillStyle = '#303030';
    ctx.fillRect(sxi, syi, tsi, tsi);
    ctx.fillStyle = p.hospital;
    const hp = Math.max(1, Math.floor(ts * 0.12));
    ctx.fillRect(sxi + hp, syi + hp, tsi - hp * 2, tsi - hp * 2);
    ctx.fillStyle = p.hospitalCross;
    const arm = Math.max(1, Math.floor(ts * 0.12));
    const hospCx = sxi + Math.floor(tsi / 2);
    const hospCy = syi + Math.floor(tsi / 2);
    const clen = Math.max(2, Math.floor(ts * 0.35));
    ctx.fillRect(hospCx - arm, hospCy - Math.floor(clen / 2), arm * 2, clen);
    ctx.fillRect(hospCx - Math.floor(clen / 2), hospCy - arm, clen, arm * 2);
  } else if (building === BUILDING_PARK) {
    drawPark(ctx, sxi, syi, tsi, ts, p, visualVariant % 5);
  }
}

export function drawFlatZoneBuilding(ctx: CanvasRenderingContext2D, zone: number, dev: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette, isAbandoned: boolean, variant: number): void {
  const zoneColor = zone === ZONE_R ? p.zoneR : zone === ZONE_C ? p.zoneC : p.zoneI;
  if (isAbandoned) { ctx.fillStyle = zoneColor; ctx.globalAlpha = 0.35; ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2); ctx.globalAlpha = 1; }
  else { ctx.fillStyle = zoneColor; ctx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2); }
  if (dev === 0) return;
  const bldPalette = zone === ZONE_R ? p.buildingR : zone === ZONE_C ? p.buildingC : p.buildingI;
  const bodyColor = isAbandoned ? '#2a2a2a' : bldPalette[Math.min(dev, bldPalette.length) - 1];   // a merged lot's level 4 has no colour of its own
  if (zone === ZONE_R) drawResidential(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
  else if (zone === ZONE_C) drawCommercial(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
  else if (zone === ZONE_I) drawIndustrial(ctx, dev, sxi, syi, tsi, ts, bodyColor, isAbandoned, variant);
  if (isAbandoned && ts > 6) {
    ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1, ts * 0.06); ctx.beginPath();
    const inset = Math.max(1, Math.floor(ts * (0.35 - dev * 0.08)));
    ctx.moveTo(sxi + inset, syi + inset); ctx.lineTo(sxi + tsi - inset, syi + tsi - inset);
    ctx.moveTo(sxi + tsi - inset, syi + inset); ctx.lineTo(sxi + inset, syi + tsi - inset); ctx.stroke();
  }
}

function drawResidential(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
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

function drawCommercial(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
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

function drawPark(ctx: CanvasRenderingContext2D, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette, variant: number): void {
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

function drawIndustrial(ctx: CanvasRenderingContext2D, dev: number, sxi: number, syi: number, tsi: number, ts: number, color: string, isAbandoned: boolean, variant: number): void {
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

/**
 * Placeholder for a merged 2×2 lot (sim/lots.ts) until its art exists: this
 * tile's quarter of one plain slab with a lighter roof. `quarter` is
 * world.layers.lot: 1 NW, 2 NE, 3 SW, 4 SE.
 */
export function drawFlatLotSlice(ctx: CanvasRenderingContext2D, zone: number, quarter: number, sxi: number, syi: number, tsi: number, ts: number, p: ColorPalette, isAbandoned: boolean): void {
  ctx.fillStyle = zone === ZONE_R ? p.zoneR : zone === ZONE_C ? p.zoneC : p.zoneI;
  ctx.fillRect(sxi, syi, tsi, tsi);
  const west = ((quarter - 1) & 1) === 0, north = quarter <= 2;
  const slab = (margin: number, colour: string): void => {
    const x0 = west ? sxi + margin : sxi, x1 = west ? sxi + tsi : sxi + tsi - margin;
    const y0 = north ? syi + margin : syi, y1 = north ? syi + tsi : syi + tsi - margin;
    ctx.fillStyle = colour;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  const walls = zone === ZONE_R ? p.buildingR : zone === ZONE_C ? p.buildingC : p.buildingI;
  slab(Math.max(1, Math.floor(ts * 0.12)), isAbandoned ? '#2a2a2a' : walls[2]);
  if (ts >= 6) slab(Math.max(2, Math.floor(ts * 0.34)), isAbandoned ? '#1a1a1a' : 'rgba(255,255,255,0.25)');
}
