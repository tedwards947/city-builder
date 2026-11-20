// Judges an event day as it ends (sim/eventDays.ts): on the last tick of the
// day, so the player has had the whole day's traffic pass to look at. Does
// nothing on other days or in a city with no venue.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { judgeEventDay } from '../eventDays';

export class EventDaySystem {
  update(world: World): void {
    const tpd = BALANCE.ticksPerDay;
    if (world.tick % tpd !== tpd - 1) return;
    judgeEventDay(world);
  }
}
