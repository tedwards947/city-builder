// "Established" lots: zone tiles that have stayed developed for many years.
// Heritage Protection (an ordinance) raises their land value and makes them
// very expensive to demolish.
//
// `world.developedSince` holds, per tile, the game day the lot was last built
// up from empty (stored as day + 1, so 0 means "no record"). It is written in
// one place, when ZoneGrowthSystem takes a lot from level 0 to level 1, and
// never needs clearing: a lot that is bulldozed, rezoned, burnt down or
// abandoned has to grow from empty again before it counts, and that growth
// overwrites the record. Levelling up does not touch it. Undoing a bulldoze
// brings the building back with its years intact, which is what undo means.
//
// A lot only counts while it is developed and not abandoned, so a stale
// record on an empty or ruined tile is harmless.

import type { World } from './World';
import { BALANCE } from '../data/balance';

/** Game days in a game year (the HUD's calendar uses the same figure). */
export const DAYS_PER_YEAR = 360;

/** The game day it is now. */
export function gameDay(world: World): number {
  return Math.floor(world.tick / BALANCE.ticksPerDay);
}

/** Record that the lot on tile `i` has just been built up from empty. */
export function markDeveloped(world: World, i: number): void {
  world.developedSince[i] = Math.min(65535, gameDay(world) + 1);
}

/**
 * How many game years the lot on tile `i` has been developed without a
 * break. 0 if it is empty, abandoned or has no record.
 */
export function developedYears(world: World, i: number): number {
  const since = world.developedSince[i];
  if (since === 0) return 0;
  if (world.layers.devLevel[i] === 0 || world.layers.abandoned[i] !== 0) return 0;
  return Math.max(0, gameDay(world) + 1 - since) / DAYS_PER_YEAR;
}

/** Years a lot must stay developed to count as established. 0 = nothing ever counts (switched off). */
export function establishedAfterYears(): number {
  return (BALANCE.politicalCapital as { establishedYears?: number }).establishedYears ?? 0;
}

/** Whether the lot on tile `i` is established. Always false while the threshold is 0. */
export function isEstablished(world: World, i: number, afterYears = establishedAfterYears()): boolean {
  return afterYears > 0 && developedYears(world, i) >= afterYears;
}

/**
 * For a save made before this record existed: start every developed lot's
 * clock now, so nothing is established the moment an old city loads.
 */
export function startCountingFromNow(world: World): void {
  const { zoned, zonedCount } = world.index;
  const today = Math.min(65535, gameDay(world) + 1);
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (world.layers.devLevel[i] > 0) world.developedSince[i] = today;
  }
}
