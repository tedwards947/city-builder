import type { VectorEntity } from '../../SpriteTypes';

/**
 * FlatTopFactoryL1: A Level 1 Industrial building.
 * A simple factory with a flat roof, loading dock, and parking area.
 */
export const FlatTopFactoryL1: VectorEntity = {
  id: 'FlatTopFactoryL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'utilitarian'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    const bx = inset, by = inset + s * 2;
    const bw = ts - inset * 2, bh = ts - by - inset;

    const bodyColor = p.buildingI[0];
    const roofColor = '#555';

    // 1. Parking Area / Concrete Pad
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, ts * 0.75, ts, ts * 0.25);

    // 2. Main Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Flat Roof
    ctx.fillStyle = roofColor;
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);

    // 4. Loading Dock
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx + bw * 0.6, by + bh * 0.5, bw * 0.35, bh * 0.5);
    ctx.fillStyle = '#ffa500';
    ctx.fillRect(bx + bw * 0.62, by + bh * 0.52, bw * 0.3, 2);

    // 5. Small Vents (Roof)
    ctx.fillStyle = '#333';
    ctx.fillRect(bx + s, by - s, s, s);
  }
};
