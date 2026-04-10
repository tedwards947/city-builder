import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * BrickManorL2: A Level 2 Residential building.
 * A 2-story classic brick manor with a chimney and mature tree.
 */
export const BrickManorL2: VectorEntity = {
  id: 'BrickManorL2',
  type: 'ZONE_1_2', // Residential Level 2
  tags: ['neutral', 'organic', 'classic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { 
      stories: 2, 
      hasChimney: true, 
      hasVegetation: true, 
      vegType: 'tree' 
    } as any);
  }
};
