import type { VectorEntity } from '../../SpriteTypes';

/**
 * MixedUseL2: A Level 2 Commercial building.
 * A 2-story commercial building with ground-floor retail and 
 * upper-floor office space.
 */
export const MixedUseL2: VectorEntity = {
  id: 'MixedUseL2',
  type: 'ZONE_2_2',
  tags: ['neutral', 'planned', 'urban'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.1);
    
    // 1. Foundation
    ctx.fillStyle = '#444';
    ctx.fillRect(0, Math.floor(ts * 0.9), ts, Math.floor(ts * 0.1));

    // 2. Main Body (2 stories)
    const bw = ts - inset * 2;
    const bh = Math.floor(ts * 0.7);
    const bx = inset;
    const by = Math.floor(ts * 0.9 - bh);

    ctx.fillStyle = '#ffffff'; // White modernist facade
    ctx.fillRect(bx, by, bw, bh);

    // 3. Ground Floor Retail (Glass heavy)
    ctx.fillStyle = 'rgba(80, 160, 240, 0.6)';
    ctx.fillRect(bx + 4, by + Math.floor(bh * 0.6), bw - 8, Math.floor(bh * 0.35));
    
    // Retail Entrance
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(bx + Math.floor(bw * 0.45), by + Math.floor(bh * 0.7), Math.floor(bw * 0.15), Math.floor(bh * 0.25));

    // 4. Second Floor Office (Regular windows)
    const winW = Math.floor(bw / 4);
    const winH = Math.floor(bh * 0.25);
    for (let i = 0; i < 3; i++) {
        const wx = bx + Math.floor(s * 0.5) + i * (winW + Math.floor(s * 0.5));
        ctx.fillStyle = 'rgba(129, 212, 250, 0.4)';
        ctx.fillRect(wx, by + Math.floor(s), winW, winH);
        // Window frames
        ctx.strokeStyle = '#cbd5e0';
        ctx.strokeRect(wx, by + Math.floor(s), winW, winH);
    }

    // 5. Architectural Details
    ctx.fillStyle = '#3182ce'; // Blue accent band
    ctx.fillRect(bx, by + Math.floor(bh * 0.5), bw, 2);
    
    // Cornice
    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);
  }
};
