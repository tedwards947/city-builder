// Abandonment system.
// Tracks distress per developed zone tile. When a tile's distress accumulates
// past the threshold, it becomes permanently abandoned: no income, no population,
// no resource consumption, no growth. Abandonment can only be cleared by bulldozing.
//
// Conditions checked here are placeholder scaffolding — future phases will add
// additional contributors (crime, fire damage, etc.) by incrementing distress[i]
// from their own systems before this system reads it.

import { World } from '../World';
import { ZONE_NONE } from '../constants';
import { BALANCE } from '../../data/balance';

export class AbandonmentSystem {
  update(world: World): void {
    if (world.tick % BALANCE.abandonment.distressInterval !== 0) return;

    const { width, height } = world.grid;
    const n = width * height;
    const { zone, devLevel, power, water, abandoned, distress, crime } = world.layers;

    for (let i = 0; i < n; i++) {
      // Skip already-abandoned tiles — abandonment is permanent until bulldozed.
      if (abandoned[i] !== 0) continue;

      // Only track developed zone tiles.
      if (zone[i] === ZONE_NONE || devLevel[i] === 0) {
        // Reset stale distress if zone was cleared externally.
        if (distress[i] !== 0) distress[i] = 0;
        continue;
      }

      // Basic condition check.
      const resourcesMet = power[i] !== 0 && water[i] !== 0;
      const crimeTooHigh = crime[i] >= BALANCE.crime.abandonThreshold;
      const conditionsMet = resourcesMet && !crimeTooHigh;

      if (!conditionsMet) {
        // Crime contributes more to distress if very high.
        const distressAdd = crimeTooHigh ? 2 : 1;
        distress[i] = Math.min(255, distress[i] + distressAdd);

        if (distress[i] >= BALANCE.abandonment.abandonThreshold) {
          abandoned[i] = 1;
          const x = i % width;
          const y = (i - x) / width;
          world.grid.markDirty(x, y);
          world.events.emit('tileAbandoned', { tx: x, ty: y, zone: zone[i], level: devLevel[i] });
        }
      } else {
        // Conditions good — drain distress (building recovers before abandoning).
        if (distress[i] > 0) distress[i]--;
      }
    }
  }
}
