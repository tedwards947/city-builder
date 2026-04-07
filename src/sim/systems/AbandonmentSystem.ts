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
    const { zone, devLevel, power, water, abandoned, distress, crime, fire, fireRisk } = world.layers;

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
      const crimeSevere = crime[i] >= BALANCE.crime.abandonThreshold;
      const crimeElevated = crime[i] > BALANCE.crime.growthThreshold;
      const isBurning = fire[i] > 0;
      const fireRiskSevere = fireRisk[i] >= BALANCE.fire.abandonThreshold;
      
      const conditionsMet = resourcesMet && !crimeSevere && !isBurning && !fireRiskSevere;

      if (!conditionsMet) {
        // Severe crime, fire, or missing resources adds 1-2 distress.
        const distressAdd = (crimeSevere || isBurning || fireRiskSevere) ? 2 : 1;
        distress[i] = Math.min(255, distress[i] + distressAdd);
      } else if (crimeElevated) {
        // Elevated crime (above growth threshold but below abandonment) 
        // adds distress slowly (only every 2nd system tick on avg).
        if (world.tick % (BALANCE.abandonment.distressInterval * 2) === 0) {
          distress[i] = Math.min(255, distress[i] + 1);
        }
      } else {
        // Conditions good — drain distress (building recovers before abandoning).
        if (distress[i] > 0) distress[i]--;
      }

      if (distress[i] >= BALANCE.abandonment.abandonThreshold) {
        abandoned[i] = 1;
        const x = i % width;
        const y = (i - x) / width;
        world.grid.markDirty(x, y);
        world.events.emit('tileAbandoned', { tx: x, ty: y, zone: zone[i], level: devLevel[i] });
      }
    }
  }
}
