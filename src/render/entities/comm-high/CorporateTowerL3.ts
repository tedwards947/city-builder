import type { VectorEntity } from '../../SpriteTypes';

/**
 * CorporateTowerL3: A Level 3 Commercial building.
 * A tall, monolithic glass skyscraper.
 */
export const CorporateTowerL3: VectorEntity = {
  id: 'CorporateTowerL3',
  type: 'ZONE_2_3',
  tags: ['corporate', 'planned', 'office'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.15);
    
    // 1. Concrete Base
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Main Glass Tower
    const bw = ts - inset * 2;
    const bh = Math.floor(ts * 0.75);
    const bx = inset;
    const by = Math.floor(ts * 0.85 - bh);

    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(bx, by, bw, bh);

    // Glass Facade (Dark blue monolithic)
    ctx.fillStyle = '#2c5282';
    ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 2);

    // Facade Grid (Performance Guard)
    if (ts > 40) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        for (let x = bx + 4; x < bx + bw; x += Math.floor(bw / 4)) {
            ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.lineTo(x, by + bh); ctx.stroke();
        }
        for (let y = by + 4; y < by + bh; y += Math.floor(bh / 10)) {
            ctx.beginPath(); ctx.moveTo(bx + 2, y); ctx.lineTo(bx + bw - 2, y); ctx.stroke();
        }
    }

    // 3. Tower Spire
    ctx.fillStyle = '#4a5568';
    const sx = Math.floor(ts * 0.5 - 1);
    const spireH = Math.floor(ts * 0.1);
    const sy = Math.floor(by - spireH);
    ctx.fillRect(sx, sy, 2, spireH + 2);
    
    // Spire Glow (Performance Guard)
    if (ts > 40 && Math.sin(t * 5) > 0) {
        ctx.fillStyle = '#f56565';
        ctx.beginPath();
        ctx.arc(ts * 0.5, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 4. Status Lights (Blue glow - Optimized)
    if (ts > 30) {
        ctx.fillStyle = '#63b3ed';
        for (let i = 0; i < 3; i++) {
            const ly = by + Math.floor(bh * (0.2 + i * 0.3));
            ctx.fillRect(bx - 1, ly, 2, 2);
            ctx.fillRect(bx + bw - 1, ly, 2, 2);
        }
    }
  }
};
