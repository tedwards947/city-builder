import type { VectorEntity } from '../../SpriteTypes';

/**
 * PeakedWorkshopL1: A Level 1 Industrial building.
 * A small workshop or factory with a peaked roof and large windows.
 */
export const PeakedWorkshopL1: VectorEntity = {
  id: 'PeakedWorkshopL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'organic', 'workshop'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    const bx = inset, by = inset + s * 2;
    const bw = ts - inset * 2, bh = ts - by - inset;

    const bodyColor = p.buildingI[0];
    const roofColor = '#3a3a3a';

    // 1. Foundation
    ctx.fillStyle = '#444';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Main Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Peaked Roof
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(bx - 1, by);
    ctx.lineTo(bx + bw / 2, by - s * 1.5);
    ctx.lineTo(bx + bw + 1, by);
    ctx.fill();

    // 4. Large Windows
    ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
    const winW = bw / 3;
    for (let i = 0; i < 2; i++) {
      ctx.fillRect(bx + s + i * (winW + s), by + s * 1.5, winW - s, bh * 0.5);
    }
  }
};
