import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse, drawVeg } from './ResUtils';

export const ResL1_01: VectorEntity = {
  id: 'res-l1-brick-cottage',
  type: 'ZONE_1_1',
  tags: ['neutral', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { hasChimney: true }); }
};

export const ResL1_02: VectorEntity = {
  id: 'res-l1-blue-suburban',
  type: 'ZONE_1_1',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#4682b4', '#2f4f4f', { doorSide: 'left' }); }
};

export const ResL1_10: VectorEntity = {
  id: 'res-l1-desert-adobe',
  type: 'ZONE_1_1',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#d7ccc8', '#a1887f', { roofStyle: 'flat', windowColor: '#ffffff' }); }
};

export const ResL1_14: VectorEntity = {
  id: 'res-l1-contemporary-glass',
  type: 'ZONE_1_1',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffffff', '#607d8b', { roofStyle: 'flat', windowColor: 'rgba(129, 212, 250, 0.6)' }); }
};

export const ResL1_52: VectorEntity = {
  id: 'res-l1-modern-black-box',
  type: 'ZONE_1_1',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#212121', '#000000', { roofStyle: 'flat', windowColor: '#ffeb3b' }); }
};

export const ResL1_B2_01: VectorEntity = {
  id: 'res-l1-blue-colonial-smoke',
  type: 'ZONE_1_1',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#3f51b5', '#212121', { hasChimney: true, hasVegetation: true, vegType: 'bush' }); }
};

export const ResL1_B2_04: VectorEntity = {
  id: 'res-l1-modern-white-garden',
  type: 'ZONE_1_1',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffffff', '#424242', { roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' }); }
};

export const ResL1_B2_34: VectorEntity = {
  id: 'res-l1-modern-steel-box-garden',
  type: 'ZONE_1_1',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#455a64', '#000000', { roofStyle: 'flat', windowColor: '#81d4fa', hasVegetation: true, vegType: 'flowers' }); }
};

export const ResL1_B2_43: VectorEntity = {
  id: 'res-l1-suburban-blue-chimney-smoke',
  type: 'ZONE_1_1',
  tags: ['planned', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#1e88e5', '#263238', { hasChimney: true, hasVegetation: true }); }
};

export const ResL1_B3_04: VectorEntity = {
  id: 'res-l1-geodesic-dome',
  type: 'ZONE_1_1',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, _p, _vibe) {
    const s = ts * 0.1;
    ctx.fillStyle = 'rgba(129, 212, 250, 0.4)';
    ctx.beginPath();
    ctx.arc(ts / 2, ts * 0.7, s * 4, Math.PI, 0);
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
