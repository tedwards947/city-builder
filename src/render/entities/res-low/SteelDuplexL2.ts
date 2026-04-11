import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * SteelDuplexL2: A Level 2 Residential building.
 * A 2-story steel-clad duplex with a flat roof and garden.
 */
export const SteelDuplexL2: VectorEntity = {
  id: 'SteelDuplexL2',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#455a64', '#000000', { stories: 2, roofStyle: 'flat', windowColor: '#81d4fa', isWider: true, hasVegetation: true, vegType: 'bush' } as any);
  }
};
