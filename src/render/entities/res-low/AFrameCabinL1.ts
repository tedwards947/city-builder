import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse } from './ResUtils';

/**
 * AFrameCabinL1: A Level 1 Residential building.
 * A rustic cabin featuring a distinctive steep A-frame roof.
 */
export const AFrameCabinL1: VectorEntity = {
  id: 'AFrameCabinL1',
  type: 'ZONE_1_1', // Residential Level 1
  tags: ['organic', 'egalitarian', 'rustic'],
  draw: (ctx, ts, t, p, vibe) => {
    drawBaseHouse(ctx, ts, t, p, vibe, '#e0e0e0', '#5d4037', { 
      roofStyle: 'a-frame',
      hasChimney: true,
      chimneySide: 'left'
    });
  }
};
