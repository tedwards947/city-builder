import type { World } from '../World';
import { ZONE_R, ZONE_C, ZONE_I, ZONE_NONE, BUILDING_NONE } from '../constants';
import { BALANCE } from '../../data/balance';

/**
 * FireSystem manages fire risk, ignition, and spreading.
 * Fire risk is higher in industrial areas and polluted areas.
 * Fire stations reduce risk and prevent spreading.
 */
export class FireSystem {
  update(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    const pollution = world.layers.pollution;
    const fireRisk = world.layers.fireRisk;
    const fire = world.layers.fire;
    const fireStation = world.layers.fireStation;
    const b = BALANCE.fire;

    const building = world.layers.building;

    for (let i = 0; i < n; i++) {
      const z = zone[i];

      // Skip tiles that are empty and have no active fire / residual risk.
      if (z === ZONE_NONE && building[i] === BUILDING_NONE && fire[i] === 0 && fireRisk[i] === 0) continue;

      // 1. Calculate Risk
      let targetRisk = 0;
      const level = dev[i];

      if (z !== ZONE_NONE && level > 0) {
        let riskMult = 1.0;
        if (z === ZONE_R) riskMult = b.riskR;
        else if (z === ZONE_C) riskMult = b.riskC;
        else if (z === ZONE_I) riskMult = b.riskI;

        targetRisk = 20 * level * riskMult;
        targetRisk += pollution[i] * b.pollutionRiskMult;
      }

      // Fire station protection reduces risk
      if (fireStation[i] === 1) {
        targetRisk *= b.fireStationEffectiveness;
      }

      targetRisk = Math.min(255, Math.max(0, targetRisk));
      fireRisk[i] = Math.floor(fireRisk[i] + (targetRisk - fireRisk[i]) * b.riskSmoothing);

      // 2. Handle Existing Fires
      if (fire[i] > 0) {
        // Fire station protection puts out fires faster
        if (fireStation[i] === 1) {
          fire[i] = Math.max(0, fire[i] - 5);
        } else {
          fire[i]--;
        }

        if (fire[i] === 0) {
          world.grid.markDirty(i % width, (i / width) | 0);
        }

        // 3. Fire Spreading
        if (fire[i] > 0 && world.rng() < b.spreadProbability) {
          // Spread to a random neighbor (no array allocation).
          const tx = i % width;
          const ty = (i / width) | 0;
          const dir = Math.floor(world.rng() * 4);
          const ntx = dir === 0 ? tx - 1 : dir === 1 ? tx + 1 : tx;
          const nty = dir === 2 ? ty - 1 : dir === 3 ? ty + 1 : ty;
          if (world.grid.inBounds(ntx, nty)) {
            const ni = world.grid.idx(ntx, nty);
            // Can only spread to developed zones or buildings
            if (fire[ni] === 0 && (zone[ni] !== ZONE_NONE || building[ni] !== BUILDING_NONE)) {
              // If fire station covers it, spread is much less likely
              if (fireStation[ni] === 0 || world.rng() < b.fireStationEffectiveness) {
                fire[ni] = b.burnDuration;
                world.grid.markDirty(ntx, nty);
                world.events.emit('fireSpreading', { tx: ntx, ty: nty });
              }
            }
          }
        }
        continue;
      }

      // 4. Ignition
      if (z !== ZONE_NONE && level > 0) {
        const ignitionProb = b.baseProbability * (fireRisk[i] / 20);
        if (world.rng() < ignitionProb) {
          fire[i] = b.burnDuration;
          const itx = i % width;
          const ity = (i / width) | 0;
          world.grid.markDirty(itx, ity);
          world.events.emit('fireIgnition', { tx: itx, ty: ity, zone: z, devLevel: level });
        }
      }
    }
  }
}
