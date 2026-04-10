import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

export const CommL1_01: VectorEntity = {
  id: 'CommL1_01',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f5f5f5', '#333333', {
      hasSign: true,
      signKey: 'commercialBrands.bmart',
      windowCount: 4,
      hasParking: true
    } as any);
  }
};

export const CommL1_02: VectorEntity = {
  id: 'CommL1_02',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#efeff4', '#2c2c2e', {
      hasSign: true,
      signKey: 'commercialBrands.gasngo',
      isGasStation: true,
      accentColor: '#ffcc00'
    } as any);
  }
};

export const CommL1_03: VectorEntity = {
  id: 'CommL1_03',
  type: 'ZONE_2_1',
  tags: ['green', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e8f5e9', '#2e7d32', {
      hasSign: true,
      signKey: 'commercialBrands.freshly',
      hasAwning: true,
      awningColor: '#4caf50',
      windowCount: 3
    } as any);
  }
};

export const CommL1_04: VectorEntity = {
  id: 'CommL1_04',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eceff1', '#263238', {
      hasSign: true,
      signKey: 'commercialBrands.byteshop',
      signColor: '#00bcd4',
      windowCount: 5
    } as any);
  }
};

export const CommL1_05: VectorEntity = {
  id: 'CommL1_05',
  type: 'ZONE_2_1',
  tags: ['organic', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fff9c4', '#fbc02d', {
      hasSign: true,
      signKey: 'commercialBrands.thecup',
      hasAwning: true,
      awningColor: '#795548',
      windowCount: 2
    } as any);
  }
};

export const CommL1_06: VectorEntity = {
  id: 'CommL1_06',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#ffecb3', '#ffa000', {
      hasSign: true,
      signKey: 'commercialBrands.pizzax',
      hasParking: true,
      windowCount: 2
    } as any);
  }
};

export const CommL1_07: VectorEntity = {
  id: 'CommL1_07',
  type: 'ZONE_2_1',
  tags: ['corporate', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#cfd8dc', '#455a64', {
      hasSign: true,
      signKey: 'commercialBrands.autozone',
      signColor: '#d32f2f',
      windowCount: 3,
      hasParking: true
    } as any);
  }
};

export const CommL1_08: VectorEntity = {
  id: 'CommL1_08',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e1f5fe', '#0288d1', {
      hasSign: true,
      signKey: 'commercialBrands.megadrug',
      windowCount: 6,
      hasParking: true
    } as any);
  }
};

export const CommL1_09: VectorEntity = {
  id: 'CommL1_09',
  type: 'ZONE_2_1',
  tags: ['organic', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', {
      hasSign: true,
      signKey: 'commercialBrands.quickstop',
      hasAwning: true,
      awningColor: '#ff5722',
      windowCount: 2
    } as any);
  }
};

export const CommL1_10: VectorEntity = {
  id: 'CommL1_10',
  type: 'ZONE_2_1',
  tags: ['green', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f1f8e9', '#558b2f', {
      hasSign: true,
      signKey: 'commercialBrands.ecomart',
      hasAwning: true,
      awningColor: '#8d6e63',
      windowCount: 3
    } as any);
  }
};

export const CommL1_11: VectorEntity = {
  id: 'CommL1_11',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eeeeee', '#212121', {
      hasSign: true,
      signKey: 'commercialBrands.lowes',
      signColor: '#1565c0',
      windowCount: 4,
      hasParking: true
    } as any);
  }
};

export const CommL1_12: VectorEntity = {
  id: 'CommL1_12',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f5f5f5', '#1b5e20', {
      hasSign: true,
      signKey: 'commercialBrands.starbucks',
      hasAwning: true,
      awningColor: '#00704a',
      windowCount: 3
    } as any);
  }
};

export const CommL1_13: VectorEntity = {
  id: 'CommL1_13',
  type: 'ZONE_2_1',
  tags: ['corporate', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fff9c4', '#fbc02d', {
      hasSign: true,
      signKey: 'commercialBrands.subway',
      hasAwning: true,
      awningColor: '#008938',
      windowCount: 2
    } as any);
  }
};

export const CommL1_14: VectorEntity = {
  id: 'CommL1_14',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#ffffff', '#333333', {
      hasSign: true,
      signKey: 'commercialBrands.apple',
      windowCount: 1,
      hasParking: false
    } as any);
  }
};

export const CommL1_15: VectorEntity = {
  id: 'CommL1_15',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fafafa', '#212121', {
      hasSign: true,
      signKey: 'commercialBrands.nike',
      windowCount: 2,
      hasParking: true
    } as any);
  }
};

export const CommL1_16: VectorEntity = {
  id: 'CommL1_16',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fafafa', '#424242', {
      hasSign: true,
      signKey: 'commercialBrands.bmart',
      windowCount: 5,
      hasParking: true
    } as any);
  }
};

export const CommL1_17: VectorEntity = {
  id: 'CommL1_17',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eeeeee', '#333333', {
      hasSign: true,
      signKey: 'commercialBrands.gasngo',
      isGasStation: true,
      accentColor: '#f44336'
    } as any);
  }
};

export const CommL1_18: VectorEntity = {
  id: 'CommL1_18',
  type: 'ZONE_2_1',
  tags: ['green', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f1f8e9', '#33691e', {
      hasSign: true,
      signKey: 'commercialBrands.freshly',
      hasAwning: true,
      awningColor: '#8bc34a',
      windowCount: 4
    } as any);
  }
};

export const CommL1_19: VectorEntity = {
  id: 'CommL1_19',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e0f7fa', '#006064', {
      hasSign: true,
      signKey: 'commercialBrands.byteshop',
      windowCount: 3,
      signColor: '#ff4081'
    } as any);
  }
};

export const CommL1_20: VectorEntity = {
  id: 'CommL1_20',
  type: 'ZONE_2_1',
  tags: ['organic', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fffde7', '#fbc02d', {
      hasSign: true,
      signKey: 'commercialBrands.thecup',
      hasAwning: true,
      awningColor: '#5d4037',
      windowCount: 2
    } as any);
  }
};

export const CommL1_21: VectorEntity = {
  id: 'CommL1_21',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fff8e1', '#ff8f00', {
      hasSign: true,
      signKey: 'commercialBrands.pizzax',
      hasAwning: true,
      awningColor: '#d32f2f',
      windowCount: 3
    } as any);
  }
};

export const CommL1_22: VectorEntity = {
  id: 'CommL1_22',
  type: 'ZONE_2_1',
  tags: ['corporate', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eceff1', '#263238', {
      hasSign: true,
      signKey: 'commercialBrands.autozone',
      hasParking: true,
      windowCount: 4
    } as any);
  }
};

export const CommL1_23: VectorEntity = {
  id: 'CommL1_23',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e3f2fd', '#1565c0', {
      hasSign: true,
      signKey: 'commercialBrands.megadrug',
      hasParking: true,
      windowCount: 5
    } as any);
  }
};

export const CommL1_24: VectorEntity = {
  id: 'CommL1_24',
  type: 'ZONE_2_1',
  tags: ['organic', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fbe9e7', '#bf360c', {
      hasSign: true,
      signKey: 'commercialBrands.quickstop',
      hasAwning: true,
      awningColor: '#ff5722',
      windowCount: 2
    } as any);
  }
};

export const CommL1_25: VectorEntity = {
  id: 'CommL1_25',
  type: 'ZONE_2_1',
  tags: ['green', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e8f5e9', '#1b5e20', {
      hasSign: true,
      signKey: 'commercialBrands.ecomart',
      hasAwning: true,
      awningColor: '#2e7d32',
      windowCount: 3
    } as any);
  }
};
