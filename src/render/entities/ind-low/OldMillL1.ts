import type { VectorEntity } from '../../SpriteTypes';

/**
 * OldMillL1: A Level 1 Industrial building.
 * A compact 2-story brick mill with a rooftop water tank.
 */
export const OldMillL1: VectorEntity = {
  id: 'OldMillL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'organic', 'brick', 'historic'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.08);
    const bodyColor = '#b04030';
    const darkerBrick = '#803020';

    // 1. Foundation
    ctx.fillStyle = '#444';
    ctx.fillRect(0, Math.floor(ts * 0.9), ts, ts * 0.1);

    // 2. Brick Body
    const bx = inset;
    const bw = Math.floor(ts * 0.65);
    const bh = Math.floor(ts * 0.55);
    const by = Math.floor(ts * 0.9 - bh);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Window Grid (2x2)
    ctx.fillStyle = 'rgba(40, 50, 60, 0.9)';
    const winW = Math.floor(bw / 3);
    const winH = Math.floor(bh / 3.5);
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            ctx.fillRect(bx + s + c * (winW + s), by + s + r * (winH + s), winW, winH);
        }
    }

    // 4. Rooftop Water Tank (Fixed floating position and legs)
    const tw = Math.floor(s * 1.5);
    const tx = bx + bw - tw - Math.floor(s * 0.5);
    const ty = by - tw - Math.floor(s * 0.5); // Slightly above roof
    
    // Legs - Must reach roof at 'by'
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx + 1, ty + tw); ctx.lineTo(tx + 1, by);
    ctx.moveTo(tx + tw - 1, ty + tw); ctx.lineTo(tx + tw - 1, by);
    ctx.stroke();

    // Tank Body
    ctx.fillStyle = '#506070';
    ctx.fillRect(tx, ty, tw, tw);

    // 5. Cornice
    ctx.fillStyle = darkerBrick;
    ctx.fillRect(bx - 1, by, bw + 2, 2);
  }
};
