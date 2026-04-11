import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * SuburbanLargeL2: A Level 2 Residential building.
 * A 2-story large suburban home, wider footprint with garden bushes.
 */
export const SuburbanLargeL2: VectorEntity = {
  id: 'SuburbanLargeL2',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned', 'suburban'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#4682b4', '#2f4f4f', { stories: 2, isWider: true, hasVegetation: true, vegType: 'bush' } as any);
  }
};
