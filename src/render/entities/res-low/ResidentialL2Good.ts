import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

// Consolidated Level 2 Residential Sprites (93 total)

export const ResL2_01: VectorEntity = {
  id: 'res-l2-brick-manor',
  type: 'ZONE_1_2',
  tags: ['neutral', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { stories: 2, hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_02: VectorEntity = {
  id: 'res-l2-blue-suburban-large',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#4682b4', '#2f4f4f', { stories: 2, isWider: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_03: VectorEntity = {
  id: 'res-l2-desert-adobe-villa',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#d7ccc8', '#a1887f', { stories: 2, roofStyle: 'flat', windowColor: '#ffffff', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_04: VectorEntity = {
  id: 'res-l2-contemporary-glass-mansion',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#607d8b', { stories: 3, roofStyle: 'flat', windowColor: 'rgba(129, 212, 250, 0.6)', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_05: VectorEntity = {
  id: 'res-l2-modern-black-stacked',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 3, roofStyle: 'flat', windowColor: '#ffeb3b', isWider: true } as any); }
};

export const ResL2_06: VectorEntity = {
  id: 'res-l2-blue-colonial-estate',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#3f51b5', '#212121', { stories: 3, hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_07: VectorEntity = {
  id: 'res-l2-modern-white-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#424242', { stories: 2, isWider: true, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_08: VectorEntity = {
  id: 'res-l2-modern-steel-duplex',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#455a64', '#000000', { stories: 2, roofStyle: 'flat', windowColor: '#81d4fa', isWider: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_09: VectorEntity = {
  id: 'res-l2-suburban-split-level',
  type: 'ZONE_1_2',
  tags: ['planned', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#1e88e5', '#263238', { stories: 2, hasChimney: true, chimneySide: 'right', isWider: true, hasVegetation: true } as any); }
};

export const ResL2_10: VectorEntity = {
  id: 'res-l2-geodesic-complex',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { 
    drawL2House(ctx, ts, t, p, vibe, 'rgba(129, 212, 250, 0.4)', '#fff', { stories: 2, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); 
  }
};

export const ResL2_11: VectorEntity = {
  id: 'res-l2-brick-townhome',
  type: 'ZONE_1_2',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#b71c1c', '#424242', { stories: 3, hasChimney: true } as any); }
};

export const ResL2_12: VectorEntity = {
  id: 'res-l2-luxury-cabin',
  type: 'ZONE_1_2',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#5d4037', '#3e2723', { stories: 2, hasChimney: true, hasVegetation: true, vegType: 'tree', isWider: true } as any); }
};

export const ResL2_13: VectorEntity = {
  id: 'res-l2-white-stucco-modern',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fafafa', '#212121', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_14: VectorEntity = {
  id: 'res-l2-grey-suburban-plus',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#cfd8dc', '#37474f', { stories: 2, hasChimney: true, hasVegetation: true } as any); }
};

export const ResL2_15: VectorEntity = {
  id: 'res-l2-asian-modern-tower',
  type: 'ZONE_1_2',
  tags: ['planned', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#eeeeee', '#c62828', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_16: VectorEntity = {
  id: 'res-l2-eco-dome-stack',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#f1f8e9', '#33691e', { stories: 2, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_17: VectorEntity = {
  id: 'res-l2-yellow-craftsman-plus',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 2, hasChimney: true, hasVegetation: true, vegType: 'bush', isWider: true } as any); }
};

export const ResL2_18: VectorEntity = {
  id: 'res-l2-teal-suburban-plus',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#009688', '#263238', { stories: 2, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_19: VectorEntity = {
  id: 'res-l2-pink-villa-plus',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 2, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_20: VectorEntity = {
  id: 'res-l2-minimalist-concrete-plus',
  type: 'ZONE_1_2',
  tags: ['planned', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#cfd8dc', '#455a64', { stories: 3, roofStyle: 'flat', isWider: true } as any); }
};

export const ResL2_21: VectorEntity = {
  id: 'res-l2-brick-duplex-plus',
  type: 'ZONE_1_2',
  tags: ['egalitarian', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#c62828', '#212121', { stories: 2, isWider: true } as any); }
};

export const ResL2_22: VectorEntity = {
  id: 'res-l2-shophouse-plus',
  type: 'ZONE_1_2',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#d32f2f', { stories: 3, roofStyle: 'flat', hasVegetation: true } as any); }
};

export const ResL2_23: VectorEntity = {
  id: 'res-l2-log-cabin-plus',
  type: 'ZONE_1_2',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#5d4037', '#3e2723', { stories: 2, hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_24: VectorEntity = {
  id: 'res-l2-modern-loft-plus',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#8d6e63', '#263238', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_25: VectorEntity = {
  id: 'res-l2-white-farmhouse-plus',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#212121', { stories: 2, hasChimney: true, hasVegetation: true, vegType: 'tree', isWider: true } as any); }
};

export const ResL2_26: VectorEntity = {
  id: 'res-l2-modern-brick-tower',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#a52a2a', '#212121', { stories: 3, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_27: VectorEntity = {
  id: 'res-l2-glass-box-estate',
  type: 'ZONE_1_2',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, 'rgba(129, 212, 250, 0.3)', '#455a64', { stories: 2, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_28: VectorEntity = {
  id: 'res-l2-colonial-manor-white',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#333333', { stories: 3, hasChimney: true, chimneySide: 'left', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_29: VectorEntity = {
  id: 'res-l2-desert-adobe-palace',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffe0b2', '#bf360c', { stories: 3, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_30: VectorEntity = {
  id: 'res-l2-modern-black-glass-stacked',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 4, roofStyle: 'flat', windowColor: '#81d4fa', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_31: VectorEntity = {
  id: 'res-l2-eco-living-tower',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#eeeeee', '#4caf50', { stories: 3, hasVegetation: true, vegType: 'flowers', isWider: true } as any); }
};

export const ResL2_32: VectorEntity = {
  id: 'res-l2-mediterranean-mansion',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#e64a19', { stories: 2, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_33: VectorEntity = {
  id: 'res-l2-industrial-loft-brick',
  type: 'ZONE_1_2',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#b71c1c', '#424242', { stories: 3, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL2_34: VectorEntity = {
  id: 'res-l2-suburban-plus-blue',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#1e88e5', '#263238', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_35: VectorEntity = {
  id: 'res-l2-modern-white-lean-to-plus',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#424242', { stories: 2, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_36: VectorEntity = {
  id: 'res-l2-asian-pagoda-estate',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#d32f2f', { stories: 3, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_37: VectorEntity = {
  id: 'res-l2-contemporary-steel-villa',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#455a64', '#212121', { stories: 2, roofStyle: 'flat', isWider: true, windowColor: '#81d4fa' } as any); }
};

export const ResL2_38: VectorEntity = {
  id: 'res-l2-modern-craftsman-estate',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#8d6e63', '#3e2723', { stories: 2, hasChimney: true, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_39: VectorEntity = {
  id: 'res-l2-pink-suburban-mansion',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 3, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_40: VectorEntity = {
  id: 'res-l2-minimalist-glass-tower',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, 'rgba(255, 255, 255, 0.2)', '#eeeeee', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_41: VectorEntity = {
  id: 'res-l2-brick-shophouse-plus',
  type: 'ZONE_1_2',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#c62828', '#212121', { stories: 3, isWider: true } as any); }
};

export const ResL2_42: VectorEntity = {
  id: 'res-l2-modern-wood-glass-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#a1887f', '#263238', { stories: 2, isWider: true, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_43: VectorEntity = {
  id: 'res-l2-suburban-cream-estate',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 3, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_44: VectorEntity = {
  id: 'res-l2-eco-dome-palace',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#f5f5f5', '#4caf50', { stories: 2, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_45: VectorEntity = {
  id: 'res-l2-modern-white-final-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#212121', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_46: VectorEntity = {
  id: 'res-l2-asian-modern-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#eeeeee', '#c62828', { stories: 3, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_47: VectorEntity = {
  id: 'res-l2-suburban-brick-estate',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#b71c1c', '#212121', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_48: VectorEntity = {
  id: 'res-l2-eco-cabin-estate',
  type: 'ZONE_1_2',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#3e2723', '#2e7d32', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_49: VectorEntity = {
  id: 'res-l2-modern-glass-final-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#455a64', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_50: VectorEntity = {
  id: 'res-l2-desert-modern-estate',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', { stories: 3, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_51: VectorEntity = {
  id: 'res-l2-modern-blue-tower',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#1e88e5', '#212121', { stories: 3, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_52: VectorEntity = {
  id: 'res-l2-glass-box-estate-v2',
  type: 'ZONE_1_2',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, 'rgba(3, 169, 244, 0.3)', '#455a64', { stories: 2, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_53: VectorEntity = {
  id: 'res-l2-colonial-manor-cream',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#333333', { stories: 3, hasChimney: true, chimneySide: 'right', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_54: VectorEntity = {
  id: 'res-l2-desert-adobe-castle',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffe0b2', '#bf360c', { stories: 3, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_55: VectorEntity = {
  id: 'res-l2-modern-white-glass-stacked',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#000000', { stories: 4, roofStyle: 'flat', windowColor: '#81d4fa', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_56: VectorEntity = {
  id: 'res-l2-eco-spire-complex',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#eeeeee', '#4caf50', { stories: 3, hasVegetation: true, vegType: 'flowers', isWider: true } as any); }
};

export const ResL2_57: VectorEntity = {
  id: 'res-l2-mediterranean-estate-v2',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#e64a19', { stories: 2, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_58: VectorEntity = {
  id: 'res-l2-industrial-brick-tower',
  type: 'ZONE_1_2',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#b71c1c', '#424242', { stories: 4, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL2_59: VectorEntity = {
  id: 'res-l2-suburban-plus-grey',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#cfd8dc', '#37474f', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_60: VectorEntity = {
  id: 'res-l2-modern-black-lean-to-plus',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 2, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_62: VectorEntity = {
  id: 'res-l2-contemporary-blue-villa',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#1e88e5', '#212121', { stories: 2, roofStyle: 'flat', isWider: true, windowColor: '#81d4fa' } as any); }
};

export const ResL2_63: VectorEntity = {
  id: 'res-l2-modern-wood-estate-v2',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#8d6e63', '#3e2723', { stories: 2, hasChimney: true, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_64: VectorEntity = {
  id: 'res-l2-pink-suburban-palace',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 3, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_65: VectorEntity = {
  id: 'res-l2-minimalist-white-tower',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#eeeeee', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_66: VectorEntity = {
  id: 'res-l2-brick-shophouse-v3',
  type: 'ZONE_1_2',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#c62828', '#212121', { stories: 3, isWider: true } as any); }
};

export const ResL2_67: VectorEntity = {
  id: 'res-l2-modern-industrial-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#37474f', '#212121', { stories: 2, isWider: true, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_68: VectorEntity = {
  id: 'res-l2-suburban-yellow-estate',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 3, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_69: VectorEntity = {
  id: 'res-l2-eco-dome-mansion',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#f5f5f5', '#4caf50', { stories: 2, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_70: VectorEntity = {
  id: 'res-l2-modern-white-glass-estate-v2',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#212121', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_71: VectorEntity = {
  id: 'res-l2-asian-modern-tower-v2',
  type: 'ZONE_1_2',
  tags: ['planned', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#eeeeee', '#c62828', { stories: 3, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_72: VectorEntity = {
  id: 'res-l2-suburban-blue-mansion',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#1e88e5', '#212121', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_73: VectorEntity = {
  id: 'res-l2-eco-wood-estate',
  type: 'ZONE_1_2',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#3e2723', '#2e7d32', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_74: VectorEntity = {
  id: 'res-l2-modern-glass-pavilion-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#455a64', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_75: VectorEntity = {
  id: 'res-l2-desert-modern-tower',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', { stories: 3, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_76: VectorEntity = {
  id: 'res-l2-modern-red-tower',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#d32f2f', '#212121', { stories: 3, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_77: VectorEntity = {
  id: 'res-l2-glass-mansion-v3',
  type: 'ZONE_1_2',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, 'rgba(129, 212, 250, 0.4)', '#263238', { stories: 3, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_78: VectorEntity = {
  id: 'res-l2-colonial-estate-tan',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#d7ccc8', '#3e2723', { stories: 3, hasChimney: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_79: VectorEntity = {
  id: 'res-l2-desert-adobe-citadel',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffe0b2', '#bf360c', { stories: 4, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_81: VectorEntity = {
  id: 'res-l2-eco-garden-complex',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#eeeeee', '#2e7d32', { stories: 3, hasVegetation: true, vegType: 'flowers', isWider: true } as any); }
};

export const ResL2_82: VectorEntity = {
  id: 'res-l2-mediterranean-villa-estate',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#d84315', { stories: 2, isWider: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_83: VectorEntity = {
  id: 'res-l2-industrial-loft-v5',
  type: 'ZONE_1_2',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#455a64', '#212121', { stories: 4, roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL2_84: VectorEntity = {
  id: 'res-l2-suburban-blue-estate-v2',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#1976d2', '#263238', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_85: VectorEntity = {
  id: 'res-l2-modern-black-lean-to-estate',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#212121', '#424242', { stories: 2, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_87: VectorEntity = {
  id: 'res-l2-contemporary-steel-citadel',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#607d8b', '#212121', { stories: 3, roofStyle: 'flat', isWider: true, windowColor: '#81d4fa' } as any); }
};

export const ResL2_88: VectorEntity = {
  id: 'res-l2-modern-craftsman-citadel',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#5d4037', '#3e2723', { stories: 2, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL2_89: VectorEntity = {
  id: 'res-l2-pink-suburban-citadel',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fce4ec', '#ad1457', { stories: 4, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_90: VectorEntity = {
  id: 'res-l2-minimalist-white-citadel',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#eeeeee', { stories: 5, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_91: VectorEntity = {
  id: 'res-l2-brick-shophouse-v4',
  type: 'ZONE_1_2',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#b71c1c', '#212121', { stories: 4, isWider: true } as any); }
};

export const ResL2_93: VectorEntity = {
  id: 'res-l2-suburban-yellow-citadel',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#5c4033', { stories: 4, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_95: VectorEntity = {
  id: 'res-l2-modern-white-glass-citadel',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#212121', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_97: VectorEntity = {
  id: 'res-l2-suburban-blue-citadel',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#1e88e5', '#212121', { stories: 3, isWider: true, hasChimney: true, hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL2_99: VectorEntity = {
  id: 'res-l2-modern-glass-pavilion-citadel',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#455a64', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL2_100: VectorEntity = {
  id: 'res-l2-desert-modern-citadel',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw(ctx, ts, t, p, vibe) { drawL2House(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', { stories: 4, roofStyle: 'flat', isWider: true, hasVegetation: true, vegType: 'bush' } as any); }
};
