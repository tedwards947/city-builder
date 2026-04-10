import type { VectorEntity } from '../../SpriteTypes';

/**
 * DinerDriveThruL2: A Level 2 Commercial building.
 * A 1-story restaurant with a wrap-around drive-thru lane
 * and a tall brand pylon sign.
 */
export const DinerDriveThruL2: VectorEntity = {
  id: 'DinerDriveThruL2',
  type: 'ZONE_2_2',
  tags: ['organic', 'planned', 'restaurant'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.1));
    
    // 1. Lot with Drive-Thru Lane
    ctx.fillStyle = '#333';
    ctx.fillRect(0, Math.floor(ts * 0.3), ts, Math.floor(ts * 0.7));
    // Lane markings
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(inset, Math.floor(ts * 0.35), 2, Math.floor(ts * 0.5));

    // 2. Restaurant Building
    const bw = Math.floor(ts * 0.5);
    const bh = Math.floor(ts * 0.4);
    const bx = Math.floor(ts * 0.4);
    const by = Math.floor(ts * 0.8 - bh);

    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(bx, by, bw, bh);

    // 3. Dining Windows
    ctx.fillStyle = 'rgba(129, 212, 250, 0.6)';
    ctx.fillRect(bx + 4, by + Math.floor(bh * 0.2), bw - 12, Math.floor(bh * 0.4));
    
    // 4. Drive-Thru Window (Side)
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(bx, by + Math.floor(bh * 0.3), 2, Math.floor(bh * 0.3));

    // 5. Slanted Roof (Modern Diner style)
    ctx.fillStyle = '#e53e3e'; // Brand Red
    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.lineTo(bx + bw + 4, by - Math.floor(s));
    ctx.lineTo(bx + bw + 4, by + 2);
    ctx.lineTo(bx - 2, by + 2);
    ctx.fill();

    // 6. Tall Pylon Sign
    const sx = Math.floor(ts * 0.15);
    const sy = Math.floor(ts * 0.1);
    ctx.fillStyle = '#222';
    ctx.fillRect(sx, sy, 2, Math.floor(ts * 0.7)); // Pole
    
    // Sign Board
    ctx.fillStyle = '#e53e3e';
    ctx.fillRect(sx - Math.floor(s * 1.5), sy, Math.floor(s * 3), Math.floor(s * 2.5));
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(s * 1.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('EAT', sx, sy + Math.floor(s * 1.6));
  }
};
