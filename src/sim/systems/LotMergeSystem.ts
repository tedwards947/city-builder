// When lots merge (sim/lots.ts, BIG_LOTS_DESIGN.md). Once a game day:
//   1. every top-level lot that is happy and in a prime spot today (downtown,
//      or by a park or water: lots.ts primeSpot) adds a day to its streak; any
//      other lot's streak goes back to 0;
//   2. each 2×2 of one zone whose four lots have all kept that up for
//      BALANCE.lots.streakDays rolls BALANCE.lots.chancePerDay (industry:
//      BALANCE.lots.industryChancePerDay); so does each pair of shops side by
//      side that is not part of a possible 2×2 (lots.ts canMergePair);
//   3. of the blocks that won, at most BALANCE.lots.maxPerDay merge, picked at random,
//      and never within BALANCE.lots.spacing tiles of another merged lot.
//
// Off (it does nothing at all, and uses no random numbers) while both chances
// are 0, and in the tutorial city. Switched on at the approved numbers 2026-11-20.

import type { World } from '../World';
import { BALANCE } from '../../data/balance';
import { ZONE_I, ZONE_R } from '../constants';
import { LOT_LEVEL, clearOfLots, doorTile, mergeCandidates, mergeLot, updateLotStreaks } from '../lots';
import { leisureGrowthMult } from '../leisureTraffic';

export class LotMergeSystem {
  update(world: World): void {
    const cfg = BALANCE.lots;
    if ((cfg.chancePerDay <= 0 && cfg.industryChancePerDay <= 0) || world.tutorial) return;
    if (world.tick % BALANCE.ticksPerDay !== 0) return;

    updateLotStreaks(world);
    const zone = world.layers.zone;
    // Homes merging into a tower want leisure in reach, like homes growing to level 3 (sim/leisureTraffic.ts).
    const won = mergeCandidates(world).filter((c) => world.rng() < (zone[c.anchor] === ZONE_I ? cfg.industryChancePerDay
      : cfg.chancePerDay * (zone[c.anchor] === ZONE_R ? leisureGrowthMult(world, c.anchor, LOT_LEVEL, doorTile(world, c.anchor)) : 1)));
    const { width } = world.grid;
    for (let merged = 0; merged < cfg.maxPerDay && won.length > 0;) {
      const c = won.splice(Math.floor(world.rng() * won.length), 1)[0];
      const x = c.anchor % width, y = (c.anchor - x) / width;
      // Not if a merge a moment ago took one of this block's tiles, or stands too close to it.
      if (clearOfLots(world, x, y, c.shape) && mergeLot(world, x, y, false, c.shape)) merged++;
    }
  }
}
