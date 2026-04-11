import type { VectorEntity } from '../../SpriteTypes';
import { drawSmoke } from './IndUtils';

/**
 * SawtoothMillL1: A Level 1 Industrial building.
 * A small factory with a classic sawtooth roof and twin smokestacks.
 */
export const SawtoothMillL1: VectorEntity = {
  id: 'SawtoothMillL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'planned', 'classic'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    const bx = inset, by = inset + s * 2;
    const bw = ts - inset * 2, bh = ts - by - inset;

    const bodyColor = p.buildingI[0];
    const roofColor = '#4a2828';

    // 1. Foundation
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Smokestacks (Background)
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#2a2a2a';
    const stackXPositions = [bx + bw * 0.2, bx + bw * 0.6];
    stackXPositions.forEach(sx => {
      ctx.fillRect(sx, inset, s * 1.2, by - inset + s);
    });

    // 3. Main Body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    // 4. Sawtooth Roof
    ctx.fillStyle = roofColor;
    for (let i = 0; i < 3; i++) {
      const rx = bx + (i * bw / 3);
      ctx.beginPath();
      ctx.moveTo(rx, by);
      ctx.lineTo(rx + bw / 6, by - s);
      ctx.lineTo(rx + bw / 3, by);
      ctx.fill();
    }

    // 5. Windows
    ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
    const winW = bw / 4;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(bx + s + i * winW, by + s * 2, winW * 0.7, bh * 0.4);
    }

    // 6. Smoke Animation (Foreground)
    stackXPositions.forEach((sx, i) => {
      drawSmoke(ctx, sx + s * 0.6, inset, t + i * 0.3);
    });
  }
};
