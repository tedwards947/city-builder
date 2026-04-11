import type { VectorEntity } from '../../SpriteTypes';
import { drawStorefront } from './CommUtils';

/**
 * GasStationL1: A Level 1 Commercial building.
 * A utilitarian gas station with a canopy, pumps, and a convenience store.
 */
export const GasStationL1: VectorEntity = {
  id: 'GasStationL1',
  type: 'ZONE_2_1',
  tags: ['industrial', 'organic', 'utilitarian'],
  draw: (ctx, ts, t, p, vibe) => {
    drawStorefront(ctx, ts, t, p, vibe, '#efeff4', '#2c2c2e', {
      hasSign: true,
      signKey: 'commercialBrands.gasngo',
      isGasStation: true,
      accentColor: '#ffcc00'
    } as any);
  }
};
