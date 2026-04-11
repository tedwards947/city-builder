import type { VectorEntity } from '../../SpriteTypes';

/**
 * MegaMallL3: A Level 3 Commercial building.
 * A sprawling multi-story shopping complex with a curved modernist facade,
 * integrated glass atrium entrance, and elegant brand signage.
 */
export const MegaMallL3: VectorEntity = {
  id: 'MegaMallL3',
  type: 'ZONE_2_3',
  tags: ['corporate', 'planned', 'retail', 'entertainment'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Parking Structure / Modern Base
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, Math.floor(ts * 0.75), ts, Math.floor(ts * 0.25));
    // Lighting/Vents in base
    ctx.fillStyle = '#4a5568';
    for (let i = 0; i < 6; i++) {
        ctx.fillRect(Math.floor(i * ts / 6 + 4), Math.floor(ts * 0.82), Math.floor(ts / 12), 3);
    }

    // 2. Main Building Body (Tiered/Curved Look)
    const bw = ts - inset * 2;
    const bh = Math.floor(ts * 0.55);
    const bx = inset;
    const by = Math.floor(ts * 0.75 - bh);

    ctx.fillStyle = '#fdfdfd'; // Ultra-clean white
    ctx.fillRect(bx, by, bw, bh);

    // Architectural Panel Lines
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    for (let x = bx + Math.floor(bw / 4); x < bx + bw; x += Math.floor(bw / 4)) {
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke();
    }

    // 3. Central Feature Atrium (Recessed Entrance)
    const aw = Math.floor(bw * 0.35);
    const ax = Math.floor(ts * 0.5 - aw / 2);
    
    // Dark Recess
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(ax, by, aw, bh);
    
    // Glass Atrium
    ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
    ctx.fillRect(ax + 4, by + 4, aw - 8, bh - 4);
    
    // Atrium Structural detail
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    for (let y = by + 10; y < by + bh; y += 10) {
        ctx.moveTo(ax + 4, y); ctx.lineTo(ax + aw - 4, y);
    }
    ctx.stroke();

    // 4. Elegant Brand Signage (Row of smaller logos)
    const logoColors = ['#e53e3e', '#2b6cb0', '#38a169', '#d69e2e'];
    const logoSize = Math.floor(s * 1.5);
    const logoY = by + Math.floor(bh * 0.2);
    
    // Left side logos
    for (let i = 0; i < 2; i++) {
        ctx.fillStyle = logoColors[i];
        ctx.fillRect(bx + Math.floor(s) + i * (logoSize + 4), logoY, logoSize, logoSize);
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx + Math.floor(s) + i * (logoSize + 4) + 2, logoY + 2, logoSize - 4, 1.5);
    }
    
    // Right side logos
    for (let i = 0; i < 2; i++) {
        ctx.fillStyle = logoColors[i + 2];
        ctx.fillRect(ts - inset - Math.floor(s) - logoSize - i * (logoSize + 4), logoY, logoSize, logoSize);
        ctx.fillStyle = '#fff';
        ctx.fillRect(ts - inset - Math.floor(s) - logoSize - i * (logoSize + 4) + 2, logoY + 2, logoSize - 4, 1.5);
    }

    // 5. Decorative Overhanging Roof
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(bx - 2, by - 2, bw + 4, Math.floor(s * 1.2));
    
    // Accent Line
    ctx.fillStyle = '#3182ce';
    ctx.fillRect(bx - 2, by + Math.floor(s * 0.8), bw + 4, 2);

    // 6. Modern Entrance Canopy
    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(Math.floor(ts * 0.4), Math.floor(ts * 0.7), Math.floor(ts * 0.2), Math.floor(s * 0.8));
  }
};
