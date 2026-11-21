// Ordinances (PC_DESIGN.md → "Ordinances"): city-wide policies the player
// enacts for a lump of political capital and keeps up for a small daily cost.
// Each one scales a few named numbers in the simulation; a system reads the
// product for its number with ordinanceModifier(world, name), which is 1 when
// nothing that touches it is active.
//
// Not undoable (owner's decision), so enact and repeal change the world
// directly instead of going through CommandHistory. Repealing refunds
// nothing. While PC is 0 or below, every active ordinance is suspended: no
// effect and no upkeep. They resume by themselves once PC is above 0 again
// (OrdinanceSystem does both).
//
// The numbers live in BALANCE.politicalCapital.ordinances and are read live,
// so the debug tuning panel can change them.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { changePc, capScale } from './politics';

export const ORDINANCE_IDS = [
  'neighbourhoodWatch', 'curfew', 'cleanAirAct', 'businessIncentives', 'freeTransit',
  'fastTrackPermits', 'eminentDomain', 'heritageProtection',
  // Parked (owner, 2026-11-16): rentControl. Its benefits (no abandonment
  // over land value, a more egalitarian vibe) have no mechanic to act on
  // yet. Its strings stay in the locale files for when it comes back; a
  // save that somehow has it active ignores it (no numbers, no effect).
] as const;
export type OrdinanceId = typeof ORDINANCE_IDS[number];

/**
 * The numbers ordinances can scale. Each sim system reads its own once per
 * tick (not per tile). Multipliers: 1 = unchanged, 0.85 = 15% less.
 */
export const ORDINANCE_MODIFIERS = [
  'crime',                     // crime build-up everywhere
  'commercialIncome',          // tax income from shops
  'industrialIncome',          // tax income from industry
  'commercialDemand',
  'industrialDemand',
  'industrialPollution',       // pollution from industry
  'pollution',                 // pollution from everything
  'industrialGrowth',          // growth chance of industry
  'growth',                    // growth chance of every zone
  'trafficTrips',              // trips put on the roads
  'landValueGrowth',           // how fast land value rises
  'abandonmentFromLandValue',  // homes abandoning because land value is too high (0 = never)
  'vibeEgalitarian',           // pull toward the egalitarian vibe
  'displacementCost',          // PC charged for displacing residents
  'satisfaction',              // city-wide satisfaction
  'establishedLandValue',      // land value of established neighbourhoods
  'establishedDemolitionCost', // PC charged for demolishing in them
] as const;
export type OrdinanceModifier = typeof ORDINANCE_MODIFIERS[number];

interface OrdinanceNumbers {
  enactCost: number;
  dailyUpkeep: number;   // PC per game day
  dailyMoney: number;    // money per game day, fixed
  dailyMoneyPerResident?: number; // and per resident per game day (Free Transit)
  modifiers: Record<string, number>;
}

export interface OrdinanceDef {
  id: OrdinanceId;
  nameKey: string;
  descKey: string;
  /** Live from BALANCE: enactCost, dailyUpkeep, dailyMoney, modifiers. */
  readonly numbers: OrdinanceNumbers;
}

const numbersOf = (id: string): OrdinanceNumbers | undefined =>
  (BALANCE.politicalCapital.ordinances as Record<string, OrdinanceNumbers>)[id];

/** The registry, in the order the panel lists them. */
export const ORDINANCES: readonly OrdinanceDef[] = ORDINANCE_IDS.map((id) => ({
  id,
  nameKey: `ordinances.${id}.name`,
  descKey: `ordinances.${id}.desc`,
  get numbers() { return numbersOf(id)!; },
}));

export function isOrdinanceId(id: string): id is OrdinanceId {
  return (ORDINANCE_IDS as readonly string[]).includes(id);
}

/** What an ordinance's row in the panel shows. */
export type OrdinanceState = 'off' | 'on' | 'cantAfford' | 'suspended';

export function ordinanceState(world: World, id: OrdinanceId): OrdinanceState {
  const o = world.politics.ordinances;
  if (o.active.includes(id)) return o.suspended.includes(id) ? 'suspended' : 'on';
  return canEnact(world, id) ? 'off' : 'cantAfford';
}

/** Whether ordinances are switched on in this build (the toolbar tile and panel are hidden until then). */
export function ordinancesEnabled(): boolean {
  return BALANCE.politicalCapital.ordinancesEnabled;
}

/** Why an ordinance can't be enacted right now. */
export type EnactBlocker = 'active' | 'inDebt' | 'notEnoughPc';

/**
 * Why `id` can't be enacted now, or null if it can. Enacting needs PC above
 * 0 (an ordinance enacted in debt would only be suspended) and at least its cost.
 */
