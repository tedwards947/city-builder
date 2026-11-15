import type { VectorEntity } from '../../SpriteTypes';
import { drawSmoke } from './IndUtils';

/**
 * SmallChemicalPlantL1: A Level 1 Industrial building.
 * A compact chemical processing facility with integrated tanks 
 * and a single rear chimney.
 */
export const SmallChemicalPlantL1: VectorEntity = {
  id: 'SmallChemicalPlantL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'organic', 'plant'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.08);
    
    // Colors
    const bodyColor = p.buildingI[0];
    const roofColor = '#4a4a4a';
    const tankColor = '#718096';
    const pipeColor = '#cbd5e0';

    // 1. Foundation
    ctx.fillStyle = '#333';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Rear Chimney (Background)
    const cx = Math.floor(ts * 0.25);
    const cy = Math.floor(inset);
    const cw = Math.floor(s * 1.5);
    const ch = Math.floor(ts * 0.4);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(cx, cy, cw, ch);
    drawSmoke(ctx, cx + cw / 2, cy, t);

    // 3. Main Processing Block
    const bx = inset;
    const bw = Math.floor(ts * 0.55);
    const bh = Math.floor(ts * 0.45);
    const by = Math.floor(ts * 0.85 - bh);

    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);
    
    // Block Roof
    ctx.fillStyle = roofColor;
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);

    // 4. Integrated Storage Tanks (Right side)
    ctx.fillStyle = tankColor;
    const tankR = Math.floor(s * 1.2);
    for (let i = 0; i < 2; i++) {
        const tx = Math.floor(ts * 0.72);
        const ty = Math.floor(ts * 0.35 + i * (tankR * 2.5));
        
        // Tank Body
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(0.1, tankR), 0, Math.PI * 2);
        ctx.fill();
        
        // Tank Detail (Horizontal band)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx - tankR, ty);
        ctx.lineTo(tx + tankR, ty);
        ctx.stroke();

        // Small pipe connecting tank to main block
        ctx.strokeStyle = pipeColor;
        ctx.beginPath();
        ctx.moveTo(tx - tankR, ty);
        ctx.lineTo(bx + bw, ty);
        ctx.stroke();
    }

    // 5. Facade Details (Vents/Windows)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(bx + Math.floor(s), by + Math.floor(s * 1.5), Math.floor(s * 2), Math.floor(s * 1.5));
    
    // Caution Stripe
    ctx.fillStyle = '#ecc94b';
    ctx.fillRect(bx, Math.floor(ts * 0.85 - 2), bw, 2);
  }
};
