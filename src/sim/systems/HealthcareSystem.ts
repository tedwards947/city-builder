import type { World } from '../World';
import { ZONE_R } from '../constants';
import { BALANCE } from '../../data/balance';

/**
 * HealthcareSystem manages citizen sickness and death events for residential zones.
 *
 * Sickness model:
 *   - R zones without hospital coverage accumulate sickness over time.
 *   - R zones with hospital coverage recover.
 *   - High sickness → death events (visual indicator only; does not reduce devLevel).
 *   - Death events set a recentDeath timer that counts down each tick.
 *
 * The "75-year natural lifespan" flavour is preserved by the base death chance being
 * effectively zero at sickness=0 — citizens die naturally at a negligible background rate
 * when fully healthy, but sicken and die noticeably faster without healthcare.
 */
export class HealthcareSystem {
  update(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    const hospital = world.layers.hospital;
    const sickness = world.layers.sickness;
    const recentDeath = world.layers.recentDeath;
    const abandoned = world.layers.abandoned;
    const b = BALANCE.healthcare;

    for (let i = 0; i < n; i++) {
      // Tick down the recentDeath visual timer on all tiles.
      if (recentDeath[i] > 0) {
        recentDeath[i]--;
      }

      // Sickness only applies to developed, non-abandoned residential zones.
      if (zone[i] !== ZONE_R || dev[i] === 0 || abandoned[i] !== 0) {
        sickness[i] = 0;
        continue;
      }

      if (hospital[i] === 1) {
        // Hospital coverage: each tick has a chance to reduce sickness by 1.
        if (sickness[i] > 0 && world.rng() < b.recoveryProbability) {
          sickness[i]--;
        }
      } else {
        // No hospital coverage: each tick has a chance to increase sickness by 1.
        if (sickness[i] < 255 && world.rng() < b.sicknessProbability) {
          sickness[i]++;
        }
      }

      // Roll for a death event — chance scales with sickness level.
      const deathChance = b.baseDeathChance + (sickness[i] / 255) * b.deathChanceMax;
      if (world.rng() < deathChance) {
        recentDeath[i] = b.deathVisualDuration;
      }
    }
  }
}
