// Runs after OrdinanceSystem, once per game day: resolves the open resident
// requests (met → reward, past the deadline → penalty), then opens a new one
// every spawnEveryDays days while fewer than maxOpen are open. With
// spawnEveryDays at 0 (shipped) nothing opens and world.rng is never drawn
// from, so the simulation is unchanged. See src/sim/requests.ts.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { changePc } from '../politics';
import { isMet, pickRequest, requestConfig, type OpenRequest } from '../requests';

const payload = (r: OpenRequest) =>
  ({ id: r.id, kind: r.kind, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, deadlineTick: r.deadlineTick });

export class RequestSystem {
  update(world: World): void {
    if (world.tick % BALANCE.ticksPerDay !== 0) return;
    const cfg = requestConfig();
    const open = world.politics.requests;

    for (let k = open.length - 1; k >= 0; k--) {
      const r = open[k];
      const n = cfg.kinds[r.kind];
      if (isMet(world, r)) {
        open.splice(k, 1);
        if (n && n.reward > 0) changePc(world, n.reward, 'requestMet');
        world.events.emit('requestMet', payload(r));
      } else if (world.tick >= r.deadlineTick) {
        open.splice(k, 1);
        // A missed request costs what PC there is, never pushing it into debt.
        const take = Math.min(n ? n.penalty : 0, Math.max(0, world.budget.politicalCapital));
        if (take > 0) changePc(world, -take, 'requestFailed');
        world.events.emit('requestFailed', payload(r));
      }
    }

    const day = world.tick / BALANCE.ticksPerDay;
    if (cfg.spawnEveryDays <= 0 || open.length >= cfg.maxOpen || day % cfg.spawnEveryDays !== 0) return;
    const pick = pickRequest(world, world.rng);
    if (!pick) return;
    const days = cfg.kinds[pick.kind]?.days ?? 0;
    const req: OpenRequest = {
      id: world.politics.nextRequestId++,
      kind: pick.kind,
      ...pick.area,
      openedTick: world.tick,
      deadlineTick: world.tick + days * BALANCE.ticksPerDay,
    };
    open.push(req);
    world.events.emit('requestOpened', payload(req));
  }
}
