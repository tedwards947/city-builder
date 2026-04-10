import type { VectorEntity } from '../../SpriteTypes';
import { drawL2House } from './ResUtils';

/**
 * ModernWhiteEstateL2: A Level 2 Residential building.
 * A 2-story modern white estate, wider footprint, flat roof, and flowers.
 */
export const ModernWhiteEstateL2: VectorEntity = {
  id: 'ModernWhiteEstateL2',
  type: 'ZONE_1_2',
  tags: ['planned', 'corporate', 'modern'],
  draw: (ctx, ts, t, p, vibe) => {
    drawL2House(ctx, ts, t, p, vibe, '#ffffff', '#424242', { stories: 2, isWider: true, roofStyle: 'flat', hasVegetation: true, vegType: 'flowers' } as any);
  }
};
