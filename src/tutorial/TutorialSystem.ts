// Runs last each tick (sim/createSystems.ts) and does nothing unless the city
// is the tutorial city: it keeps the tutorial-only rules (tutorial/rules.ts).

import type { World } from '../sim/World';
import type { System } from '../sim/Scheduler';
import { holdTutorial } from './rules';

export class TutorialSystem implements System {
  update(world: World): void {
    holdTutorial(world);
  }
}
