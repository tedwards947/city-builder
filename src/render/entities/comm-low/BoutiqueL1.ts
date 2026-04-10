import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

/**
 * BoutiqueL1: A Level 1 Commercial building.
 * A compact, high-end shop with a decorative awning and large windows.
 */
export const BoutiqueL1: VectorEntity = {
  id: 'BoutiqueL1',
  type: 'ZONE_2_1',
  tags: ['organic', 'egalitarian', 'boutique'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#e8f5e9', '#2e7d32', {
      hasSign: true,
      signKey: 'commercialBrands.freshly',
      hasAwning: true,
      awningColor: '#4caf50',
      windowCount: 3,
      fontStyle: 'serif'
    } as any);
  }
};
