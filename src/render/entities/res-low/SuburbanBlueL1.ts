import type { VectorEntity } from '../../SpriteTypes';
import { drawBaseHouse } from './ResUtils';

/**
 * SuburbanBlueL1: A Level 1 Residential building.
 * A classic suburban house with blue siding and an off-center door.
 */
export const SuburbanBlueL1: VectorEntity = {
  id: 'SuburbanBlueL1',
  type: 'ZONE_1_1', // Residential Level 1
  tags: ['neutral', 'planned', 'suburban'],
  draw: (ctx, ts, t, p, vibe) => {
    drawBaseHouse(ctx, ts, t, p, vibe, '#4682b4', '#2f4f4f', { 
      doorSide: 'left',
      hasVegetation: true,
      vegType: 'bush'
    });
  }
};
