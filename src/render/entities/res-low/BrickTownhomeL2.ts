import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * BrickTownhomeL2: A Level 2 Residential building.
 * A tall 3-story brick townhome with a chimney.
 */
export const BrickTownhomeL2: VectorEntity = {
  id: 'BrickTownhomeL2',
  type: 'ZONE_1_2',
  tags: ['egalitarian', 'organic', 'urban'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#b71c1c', '#424242', { stories: 3, hasChimney: true } as any);
  }
};
