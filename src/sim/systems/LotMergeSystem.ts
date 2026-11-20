// When lots merge (sim/lots.ts, BIG_LOTS_DESIGN.md). Once a game day:
//   1. every top-level lot that is happy and on valuable land today adds a
//      day to its streak; any other lot's streak goes back to 0;
//   2. each 2×2 of one zone whose four lots have all kept that up for
//      BALANCE.lots.streakDays rolls BALANCE.lots.chancePerDay;
//   3. of the blocks that won, at most BALANCE.lots.maxPerDay merge, picked at random.
//
// Off (it does nothing at all, and uses no random numbers) while
// BALANCE.lots.chancePerDay is 0, which is what ships until the owner approves
// the numbers, and in the tutorial city.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { mergeCandidates, mergeLot, updateLotStreaks } from '../lots';

export class LotMergeSystem {
  update(world: World): void {
    const cfg = BALANCE.lots;
    if (cfg.chancePerDay <= 0 || world.tutorial) return;
    if (world.tick % BALANCE.ticksPerDay !== 0) return;

    updateLotStreaks(world);
    const won = mergeCandidates(world).filter(() => world.rng() < cfg.chancePerDay);
    const { width } = world.grid;
    for (let merged = 0; merged < cfg.maxPerDay && won.length > 0;) {
      const a = won.splice(Math.floor(world.rng() * won.length), 1)[0];
      // False if a merge a moment ago took one of this block's tiles.
      if (mergeLot(world, a % width, (a - (a % width)) / width)) merged++;
    }
  }
}
