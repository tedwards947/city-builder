// Runs the stadium's events clock every tick (sim/eventDays.ts tickEvents):
// schedules events, judges the one that is on after each traffic pass, and
// ends it. Does nothing in a city with no venue.

import type { World } from '../World';
import { tickEvents } from '../eventDays';

export class EventDaySystem {
  update(world: World): void {
    tickEvents(world);
  }
}
