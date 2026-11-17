import { describe, it, expect } from 'vitest';
import { VARIANT_VALUES } from '../ui/pcVariantValues';
import { PARAMS, move, diff, tune, type Eval, type ValueTree } from './tune';

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

describe('auto-tuner search', () => {
  // A stand-in score: distance of `max` from 300 and of servicePerResident.4 from 0 (no sim run).
  const fake = (t: ValueTree): Eval => {
    const v = t as { max: number; service: { perResident: Record<string, number> } };
    const score = Math.abs(v.max - 300) / 100 + v.service.perResident['4'];
    return { score, pass: 0, graded: 1, results: { 'x@fresh': score < 0.5 }, values: t };
  };
  it('lowers the score, stays within budget, and is deterministic', async () => {
    let calls = 0;
    const many = async (ts: ValueTree[]) => { calls += ts.length; return ts.map(fake); };
    const a = await tune('B', many, { budget: 60 });
    const b = await tune('B', async ts => ts.map(fake), { budget: 60 });
    expect(a.best.score).toBeLessThan(a.startEval.score);
    expect(a.evals).toBeLessThanOrEqual(60);
    expect(calls).toBe(a.evals);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
