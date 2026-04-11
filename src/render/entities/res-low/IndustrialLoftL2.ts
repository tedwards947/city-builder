import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * IndustrialLoftL2: A Level 2 Residential building.
 * A 3-story industrial-style brick loft with a flat roof and chimney.
 */
export const IndustrialLoftL2: VectorEntity = {
  id: 'IndustrialLoftL2',
  type: 'ZONE_1_2',
  tags: ['industrial', 'planned', 'urban'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#b71c1c', '#424242', { stories: 3, roofStyle: 'flat', hasChimney: true } as any);
  }
};
