import type { VectorEntity } from '../../SpriteTypes';

/**
 * PharmaCompany_01: A Level 2 Industrial building.
 * A modern, high-tech pharmaceutical facility.
 * Features clean white walls, large blue glass surfaces, and 
 * specialized ventilation equipment.
 */
export const PharmaCompany_01: VectorEntity = {
  id: 'PharmaCompany_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'corporate', 'high-tech', 'pharma'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Dimensions
    const bx = inset;
    const by = inset + s * 2;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Colors
    const wallColor = '#f0f0f0'; // Clean white
    const glassColor = 'rgba(100, 180, 255, 0.7)'; // Bright blue glass
    const metalColor = '#a0a0b0';
    const accentColor = '#3060c0'; // Corporate blue

    // 1. Foundation / Modern Landscaping
    ctx.fillStyle = '#555';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);
    // Blue accent line at base
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, ts * 0.85, ts, 2);

    // 2. Main Building (Modernist split-level)
    ctx.fillStyle = wallColor;
    // Left Block (Main Lab)
    ctx.fillRect(bx, by, bw * 0.6, bh);
    // Right Block (Office/Admin - slightly offset)
    ctx.fillRect(bx + bw * 0.6, by + s, bw * 0.4, bh - s);

    // 3. Glass Facade (Ribbon Windows)
    ctx.fillStyle = glassColor;
    // Main Lab Windows (High, thin windows)
    ctx.fillRect(bx + s, by + s, bw * 0.5, s * 1.5);
    ctx.fillRect(bx + s, by + s * 4, bw * 0.5, s * 1.5);
    
    // Admin Entrance Glass
    ctx.fillRect(bx + bw * 0.65, by + s * 2.5, bw * 0.3, bh - s * 2.5);

    // 4. "Clean Room" Ventilation Units (Roof)
    ctx.fillStyle = metalColor;
    const unitSize = s * 1.5;
    // Specialized high-efficiency units
    for (let i = 0; i < 2; i++) {
      const ux = bx + s + i * (unitSize + s);
      const uy = by - unitSize + 2;
      ctx.fillRect(ux, uy, unitSize, unitSize);
      
      // Small exhaust pipes (angled)
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ux + unitSize / 2, uy);
      ctx.lineTo(ux + unitSize / 2 + 2, uy - 4);
      ctx.stroke();
    }

    // 5. High-Tech Details
    // Decorative "blue" trim
    ctx.fillStyle = accentColor;
    ctx.fillRect(bx, by, bw * 0.6, 2);
    ctx.fillRect(bx + bw * 0.6, by + s, bw * 0.4, 2);

    // Subtle panel lines
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.3, by);
    ctx.lineTo(bx + bw * 0.3, by + bh);
    ctx.stroke();

    // 6. Corporate Logo/Sign (Abstract)
    ctx.fillStyle = accentColor;
    const lx = bx + bw * 0.7;
    const ly = by + s * 2.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(lx + 3, ly - 1, 6, 2);
  }
};
