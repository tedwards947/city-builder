import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse } from './ResUtils';

/**
 * CottageL1: A Level 1 Residential building.
 * A simple, classic cottage with a peaked roof and a chimney.
 */
export const CottageL1: VectorEntity = {
  id: 'CottageL1',
  type: 'ZONE_1_1', // Residential Level 1
  tags: ['neutral', 'organic', 'classic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawBaseHouse(ctx, ts, t, p, vibe, '#a52a2a', '#3e3e3e', { 
      hasChimney: true,
      roofStyle: 'pitched'
    });
  }
};
