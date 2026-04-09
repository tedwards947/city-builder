import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';

// Helper to draw residential buildings (extracted from CanvasRenderer._drawResidential)
function createResidentialDrawFn(dev: number, isAbandoned: boolean = false): DrawFn {
  return (ctx, x, y, ts, palette, variant) => {
    const zoneColor = palette.zoneR;
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

    const bodyColor = isAbandoned ? '#2a2a2a' : palette.buildingR[dev - 1];
    const inset = Math.max(1, Math.floor(ts * (0.32 - dev * 0.06)));
    const bx = x + inset;
    const by = y + inset;
    const bw = tsi - inset * 2;
    const bh = tsi - inset * 2;

    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    const roofColors = isAbandoned ? ['#1a1a1a'] : ['#5a3a2a', '#3a4a5a', '#7a4a3a', '#4a5a4a'];
    ctx.fillStyle = roofColors[variant % roofColors.length];

    if (dev === 1) {
      if (variant % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(bx - 1, by + bh * 0.5);
        ctx.lineTo(bx + bw / 2, by - 1);
        ctx.lineTo(bx + bw + 1, by + bh * 0.5);
        ctx.fill();
      } else {
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.4);
      }
      if (!isAbandoned && variant % 3 === 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(bx + bw * 0.7, by - 2, 2, 4);
      }
    } else if (dev === 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(bx + bw * 0.45, by, bw * 0.1, bh);
      ctx.fillStyle = roofColors[(variant + 1) % roofColors.length];
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.25);
      if (!isAbandoned) {
        ctx.fillStyle = '#444';
        ctx.fillRect(bx + bw * 0.2, by + bh * 0.4, bw * 0.6, 1);
      }
    } else {
      ctx.fillStyle = roofColors[variant % roofColors.length];
      ctx.fillRect(bx, by, bw, bh * 0.15);
      ctx.fillStyle = bodyColor;
      const pW = bw * 0.5;
      const pH = bh * 0.3;
      ctx.fillRect(bx + (bw - pW) / 2, by - pH * 0.4, pW, pH);
      ctx.fillStyle = '#222';
      ctx.fillRect(bx + (bw - pW) / 2, by - pH * 0.4, pW, 2);
    }

    ctx.fillStyle = isAbandoned ? '#111' : '#3d2b1f';
    const doorW = Math.max(2, bw * 0.2);
    const doorH = Math.max(3, bh * 0.3);
    ctx.fillRect(bx + (bw - doorW) / 2, by + bh - doorH, doorW, doorH);

    if (!isAbandoned && ts > 12) {
      const winColor = '#ffe680';
      const winSize = Math.max(1, ts * 0.08);
      ctx.fillStyle = winColor;
      if (dev === 1) {
        ctx.fillRect(bx + bw * 0.2, by + bh * 0.55, winSize, winSize);
        ctx.fillRect(bx + bw * 0.7, by + bh * 0.55, winSize, winSize);
      } else {
        const rows = dev + 1;
        const cols = 2 + (variant % 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((variant + r + c) % 5 === 0) continue;
            const wx = bx + (bw / (cols + 1)) * (c + 1) - winSize / 2;
            const wy = by + (bh / (rows + 1)) * (r + 1) - winSize / 2;
            if (wy > by + bh - doorH - 2 && wx > bx + (bw - doorW) / 2 - 2 && wx < bx + (bw + doorW) / 2 + 2) continue;
            ctx.fillRect(wx, wy, winSize, winSize);
            if (ts > 20) {
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.fillRect(wx, wy + winSize, winSize, 1);
              ctx.fillStyle = winColor;
            }
          }
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

// Register residential sprites for all dev levels
for (let dev = 0; dev <= 3; dev++) {
  SPRITE_REGISTRY.register({
    id: `r_dev${dev}_fallback`,
    tags: new Set(['zone:R', `dev:${dev}`, 'vibe:any']),
    weight: 1,
    drawFallback: createResidentialDrawFn(dev, false),
  });

  // Abandoned variants
  if (dev > 0) {
    SPRITE_REGISTRY.register({
      id: `r_dev${dev}_abandoned_fallback`,
      tags: new Set(['zone:R', `dev:${dev}`, 'state:abandoned']),
      weight: 1,
      drawFallback: createResidentialDrawFn(dev, true),
    });
  }
}
