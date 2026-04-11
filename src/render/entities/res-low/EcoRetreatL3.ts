import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

/**
 * EcoRetreatL3: A Level 3 Residential building.
 * A 3-story ecological retreat with a pitched roof and garden bushes.
 */
export const EcoRetreatL3: VectorEntity = {
  id: 'EcoRetreatL3',
  type: 'ZONE_1_3',
  tags: ['organic', 'green', 'retreat'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL3House(ctx, ts, t, p, vibe, '#5d4037', '#2e7d32', { stories: 3, roofStyle: 'pitched', hasVegetation: true, vegType: 'bush' } as any);
  }
};
