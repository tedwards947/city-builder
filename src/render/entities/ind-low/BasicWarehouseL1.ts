import type { VectorEntity } from '../../SpriteTypes';

/**
 * BasicWarehouseL1: A Level 1 Industrial building.
 * A simple warehouse with multiple loading bays and a flat roof.
 */
export const BasicWarehouseL1: VectorEntity = {
  id: 'BasicWarehouseL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'utilitarian', 'warehouse'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    const bx = inset, by = inset + s * 1.5;
    const bw = ts - inset * 2, bh = ts - by - inset;

    const bodyColor = p.buildingI[0];
    const roofColor = '#4a4a4a';

    // 1. Large Flat Building
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    // 2. Flat Roof
    ctx.fillStyle = roofColor;
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);

    // 3. Loading Bays
    ctx.fillStyle = '#1a1a1a';
    const bayCount = 3;
    const bayW = bw / bayCount - 2;
    for (let i = 0; i < bayCount; i++) {
      const dx = bx + i * (bw / bayCount) + 1;
      ctx.fillRect(dx, by + bh * 0.4, bayW, bh * 0.6);
      // Yellow stripe
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(dx, by + bh * 0.4, bayW, 1);
      ctx.fillStyle = '#1a1a1a';
    }
  }
};
