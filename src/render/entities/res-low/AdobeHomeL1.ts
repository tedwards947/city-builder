import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse } from './ResUtils';

/**
 * AdobeHomeL1: A Level 1 Residential building.
 * A warm, desert-style adobe home with a flat roof.
 */
export const AdobeHomeL1: VectorEntity = {
  id: 'AdobeHomeL1',
  type: 'ZONE_1_1', // Residential Level 1
  tags: ['organic', 'neutral', 'desert'],
  draw: (ctx, ts, t, p, vibe) => {
    drawBaseHouse(ctx, ts, t, p, vibe, '#d7ccc8', '#a1887f', { 
      roofStyle: 'flat',
      windowColor: '#ffffff'
    });
  }
};
