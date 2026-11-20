// The rules that apply only to the tutorial city (TUTORIAL_DESIGN.md,
// principle 3: the city can't fail). They switch on `world.tutorial` being
// set, and end the moment it is cleared (the tutorial finished, or the player
// left it):
//   - money never falls below a generous floor, political capital is held
//     full and no debt builds up (tutorial/TutorialSystem.ts, every tick);
//   - no fire starts (FireSystem) and residents make no requests
//     (RequestSystem).
// A city that is not a tutorial city is not touched and draws no random number
// here, so the simulation is otherwise unchanged.

import type { World } from '../sim/World';
import { keepSolvent } from '../title/showcaseKeeper';

/** Where the tutorial city's save file lives, under the site's base address (a file from the Save panel's "save to file"). */
export const TUTORIAL_PATH = 'tutorial/tutorial.citysave.json';

export const TUTORIAL = {
  /** The tutorial starts with at least this much money, whatever the map was saved with. */
  startMoney: 100_000,
  /** Money is topped up to this whenever it falls below. */
  minMoney: 50_000,
};

/** Make `world` the tutorial city, at the first step. */
export function beginTutorial(world: World): void {
  world.tutorial = { step: 0 };
  if (world.budget.money < TUTORIAL.startMoney) world.budget.money = TUTORIAL.startMoney;
  holdTutorial(world);
}

/** The tutorial is over (finished or left): the city carries on as a normal game. */
export function endTutorial(world: World): void {
  delete world.tutorial;
}

/** The money floor and the full political capital. Does nothing outside the tutorial. */
export function holdTutorial(world: World): void {
  if (!world.tutorial) return;
  if (world.budget.money < TUTORIAL.minMoney) world.budget.money = TUTORIAL.minMoney;
  keepSolvent(world);
}
