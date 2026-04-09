import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';

// Grass terrain
const drawGrass: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = palette.grass;
  ctx.fillRect(x, y, ts, ts);
};

// Water terrain
const drawWater: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = palette.water;
  ctx.fillRect(x, y, ts, ts);
};

// Sand terrain
const drawSand: DrawFn = (ctx, x, y, ts, palette) => {
  ctx.fillStyle = palette.sand;
  ctx.fillRect(x, y, ts, ts);
};

// Tree drawing (extracted from CanvasRenderer._drawTree)
const drawTreeSpecies1: DrawFn = (ctx, x, y, ts, palette) => {
  const color = palette.treeColors[0];
  ctx.fillStyle = color;

  if (ts < 8) {
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
    return;
  }

  const mid = ts / 2;
  const r = ts * 0.35;
  ctx.beginPath();
  ctx.arc(x + mid, y + mid, r, 0, Math.PI * 2);
  ctx.arc(x + mid * 0.7, y + mid * 0.8, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x + mid * 1.3, y + mid * 1.2, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
};

const drawTreeSpecies2: DrawFn = (ctx, x, y, ts, palette) => {
  const color = palette.treeColors[1] || palette.treeColors[0];
  ctx.fillStyle = color;

  if (ts < 8) {
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
    return;
  }

  const mid = ts / 2;
  const r = ts * 0.35;
  ctx.beginPath();
  ctx.arc(x + mid, y + mid, r, 0, Math.PI * 2);
  ctx.arc(x + mid * 0.7, y + mid * 0.8, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x + mid * 1.3, y + mid * 1.2, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
};

const drawTreeSpecies3: DrawFn = (ctx, x, y, ts, palette) => {
  const color = palette.treeColors[2] || palette.treeColors[0];
  ctx.fillStyle = color;

  if (ts < 8) {
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
    return;
  }

  const mid = ts / 2;
  const bw = ts * 0.7;
  const bh = ts * 0.8;
  ctx.beginPath();
  ctx.moveTo(x + mid, y + ts * 0.1);
  ctx.lineTo(x + mid - bw / 2, y + ts * 0.1 + bh);
  ctx.lineTo(x + mid + bw / 2, y + ts * 0.1 + bh);
  ctx.closePath();
  ctx.fill();
};

const drawTreeSpecies4: DrawFn = (ctx, x, y, ts, palette) => {
  const color = palette.treeColors[3] || palette.treeColors[0];
  ctx.fillStyle = color;

  if (ts < 8) {
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
    return;
  }

  const mid = ts / 2;
  const bw = ts * 0.7;
  const bh = ts * 0.8;
  ctx.beginPath();
  ctx.moveTo(x + mid, y + ts * 0.1);
  ctx.lineTo(x + mid - bw / 2, y + ts * 0.1 + bh);
  ctx.lineTo(x + mid + bw / 2, y + ts * 0.1 + bh);
  ctx.closePath();
  ctx.fill();
};

const drawTreeSpecies5: DrawFn = (ctx, x, y, ts, palette) => {
  const color = palette.treeColors[4] || palette.treeColors[0];
  ctx.fillStyle = color;

  if (ts < 8) {
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
    return;
  }

  const mid = ts / 2;
  const r = ts * 0.25;
  const h = ts * 0.7;
  ctx.beginPath();
  ctx.ellipse(x + mid, y + mid, r, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
};

const drawTreeSpecies6: DrawFn = (ctx, x, y, ts, palette) => {
  const color = palette.treeColors[5] || palette.treeColors[0];
  ctx.fillStyle = color;

  if (ts < 8) {
    ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
    return;
  }

  const mid = ts / 2;
  const r = ts * 0.25;
  const h = ts * 0.7;
  ctx.beginPath();
  ctx.ellipse(x + mid, y + mid, r, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
};

// Register terrain sprites
SPRITE_REGISTRY.register({
  id: 'grass_fallback',
  tags: new Set(['terrain:grass']),
  weight: 1,
  drawFallback: drawGrass,
});

SPRITE_REGISTRY.register({
  id: 'water_fallback',
  tags: new Set(['terrain:water']),
  weight: 1,
  drawFallback: drawWater,
});

SPRITE_REGISTRY.register({
  id: 'sand_fallback',
  tags: new Set(['terrain:sand']),
  weight: 1,
  drawFallback: drawSand,
});

// Register tree sprites
SPRITE_REGISTRY.register({
  id: 'tree_species1_fallback',
  tags: new Set(['vegetation:tree', 'vegetation:species1']),
  weight: 1,
  drawFallback: drawTreeSpecies1,
});

SPRITE_REGISTRY.register({
  id: 'tree_species2_fallback',
  tags: new Set(['vegetation:tree', 'vegetation:species2']),
  weight: 1,
  drawFallback: drawTreeSpecies2,
});

SPRITE_REGISTRY.register({
  id: 'tree_species3_fallback',
  tags: new Set(['vegetation:tree', 'vegetation:species3']),
  weight: 1,
  drawFallback: drawTreeSpecies3,
});

SPRITE_REGISTRY.register({
  id: 'tree_species4_fallback',
  tags: new Set(['vegetation:tree', 'vegetation:species4']),
  weight: 1,
  drawFallback: drawTreeSpecies4,
});

SPRITE_REGISTRY.register({
  id: 'tree_species5_fallback',
  tags: new Set(['vegetation:tree', 'vegetation:species5']),
  weight: 1,
  drawFallback: drawTreeSpecies5,
});

SPRITE_REGISTRY.register({
  id: 'tree_species6_fallback',
  tags: new Set(['vegetation:tree', 'vegetation:species6']),
  weight: 1,
  drawFallback: drawTreeSpecies6,
});
