import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * AsianModernTowerL2: A Level 2 Residential building.
 * A 3-story modern tower inspired by Asian architecture, with trees.
 */
export const AsianModernTowerL2: VectorEntity = {
  id: 'AsianModernTowerL2',
  type: 'ZONE_1_2',
  tags: ['planned', 'neutral', 'modern'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#eeeeee', '#c62828', { stories: 3, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any);
  }
};
