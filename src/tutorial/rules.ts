// PLACEHOLDER (GRAPHICS). ENGINE owns this file: the real one adds the
// tutorial-only rules in the sim (money floor, PC hold, requests off apart
// from the scripted one), switched on by `world.tutorial` being set.

import type { World } from '../sim/World';
import type { TutorialState } from './types';

/** The tutorial map, fetched like the showcase. */
export const TUTORIAL_PATH = 'tutorial/tutorial.citysave.json';

type WithTutorial = { tutorial?: TutorialState };

export function beginTutorial(world: World): void {
  (world as unknown as WithTutorial).tutorial = { step: 0 };
}

export function endTutorial(world: World): void {
  delete (world as unknown as WithTutorial).tutorial;
}
