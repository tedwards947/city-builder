import type { VectorEntity } from '../../SpriteTypes';

/**
 * ModernSupermarketL2: A Level 2 Commercial building.
 * A wide single-story supermarket with a large glass facade,
 * shopping cart corral, and prominent brand signage.
 */
export const ModernSupermarketL2: VectorEntity = {
  id: 'ModernSupermarketL2',
  type: 'ZONE_2_2', // Commercial Level 2
  tags: ['corporate', 'planned', 'retail', 'supermarket'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Foundation / Large Parking Area
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, Math.floor(ts * 0.75), ts, Math.floor(ts * 0.25));
    
    // Shopping Cart Corral (Parking lot detail)
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 1;
    const cx = Math.floor(ts * 0.15);
    const cy = Math.floor(ts * 0.82);
    ctx.strokeRect(cx, cy, Math.floor(s * 2.5), Math.floor(s * 1.2));
    ctx.fillStyle = '#718096';
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(cx + 2 + i * 6, cy + 2, 4, Math.floor(s * 0.8));
    }

    // 2. Main Market Structure
    const bw = ts - inset * 2;
    const bh = Math.floor(ts * 0.5);
    const bx = inset;
    const by = Math.floor(ts * 0.75 - bh);

    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(bx, by, bw, bh);

    // 3. Large Glass Facade
    ctx.fillStyle = 'rgba(129, 212, 250, 0.5)';
    ctx.fillRect(bx + 4, by + Math.floor(bh * 0.2), bw - 8, Math.floor(bh * 0.55));
    
    // Automatic Sliding Doors (Center)
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(bx + Math.floor(bw * 0.4), by + Math.floor(bh * 0.45), Math.floor(bw * 0.2), Math.floor(bh * 0.55));

    // 4. Overhanging Roof / Brand Signage
    ctx.fillStyle = '#38a169'; // Market Green
    ctx.fillRect(bx - 2, by - 2, bw + 4, Math.floor(s * 2));
    
    // Secondary cornice
    ctx.fillStyle = '#276749';
    ctx.fillRect(bx - 4, by + Math.floor(s * 1.5), bw + 8, 2);

    // 5. Brand Sign (On overhanging roof)
    ctx.fillStyle = '#ffffff';
    const signW = Math.floor(bw * 0.6);
    const signH = Math.floor(s * 1.5);
    const sx = Math.floor(ts * 0.5 - signW / 2);
    const sy = Math.floor(by + 1);
    
    // Auto-scaling text (50% rule)
    const text = 'FRESH';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let fontSize = Math.floor(s * 1.2);
    const maxWidth = Math.floor(signW * 0.5);
    ctx.font = `bold ${fontSize}px sans-serif`;
    let metrics = ctx.measureText(text);
    
    while (metrics.width > maxWidth && fontSize > 4) {
        fontSize--;
        ctx.font = `bold ${fontSize}px sans-serif`;
        metrics = ctx.measureText(text);
    }
    
    ctx.fillText(text, Math.floor(ts * 0.5), Math.floor(sy + signH / 2 + 1));

    // 6. Roof HVAC
    ctx.fillStyle = '#a0aec0';
    ctx.fillRect(bx + bw - s * 4, by - s, s * 2, s);
  }
};
