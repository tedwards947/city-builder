import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse } from './ResUtils';

/**
 * ModernBoxL1: A Level 1 Residential building.
 * A sleek, modernist house with a flat roof and large windows.
 */
export const ModernBoxL1: VectorEntity = {
  id: 'ModernBoxL1',
  type: 'ZONE_1_1', // Residential Level 1
  tags: ['planned', 'corporate', 'modern'],
  draw: (ctx, ts, t, p, vibe) => {
    drawBaseHouse(ctx, ts, t, p, vibe, '#ffffff', '#424242', { 
      roofStyle: 'flat',
      windowColor: 'rgba(129, 212, 250, 0.6)',
      hasVegetation: true,
      vegType: 'flowers'
    });
  }
};
