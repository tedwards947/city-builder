import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * ContemporaryGlassL2: A Level 2 Residential building.
 * A 3-story contemporary home with floor-to-ceiling glass and flower gardens.
 */
export const ContemporaryGlassL2: VectorEntity = {
  id: 'ContemporaryGlassL2',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate', 'modern'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#607d8b', { stories: 3, roofStyle: 'flat', windowColor: 'rgba(129, 212, 250, 0.6)', hasVegetation: true, vegType: 'flowers' } as any);
  }
};
