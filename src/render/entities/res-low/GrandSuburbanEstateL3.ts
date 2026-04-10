import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

/**
 * GrandSuburbanEstateL3: A Level 3 Residential building.
 * A massive 5-story suburban estate with a pitched roof.
 */
export const GrandSuburbanEstateL3: VectorEntity = {
  id: 'GrandSuburbanEstateL3',
  type: 'ZONE_1_3',
  tags: ['corporate', 'egalitarian', 'estate'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL3House(ctx, ts, t, p, vibe, '#4682b4', '#2f4f4f', { stories: 5, roofStyle: 'pitched', windowColor: '#ffffff' } as any);
  }
};
