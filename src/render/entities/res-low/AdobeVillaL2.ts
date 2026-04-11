import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * AdobeVillaL2: A Level 2 Residential building.
 * A 2-story desert-style villa with flat roofs and xeriscaping.
 */
export const AdobeVillaL2: VectorEntity = {
  id: 'AdobeVillaL2',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral', 'desert'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#d7ccc8', '#a1887f', { stories: 2, roofStyle: 'flat', windowColor: '#ffffff', hasVegetation: true, vegType: 'bush' } as any);
  }
};
