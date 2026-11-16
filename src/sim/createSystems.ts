// The simulation's systems, in the order they run each tick. One place, so the
// game, the tests and the benchmarks all run the same simulation.

import type { System } from './Scheduler';
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

export interface SimSystems {
  /** Every system, in tick order. */
  systems: System[];
  /** The traffic system (also in `systems`), for callers that poke it between ticks. */
  transit: TransitSystem;
}

/**
 * A fresh set of systems. They carry per-game state (alert cooldowns, shortage
 * flags, caches), so every new or loaded world gets its own set.
 */
export function createSystems(): SimSystems {
  const transit = new TransitSystem();
  return {
    transit,
    systems: [
      new NetworkSystem(),
      new PowerSystem(),
      new WaterSystem(),
      new SewageSystem(),
      new ServiceSystem(),
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
    ],
  };
}