export function enactBlocker(world: World, id: OrdinanceId): EnactBlocker | null {
  const pc = world.budget.politicalCapital;
  if (world.politics.ordinances.active.includes(id)) return 'active';
  if (pc <= 0) return 'inDebt';
  if (pc < numbersOf(id)!.enactCost) return 'notEnoughPc';
  return null;
}

export function canEnact(world: World, id: OrdinanceId): boolean {
  return enactBlocker(world, id) === null;
}

/** Enact an ordinance, charging its cost. Returns false (and changes nothing) if it can't be. */
export function enactOrdinance(world: World, id: OrdinanceId): boolean {
  if (!canEnact(world, id)) return false;
  const cost = numbersOf(id)!.enactCost;
  if (cost > 0) changePc(world, -cost, 'ordinanceEnacted');
  world.politics.ordinances.active.push(id);
  world.events.emit('ordinanceEnacted', { id, cost });
  return true;
}

/** Repeal an active ordinance. Nothing is refunded. Returns false if it was not active. */
export function repealOrdinance(world: World, id: OrdinanceId): boolean {
  const o = world.politics.ordinances;
  const k = o.active.indexOf(id);
  if (k < 0) return false;
  o.active.splice(k, 1);
  const s = o.suspended.indexOf(id);
  if (s >= 0) o.suspended.splice(s, 1);
  world.events.emit('ordinanceRepealed', { id });
  return true;
}

/**
 * The product of `name` over every active, unsuspended ordinance; 1 when
 * none touches it. O(active ordinances), no allocation: call it once per
 * tick and keep the number, not once per tile.
 */
export function ordinanceModifier(world: World, name: OrdinanceModifier): number {
  const { active, suspended } = world.politics.ordinances;
  let m = 1;
  for (let k = 0; k < active.length; k++) {
    if (suspended.length && suspended.includes(active[k])) continue;
    const v = numbersOf(active[k])?.modifiers[name];
    if (v !== undefined) m *= v;
  }
  return m;
}

/** Whether Free Transit is in force (enacted and not suspended): rail fares are 0 while it is. */
export function transitIsFree(world: World): boolean {
  const { active, suspended } = world.politics.ordinances;
  return active.includes('freeTransit') && !suspended.includes('freeTransit');
}

/** Suspend everything while PC is 0 or below; resume once it is above 0. Cheap: call every tick. */
export function updateSuspension(world: World): void {
  const o = world.politics.ordinances;
  if (world.budget.politicalCapital <= 0) {
    for (const id of o.active) {
      if (o.suspended.includes(id)) continue;
      o.suspended.push(id);
      world.events.emit('ordinanceSuspended', { id });
    }
  } else if (o.suspended.length) {
    const resumed = o.suspended.splice(0);
    for (const id of resumed) world.events.emit('ordinanceResumed', { id });
  }
}

/**
 * How much the PC upkeep in the balance table is scaled for this city: the
 * cap ÷ the base cap, the same factor regeneration uses. A bigger city earns
 * PC proportionally faster, so its ordinances cost proportionally more and
 * running them takes the same share of PC income at any size. Exactly 1
 * while the cap is the base cap.
 */
export function upkeepScale(world: World): number {
  return capScale(world);
}

/** The PC an ordinance costs to keep up per game day in this city (its `dailyUpkeep` × upkeepScale). */
export function dailyUpkeepOf(world: World, id: OrdinanceId): number {
  return (numbersOf(id)?.dailyUpkeep ?? 0) * upkeepScale(world);
}

/** The money an ordinance costs to keep up per game day in this city: `dailyMoney` + `dailyMoneyPerResident` × population. */
export function dailyMoneyOf(world: World, id: OrdinanceId | string): number {
  const n = numbersOf(id);
  return n ? n.dailyMoney + (n.dailyMoneyPerResident ?? 0) * world.stats.population : 0;
}

/**
 * One game day of upkeep for the active, unsuspended ordinances. PC upkeep
 * scales with the cap (upkeepScale), takes what PC there is and never pushes
 * it below 0; money upkeep (dailyMoneyOf: fixed, plus any per resident) is paid like any other running cost.
 */
export function payUpkeep(world: World): void {
  const { active, suspended } = world.politics.ordinances;
  let pc = 0, money = 0;
  for (const id of active) {
    if (suspended.includes(id)) continue;
    const n = numbersOf(id);
    if (!n) continue;
    pc += n.dailyUpkeep;
    money += dailyMoneyOf(world, id);
  }
  pc *= upkeepScale(world);
  const take = Math.min(pc, Math.max(0, world.budget.politicalCapital));
  if (take > 0) changePc(world, -take, 'ordinanceUpkeep');
  if (money > 0) world.budget.money -= money;
}
