import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * ColonialEstateL2: A Level 2 Residential building.
 * A grand 3-story colonial estate with a chimney and mature tree.
 */
export const ColonialEstateL2: VectorEntity = {
  id: 'ColonialEstateL2',
  type: 'ZONE_1_2',
  tags: ['neutral', 'planned', 'classic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#3f51b5', '#212121', { stories: 3, hasChimney: true, hasVegetation: true, vegType: 'tree' } as any);
  }
};
