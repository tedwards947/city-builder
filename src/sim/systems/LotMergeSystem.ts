// When lots merge (sim/lots.ts, BIG_LOTS_DESIGN.md). Once a game day:
//   1. every top-level lot that is happy and in a prime spot today (downtown,
//      or by a park or water: lots.ts primeSpot) adds a day to its streak; any
//      other lot's streak goes back to 0;
//   2. each 2×2 of one zone whose four lots have all kept that up for
//      BALANCE.lots.streakDays rolls BALANCE.lots.chancePerDay (industry:
//      BALANCE.lots.industryChancePerDay);
//   3. of the blocks that won, at most BALANCE.lots.maxPerDay merge, picked at random,
//      and never within BALANCE.lots.spacing tiles of another merged lot.
//
// Off (it does nothing at all, and uses no random numbers) while both chances
// are 0, and in the tutorial city. Switched on at the approved numbers 2026-11-20.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { ZONE_I } from '../constants';
import { clearOfLots, mergeCandidates, mergeLot, updateLotStreaks } from '../lots';

export class LotMergeSystem {
  update(world: World): void {
    const cfg = BALANCE.lots;
    if ((cfg.chancePerDay <= 0 && cfg.industryChancePerDay <= 0) || world.tutorial) return;
    if (world.tick % BALANCE.ticksPerDay !== 0) return;

    updateLotStreaks(world);
    const zone = world.layers.zone;
    const won = mergeCandidates(world).filter((a) => world.rng() < (zone[a] === ZONE_I ? cfg.industryChancePerDay : cfg.chancePerDay));
    const { width } = world.grid;
    for (let merged = 0; merged < cfg.maxPerDay && won.length > 0;) {
      const a = won.splice(Math.floor(world.rng() * won.length), 1)[0];
      const x = a % width, y = (a - x) / width;
      // Not if a merge a moment ago took one of this block's tiles, or stands too close to it.
      if (clearOfLots(world, x, y) && mergeLot(world, x, y)) merged++;
    }
  }
}
