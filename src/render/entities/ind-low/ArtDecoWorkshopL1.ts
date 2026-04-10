import type { VectorEntity } from '../../SpriteTypes';
import { drawSmoke } from './IndUtils';

/**
 * ArtDecoWorkshopL1: A Level 1 Industrial building.
 * A miniature Art Deco facility featuring a single stepped facade
 * and a stylized rear smokestack.
 */
export const ArtDecoWorkshopL1: VectorEntity = {
  id: 'ArtDecoWorkshopL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'planned', 'art-deco'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.08);
    const bodyColor = p.buildingI[0];
    const accentColor = '#e0b060';

    // 1. Foundation
    ctx.fillStyle = '#222';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Rear Stack (Background - Moved left slightly)
    const sx = Math.floor(ts * 0.55);
    const sy = Math.floor(inset);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(sx, sy, Math.floor(s * 1.2), Math.floor(ts * 0.4));

    // 3. Stepped Facade
    const bx = inset;
    const bw = Math.floor(ts * 0.6);
    const bh = Math.floor(ts * 0.5);
    const by = Math.floor(ts * 0.85 - bh);

    ctx.fillStyle = bodyColor;
    // Main Block
    ctx.fillRect(bx, by, bw, bh);
    // Upper Step
    ctx.fillRect(bx + Math.floor(s), by - Math.floor(s), Math.floor(bw - s * 2), Math.floor(s));

    // 4. Vertical Art Deco Lines
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(bx + Math.floor(bw / 2 - 1), by + Math.floor(s), 2, Math.floor(bh - s * 2));

    // 5. Brass Accents
    ctx.fillStyle = accentColor;
    ctx.fillRect(bx, by, bw, 1);
    ctx.fillRect(bx + Math.floor(s), by - Math.floor(s), Math.floor(bw - s * 2), 1);

    // 6. Smoke (Foreground)
    drawSmoke(ctx, sx + s * 0.6, sy, t);
  }
};
