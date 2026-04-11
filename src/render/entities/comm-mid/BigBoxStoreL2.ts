import type { VectorEntity } from '../../SpriteTypes';

/**
 * BigBoxStoreL2: A Level 2 Commercial building.
 * A massive single-story retail warehouse with a prominent 
 * central entrance and large overhead brand sign.
 */
export const BigBoxStoreL2: VectorEntity = {
  id: 'BigBoxStoreL2',
  type: 'ZONE_2_2',
  tags: ['corporate', 'planned', 'retail'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Concrete Foundation
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(0, Math.floor(ts * 0.8), ts, Math.floor(ts * 0.2));

    // 2. Main Box Structure
    const bx = inset;
    const bw = ts - inset * 2;
    const bh = Math.floor(ts * 0.5);
    const by = Math.floor(ts * 0.8 - bh);

    ctx.fillStyle = '#edf2f7'; // Off-white/Silver panels
    ctx.fillRect(bx, by, bw, bh);

    // Vertical Panel Seams
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    for (let x = bx + Math.floor(bw / 4); x < bx + bw; x += Math.floor(bw / 4)) {
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke();
    }

    // 3. Central Entrance Block (Wider and prominent)
    const ew = Math.floor(bw * 0.6); // Increased from 0.4
    const eh = Math.floor(bh * 1.1);
    const ex = Math.floor(ts * 0.5 - ew / 2);
    const ey = Math.floor(ts * 0.8 - eh);

    ctx.fillStyle = '#2b6cb0'; // Brand Blue
    ctx.fillRect(ex, ey, ew, eh);

    // Glass Entrance Doors
    ctx.fillStyle = 'rgba(129, 212, 250, 0.7)';
    ctx.fillRect(ex + Math.floor(ew * 0.3), ey + Math.floor(eh * 0.6), Math.floor(ew * 0.4), Math.floor(eh * 0.4));

    // 4. Brand Sign (On blue block)
    if (ts > 40) {
        ctx.fillStyle = '#ffffff';
        const sw = Math.floor(ew * 0.8);
        const sh = Math.floor(eh * 0.3); // Clear horizontal rectangle
        const sx = Math.floor(ts * 0.5 - sw / 2);
        const sy = Math.floor(ey + eh * 0.15);
        
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, sw, sh);
        
        // Text with robust scaling (50% rule)
        const text = 'MEGA';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let fontSize = Math.floor(sh * 0.6); // Start relative to sign height
        const maxWidth = Math.floor(sw * 0.5); // Strict 50% width rule
        
        ctx.font = `bold ${fontSize}px sans-serif`;
        let metrics = ctx.measureText(text);
        
        let limit = 0;
        while (metrics.width > maxWidth && fontSize > 4 && limit++ < 100) {
            fontSize--;
            ctx.font = `bold ${fontSize}px sans-serif`;
            metrics = ctx.measureText(text);
        }
        
        ctx.fillText(text, Math.floor(ts * 0.5), Math.floor(sy + sh / 2 + 1));
    }

    // 5. Roof HVAC Units
    ctx.fillStyle = '#718096';
    ctx.fillRect(bx + s, by - 2, s * 2, 2);
    ctx.fillRect(bx + bw - s * 3, by - 2, s * 2, 2);
  }
};
