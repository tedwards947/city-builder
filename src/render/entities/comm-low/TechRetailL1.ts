import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

/**
 * TechRetailL1: A Level 1 Commercial building.
 * A sleek, minimalist high-tech retail store with one large glass display.
 */
export const TechRetailL1: VectorEntity = {
  id: 'TechRetailL1',
  type: 'ZONE_2_1',
  tags: ['corporate', 'planned', 'modern'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#ffffff', '#333333', {
      hasSign: true,
      signKey: 'commercialBrands.apple',
      windowCount: 1,
      hasParking: false,
      fontStyle: 'display'
    } as any);
  }
};
