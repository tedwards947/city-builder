import type { VectorEntity } from '../../SpriteTypes';

/**
 * ShowroomL2: A Level 2 Commercial building.
 * A sleek, modern 1-story showroom.
 */
export const ShowroomL2: VectorEntity = {
  id: 'ShowroomL2',
  type: 'ZONE_2_2',
  tags: ['corporate', 'planned', 'modern', 'showroom'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Dark Modern Foundation
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Main Structure
    const bw = Math.floor(ts * 0.8);
    const bh = Math.floor(ts * 0.5);
    const bx = Math.floor(ts * 0.5 - bw / 2);
    const by = Math.floor(ts * 0.85 - bh);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, bw, bh);

    // 3. Massive Glass Facade (Optimized)
    if (ts > 20) {
        ctx.fillStyle = 'rgba(129, 212, 250, 0.4)';
        const fw = bw - 8;
        const fh = bh - 12;
        ctx.fillRect(bx + 4, by + 4, fw, fh);
        
        // Structural Mullions
        ctx.fillStyle = '#2d3748';
        const mullionW = Math.floor(fw / 3);
        for (let i = 1; i < 3; i++) {
            ctx.fillRect(bx + 4 + i * mullionW, by + 4, 1, fh);
        }

        // 4. Interior Display (Guard for zoom)
        if (ts > 20) {
            const displayColors = ['#e53e3e', '#3182ce', '#38a169'];
            for (let i = 0; i < 3; i++) {
                const dx = Math.floor(bx + 10 + i * (fw / 3.5));
                const dy = Math.floor(by + bh - 12);
                ctx.fillStyle = displayColors[i];
                ctx.fillRect(dx, dy, Math.floor(s * 1.5), Math.floor(s * 0.8));
            }
        }
    }

    // 5. Minimalist Overhanging Roof
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(bx - 4, by - 2, bw + 8, Math.floor(s * 1.2));
    
    // Recessed Lighting (Small yellow dots - Guarded)
    if (ts > 50) {
        ctx.fillStyle = '#ecc94b';
        for (let x = bx; x < bx + bw; x += Math.floor(bw / 4)) {
            ctx.beginPath();
            ctx.arc(x + Math.floor(bw / 8), by + 2, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
  }
};
