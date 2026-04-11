import type { VectorEntity } from '../../SpriteTypes';
import { drawVeg } from './ResUtils';

/**
 * GeodesicDomeL1: A Level 1 Residential building.
 * A unique glass dome structure with a hexagonal pattern.
 */
export const GeodesicDomeL1: VectorEntity = {
  id: 'GeodesicDomeL1',
  type: 'ZONE_1_1', // Residential Level 1
  tags: ['green', 'planned', 'futuristic'],
  draw: (ctx, ts, t, _p, _vibe) => {
    const s = ts * 0.1;
    ctx.fillStyle = 'rgba(129, 212, 250, 0.4)';
    ctx.beginPath();
    ctx.arc(ts / 2, ts * 0.7, Math.max(0.1, s * 4), Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    // Hex pattern lines
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 1, ts * 0.7 - i * s);
      ctx.lineTo(s * 9, ts * 0.7 - i * s);
      ctx.stroke();
    }
    drawVeg(ctx, s * 5, ts * 0.7, ts, t, 'flowers');
  }
};
