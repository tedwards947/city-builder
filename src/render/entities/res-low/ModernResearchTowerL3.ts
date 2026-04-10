import type { VectorEntity } from '../../SpriteTypes';
import { drawL3House } from './ResUtils';

/**
 * ModernResearchTowerL3: A Level 3 Residential building.
 * A 4-story modern research tower with trees and a flat roof.
 */
export const ModernResearchTowerL3: VectorEntity = {
  id: 'ModernResearchTowerL3',
  type: 'ZONE_1_3',
  tags: ['planned', 'corporate', 'modern'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL3House(ctx, ts, t, p, vibe, '#ffffff', '#424242', { stories: 4, roofStyle: 'flat', hasVegetation: true, vegType: 'tree' } as any);
  }
};
