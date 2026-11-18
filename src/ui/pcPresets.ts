// Political Capital number sets for the debug tuning panel's variant picker. Only the keys listed are changed; the rest keep their current
// value. T is the shipped BALANCE.politicalCapital; Off (PC_OFF, src/data/pcOff.ts) is every PC effect at 0.

import { VARIANT_VALUES } from './pcVariantValues';

export type PcVariantId = 'A' | 'B' | 'C' | 'D' | 'T';

export interface PcVariant {
  id: PcVariantId;
  name: string;
  /** One line for the panel. */
  desc: string;
  /** A partial BALANCE.politicalCapital tree, applied over the shipped numbers with PC switched off (PC_OFF). */
  values: Record<string, unknown>;
}

/**
 * The play-test variants on the panel's picker. Choosing one resets to
 * the shipped numbers, switches PC off (PC_OFF), then applies its values. The numbers are in
 * pcVariantValues.ts (A–D are the engine session's dry-run sets, B the accepted
 * one; T is the Balance Lab tuner's best set, found starting from D).
 */
export const PC_VARIANTS: readonly PcVariant[] = [
  { id: 'A', name: 'Gentle', desc: 'Relaxed: PC refills in 3 minutes and rarely says no.', values: VARIANT_VALUES.A },
  { id: 'B', name: 'Balanced', desc: 'A full bar in 5 minutes; a tower costs about a third of it.', values: VARIANT_VALUES.B },
  { id: 'C', name: 'Strict planner', desc: 'PC is slow and dear: every demolition is a decision.', values: VARIANT_VALUES.C },
  { id: 'D', name: 'Political', desc: 'PC flows fast both ways: bigger rewards, costs and ordinances.', values: VARIANT_VALUES.D },
  { id: 'T', name: 'Tuned', desc: 'The shipped numbers: auto-tuned from D, passes the most Balance Lab targets.', values: VARIANT_VALUES.T },
];

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;

/**
 * Copy `from` into `into` in place: nested objects are filled rather than
 * replaced and lists are spliced, so sim code holding a reference to a list
 * (milestones, bands) sees the new values.
 */
export function applyValues(into: Tree, from: Tree): void {
  for (const key of Object.keys(from)) {
    const src = from[key], dst = into[key];
    if (Array.isArray(src) && Array.isArray(dst)) {
      dst.splice(0, dst.length, ...src.map((row) => (isTree(row) ? { ...row } : row)));
    } else if (isTree(src) && isTree(dst)) {
      applyValues(dst, src);
    } else {
      into[key] = src;
    }
  }
}
