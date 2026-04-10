import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

// Consolidated Good Level 3 Residential Sprites (100 total)

export const ResL3_01: VectorEntity = {
  id: 'res-l3-01',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#424242', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_02: VectorEntity = {
  id: 'res-l3-02',
  type: 'ZONE_1_3',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#5d4037', '#2e7d32', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_03: VectorEntity = {
  id: 'res-l3-03',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#212121', { stories: 5, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL3_04: VectorEntity = {
  id: 'res-l3-04',
  type: 'ZONE_1_3',
  tags: ['planned', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#f1f8e9', '#33691e', { stories: 4, roofStyle: 'mansard', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_05: VectorEntity = {
  id: 'res-l3-05',
  type: 'ZONE_1_3',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 6, roofStyle: 'flat', windowColor: '#81d4fa', isWider: true } as any); }
};

export const ResL3_06: VectorEntity = {
  id: 'res-l3-06',
  type: 'ZONE_1_3',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#a1887f', { stories: 3, roofStyle: 'pitched', hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_07: VectorEntity = {
  id: 'res-l3-07',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#cfd8dc', '#37474f', { stories: 4, roofStyle: 'flat', isWider: true } as any); }
};

export const ResL3_08: VectorEntity = {
  id: 'res-l3-08',
  type: 'ZONE_1_3',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { stories: 5, roofStyle: 'mansard', hasChimney: true } as any); }
};

export const ResL3_09: VectorEntity = {
  id: 'res-l3-09',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#4caf50', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree', isWider: true } as any); }
};

export const ResL3_10: VectorEntity = {
  id: 'res-l3-10',
  type: 'ZONE_1_3',
  tags: ['corporate', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#4682b4', '#2f4f4f', { stories: 5, roofStyle: 'pitched', windowColor: '#ffffff' } as any); }
};

export const ResL3_11: VectorEntity = {
  id: 'res-l3-11',
  type: 'ZONE_1_3',
  tags: ['organic', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 3, roofStyle: 'mansard', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_12: VectorEntity = {
  id: 'res-l3-12',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#212121', { stories: 4, roofStyle: 'flat', isWider: true, hasChimney: true } as any); }
};

export const ResL3_13: VectorEntity = {
  id: 'res-l3-13',
  type: 'ZONE_1_3',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#8d6e63', '#3e2723', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_14: VectorEntity = {
  id: 'res-l3-14',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#eeeeee', '#607d8b', { stories: 5, roofStyle: 'flat', windowColor: '#81d4fa' } as any); }
};

export const ResL3_15: VectorEntity = {
  id: 'res-l3-15',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#3f51b5', '#212121', { stories: 4, roofStyle: 'mansard', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_16: VectorEntity = {
  id: 'res-l3-16',
  type: 'ZONE_1_3',
  tags: ['industrial', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#009688', '#263238', { stories: 5, roofStyle: 'flat', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_17: VectorEntity = {
  id: 'res-l3-17',
  type: 'ZONE_1_3',
  tags: ['organic', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 3, roofStyle: 'pitched', isWider: true } as any); }
};

export const ResL3_18: VectorEntity = {
  id: 'res-l3-18',
  type: 'ZONE_1_3',
  tags: ['planned', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fafafa', '#212121', { stories: 4, roofStyle: 'mansard', windowColor: '#add8e6' } as any); }
};

export const ResL3_19: VectorEntity = {
  id: 'res-l3-19',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#000000', { stories: 6, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL3_20: VectorEntity = {
  id: 'res-l3-20',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#2e7d32', { stories: 4, roofStyle: 'pitched', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_21: VectorEntity = {
  id: 'res-l3-21',
  type: 'ZONE_1_3',
  tags: ['corporate', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', { stories: 3, roofStyle: 'flat', windowColor: '#ffffff', isWider: true } as any); }
};

export const ResL3_22: VectorEntity = {
  id: 'res-l3-22',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#263238', { stories: 5, roofStyle: 'mansard', hasChimney: true } as any); }
};

export const ResL3_23: VectorEntity = {
  id: 'res-l3-23',
  type: 'ZONE_1_3',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#d32f2f', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_24: VectorEntity = {
  id: 'res-l3-24',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#424242', { stories: 5, roofStyle: 'flat', windowColor: '#81d4fa', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_25: VectorEntity = {
  id: 'res-l3-25',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#37474f', { stories: 4, roofStyle: 'mansard', isWider: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_26: VectorEntity = {
  id: 'res-l3-26',
  type: 'ZONE_1_3',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#a52a2a', '#212121', { stories: 4, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_27: VectorEntity = {
  id: 'res-l3-27',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#607d8b', { stories: 5, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_28: VectorEntity = {
  id: 'res-l3-28',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#333333', { stories: 3, roofStyle: 'mansard', hasChimney: true } as any); }
};

export const ResL3_29: VectorEntity = {
  id: 'res-l3-29',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#f1f8e9', '#2e7d32', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_30: VectorEntity = {
  id: 'res-l3-30',
  type: 'ZONE_1_3',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 5, roofStyle: 'mansard', windowColor: '#81d4fa' } as any); }
};

export const ResL3_31: VectorEntity = {
  id: 'res-l3-31',
  type: 'ZONE_1_3',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#263238', { stories: 6, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL3_32: VectorEntity = {
  id: 'res-l3-32',
  type: 'ZONE_1_3',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#cfd8dc', '#37474f', { stories: 4, roofStyle: 'pitched', isWider: true, hasVegetation: true } as any); }
};

export const ResL3_33: VectorEntity = {
  id: 'res-l3-33',
  type: 'ZONE_1_3',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#8d6e63', '#3e2723', { stories: 3, roofStyle: 'mansard', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_34: VectorEntity = {
  id: 'res-l3-34',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#eeeeee', '#424242', { stories: 5, roofStyle: 'flat', windowColor: '#ffffff', isWider: true } as any); }
};

export const ResL3_35: VectorEntity = {
  id: 'res-l3-35',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#3f51b5', '#212121', { stories: 4, roofStyle: 'pitched', hasChimney: true } as any); }
};

export const ResL3_36: VectorEntity = {
  id: 'res-l3-36',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#4caf50', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_37: VectorEntity = {
  id: 'res-l3-37',
  type: 'ZONE_1_3',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#bf360c', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_38: VectorEntity = {
  id: 'res-l3-38',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 6, roofStyle: 'flat', windowColor: '#ffeb3b' } as any); }
};

