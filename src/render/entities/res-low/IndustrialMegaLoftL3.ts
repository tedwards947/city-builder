import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

/**
 * IndustrialMegaLoftL3: A Level 3 Residential building.
 * A 5-story massive industrial brick loft with a flat roof and chimneys.
 */
export const IndustrialMegaLoftL3: VectorEntity = {
  id: 'IndustrialMegaLoftL3',
  type: 'ZONE_1_3',
  tags: ['egalitarian', 'industrial', 'urban'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL3House(ctx, ts, t, p, vibe, '#b71c1c', '#212121', { stories: 5, roofStyle: 'flat', hasChimney: true } as any);
  }
};
