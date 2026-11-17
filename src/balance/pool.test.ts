import { describe, it, expect } from 'vitest';
import { createPool, evaluateAll, defaultWorkers } from '../../scripts/balance-pool.mjs';
import type { CitySpec } from './world';
import type { TestEval } from './poolTestTarget';

// The pool (scripts/balance-pool.mjs) is a tool for the lab's runner scripts.
// These checks use a cheap
// stand-in scoring function (poolTestTarget.ts) in real worker processes.
describe('balance lab pool', () => {
  const cities: CitySpec[] = [{ id: 'fresh-a', kind: 'fresh', size: 32, seed: 7 }, { id: 'fresh-b', kind: 'fresh', size: 32, seed: 8 }];
  const base = { cities, days: 3, module: '/src/balance/poolTestTarget.ts', fn: 'evaluate' };
  const trees = [0.01, 0.2, 0.05, 0.4, 0.1, 0.3, 0.02].map(regen => ({ regen }));
  const strip = (r: TestEval[]) => r.map(({ pid: _pid, ...rest }) => rest);

  it('gives the same results, in the order asked, with one worker or several', async () => {
    const one = await evaluateAll<TestEval>(trees, { ...base, workers: 1 });
    const three = await evaluateAll<TestEval>(trees, { ...base, workers: 3 });
    expect(one.map(r => r.regen)).toEqual(trees.map(t => t.regen));
    expect(strip(three)).toEqual(strip(one));
    // Each candidate ran with its own numbers: more regeneration, more PC.
    const byRegen = [...one].sort((a, b) => a.regen - b.regen);
    for (let k = 1; k < byRegen.length; k++) expect(byRegen[k].pcAfter).toBeGreaterThan(byRegen[k - 1].pcAfter);
    // The cities and days reached the workers.
    expect(one[0].cities).toEqual(['fresh-a', 'fresh-b']);
    expect(one[0].days).toBe(3);
    // Really separate processes, and really more than one.
    expect(new Set(one.map(r => r.pid)).size).toBe(1);
    expect(new Set(three.map(r => r.pid)).size).toBeGreaterThan(1);
  }, 120_000);

  it('keeps its workers between rounds, and survives a candidate that throws', async () => {
    const pool = createPool<TestEval>({ ...base, workers: 2 });
    try {
      const first = await pool.evaluateAll(trees.slice(0, 4));
      await expect(pool.evaluateAll([{ regen: 0.1 }, { fail: 'on purpose' }, { regen: 0.2 }])).rejects.toThrow(/candidate 1: .*on purpose/s);
      const again = await pool.evaluateAll(trees.slice(0, 4));
      expect(strip(again)).toEqual(strip(first));
      expect(new Set([...first, ...again].map(r => r.pid)).size).toBeLessThanOrEqual(2);
      expect(await pool.evaluateAll([])).toEqual([]);
    } finally {
      await pool.close();
    }
    await expect(pool.evaluateAll(trees)).rejects.toThrow(/after close/);
  }, 120_000);

  it('reports a scoring function that does not exist', async () => {
    await expect(evaluateAll(trees.slice(0, 2), { ...base, fn: 'nope', workers: 1 })).rejects.toThrow(/no function "nope"/);
  }, 60_000);

  it('picks a sensible number of workers by default', () => {
    expect(defaultWorkers()).toBeGreaterThanOrEqual(1);
    expect(defaultWorkers()).toBeLessThanOrEqual(8);
  });
});
