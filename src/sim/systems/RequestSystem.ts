// Runs after OrdinanceSystem, once per game day: resolves the open resident
// requests (met → reward, past the deadline → penalty), then opens a new one
// every spawnEveryDays days while fewer than maxOpen are open. Durable kinds
// (traffic) are judged on a few days' readings: see observeRequests. With
// spawnEveryDays at 0 (shipped) nothing opens and world.rng is never drawn
// from, so the simulation is unchanged. See src/sim/requests.ts.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { isMet, isHolding, observeRequests, pickRequest, requestConfig, openRequest, meetRequest, failRequest, openSlotsUsed } from '../requests';

export class RequestSystem {
  update(world: World): void {
    if (world.tick % BALANCE.ticksPerDay !== 0) return;
    const cfg = requestConfig();
    const open = world.politics.requests;

    observeRequests(world);     // today's reading for the durable kinds (traffic)

    for (let k = open.length - 1; k >= 0; k--) {
      const r = open[k];
      if (isMet(world, r)) meetRequest(world, r);
      // A durable request that is passing, part-way through its hold, is not failed by the clock.
      else if (world.tick >= r.deadlineTick && !isHolding(r)) failRequest(world, r);
    }

    const day = world.tick / BALANCE.ticksPerDay;
    // A standing request (the airport) does not take one of the maxOpen slots.
    // Residents of the tutorial city make no requests (tutorial/rules.ts).
    if (world.tutorial) return;
    if (cfg.spawnEveryDays <= 0 || openSlotsUsed(world) >= cfg.maxOpen || day % cfg.spawnEveryDays !== 0) return;
    const pick = pickRequest(world, world.rng);
    if (pick) openRequest(world, pick.kind, pick.area, cfg.kinds[pick.kind]?.days ?? 0, pick.need, pick);
  }
}
