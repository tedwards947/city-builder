import type { VectorEntity } from '../../SpriteTypes';
import { drawSmoke } from './IndUtils';

/**
 * ArtDecoFactory_01: A Level 2 Industrial building.
 * Features a classic Art Deco "Ziggurat" stepped form with vertical window strips
 * and a single, stylized smokestack.
 */
export const ArtDecoFactory_01: VectorEntity = {
  id: 'ArtDecoFactory_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'planned', 'art-deco'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Base dimensions for the main body
    const bx = inset;
    const by = inset + s * 2.5;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Palette Colors
    // Art Deco often used warm ochres, terracotta, or cool grays with metallic accents.
    // We'll use the industrial building colors from the palette as a base.
    const bodyColor = p.buildingI[1]; // Level 2 Industrial color
    const roofColor = p.buildingI[2]; // Level 3 color for darker accents/roof
    const windowColor = 'rgba(30, 40, 50, 0.8)';
    const accentColor = '#e0b060'; // Brass/Gold accent (from buildingI[1] but literal for consistency)

    // 1. Foundation / Platform
    ctx.fillStyle = '#333';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Stylized Art Deco Smokestack (DRAWN BEHIND)
    // Tall, tapered, with a flared decorative top
    const sx = bx + bw * 0.7;
    const sy = inset;
    const sw = s * 1.2;
    const sh = by - inset + s; // Extend it slightly into the building body

    // Stack base
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(sx, sy, sw, sh);
    
    // Decorative bands on stack
    ctx.fillStyle = accentColor;
    ctx.fillRect(sx, sy + sh * 0.3, sw, 1);
    ctx.fillRect(sx, sy + sh * 0.6, sw, 1);

    // Flared top (decorative crown)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy);
    ctx.lineTo(sx + sw + 2, sy);
    ctx.lineTo(sx + sw + 1, sy + 3);
    ctx.lineTo(sx - 1, sy + 3);
    ctx.closePath();
    ctx.fill();

    // 3. Main Body (Stepped Ziggurat Form)
    ctx.fillStyle = bodyColor;
    
    // Bottom Step (Widest)
    ctx.fillRect(bx, by + bh * 0.4, bw, bh * 0.6);
    
    // Middle Step
    ctx.fillRect(bx + bw * 0.1, by + bh * 0.1, bw * 0.8, bh * 0.3);
    
    // Top Step / Central Tower
    ctx.fillRect(bx + bw * 0.25, by - s * 1.5, bw * 0.5, bh * 0.25 + s * 1.5);

    // 4. Vertical Art Deco Details
    // Central vertical column with "ribbed" texture or long windows
    ctx.fillStyle = windowColor;
    const winW = Math.max(1, bw * 0.06);
    const winGap = winW;
    const winXStart = bx + bw * 0.5 - (winW * 1.5 + winGap);
    
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(winXStart + i * (winW + winGap), by - s * 0.5, winW, bh * 0.6);
    }

    // 5. Accent Lines (Horizontal "Speed Lines")
    ctx.fillStyle = accentColor;
    // Lines on the middle step
    ctx.fillRect(bx + bw * 0.1, by + bh * 0.2, bw * 0.15, 1);
    ctx.fillRect(bx + bw * 0.75, by + bh * 0.2, bw * 0.15, 1);
    // Lines on the bottom step
    ctx.fillRect(bx, by + bh * 0.5, bw * 0.1, 1);
    ctx.fillRect(bx + bw * 0.9, by + bh * 0.5, bw * 0.1, 1);

    // 6. Roof Cap
    ctx.fillStyle = roofColor;
    ctx.fillRect(bx + bw * 0.25 - 1, by - s * 1.5, bw * 0.5 + 2, 2);

    // 7. Smoke Animation (DRAWN LAST)
    // Use the utility function from IndUtils
    drawSmoke(ctx, sx + sw / 2, sy, t);
  }
};
