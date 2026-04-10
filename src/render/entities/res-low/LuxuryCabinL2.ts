import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * LuxuryCabinL2: A Level 2 Residential building.
 * A large 2-story luxury log cabin with a wide footprint and trees.
 */
export const LuxuryCabinL2: VectorEntity = {
  id: 'LuxuryCabinL2',
  type: 'ZONE_1_2',
  tags: ['green', 'organic', 'rustic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#5d4037', '#3e2723', { stories: 2, hasChimney: true, hasVegetation: true, vegType: 'tree', isWider: true } as any);
  }
};
