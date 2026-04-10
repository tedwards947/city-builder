import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

export const CommL1_26: VectorEntity = {
  id: 'CommL1_26',
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

export const CommL1_27: VectorEntity = {
  id: 'CommL1_27',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#ffffff', '#1b5e20', {
      hasSign: true,
      signKey: 'commercialBrands.starbucks',
      hasAwning: true,
      awningColor: '#00704a',
      windowCount: 3
    } as any);
  }
};

export const CommL1_28: VectorEntity = {
  id: 'CommL1_28',
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

export const CommL1_29: VectorEntity = {
  id: 'CommL1_29',
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

export const CommL1_30: VectorEntity = {
  id: 'CommL1_30',
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

export const CommL1_31: VectorEntity = {
  id: 'CommL1_31',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eeeeee', '#424242', {
      hasSign: true,
      signKey: 'commercialBrands.bmart',
      windowCount: 6,
      hasParking: true
    } as any);
  }
};

export const CommL1_32: VectorEntity = {
  id: 'CommL1_32',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#cfd8dc', '#455a64', {
      hasSign: true,
      signKey: 'commercialBrands.gasngo',
      isGasStation: true,
      accentColor: '#3f51b5'
    } as any);
  }
};

export const CommL1_33: VectorEntity = {
  id: 'CommL1_33',
  type: 'ZONE_2_1',
  tags: ['green', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e8f5e9', '#1b5e20', {
      hasSign: true,
      signKey: 'commercialBrands.freshly',
      hasAwning: true,
      awningColor: '#4caf50',
      windowCount: 3
    } as any);
  }
};

export const CommL1_34: VectorEntity = {
  id: 'CommL1_34',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eceff1', '#263238', {
      hasSign: true,
      signKey: 'commercialBrands.byteshop',
      windowCount: 4,
      signColor: '#00bcd4'
    } as any);
  }
};

export const CommL1_35: VectorEntity = {
  id: 'CommL1_35',
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

export const CommL1_36: VectorEntity = {
  id: 'CommL1_36',
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

export const CommL1_37: VectorEntity = {
  id: 'CommL1_37',
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

export const CommL1_38: VectorEntity = {
  id: 'CommL1_38',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e1f5fe', '#0288d1', {
      hasSign: true,
      signKey: 'commercialBrands.megadrug',
      hasParking: true,
      windowCount: 5
    } as any);
  }
};

export const CommL1_39: VectorEntity = {
  id: 'CommL1_39',
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

export const CommL1_40: VectorEntity = {
  id: 'CommL1_40',
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

export const CommL1_41: VectorEntity = {
  id: 'CommL1_41',
  type: 'ZONE_2_1',
  tags: ['industrial', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eceff1', '#263238', {
      hasSign: true,
      signKey: 'commercialBrands.lowes',
      windowCount: 5,
      hasParking: true
    } as any);
  }
};

export const CommL1_42: VectorEntity = {
  id: 'CommL1_42',
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

export const CommL1_43: VectorEntity = {
  id: 'CommL1_43',
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

export const CommL1_44: VectorEntity = {
  id: 'CommL1_44',
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

export const CommL1_45: VectorEntity = {
  id: 'CommL1_45',
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

export const CommL1_46: VectorEntity = {
  id: 'CommL1_46',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#f5f5f5', '#424242', {
      hasSign: true,
      signKey: 'commercialBrands.bmart',
      windowCount: 4,
      hasParking: true
    } as any);
  }
};

export const CommL1_47: VectorEntity = {
  id: 'CommL1_47',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#eceff1', '#2c2c2e', {
      hasSign: true,
      signKey: 'commercialBrands.gasngo',
      isGasStation: true,
      accentColor: '#4caf50'
    } as any);
  }
};

export const CommL1_48: VectorEntity = {
  id: 'CommL1_48',
  type: 'ZONE_2_1',
  tags: ['green', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e8f5e9', '#2e7d32', {
      hasSign: true,
      signKey: 'commercialBrands.freshly',
      hasAwning: true,
      awningColor: '#66bb6a',
      windowCount: 4
    } as any);
  }
};

export const CommL1_49: VectorEntity = {
  id: 'CommL1_49',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e1f5fe', '#01579b', {
      hasSign: true,
      signKey: 'commercialBrands.byteshop',
      windowCount: 5,
      signColor: '#29b6f6'
    } as any);
  }
};

export const CommL1_50: VectorEntity = {
  id: 'CommL1_50',
  type: 'ZONE_2_1',
  tags: ['organic', 'egalitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#fff9c4', '#fbc02d', {
      hasSign: true,
      signKey: 'commercialBrands.thecup',
      hasAwning: true,
      awningColor: '#8d6e63',
      windowCount: 2
    } as any);
  }
};
