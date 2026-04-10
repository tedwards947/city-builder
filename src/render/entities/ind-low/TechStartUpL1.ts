import type { VectorEntity } from '../../SpriteTypes';

/**
 * TechStartUpL1: A Level 1 Industrial building.
 * A small high-tech lab or startup facility.
 * Features clean white walls and a large blue glass window.
 */
export const TechStartUpL1: VectorEntity = {
  id: 'TechStartUpL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'high-tech', 'corporate'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.08);
    
    // 1. Foundation
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Main Lab Block
    const bx = inset;
    const bw = Math.floor(ts * 0.7);
    const bh = Math.floor(ts * 0.45);
    const by = Math.floor(ts * 0.85 - bh);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, bw, bh);

    // 3. Large Blue Window
    ctx.fillStyle = 'rgba(66, 153, 225, 0.7)';
    ctx.fillRect(bx + 4, by + 4, bw - 8, bh - 12);

    // 4. Rooftop Vent
    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(bx + s, by - Math.floor(s * 1.2), Math.floor(s * 2), Math.floor(s * 1.2));
    
    // 5. Digital Entrance
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(bx + bw - Math.floor(s * 2), Math.floor(ts * 0.85 - s * 2), Math.floor(s * 1.5), Math.floor(s * 2));
    ctx.fillStyle = '#00ccff';
    ctx.fillRect(bx + bw - Math.floor(s * 2) + 1, Math.floor(ts * 0.85 - s * 1.8), 2, 1);
  }
};
