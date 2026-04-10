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

export const ResL1_B4_26: VectorEntity = {
  id: 'ResL1_B4_26',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#757575', '#3e2723', { roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_27: VectorEntity = {
  id: 'ResL1_B4_27',
  type: 'ZONE_1_1',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#c5e1a5', '#1b5e20', { roofStyle: 'a-frame', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_28: VectorEntity = {
  id: 'ResL1_B4_28',
  type: 'ZONE_1_1',
  tags: ['industrial', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#212121', '#000000', { roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL1_B4_29: VectorEntity = {
  id: 'ResL1_B4_29',
  type: 'ZONE_1_1',
  tags: ['planned', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffcc80', '#e65100', { roofStyle: 'slanted', doorSide: 'left' } as any); }
};

export const ResL1_B4_30: VectorEntity = {
  id: 'ResL1_B4_30',
  type: 'ZONE_1_1',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffe082', '#ff8f00', { roofStyle: 'pagoda', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_31: VectorEntity = {
  id: 'ResL1_B4_31',
  type: 'ZONE_1_1',
  tags: ['corporate', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#bdbdbd', '#263238', { roofStyle: 'pitched', windowColor: '#81d4fa' } as any); }
};

export const ResL1_B4_32: VectorEntity = {
  id: 'ResL1_B4_32',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#81d4fa', '#01579b', { roofStyle: 'a-frame', hasChimney: true, chimneySide: 'left' } as any); }
};

export const ResL1_B4_33: VectorEntity = {
  id: 'ResL1_B4_33',
  type: 'ZONE_1_1',
  tags: ['green', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#80cbc4', '#004d40', { roofStyle: 'flat', doorSide: 'right' } as any); }
};

export const ResL1_B4_34: VectorEntity = {
  id: 'ResL1_B4_34',
  type: 'ZONE_1_1',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#bcaaa4', '#3e2723', { roofStyle: 'slanted', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_35: VectorEntity = {
  id: 'ResL1_B4_35',
  type: 'ZONE_1_1',
  tags: ['planned', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffffff', '#424242', { roofStyle: 'pagoda', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_36: VectorEntity = {
  id: 'ResL1_B4_36',
  type: 'ZONE_1_1',
  tags: ['organic', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ce93d8', '#4a148c', { roofStyle: 'pitched', hasChimney: true } as any); }
};

export const ResL1_B4_37: VectorEntity = {
  id: 'ResL1_B4_37',
  type: 'ZONE_1_1',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#fff59d', '#fbc02d', { roofStyle: 'a-frame', doorSide: 'center' } as any); }
};

export const ResL1_B4_38: VectorEntity = {
  id: 'ResL1_B4_38',
  type: 'ZONE_1_1',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#9fa8da', '#1a237e', { roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_39: VectorEntity = {
  id: 'ResL1_B4_39',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ef9a9a', '#b71c1c', { roofStyle: 'slanted', hasChimney: true, chimneySide: 'right' } as any); }
};

export const ResL1_B4_40: VectorEntity = {
  id: 'ResL1_B4_40',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#f5f5f5', '#424242', { roofStyle: 'pagoda', doorSide: 'left' } as any); }
};

export const ResL1_B4_41: VectorEntity = {
  id: 'ResL1_B4_41',
  type: 'ZONE_1_1',
  tags: ['planned', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#4682b4', '#263238', { roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_42: VectorEntity = {
  id: 'ResL1_B4_42',
  type: 'ZONE_1_1',
  tags: ['organic', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#a52a2a', '#3e2723', { roofStyle: 'a-frame', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_43: VectorEntity = {
  id: 'ResL1_B4_43',
  type: 'ZONE_1_1',
  tags: ['green', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#c5e1a5', '#1b5e20', { roofStyle: 'flat', hasChimney: true } as any); }
};

export const ResL1_B4_44: VectorEntity = {
  id: 'ResL1_B4_44',
  type: 'ZONE_1_1',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#757575', '#212121', { roofStyle: 'slanted', doorSide: 'right' } as any); }
};

export const ResL1_B4_45: VectorEntity = {
  id: 'ResL1_B4_45',
  type: 'ZONE_1_1',
  tags: ['corporate', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#bdbdbd', '#263238', { roofStyle: 'pagoda', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_46: VectorEntity = {
  id: 'ResL1_B4_46',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffcc80', '#e65100', { roofStyle: 'pitched', hasChimney: true, chimneySide: 'left' } as any); }
};

export const ResL1_B4_47: VectorEntity = {
  id: 'ResL1_B4_47',
  type: 'ZONE_1_1',
  tags: ['planned', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#81d4fa', '#01579b', { roofStyle: 'a-frame', doorSide: 'center' } as any); }
};

export const ResL1_B4_48: VectorEntity = {
  id: 'ResL1_B4_48',
  type: 'ZONE_1_1',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffe082', '#ff8f00', { roofStyle: 'flat', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_49: VectorEntity = {
  id: 'ResL1_B4_49',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffffff', '#424242', { roofStyle: 'slanted', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_50: VectorEntity = {
  id: 'ResL1_B4_50',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ce93d8', '#4a148c', { roofStyle: 'pagoda', hasChimney: true } as any); }
};

export const ResL1_B4_51: VectorEntity = {
  id: 'ResL1_B4_51',
  type: 'ZONE_1_1',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#fff59d', '#fbc02d', { roofStyle: 'pitched', doorSide: 'left' } as any); }
};

export const ResL1_B4_52: VectorEntity = {
  id: 'ResL1_B4_52',
  type: 'ZONE_1_1',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#9fa8da', '#1a237e', { roofStyle: 'a-frame', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_53: VectorEntity = {
  id: 'ResL1_B4_53',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ef9a9a', '#b71c1c', { roofStyle: 'flat', hasChimney: true, chimneySide: 'right' } as any); }
};

export const ResL1_B4_54: VectorEntity = {
  id: 'ResL1_B4_54',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#f5f5f5', '#424242', { roofStyle: 'slanted', doorSide: 'center' } as any); }
};

export const ResL1_B4_55: VectorEntity = {
  id: 'ResL1_B4_55',
  type: 'ZONE_1_1',
  tags: ['planned', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#4682b4', '#263238', { roofStyle: 'pagoda', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_56: VectorEntity = {
  id: 'ResL1_B4_56',
  type: 'ZONE_1_1',
  tags: ['organic', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#a52a2a', '#3e2723', { roofStyle: 'pitched', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_57: VectorEntity = {
  id: 'ResL1_B4_57',
  type: 'ZONE_1_1',
  tags: ['green', 'egalitarian'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#c5e1a5', '#1b5e20', { roofStyle: 'a-frame', hasChimney: true } as any); }
};

export const ResL1_B4_58: VectorEntity = {
  id: 'ResL1_B4_58',
  type: 'ZONE_1_1',
  tags: ['industrial', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#757575', '#212121', { roofStyle: 'flat', doorSide: 'right' } as any); }
};

export const ResL1_B4_59: VectorEntity = {
  id: 'ResL1_B4_59',
  type: 'ZONE_1_1',
  tags: ['corporate', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#bdbdbd', '#263238', { roofStyle: 'slanted', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_60: VectorEntity = {
  id: 'ResL1_B4_60',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffcc80', '#e65100', { roofStyle: 'pagoda', hasChimney: true, chimneySide: 'left' } as any); }
};

export const ResL1_B4_61: VectorEntity = {
  id: 'ResL1_B4_61',
  type: 'ZONE_1_1',
  tags: ['planned', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#81d4fa', '#01579b', { roofStyle: 'pitched', doorSide: 'center' } as any); }
};

export const ResL1_B4_62: VectorEntity = {
  id: 'ResL1_B4_62',
  type: 'ZONE_1_1',
  tags: ['organic', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffe082', '#ff8f00', { roofStyle: 'a-frame', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_63: VectorEntity = {
  id: 'ResL1_B4_63',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ffffff', '#424242', { roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any); }
};

export const ResL1_B4_64: VectorEntity = {
  id: 'ResL1_B4_64',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ce93d8', '#4a148c', { roofStyle: 'slanted', hasChimney: true } as any); }
};

export const ResL1_B4_65: VectorEntity = {
  id: 'ResL1_B4_65',
  type: 'ZONE_1_1',
  tags: ['green', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#fff59d', '#fbc02d', { roofStyle: 'pagoda', doorSide: 'left' } as any); }
};

export const ResL1_B4_66: VectorEntity = {
  id: 'ResL1_B4_66',
  type: 'ZONE_1_1',
  tags: ['industrial', 'organic'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#9fa8da', '#1a237e', { roofStyle: 'pitched', hasVegetation: true, vegType: 'tree' } as any); }
};

export const ResL1_B4_67: VectorEntity = {
  id: 'ResL1_B4_67',
  type: 'ZONE_1_1',
  tags: ['corporate', 'planned'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#ef9a9a', '#b71c1c', { roofStyle: 'a-frame', hasChimney: true, chimneySide: 'right' } as any); }
};

export const ResL1_B4_68: VectorEntity = {
  id: 'ResL1_B4_68',
  type: 'ZONE_1_1',
  tags: ['egalitarian', 'green'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#f5f5f5', '#424242', { roofStyle: 'flat', doorSide: 'center' } as any); }
};

export const ResL1_B4_69: VectorEntity = {
  id: 'ResL1_B4_69',
  type: 'ZONE_1_1',
  tags: ['planned', 'industrial'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#4682b4', '#263238', { roofStyle: 'slanted', hasVegetation: true, vegType: 'bush' } as any); }
};

export const ResL1_B4_70: VectorEntity = {
  id: 'ResL1_B4_70',
  type: 'ZONE_1_1',
  tags: ['organic', 'corporate'],
  draw(ctx, ts, t, p, vibe) { drawBaseHouse(ctx, ts, t, p, vibe, '#a52a2a', '#3e2723', { roofStyle: 'pagoda', hasVegetation: true, vegType: 'flowers' } as any); }
};
