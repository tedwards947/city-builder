// Runs after OrdinanceSystem, once per game day: resolves the open resident
// requests (met → reward, past the deadline → penalty), then opens a new one
// every spawnEveryDays days while fewer than maxOpen are open. With
// spawnEveryDays at 0 (shipped) nothing opens and world.rng is never drawn
// from, so the simulation is unchanged. See src/sim/requests.ts.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { isMet, pickRequest, requestConfig, openRequest, meetRequest, failRequest } from '../requests';

export class RequestSystem {
  update(world: World): void {
    if (world.tick % BALANCE.ticksPerDay !== 0) return;
    const cfg = requestConfig();
    const open = world.politics.requests;

    for (let k = open.length - 1; k >= 0; k--) {
      const r = open[k];
      if (isMet(world, r)) meetRequest(world, r);
      else if (world.tick >= r.deadlineTick) failRequest(world, r);
    }

    const day = world.tick / BALANCE.ticksPerDay;
    if (cfg.spawnEveryDays <= 0 || open.length >= cfg.maxOpen || day % cfg.spawnEveryDays !== 0) return;
    const pick = pickRequest(world, world.rng);
    if (pick) openRequest(world, pick.kind, pick.area, cfg.kinds[pick.kind]?.days ?? 0, pick.need, pick);
  }
}
