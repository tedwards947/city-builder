import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

export const CommL1_51: VectorEntity = {
  id: 'CommL1_51',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#ffecb3', '#ffa000', {
      hasSign: true,
      signKey: 'commercialBrands.pizzax',
      hasParking: true,
      windowCount: 3
    } as any);
  }
};

export const CommL1_52: VectorEntity = {
  id: 'CommL1_52',
  type: 'ZONE_2_1',
  tags: ['corporate', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#cfd8dc', '#455a64', {
      hasSign: true,
      signKey: 'commercialBrands.autozone',
      hasParking: true,
      windowCount: 4
    } as any);
  }
};

export const CommL1_53: VectorEntity = {
  id: 'CommL1_53',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e3f2fd', '#1565c0', {
      hasSign: true,
      signKey: 'commercialBrands.megadrug',
      hasParking: true,
      windowCount: 6
    } as any);
  }
};

export const CommL1_54: VectorEntity = {
  id: 'CommL1_54',
  type: 'ZONE_2_1',
  tags: ['organic', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', {
      hasSign: true,
      signKey: 'commercialBrands.quickstop',
      hasAwning: true,
      awningColor: '#ff9800',
      windowCount: 2
    } as any);
  }
};

export const CommL1_55: VectorEntity = {
  id: 'CommL1_55',
  type: 'ZONE_2_1',
  tags: ['green', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f1f8e9', '#33691e', {
      hasSign: true,
      signKey: 'commercialBrands.ecomart',
      hasAwning: true,
      awningColor: '#7cb342',
      windowCount: 3
    } as any);
  }
};

export const CommL1_56: VectorEntity = {
  id: 'CommL1_56',
  type: 'ZONE_2_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eceff1', '#263238', {
      hasSign: true,
      signKey: 'commercialBrands.lowes',
      windowCount: 4,
      hasParking: true
    } as any);
  }
};

export const CommL1_57: VectorEntity = {
  id: 'CommL1_57',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#ffffff', '#1b5e20', {
      hasSign: true,
      signKey: 'commercialBrands.starbucks',
      hasAwning: true,
      awningColor: '#00704a',
      windowCount: 4
    } as any);
  }
};

export const CommL1_58: VectorEntity = {
  id: 'CommL1_58',
  type: 'ZONE_2_1',
  tags: ['corporate', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fff9c4', '#fbc02d', {
      hasSign: true,
      signKey: 'commercialBrands.subway',
      hasAwning: true,
      awningColor: '#2e7d32',
      windowCount: 2
    } as any);
  }
};

export const CommL1_59: VectorEntity = {
  id: 'CommL1_59',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f5f5f5', '#212121', {
      hasSign: true,
      signKey: 'commercialBrands.apple',
      windowCount: 1,
      hasParking: false
    } as any);
  }
};

export const CommL1_60: VectorEntity = {
  id: 'CommL1_60',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fafafa', '#212121', {
      hasSign: true,
      signKey: 'commercialBrands.nike',
      windowCount: 3,
      hasParking: true
    } as any);
  }
};

export const CommL1_61: VectorEntity = {
  id: 'CommL1_61',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f5f5f5', '#424242', {
      hasSign: true,
      signKey: 'commercialBrands.bmart',
      windowCount: 5,
      hasParking: true
    } as any);
  }
};

export const CommL1_62: VectorEntity = {
  id: 'CommL1_62',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eeeeee', '#333333', {
      hasSign: true,
      signKey: 'commercialBrands.gasngo',
      isGasStation: true,
      accentColor: '#ffa000'
    } as any);
  }
};

export const CommL1_63: VectorEntity = {
  id: 'CommL1_63',
  type: 'ZONE_2_1',
  tags: ['green', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e8f5e9', '#2e7d32', {
      hasSign: true,
      signKey: 'commercialBrands.freshly',
      hasAwning: true,
      awningColor: '#43a047',
      windowCount: 3
    } as any);
  }
};

export const CommL1_64: VectorEntity = {
  id: 'CommL1_64',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e1f5fe', '#01579b', {
      hasSign: true,
      signKey: 'commercialBrands.byteshop',
      windowCount: 4,
      signColor: '#03a9f4'
    } as any);
  }
};

export const CommL1_65: VectorEntity = {
  id: 'CommL1_65',
  type: 'ZONE_2_1',
  tags: ['organic', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fff9c4', '#fbc02d', {
      hasSign: true,
      signKey: 'commercialBrands.thecup',
      hasAwning: true,
      awningColor: '#5d4037',
      windowCount: 2
    } as any);
  }
};

export const CommL1_66: VectorEntity = {
  id: 'CommL1_66',
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

export const CommL1_67: VectorEntity = {
  id: 'CommL1_67',
  type: 'ZONE_2_1',
  tags: ['corporate', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#cfd8dc', '#455a64', {
      hasSign: true,
      signKey: 'commercialBrands.autozone',
      hasParking: true,
      windowCount: 3
    } as any);
  }
};

export const CommL1_68: VectorEntity = {
  id: 'CommL1_68',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e1f5fe', '#0288d1', {
      hasSign: true,
      signKey: 'commercialBrands.megadrug',
      hasParking: true,
      windowCount: 4
    } as any);
  }
};

export const CommL1_69: VectorEntity = {
  id: 'CommL1_69',
  type: 'ZONE_2_1',
  tags: ['organic', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#d7ccc8', '#5d4037', {
      hasSign: true,
      signKey: 'commercialBrands.quickstop',
      hasAwning: true,
      awningColor: '#ff5722',
      windowCount: 3
    } as any);
  }
};

export const CommL1_70: VectorEntity = {
  id: 'CommL1_70',
  type: 'ZONE_2_1',
  tags: ['green', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f1f8e9', '#558b2f', {
      hasSign: true,
      signKey: 'commercialBrands.ecomart',
      hasAwning: true,
      awningColor: '#689f38',
      windowCount: 3
    } as any);
  }
};

export const CommL1_71: VectorEntity = {
  id: 'CommL1_71',
  type: 'ZONE_2_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eceff1', '#263238', {
      hasSign: true,
      signKey: 'commercialBrands.lowes',
      windowCount: 6,
      hasParking: true
    } as any);
  }
};

export const CommL1_72: VectorEntity = {
  id: 'CommL1_72',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f5f5f5', '#1b5e20', {
      hasSign: true,
      signKey: 'commercialBrands.starbucks',
      hasAwning: true,
      awningColor: '#00704a',
      windowCount: 2
    } as any);
  }
};

export const CommL1_73: VectorEntity = {
  id: 'CommL1_73',
  type: 'ZONE_2_1',
  tags: ['corporate', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fff9c4', '#fbc02d', {
      hasSign: true,
      signKey: 'commercialBrands.subway',
      hasAwning: true,
      awningColor: '#008938',
      windowCount: 3
    } as any);
  }
};

export const CommL1_74: VectorEntity = {
  id: 'CommL1_74',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#ffffff', '#333333', {
      hasSign: true,
      signKey: 'commercialBrands.apple',
      windowCount: 2,
      hasParking: false
    } as any);
  }
};

export const CommL1_75: VectorEntity = {
  id: 'CommL1_75',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fafafa', '#212121', {
      hasSign: true,
      signKey: 'commercialBrands.nike',
      windowCount: 4,
      hasParking: true
    } as any);
  }
};
