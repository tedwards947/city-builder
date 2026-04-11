import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

/**
 * GlassMansardEstateL3: A Level 3 Residential building.
 * A 4-story luxury estate with a mansard roof and flower gardens.
 */
export const GlassMansardEstateL3: VectorEntity = {
  id: 'GlassMansardEstateL3',
  type: 'ZONE_1_3',
  tags: ['planned', 'green', 'luxury'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL3House(ctx, ts, t, p, vibe, '#f1f8e9', '#33691e', { stories: 4, roofStyle: 'mansard', hasVegetation: true, vegType: 'flowers' } as any);
  }
};
