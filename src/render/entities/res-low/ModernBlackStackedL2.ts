import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * ModernBlackStackedL2: A Level 2 Residential building.
 * A 3-story stacked modern residence with dark finishes and a wider footprint.
 */
export const ModernBlackStackedL2: VectorEntity = {
  id: 'ModernBlackStackedL2',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate', 'modern'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 3, roofStyle: 'flat', windowColor: '#ffeb3b', isWider: true } as any);
  }
};
