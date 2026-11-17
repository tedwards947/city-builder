// Shops need goods (the owner's decision with the seaport, 2026-11-17).
//
// Shops fetch goods from industry (and from a seaport's imports) in the
// traffic system's 'goods' market. When the city's shops want more goods
// trips than its sources can supply, there is a SHORTAGE, from 0 (enough) to
// 1 (none at all). A shortage cuts shops' tax income and commercial growth
// demand, by the penalties in BALANCE.goods. Both ship at 0: no effect.
//
// City-wide on purpose: one number the player can read ("shops are 30% short
// of goods") and fix by zoning industry or opening a port.

import type { World } from './World';
import { BALANCE } from '../data/balance';

/**
 * How short of goods the city's shops are, 0–1, from the last traffic pass:
 * 1 − (goods trips supplied ÷ goods trips wanted). Wanted counts every shop,
 * including shops with no road or no route to any source; supplied is what
 * the sources reached have room for. 0 with no shops, or before any pass.
 */
export function goodsShortage(world: World): number {
  const goods = world.traffic?.goods.field;
  if (!goods) return 0;
  const wanted = goods.demand + goods.stranded;
  if (!(wanted > 0)) return 0;
  const supplied = goods.demandRatio > 1 ? goods.demand / goods.demandRatio : goods.demand;
  const shortage = 1 - supplied / wanted;
  return shortage > 1e-9 ? Math.min(1, shortage) : 0;
}

/** What shops' tax income is multiplied by because of the goods shortage (1 = no effect). */
export function goodsIncomeMult(world: World): number {
  const penalty = BALANCE.goods.shortageIncomePenalty;
  return penalty > 0 ? 1 - penalty * goodsShortage(world) : 1;
}

/** What commercial growth demand is multiplied by because of the goods shortage (1 = no effect). */
export function goodsDemandMult(world: World): number {
  const penalty = BALANCE.goods.shortageDemandPenalty;
  return penalty > 0 ? 1 - penalty * goodsShortage(world) : 1;
}
