import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * GeodesicComplexL2: A Level 2 Residential building.
 * A 2-story complex of interconnected geodesic domes with garden space.
 */
export const GeodesicComplexL2: VectorEntity = {
  id: 'GeodesicComplexL2',
  type: 'ZONE_1_2',
  tags: ['green', 'planned', 'futuristic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, 'rgba(129, 212, 250, 0.4)', '#fff', { stories: 2, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any);
  }
};
