import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';

// Power Plant (extracted from CanvasRenderer)
const drawPowerPlant: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = palette.powerPlant;
  const pad = Math.max(1, Math.floor(ts * 0.15));
  ctx.fillRect(x + pad, y + pad, ts - pad * 2, ts - pad * 2);
  ctx.fillStyle = palette.powerPlantRoof;
  ctx.fillRect(x + pad, y + pad, ts - pad * 2, Math.max(1, Math.floor(ts * 0.25)));
  ctx.fillStyle = '#ffe680';
  const ppCx = x + Math.floor(ts / 2) - 1;
  const ppCy = y + Math.floor(ts / 2);
  ctx.fillRect(ppCx, ppCy, 2, 2);
};

// Water Tower
const drawWaterTower: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#2a3a3a';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = palette.waterTower;
  const wpad = Math.max(1, Math.floor(ts * 0.2));
  const tankH = Math.max(2, Math.floor(ts * 0.5));
  ctx.fillRect(x + wpad, y + Math.floor(ts * 0.35), ts - wpad * 2, tankH);
  ctx.fillStyle = palette.waterTowerTop;
  ctx.fillRect(x + wpad, y + Math.floor(ts * 0.35), ts - wpad * 2, Math.max(1, Math.floor(ts * 0.12)));
  const legX1 = x + Math.floor(ts * 0.3);
  const legX2 = x + Math.floor(ts * 0.6);
  const legTop = y + Math.floor(ts * 0.35) + tankH;
  ctx.fillStyle = '#4a6a7a';
  ctx.fillRect(legX1, legTop, 1, ts - legTop + y);
  ctx.fillRect(legX2, legTop, 1, ts - legTop + y);
};

// Sewage Plant
const drawSewagePlant: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#2a2a1a';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = palette.sewagePlant;
  const sp = Math.max(1, Math.floor(ts * 0.12));
  ctx.fillRect(x + sp, y + sp, ts - sp * 2, ts - sp * 2);
  ctx.fillStyle = palette.sewagePlantRoof;
  ctx.fillRect(x + sp, y + sp, ts - sp * 2, Math.max(1, Math.floor(ts * 0.2)));
  ctx.fillStyle = '#6a5010';
  const sewCr = Math.max(1, Math.floor(ts * 0.15));
  const sewCx = x + Math.floor(ts / 2);
  const sewCy = y + Math.floor(ts * 0.62);
  ctx.beginPath();
  ctx.arc(sewCx, sewCy, sewCr, 0, Math.PI * 2);
  ctx.fill();
};

// Police Station
const drawPolice: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#1a2a4a';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = palette.police;
  const pp = Math.max(1, Math.floor(ts * 0.12));
  ctx.fillRect(x + pp, y + pp, ts - pp * 2, ts - pp * 2);
  ctx.fillStyle = palette.policeBadge;
  const bw = Math.max(2, Math.floor(ts * 0.3));
  const bh = Math.max(2, Math.floor(ts * 0.35));
  ctx.fillRect(x + Math.floor((ts - bw) / 2), y + Math.floor((ts - bh) / 2), bw, bh);
};

// Fire Station
const drawFire: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#3a1010';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = palette.fire;
  const fp = Math.max(1, Math.floor(ts * 0.12));
  ctx.fillRect(x + fp, y + fp, ts - fp * 2, ts - fp * 2);
  ctx.fillStyle = palette.fireAccent;
  const fw = Math.max(2, Math.floor(ts * 0.25));
  const fireCx = x + Math.floor(ts / 2);
  ctx.fillRect(fireCx - Math.floor(fw / 2), y + Math.floor(ts * 0.2), fw, Math.floor(ts * 0.5));
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(fireCx - Math.max(1, Math.floor(fw * 0.4)), y + Math.floor(ts * 0.35), Math.max(1, Math.floor(fw * 0.8)), Math.floor(ts * 0.3));
};

// School
const drawSchool: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#2a2000';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = palette.school;
  const sp2 = Math.max(1, Math.floor(ts * 0.12));
  ctx.fillRect(x + sp2, y + sp2, ts - sp2 * 2, ts - sp2 * 2);
  ctx.fillStyle = palette.schoolAccent;
  const bw2 = Math.max(2, Math.floor(ts * 0.3));
  ctx.fillRect(x + Math.floor((ts - bw2) / 2), y + Math.floor(ts * 0.1), bw2, Math.max(2, Math.floor(ts * 0.35)));
};

// Hospital
const drawHospital: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#303030';
  ctx.fillRect(x, y, ts, ts);
  ctx.fillStyle = palette.hospital;
  const hp = Math.max(1, Math.floor(ts * 0.12));
  ctx.fillRect(x + hp, y + hp, ts - hp * 2, ts - hp * 2);
  ctx.fillStyle = palette.hospitalCross;
  const arm = Math.max(1, Math.floor(ts * 0.12));
  const hospCx = x + Math.floor(ts / 2);
  const hospCy = y + Math.floor(ts / 2);
  const clen = Math.max(2, Math.floor(ts * 0.35));
  ctx.fillRect(hospCx - arm, hospCy - Math.floor(clen / 2), arm * 2, clen);
  ctx.fillRect(hospCx - Math.floor(clen / 2), hospCy - arm, clen, arm * 2);
};

