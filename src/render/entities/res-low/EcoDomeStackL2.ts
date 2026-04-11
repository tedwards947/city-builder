import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * EcoDomeStackL2: A Level 2 Residential building.
 * A 2-story stack of ecological dome homes with flower gardens.
 */
export const EcoDomeStackL2: VectorEntity = {
  id: 'EcoDomeStackL2',
  type: 'ZONE_1_2',
  tags: ['green', 'planned'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#f1f8e9', '#33691e', { stories: 2, hasVegetation: true, vegType: 'flowers' } as any);
  }
};
