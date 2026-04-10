import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse } from './ResUtils';

export const ResL1_B4_01: VectorEntity = {
  id: 'ResL1_B4_01',
  type: 'ZONE_1_1',
  tags: ['planned', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#f5f5f5', '#333333', { roofStyle: 'pitched', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_02: VectorEntity = {
  id: 'ResL1_B4_02',
  type: 'ZONE_1_1',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#e0e0e0', '#5d4037', { roofStyle: 'a-frame', hasChimney: true, chimneySide: 'left' } as any); }
};

export const ResL1_B4_03: VectorEntity = {
  id: 'ResL1_B4_03',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#bdbdbd', '#263238', { roofStyle: 'flat', doorSide: 'right' } as any); }
};

export const ResL1_B4_04: VectorEntity = {
  id: 'ResL1_B4_04',
  type: 'ZONE_1_1',
  tags: ['industrial', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#757575', '#3e2723', { roofStyle: 'slanted', hasChimney: true } as any); }
};

export const ResL1_B4_05: VectorEntity = {
  id: 'ResL1_B4_05',
  type: 'ZONE_1_1',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#c5e1a5', '#1b5e20', { roofStyle: 'pagoda', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_06: VectorEntity = {
  id: 'ResL1_B4_06',
  type: 'ZONE_1_1',
  tags: ['planned', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffcc80', '#8d6e63', { roofStyle: 'pitched', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_07: VectorEntity = {
  id: 'ResL1_B4_07',
  type: 'ZONE_1_1',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffe082', '#5d4037', { roofStyle: 'a-frame', doorSide: 'left' } as any); }
};

export const ResL1_B4_08: VectorEntity = {
  id: 'ResL1_B4_08',
  type: 'ZONE_1_1',
  tags: ['corporate', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#212121', '#000000', { roofStyle: 'flat', windowColor: '#ffeb3b' } as any); }
};

export const ResL1_B4_09: VectorEntity = {
  id: 'ResL1_B4_09',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#81d4fa', '#1a237e', { roofStyle: 'slanted', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_10: VectorEntity = {
  id: 'ResL1_B4_10',
  type: 'ZONE_1_1',
  tags: ['green', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#80cbc4', '#263238', { roofStyle: 'pagoda', hasChimney: true, chimneySide: 'right' } as any); }
};

export const ResL1_B4_11: VectorEntity = {
  id: 'ResL1_B4_11',
  type: 'ZONE_1_1',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffffff', '#424242', { roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_12: VectorEntity = {
  id: 'ResL1_B4_12',
  type: 'ZONE_1_1',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ce93d8', '#4a148c', { roofStyle: 'a-frame', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_13: VectorEntity = {
  id: 'ResL1_B4_13',
  type: 'ZONE_1_1',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#fff59d', '#fbc02d', { roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL1_B4_14: VectorEntity = {
  id: 'ResL1_B4_14',
  type: 'ZONE_1_1',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#bcaaa4', '#3e2723', { roofStyle: 'slanted', doorSide: 'center' } as any); }
};

export const ResL1_B4_15: VectorEntity = {
  id: 'ResL1_B4_15',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#9fa8da', '#1a237e', { roofStyle: 'pagoda', windowColor: '#ffffff' } as any); }
};

export const ResL1_B4_16: VectorEntity = {
  id: 'ResL1_B4_16',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ef9a9a', '#b71c1c', { roofStyle: 'pitched', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_17: VectorEntity = {
  id: 'ResL1_B4_17',
  type: 'ZONE_1_1',
  tags: ['planned', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#4682b4', '#263238', { roofStyle: 'a-frame', hasChimney: true, chimneySide: 'left' } as any); }
};

export const ResL1_B4_18: VectorEntity = {
  id: 'ResL1_B4_18',
  type: 'ZONE_1_1',
  tags: ['organic', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#a52a2a', '#3e2723', { roofStyle: 'flat', doorSide: 'right' } as any); }
};

export const ResL1_B4_19: VectorEntity = {
  id: 'ResL1_B4_19',
  type: 'ZONE_1_1',
  tags: ['green', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#c5e1a5', '#1b5e20', { roofStyle: 'slanted', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_20: VectorEntity = {
  id: 'ResL1_B4_20',
  type: 'ZONE_1_1',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#757575', '#212121', { roofStyle: 'pagoda', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_21: VectorEntity = {
  id: 'ResL1_B4_21',
  type: 'ZONE_1_1',
  tags: ['corporate', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#f5f5f5', '#424242', { roofStyle: 'pitched', doorSide: 'left' } as any); }
};

export const ResL1_B4_22: VectorEntity = {
  id: 'ResL1_B4_22',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffcc80', '#e65100', { roofStyle: 'a-frame', hasChimney: true } as any); }
};

export const ResL1_B4_23: VectorEntity = {
  id: 'ResL1_B4_23',
  type: 'ZONE_1_1',
  tags: ['planned', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#81d4fa', '#01579b', { roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_24: VectorEntity = {
  id: 'ResL1_B4_24',
  type: 'ZONE_1_1',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffe082', '#ff8f00', { roofStyle: 'slanted', hasChimney: true, chimneySide: 'right' } as any); }
};

export const ResL1_B4_25: VectorEntity = {
  id: 'ResL1_B4_25',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#bdbdbd', '#263238', { roofStyle: 'pagoda', doorSide: 'center' } as any); }
};
