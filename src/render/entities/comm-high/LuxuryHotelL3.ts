import type { VectorEntity } from '../../SpriteTypes';

/**
 * LuxuryHotelL3: A Level 3 Commercial building.
 * A tall, grand hotel featuring tiered glass architecture,
 * a rooftop helipad, and a prominent lit entrance.
 */
export const LuxuryHotelL3: VectorEntity = {
  id: 'LuxuryHotelL3',
  type: 'ZONE_2_3', // Commercial Level 3
  tags: ['corporate', 'planned', 'luxury', 'tourism'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Foundation / Grand Plaza
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Main Tower (Tiered)
    const bw = ts - inset * 4;
    const bx = inset * 2;
    
    // Bottom Tier (Base)
    ctx.fillStyle = '#f7fafc';
    const by1 = Math.floor(ts * 0.5);
    const bh1 = Math.floor(ts * 0.35);
    ctx.fillRect(bx, by1, bw, bh1);
    
    // Middle Tier
    ctx.fillStyle = '#edf2f7';
    const by2 = Math.floor(ts * 0.25);
    const bh2 = Math.floor(ts * 0.25) + 1; // +1 for overlap
    ctx.fillRect(bx + Math.floor(s), by2, bw - Math.floor(s * 2), bh2);
    
    // Top Tier
    ctx.fillStyle = '#ffffff';
    const by3 = Math.floor(ts * 0.05);
    const bh3 = Math.floor(ts * 0.2) + 1; // +1 for overlap
    ctx.fillRect(bx + Math.floor(s * 2), by3, bw - Math.floor(s * 4), bh3);

    // 3. Glass Facade (Blue tint)
    ctx.fillStyle = 'rgba(66, 153, 225, 0.6)';
    // Windows on all tiers
    ctx.fillRect(bx + 4, by1 + 4, bw - 8, Math.floor(bh1 * 0.6));
    ctx.fillRect(bx + Math.floor(s) + 4, by2 + 4, bw - Math.floor(s * 2) - 8, Math.floor(bh2 * 0.6));
    ctx.fillRect(bx + Math.floor(s * 2) + 4, by3 + 4, bw - Math.floor(s * 4) - 8, Math.floor(bh3 * 0.6));

    // 4. Rooftop Helipad (Performance Guard)
    if (ts > 20) {
        const hx = Math.floor(ts * 0.5);
        const hy = Math.floor(ts * 0.05);
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.arc(hx, hy, s * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, s * 1.2, 0, Math.PI * 2);
        ctx.stroke();
        // "H" letter
        ctx.font = `bold ${Math.floor(s)}px sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', hx, hy);
    }

    // 5. Grand Entrance (Lit, Centered, Touches base)
    const ew = Math.floor(bw * 0.4); // Lit marquee/canopy
    const eh = Math.floor(ts * 0.12);
    const ex = Math.floor(ts * 0.5 - ew / 2);
    const ey = Math.floor(ts * 0.85 - eh);

    ctx.fillStyle = '#ecc94b'; // Warm light
    ctx.fillRect(ex, ey, ew, eh);
    
    // Dark door insert (Narrower and justified to the bottom/foundation)
    const dw = Math.floor(ew * 0.35);
    const dh = Math.floor(eh * 0.7);
    const dx = Math.floor(ts * 0.5 - dw / 2);
    const dy = Math.floor(ts * 0.85 - dh);
    
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(dx, dy, dw, dh);
  }
};
