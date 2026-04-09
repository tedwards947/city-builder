import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';
import { TILE_SIZE } from '../../Projection';

// Helper to draw industrial buildings (extracted from CanvasRenderer._drawIndustrial)
function createIndustrialDrawFn(dev: number, isAbandoned: boolean = false): DrawFn {
  return (ctx, x, y, ts, palette, variant) => {
    const zoneColor = palette.zoneI;
    const tsi = ts;

    // Zone base
    if (isAbandoned) {
      ctx.fillStyle = zoneColor;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + 1, y + 1, tsi - 2, tsi - 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = zoneColor;
      ctx.fillRect(x + 1, y + 1, tsi - 2, tsi - 2);
    }

    if (dev === 0) return;

    const bodyColor = isAbandoned ? '#2a2a2a' : palette.buildingI[dev - 1];
    const inset = Math.max(1, Math.floor(ts * 0.15));
    const bx = x + inset;
    const by = y + inset;
    const bw = tsi - inset * 2;
    const bh = tsi - inset * 2;

    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    // Chimneys
    ctx.fillStyle = '#3a3a3a';
    const chimneyCount = dev;
    for (let ci = 0; ci < chimneyCount; ci++) {
      const offset = (variant % 2 === 0) ? 0.2 : 0.1;
      const chX = bx + bw * (offset + ci * 0.3);
      if (chX + bw * 0.15 > bx + bw) break;
      ctx.fillRect(chX, by - bh * 0.15, bw * 0.15, bh * 0.3);
      if (!isAbandoned && ts >= TILE_SIZE) {
        ctx.fillStyle = 'rgba(200,200,200,0.4)';
        ctx.beginPath();
        ctx.arc(chX + bw * 0.07, by - bh * 0.25, bw * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a3a3a';
      }
    }

    ctx.fillStyle = isAbandoned ? '#1a1a1a' : '#4a4a4a';
    const doorW = bw * 0.6;
    ctx.fillRect(bx + (bw - doorW) / 2, by + bh * 0.5, doorW, bh * 0.4);

    if (ts > 10) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const lineCount = dev * 2;
      for (let li = 1; li <= lineCount; li++) {
        const ly = by + (bh / (lineCount + 1)) * li;
        ctx.moveTo(bx, ly);
        ctx.lineTo(bx + bw, ly);
      }
      ctx.stroke();
    }

    // Abandoned overlay
    if (isAbandoned && ts > 6) {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = Math.max(1, ts * 0.06);
      ctx.beginPath();
      const lineInset = Math.max(1, Math.floor(ts * (0.35 - dev * 0.08)));
      ctx.moveTo(x + lineInset, y + lineInset);
      ctx.lineTo(x + tsi - lineInset, y + tsi - lineInset);
      ctx.moveTo(x + tsi - lineInset, y + lineInset);
      ctx.lineTo(x + lineInset, y + tsi - lineInset);
      ctx.stroke();
    }
  };
}

// Register industrial sprites for all dev levels
for (let dev = 0; dev <= 3; dev++) {
  SPRITE_REGISTRY.register({
    id: `i_dev${dev}_fallback`,
    tags: new Set(['zone:I', `dev:${dev}`, 'vibe:any']),
    weight: 1,
    drawFallback: createIndustrialDrawFn(dev, false),
  });

  // Abandoned variants
  if (dev > 0) {
    SPRITE_REGISTRY.register({
      id: `i_dev${dev}_abandoned_fallback`,
      tags: new Set(['zone:I', `dev:${dev}`, 'state:abandoned']),
      weight: 1,
      drawFallback: createIndustrialDrawFn(dev, true),
    });
  }
}
