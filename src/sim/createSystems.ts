// The simulation's systems, in the order they run each tick. One place, so the
// game, the tests and the benchmarks all run the same simulation.

import type { System } from './Scheduler';
import type { World } from './World';
import { NetworkSystem } from './systems/NetworkSystem';
import { PowerSystem } from './systems/PowerSystem';
import { WaterSystem } from './systems/WaterSystem';
import { SewageSystem } from './systems/SewageSystem';
import { ServiceSystem } from './systems/ServiceSystem';
import { LandValueSystem } from './systems/LandValueSystem';
import { PollutionSystem } from './systems/PollutionSystem';
import { CrimeSystem } from './systems/CrimeSystem';
import { FireSystem } from './systems/FireSystem';
import { TransitSystem } from './systems/TransitSystem';
import { AbandonmentSystem } from './systems/AbandonmentSystem';
import { EducationSystem } from './systems/EducationSystem';
import { HealthcareSystem } from './systems/HealthcareSystem';
import { ZoneGrowthSystem } from './systems/ZoneGrowthSystem';
import { EconomySystem } from './systems/EconomySystem';
import { VibeSystem } from './systems/VibeSystem';
import { PoliticsSystem } from './systems/PoliticsSystem';
import { OrdinanceSystem } from './systems/OrdinanceSystem';
import { RequestSystem } from './systems/RequestSystem';
import { LotMergeSystem } from './systems/LotMergeSystem';
import { TutorialSystem } from '../tutorial/TutorialSystem';

export interface SimSystems {
  /** Every system, in tick order. */
  systems: System[];
  /** The traffic system (also in `systems`), for callers that poke it between ticks. */
  transit: TransitSystem;
  /** The systems (also in `systems`) that work out what reaches each tile: see refreshCoverage. */
  coverage: System[];
}

/**
 * Rework the road networks and the power, water, sewage and service coverage
 * now, without a tick. These depend only on what is built, and are otherwise
 * redone each tick, so a clock that is stopped (paused, or game over) would
 * leave a road or a zone built in the meantime showing "No power" until it
 * runs again. Draws no random numbers and moves nothing else in the city.
 */
export function refreshCoverage(world: World, sim: SimSystems): void {
  world.pinIndex();
  try {
    for (const sys of sim.coverage) sys.update(world);
  } finally {
    world.unpinIndex();
  }
}

/**
 * A fresh set of systems. They carry per-game state (alert cooldowns, shortage
 * flags, caches), so every new or loaded world gets its own set.
 */
export function createSystems(): SimSystems {
  const transit = new TransitSystem();
  const coverage = [new NetworkSystem(), new PowerSystem(), new WaterSystem(), new SewageSystem(), new ServiceSystem()];
  return {
    transit,
    coverage,
    systems: [
      ...coverage,
      new LandValueSystem(),
      new PollutionSystem(),
      new CrimeSystem(),
      new FireSystem(),
      transit,
      new AbandonmentSystem(),
      new EducationSystem(),
      new HealthcareSystem(),
      new ZoneGrowthSystem(),
      new EconomySystem(),
      new VibeSystem(),
      new PoliticsSystem(),
      new OrdinanceSystem(),
      new RequestSystem(),
      new LotMergeSystem(),
      new TutorialSystem(),
    ],
  };
}
