// The auto-tuner's best PC number set (variant "T" / Tuned). Since 2026-11-18
// it IS the shipped BALANCE.politicalCapital (src/data/balance.ts), which is
// the only copy: this file reads the tunable numbers (the keys of PC_OFF,
// src/data/pcOff.ts) back from it when the module loads, before anything can
// retune BALANCE in place. To ship a newer tuner result, put its best.values
// into balance.ts.
// History: re-tuned 2026-11-17 under the shipped service numbers (school 20 /
// 4,000, hospital 30 / 8,000); closureMultiplier 1.67 → 1.85 on 2026-11-18 for
// pc.closure.lonely ≥ 0.15 (owner); re-graded after #253: 96/98.

import { BALANCE } from '../data/balance';
import { PC_OFF } from '../data/pcOff';

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A deep copy of `from`, keeping only the keys `shape` has. */
function pick(shape: Tree, from: Tree): Tree {
  const out: Tree = {};
  for (const key of Object.keys(shape)) {
    const s = shape[key], v = from[key];
    out[key] = isTree(s) && isTree(v) ? pick(s, v) : structuredClone(v);
  }
  return out;
}

export const TUNED_T: Record<string, unknown> = pick(PC_OFF, BALANCE.politicalCapital as unknown as Tree);
