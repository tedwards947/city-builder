import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * MediterraneanMansionL2: A Level 2 Residential building.
 * A 2-story Mediterranean-style mansion, wider footprint with trees.
 */
export const MediterraneanMansionL2: VectorEntity = {
  id: 'MediterraneanMansionL2',
  type: 'ZONE_1_2',
  tags: ['organic', 'neutral'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#fff9c4', '#e64a19', { stories: 2, isWider: true, hasVegetation: true, vegType: 'tree' } as any);
  }
};