// Park (extracted from CanvasRenderer._drawPark)
const drawParkVariant0: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = palette.park;
  ctx.fillRect(x, y, ts, ts);

  if (ts < 6) return;

  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x + ts * 0.4, y, ts * 0.2, ts);
  ctx.fillStyle = palette.parkTree;
  const tr = Math.max(2, Math.floor(ts * 0.22));
  ctx.beginPath();
  ctx.arc(x + ts * 0.25, y + ts * 0.3, tr, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + ts * 0.75, y + ts * 0.7, tr, 0, Math.PI * 2);
  ctx.fill();
  if (ts > 12) {
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(x + ts * 0.45, y + ts * 0.5, ts * 0.1, 2);
  }
};

const drawParkVariant1: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(x, y, ts, ts);

  if (ts < 6) return;

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
  const pkCx = x + ts / 2;
  const pkCy = y + ts / 2;
  ctx.fillStyle = '#8aa';
  ctx.fillRect(pkCx - 2, pkCy - 2, 4, 4);
  if (ts > 10) {
    ctx.fillStyle = '#aaf';
    ctx.beginPath();
    ctx.arc(pkCx, pkCy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawParkVariant2: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = palette.park;
  ctx.fillRect(x, y, ts, ts);

  if (ts < 6) return;

  ctx.fillStyle = '#0a3a0a';
  ctx.fillRect(x + 2, y + 2, ts - 4, 2);
  ctx.fillRect(x + 2, y + ts - 4, ts - 4, 2);
  const flowers = ['#f66', '#f6f', '#ff6'];
  const fSize = Math.max(1, ts * 0.08);
  for (let fi = 0; fi < 3; fi++) {
    ctx.fillStyle = flowers[fi % flowers.length];
    ctx.fillRect(x + ts * (0.2 + fi * 0.3), y + ts * 0.5, fSize, fSize);
  }
};

const drawParkVariant3: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = palette.park;
  ctx.fillRect(x, y, ts, ts);

  if (ts < 6) return;

  ctx.fillStyle = '#d2b48c';
  const pad = ts * 0.2;
  ctx.fillRect(x + pad, y + pad, ts - pad * 2, ts - pad * 2);
  if (ts > 8) {
    ctx.fillStyle = '#e55';
    ctx.fillRect(x + ts * 0.3, y + ts * 0.3, ts * 0.1, ts * 0.3);
    ctx.fillStyle = '#55e';
    ctx.fillRect(x + ts * 0.6, y + ts * 0.4, 2, ts * 0.2);
  }
};

const drawParkVariant4: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = palette.park;
  ctx.fillRect(x, y, ts, ts);

  if (ts < 6) return;

  ctx.fillStyle = palette.parkTree;
  const cr = Math.max(2, ts * 0.15);
  ctx.beginPath();
  ctx.arc(x + ts * 0.5, y + ts * 0.5, cr, 0, Math.PI * 2);
  ctx.fill();
};

// Register service building sprites
SPRITE_REGISTRY.register({
  id: 'powerplant_fallback',
  tags: new Set(['building:powerPlant']),
  weight: 1,
  drawFallback: drawPowerPlant,
});

SPRITE_REGISTRY.register({
  id: 'watertower_fallback',
  tags: new Set(['building:waterTower']),
  weight: 1,
  drawFallback: drawWaterTower,
});

SPRITE_REGISTRY.register({
  id: 'sewageplant_fallback',
  tags: new Set(['building:sewagePlant']),
  weight: 1,
  drawFallback: drawSewagePlant,
});

SPRITE_REGISTRY.register({
  id: 'police_fallback',
  tags: new Set(['building:police']),
  weight: 1,
  drawFallback: drawPolice,
});

SPRITE_REGISTRY.register({
  id: 'fire_fallback',
  tags: new Set(['building:fire']),
  weight: 1,
  drawFallback: drawFire,
});

SPRITE_REGISTRY.register({
  id: 'school_fallback',
  tags: new Set(['building:school']),
  weight: 1,
  drawFallback: drawSchool,
});

SPRITE_REGISTRY.register({
  id: 'hospital_fallback',
  tags: new Set(['building:hospital']),
  weight: 1,
  drawFallback: drawHospital,
});

// Register park variants
SPRITE_REGISTRY.register({
  id: 'park_variant0_fallback',
  tags: new Set(['building:park']),
  weight: 1,
  drawFallback: drawParkVariant0,
});

SPRITE_REGISTRY.register({
  id: 'park_variant1_fallback',
  tags: new Set(['building:park']),
  weight: 1,
  drawFallback: drawParkVariant1,
});

SPRITE_REGISTRY.register({
  id: 'park_variant2_fallback',
  tags: new Set(['building:park']),
  weight: 1,
  drawFallback: drawParkVariant2,
});

SPRITE_REGISTRY.register({
  id: 'park_variant3_fallback',
  tags: new Set(['building:park']),
  weight: 1,
  drawFallback: drawParkVariant3,
});

SPRITE_REGISTRY.register({
  id: 'park_variant4_fallback',
  tags: new Set(['building:park']),
  weight: 1,
  drawFallback: drawParkVariant4,
});
