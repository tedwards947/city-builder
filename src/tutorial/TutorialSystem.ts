// Runs last each tick (sim/createSystems.ts) and does nothing unless the city
// is the tutorial city: it keeps the tutorial-only rules (tutorial/rules.ts).

import type { World } from '../sim/World';
import type { System } from '../sim/Scheduler';
import { BALANCE } from '../data/balance';
import { TUTORIAL, holdTutorial, openScriptedRequest } from './rules';
import { TUTORIAL_STEPS } from './steps';

export class TutorialSystem implements System {
  update(world: World): void {
    const state = world.tutorial;
    if (!state) return;
    holdTutorial(world);
    // The scripted request, in case the step was reached before any home had been lived in.
    if (world.tick % BALANCE.ticksPerDay === 0 && TUTORIAL_STEPS[state.step]?.id === TUTORIAL.requestStep) openScriptedRequest(world);
  }
}
