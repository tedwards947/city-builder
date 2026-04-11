import type { VectorEntity } from '../../SpriteTypes';

/**
 * RuralSiloL1: A Level 1 Industrial building.
 * A simple agricultural facility with one concrete silo 
 * and a small metal shed.
 */
export const RuralSiloL1: VectorEntity = {
  id: 'RuralSiloL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'agricultural', 'organic'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.08);
    
    // 1. Foundation
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Concrete Silo
    const sx = Math.floor(ts * 0.2);
    const sw = Math.floor(ts * 0.3);
    const sh = Math.floor(ts * 0.65);
    const sy = Math.floor(ts * 0.85 - sh);
    
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(sx, sy, sw, sh);
    // Dome top
    ctx.beginPath();
    ctx.ellipse(sx + sw / 2, sy, Math.max(0.1, sw / 2), Math.max(0.1, 2), 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Attached Shed
    const bx = sx + sw;
    const bw = Math.floor(ts * 0.35);
    const bh = Math.floor(ts * 0.3);
    const by = Math.floor(ts * 0.85 - bh);
    
    ctx.fillStyle = '#8a9a9a';
    ctx.fillRect(bx, by, bw, bh);
    // Shed Roof
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 2);
    
    // Dark entrance
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx + 4, by + 4, bw - 8, bh - 4);
  }
};