export const ResL3_39: VectorEntity = {
  id: 'res-l3-39',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 4, roofStyle: 'mansard', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_40: VectorEntity = {
  id: 'res-l3-40',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#212121', { stories: 5, roofStyle: 'flat', isWider: true, hasChimney: true } as any); }
};

export const ResL3_41: VectorEntity = {
  id: 'res-l3-41',
  type: 'ZONE_1_3',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#009688', '#263238', { stories: 4, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_42: VectorEntity = {
  id: 'res-l3-42',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#455a64', { stories: 5, roofStyle: 'mansard', isWider: true } as any); }
};

export const ResL3_43: VectorEntity = {
  id: 'res-l3-43',
  type: 'ZONE_1_3',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_44: VectorEntity = {
  id: 'res-l3-44',
  type: 'ZONE_1_3',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fafafa', '#212121', { stories: 4, roofStyle: 'pitched', hasChimney: true } as any); }
};

export const ResL3_45: VectorEntity = {
  id: 'res-l3-45',
  type: 'ZONE_1_3',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { stories: 5, roofStyle: 'mansard', isWider: true } as any); }
};

export const ResL3_46: VectorEntity = {
  id: 'res-l3-46',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#eeeeee', '#33691e', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_47: VectorEntity = {
  id: 'res-l3-47',
  type: 'ZONE_1_3',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#000000', { stories: 6, roofStyle: 'pitched', windowColor: '#81d4fa' } as any); }
};

export const ResL3_48: VectorEntity = {
  id: 'res-l3-48',
  type: 'ZONE_1_3',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', { stories: 3, roofStyle: 'mansard', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_49: VectorEntity = {
  id: 'res-l3-49',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#263238', { stories: 5, roofStyle: 'flat', hasChimney: true, isWider: true } as any); }
};

export const ResL3_50: VectorEntity = {
  id: 'res-l3-50',
  type: 'ZONE_1_3',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#2e7d32', { stories: 4, roofStyle: 'pitched', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_51: VectorEntity = {
  id: 'res-l3-51',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#424242', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree', isWider: true } as any); }
};

