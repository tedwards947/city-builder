import type { World } from '../World';
import { ZONE_R, ZONE_NONE } from '../constants';
import { BALANCE } from '../../data/balance';

/**
 * EducationSystem manages the persistent education levels of residential zones.
 * If a residential zone has school coverage, its education level increases.
 * If coverage is lost, education slowly decays.
 * Education level is persistent and tied to the residential population.
 */
export class EducationSystem {
  update(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const zone = world.layers.zone;
    const school = world.layers.school;
    const education = world.layers.education;
    const b = BALANCE.education;

    for (let i = 0; i < n; i++) {
      if (zone[i] !== ZONE_R) {
        // Non-residential zones don't track education level (or it decays immediately).
        education[i] = 0;
        continue;
      }

      const current = education[i];
      let next = current;

      if (school[i] === 1) {
        // Covered by school: education level rises.
        next += b.baseRate;
      } else {
        // No school coverage: education level decays.
        next -= b.decayRate;
      }

      // Clamp to 0-255.
      education[i] = Math.min(255, Math.max(0, Math.floor(next)));
    }
  }
}
