import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

/**
 * SmallShopL1: A Level 1 Commercial building.
 * A basic generic storefront with large display windows and a sign.
 */
export const SmallShopL1: VectorEntity = {
  id: 'SmallShopL1',
  type: 'ZONE_2_1', // Commercial Level 1
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
