import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';

// Helper to draw commercial buildings (extracted from CanvasRenderer._drawCommercial)
function createCommercialDrawFn(dev: number, isAbandoned: boolean = false): DrawFn {
  return (ctx, x, y, ts, palette, variant) => {
    const zoneColor = palette.zoneC;
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

    const bodyColor = isAbandoned ? '#2a2a2a' : palette.buildingC[dev - 1];
    const inset = Math.max(1, Math.floor(ts * (0.25 - dev * 0.05)));
    const bx = x + inset;
    const by = y + inset;
    const bw = tsi - inset * 2;
    const bh = tsi - inset * 2;

    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx + bw * 0.1, by + bh * 0.7, bw * 0.8, bh * 0.2);

    if (!isAbandoned && ts > 10) {
      ctx.fillStyle = variant % 2 === 0 ? '#e07070' : '#7070e0';
      ctx.fillRect(bx + bw * 0.2, by + bh * 0.1, bw * 0.6, bh * 0.15);
    }

    if (!isAbandoned && ts > 12) {
      ctx.fillStyle = '#80e6ff';
      const winSize = Math.max(1, ts * 0.1);
      for (let row = 0; row < dev + 1; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillRect(bx + bw * (0.15 + col * 0.25), by + bh * (0.3 + row * 0.15), winSize, winSize * 0.8);
        }
      }
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

// Register commercial sprites for all dev levels
for (let dev = 0; dev <= 3; dev++) {
  SPRITE_REGISTRY.register({
    id: `c_dev${dev}_fallback`,
    tags: new Set(['zone:C', `dev:${dev}`, 'vibe:any']),
    weight: 1,
    drawFallback: createCommercialDrawFn(dev, false),
  });

  // Abandoned variants
  if (dev > 0) {
    SPRITE_REGISTRY.register({
      id: `c_dev${dev}_abandoned_fallback`,
      tags: new Set(['zone:C', `dev:${dev}`, 'state:abandoned']),
      weight: 1,
      drawFallback: createCommercialDrawFn(dev, true),
    });
  }
}