export const ResL3_52: VectorEntity = {
  id: 'res-l3-52',
  type: 'ZONE_1_3',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#5d4037', '#33691e', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_53: VectorEntity = {
  id: 'res-l3-53',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#212121', { stories: 5, roofStyle: 'mansard', hasChimney: true } as any); }
};

export const ResL3_54: VectorEntity = {
  id: 'res-l3-54',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#f1f8e9', '#4caf50', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_55: VectorEntity = {
  id: 'res-l3-55',
  type: 'ZONE_1_3',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 6, roofStyle: 'flat', windowColor: '#81d4fa', isWider: true } as any); }
};

export const ResL3_56: VectorEntity = {
  id: 'res-l3-56',
  type: 'ZONE_1_3',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#a1887f', { stories: 3, roofStyle: 'pitched', hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_57: VectorEntity = {
  id: 'res-l3-57',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#cfd8dc', '#37474f', { stories: 4, roofStyle: 'mansard', isWider: true } as any); }
};

export const ResL3_58: VectorEntity = {
  id: 'res-l3-58',
  type: 'ZONE_1_3',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { stories: 5, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL3_59: VectorEntity = {
  id: 'res-l3-59',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#2e7d32', { stories: 4, roofStyle: 'pitched', hasVegetation: true, vegType: 'tree', isWider: true } as any); }
};

export const ResL3_60: VectorEntity = {
  id: 'res-l3-60',
  type: 'ZONE_1_3',
  tags: ['corporate', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#4682b4', '#2f4f4f', { stories: 5, roofStyle: 'flat', windowColor: '#ffffff' } as any); }
};

export const ResL3_61: VectorEntity = {
  id: 'res-l3-61',
  type: 'ZONE_1_3',
  tags: ['organic', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 3, roofStyle: 'mansard', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_62: VectorEntity = {
  id: 'res-l3-62',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#212121', { stories: 4, roofStyle: 'flat', isWider: true, hasChimney: true } as any); }
};

export const ResL3_63: VectorEntity = {
  id: 'res-l3-63',
  type: 'ZONE_1_3',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#8d6e63', '#3e2723', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_64: VectorEntity = {
  id: 'res-l3-64',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#eeeeee', '#607d8b', { stories: 5, roofStyle: 'mansard', windowColor: '#81d4fa' } as any); }
};

export const ResL3_65: VectorEntity = {
  id: 'res-l3-65',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#3f51b5', '#212121', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_66: VectorEntity = {
  id: 'res-l3-66',
  type: 'ZONE_1_3',
  tags: ['industrial', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#009688', '#263238', { stories: 5, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_67: VectorEntity = {
  id: 'res-l3-67',
  type: 'ZONE_1_3',
  tags: ['organic', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 3, roofStyle: 'mansard', isWider: true } as any); }
};

export const ResL3_68: VectorEntity = {
  id: 'res-l3-68',
  type: 'ZONE_1_3',
  tags: ['planned', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fafafa', '#212121', { stories: 4, roofStyle: 'flat', windowColor: '#add8e6' } as any); }
};

export const ResL3_69: VectorEntity = {
  id: 'res-l3-69',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#000000', { stories: 6, roofStyle: 'pitched', hasChimney: true } as any); }
};

export const ResL3_70: VectorEntity = {
  id: 'res-l3-70',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#33691e', { stories: 4, roofStyle: 'mansard', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_71: VectorEntity = {
  id: 'res-l3-71',
  type: 'ZONE_1_3',
  tags: ['corporate', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', { stories: 3, roofStyle: 'flat', windowColor: '#ffffff', isWider: true } as any); }
};

export const ResL3_72: VectorEntity = {
  id: 'res-l3-72',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#263238', { stories: 5, roofStyle: 'pitched', hasChimney: true } as any); }
};

export const ResL3_73: VectorEntity = {
  id: 'res-l3-73',
  type: 'ZONE_1_3',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#d32f2f', { stories: 3, roofStyle: 'mansard', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_74: VectorEntity = {
  id: 'res-l3-74',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#424242', { stories: 5, roofStyle: 'flat', windowColor: '#81d4fa', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_75: VectorEntity = {
  id: 'res-l3-75',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#37474f', { stories: 4, roofStyle: 'pitched', isWider: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_76: VectorEntity = {
  id: 'res-l3-76',
  type: 'ZONE_1_3',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#a52a2a', '#212121', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_77: VectorEntity = {
  id: 'res-l3-77',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#607d8b', { stories: 5, roofStyle: 'pitched', isWider: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_78: VectorEntity = {
  id: 'res-l3-78',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#333333', { stories: 3, roofStyle: 'mansard', hasChimney: true } as any); }
};

export const ResL3_79: VectorEntity = {
  id: 'res-l3-79',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#f1f8e9', '#2e7d32', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_80: VectorEntity = {
  id: 'res-l3-80',
  type: 'ZONE_1_3',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 5, roofStyle: 'mansard', windowColor: '#81d4fa' } as any); }
};

export const ResL3_81: VectorEntity = {
  id: 'res-l3-81',
  type: 'ZONE_1_3',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#263238', { stories: 6, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL3_82: VectorEntity = {
  id: 'res-l3-82',
  type: 'ZONE_1_3',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#cfd8dc', '#37474f', { stories: 4, roofStyle: 'pitched', isWider: true, hasVegetation: true } as any); }
};

export const ResL3_83: VectorEntity = {
  id: 'res-l3-83',
  type: 'ZONE_1_3',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#8d6e63', '#3e2723', { stories: 3, roofStyle: 'mansard', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_84: VectorEntity = {
  id: 'res-l3-84',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#eeeeee', '#424242', { stories: 5, roofStyle: 'flat', windowColor: '#ffffff', isWider: true } as any); }
};

export const ResL3_85: VectorEntity = {
  id: 'res-l3-85',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#3f51b5', '#212121', { stories: 4, roofStyle: 'pitched', hasChimney: true } as any); }
};

export const ResL3_86: VectorEntity = {
  id: 'res-l3-86',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#4caf50', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_87: VectorEntity = {
  id: 'res-l3-87',
  type: 'ZONE_1_3',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#bf360c', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_88: VectorEntity = {
  id: 'res-l3-88',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 6, roofStyle: 'flat', windowColor: '#ffeb3b' } as any); }
};

