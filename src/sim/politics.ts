// Political capital (PC): the one place that reads its cap and writes its value.
//
// Everything that changes `world.budget.politicalCapital` goes through this
// file, so the rules (cap, events, later a floor at zero) live in one place:
//   - changePc: a cost or a reward from a player action;
//   - regenPc:  the passive per-tick change from PoliticsSystem.

import type { World } from './World';
import { BALANCE } from '../data/balance';

/** Why political capital changed. */
export type PcReason =
  | 'displacement'    // residents lost their homes (bulldoze, rezone, road or building over homes)
  | 'blightCleared';  // an abandoned building was cleared

export interface PcChangeInfo {
  /** The tile the change came from, if it has one. */
  tx?: number;
  ty?: number;
  /** True when a command is being undone: the change reverses an earlier one. */
  undo?: boolean;
}

/** The most political capital passive regeneration can reach. */
export function pcCap(_world: World): number {
  return BALANCE.politicalCapital.max;
}

/**
 * Add `delta` to political capital (negative for a cost) and tell listeners.
 * Emits `pcChanged`; see CityEvents for the payload. A zero delta does nothing.
 * CommandHistory adds these up into one `pcAction` per finished player action.
 */
export function changePc(world: World, delta: number, reason: PcReason, info: PcChangeInfo = {}): void {
  if (delta === 0) return;
  world.budget.politicalCapital += delta;
  world.events.emit('pcChanged', {
    delta,
    reason,
    tx: info.tx,
    ty: info.ty,
    undo: info.undo === true,
  });
}

/**
 * Apply one tick of passive regeneration, stopping at the cap. No event: it
 * happens every tick, and the HUD reads the value directly.
 */
export function regenPc(world: World, amount: number): void {
  world.budget.politicalCapital = Math.min(pcCap(world), world.budget.politicalCapital + amount);
}
