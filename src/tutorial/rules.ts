// The rules that apply only to the tutorial city (TUTORIAL_DESIGN.md,
// principle 3: the city can't fail). They switch on `world.tutorial` being
// set, and end the moment it is cleared (the tutorial finished, or the player
// left it):
//   - money never falls below a generous floor, political capital is held
//     full and no debt builds up (tutorial/TutorialSystem.ts, every tick);
//   - no fire starts (FireSystem) and residents make no requests of their own
//     (RequestSystem);
//   - one scripted request, for a park, opens when the park step is reached.
// A city that is not a tutorial city is not touched and draws no random number
// here, so the simulation is otherwise unchanged.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ZONE_R } from '../sim/constants';
import { openRequest, planRequest, requestConfig, type OpenRequest } from '../sim/requests';
import { keepSolvent } from '../title/showcaseKeeper';

/** Where the tutorial city's save file lives, under the site's base address (a file from the Save panel's "save to file"). */
export const TUTORIAL_PATH = 'tutorial/tutorial.citysave.json';

export const TUTORIAL = {
  /** The tutorial starts with at least this much money, whatever the map was saved with. */
  startMoney: 100_000,
  /** Money is topped up to this whenever it falls below. */
  minMoney: 50_000,
  /** The scripted park request's deadline, in game days: long enough never to be missed. */
  requestDays: 3600,
  /** The step (tutorial/steps.ts id) whose request is scripted. */
  requestStep: 'park',
};

/** Make `world` the tutorial city, at the first step. */
export function beginTutorial(world: World): void {
  world.tutorial = { step: 0 };
  if (world.budget.money < TUTORIAL.startMoney) world.budget.money = TUTORIAL.startMoney;
  holdTutorial(world);
}

/**
 * The tutorial is over (finished or left): the city carries on as a normal
 * game. If the scripted request is still open it becomes an ordinary one,
 * with the usual time to meet it.
 */
export function endTutorial(world: World): void {
  const req = scriptedRequest(world);
  if (req) req.deadlineTick = world.tick + (requestConfig().kinds[req.kind]?.days ?? 0) * BALANCE.ticksPerDay;
  delete world.tutorial;
}

/** The money floor and the full political capital. Does nothing outside the tutorial. */
export function holdTutorial(world: World): void {
  if (!world.tutorial) return;
  if (world.budget.money < TUTORIAL.minMoney) world.budget.money = TUTORIAL.minMoney;
  keepSolvent(world);
}

/** The scripted request while it is open, else null. */
export function scriptedRequest(world: World): OpenRequest | null {
  const id = world.tutorial?.request;
  if (id === undefined) return null;
  return world.politics.requests.find((r) => r.id === id) ?? null;
}

/**
 * Open the scripted park request, once: the homes around the first lived-in
 * home that has no park in reach ask for one. Does nothing if it has already
 * opened, or while no such home exists (it is tried again every game day
 * while the park step is the current one). Draws nothing from world.rng.
 */
export function openScriptedRequest(world: World): OpenRequest | null {
  const state = world.tutorial;
  if (!state || state.request !== undefined) return null;
  const { width, height } = world.grid;
  const plan = planRequest(world, 'park', { x0: 0, y0: 0, x1: width - 1, y1: height - 1 }, () => 0);
  if (!plan) return null;
  const req = openRequest(world, 'park', plan.area, TUTORIAL.requestDays, plan.need, plan);
  state.request = req.id;
  return req;
}

/** Whether the city has a lived-in home. */
export function hasLivedInHome(world: World): boolean {
  const { zone, devLevel, abandoned } = world.layers;
  const { zoned, zonedCount } = world.index;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (zone[i] === ZONE_R && devLevel[i] > 0 && !abandoned[i]) return true;
  }
  return false;
}
