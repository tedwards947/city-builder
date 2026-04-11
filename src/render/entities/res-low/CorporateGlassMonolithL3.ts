import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

/**
 * CorporateGlassMonolithL3: A Level 3 Residential building.
 * A 6-story massive glass residential monolith, wider footprint and sleek design.
 */
export const CorporateGlassMonolithL3: VectorEntity = {
  id: 'CorporateGlassMonolithL3',
  type: 'ZONE_1_3',
  tags: ['corporate', 'planned', 'monolith'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL3House(ctx, ts, t, p, vibe, '#212121', '#000000', { stories: 6, roofStyle: 'flat', windowColor: '#81d4fa', isWider: true } as any);
  }
};
