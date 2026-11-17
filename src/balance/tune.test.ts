import { describe, it, expect } from 'vitest';
import { VARIANT_VALUES } from '../ui/pcVariantValues';
import { PARAMS, move, diff } from './tune';

const B = VARIANT_VALUES.B as unknown as Record<string, unknown>;

describe('auto-tuner levers', () => {
  it('every lever points at keys variant B sets', () => {
    for (const p of PARAMS) expect(move(B, p, 1, 1.5) ?? move(B, p, -1, 1.5), p.id).not.toBeNull();
  });
  it('moves a group together, clamps, and leaves the input alone', () => {
    const before = JSON.stringify(B);
    const up = move(B, PARAMS.find(p => p.id === 'servicePerResident')!, 1, 2)!;
    expect(JSON.stringify(B)).toBe(before);
    expect(Object.keys(diff(B, up)).sort()).toEqual([4, 5, 6, 7, 8].map(k => `service.perResident.${k}`).sort());
    const rf = PARAMS.find(p => p.id === 'repeatFactor')!;
    let t: Record<string, unknown> | null = B;
    for (let k = 0; k < 20 && t; k++) t = move(t, rf, 1, 1) ?? null;
    expect(t).toBeNull();   // stops changing at the max (1)
  });
});
