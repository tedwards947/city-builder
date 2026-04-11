import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

/**
 * HardwareStoreL1: A Level 1 Commercial building.
 * A larger hardware or auto-parts store with parking and technical signage.
 */
export const HardwareStoreL1: VectorEntity = {
  id: 'HardwareStoreL1',
  type: 'ZONE_2_1',
  tags: ['corporate', 'industrial'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#cfd8dc', '#455a64', {
      hasSign: true,
      signKey: 'commercialBrands.autozone',
      signColor: '#d32f2f',
      windowCount: 3,
      hasParking: true,
      fontStyle: 'mono'
    } as any);
  }
};
