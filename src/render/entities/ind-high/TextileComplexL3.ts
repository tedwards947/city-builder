import type { VectorEntity } from '../../SpriteTypes';
import { drawSmoke } from '../ind-low/IndUtils';

/**
 * TextileComplexL3_01: A Level 3 Industrial building.
 * A massive multi-wing brick textile mill.
 * Features a grand central structure, a single tall brick smokestack,
 * and twin rooftop water towers.
 */
export const TextileComplexL3_01: VectorEntity = {
  id: 'TextileComplexL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'organic', 'brick', 'historic', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Colors
    const brickColor = '#a03020';
    const darkerBrick = '#702010';
    const windowColor = 'rgba(40, 50, 60, 0.9)';
    const towerColor = '#506070';

    // 1. Foundation
    ctx.fillStyle = '#333';
    ctx.fillRect(0, ts * 0.9, ts, ts * 0.1);

    // 2. Large Brick Smokestack (Drawn behind)
    ctx.fillStyle = darkerBrick;
    const sx = ts * 0.8;
    ctx.fillRect(sx - s, ts * 0.1, s * 2, ts * 0.8);
    drawSmoke(ctx, sx, ts * 0.1, t);

    // 3. Main Building Complex (Three Tiered Blocks)
    ctx.fillStyle = brickColor;
    const bx = inset, bw = ts - inset * 2;
    
    // Side Wings (Lower)
    ctx.fillRect(bx, ts * 0.5, bw, ts * 0.4);
    
    // Central Block (Taller)
    ctx.fillRect(bx + bw * 0.2, ts * 0.3, bw * 0.6, ts * 0.6);
    
    // 4. Rooftop Water Towers (Twin)
    ctx.fillStyle = towerColor;
    const wtSize = s * 1.5;
    for (let i = 0; i < 2; i++) {
        const wtx = ts * (0.3 + i * 0.4) - wtSize/2;
        const wty = ts * 0.3 - wtSize;
        ctx.fillRect(wtx, wty, wtSize, wtSize);
        // Legs
        ctx.strokeStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(wtx, wty + wtSize); ctx.lineTo(wtx, ts * 0.3);
        ctx.moveTo(wtx + wtSize, wty + wtSize); ctx.lineTo(wtx + wtSize, ts * 0.3);
        ctx.stroke();
    }

    // 5. Regular Window Grid (Simplified)
    ctx.fillStyle = windowColor;
    const winW = s;
    const winH = s * 1.5;
    // Central windows
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
            ctx.fillRect(bx + bw * 0.25 + c * (bw * 0.12), ts * 0.4 + r * (ts * 0.2), winW, winH);
        }
    }
    // Wing windows
    for (let c = 0; c < 2; c++) {
        ctx.fillRect(bx + s + c * (bw * 0.7), ts * 0.6, winW, winH);
    }

    // 6. Cornice Details
    ctx.fillStyle = darkerBrick;
    ctx.fillRect(bx + bw * 0.2 - 2, ts * 0.3, bw * 0.6 + 4, 3);
    ctx.fillRect(bx - 1, ts * 0.5, bw + 2, 2);
  }
};
