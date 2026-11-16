// Runs after PoliticsSystem: suspends or resumes ordinances as PC crosses 0
// (every tick, so the panel's state follows PC at once), then charges one
// day's upkeep at the start of each game day. See src/sim/ordinances.ts.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { updateSuspension, payUpkeep } from '../ordinances';

export class OrdinanceSystem {
  update(world: World): void {
    if (world.politics.ordinances.active.length === 0) return;
    updateSuspension(world);
    if (world.tick % BALANCE.ticksPerDay === 0) {
      payUpkeep(world);
      updateSuspension(world); // upkeep may have taken the last of the PC
    }
  }
}