export const ResL3_89: VectorEntity = {
  id: 'res-l3-89',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 4, roofStyle: 'mansard', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_90: VectorEntity = {
  id: 'res-l3-90',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#212121', { stories: 5, roofStyle: 'flat', isWider: true, hasChimney: true } as any); }
};

export const ResL3_91: VectorEntity = {
  id: 'res-l3-91',
  type: 'ZONE_1_3',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#009688', '#263238', { stories: 4, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_92: VectorEntity = {
  id: 'res-l3-92',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#455a64', { stories: 5, roofStyle: 'mansard', isWider: true } as any); }
};

export const ResL3_93: VectorEntity = {
  id: 'res-l3-93',
  type: 'ZONE_1_3',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL3_94: VectorEntity = {
  id: 'res-l3-94',
  type: 'ZONE_1_3',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fafafa', '#212121', { stories: 4, roofStyle: 'pitched', hasChimney: true } as any); }
};

export const ResL3_95: VectorEntity = {
  id: 'res-l3-95',
  type: 'ZONE_1_3',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { stories: 5, roofStyle: 'mansard', isWider: true } as any); }
};

export const ResL3_96: VectorEntity = {
  id: 'res-l3-96',
  type: 'ZONE_1_3',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#eeeeee', '#33691e', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL3_97: VectorEntity = {
  id: 'res-l3-97',
  type: 'ZONE_1_3',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#000000', { stories: 6, roofStyle: 'pitched', windowColor: '#81d4fa' } as any); }
};

export const ResL3_98: VectorEntity = {
  id: 'res-l3-98',
  type: 'ZONE_1_3',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', { stories: 3, roofStyle: 'mansard', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL3_99: VectorEntity = {
  id: 'res-l3-99',
  type: 'ZONE_1_3',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#455a64', '#263238', { stories: 5, roofStyle: 'flat', hasChimney: true, isWider: true } as any); }
};

export const ResL3_100: VectorEntity = {
  id: 'res-l3-100',
  type: 'ZONE_1_3',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL3House(ctx, ts, t, p, vibe, '#fff9c4', '#2e7d32', { stories: 4, roofStyle: 'pitched', hasVegetation: true, vegType: 'flowers' } as any); }
};
