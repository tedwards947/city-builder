import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse } from './ResUtils';

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
