import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

/**
 * GrandAdobePalaceL3: A Level 3 Residential building.
 * A 3-story grand desert palace with a flat roof and trees.
 */
export const GrandAdobePalaceL3: VectorEntity = {
  id: 'GrandAdobePalaceL3',
  type: 'ZONE_1_3',
  tags: ['organic', 'neutral', 'desert', 'palace'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL3House(ctx, ts, t, p, vibe, '#d7ccc8', '#a1887f', { stories: 3, roofStyle: 'pitched', hasChimney: true, hasVegetation: true, vegType: 'tree' } as any);
  }
};
