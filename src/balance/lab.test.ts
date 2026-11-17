import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { runLab, REPORT_SCHEMA } from './lab';
import { TARGETS } from './targets';

// The Balance Lab is a tool, not the game: these checks only say it runs, is
// deterministic, grades every target and leaves BALANCE as it found it.
describe('balance lab', () => {
  const small = () => runLab({ variants: ['Off', 'B'], personas: ['planner', 'chaser', 'exploiter'], daysFresh: 40, cities: [{ id: 'fresh', kind: 'fresh', size: 128, seed: 7 }] });

  it('runs, grades every target for every variant, and restores BALANCE', () => {
    const before = JSON.stringify(BALANCE.politicalCapital);
    const r = small();
    expect(JSON.stringify(BALANCE.politicalCapital)).toBe(before);
    expect(r.schema).toBe(REPORT_SCHEMA);
    expect(r.targets.map(t => t.id)).toEqual(TARGETS.map(t => t.id));
    for (const t of r.targets) for (const v of ['Off', 'B']) expect(t.results[v]?.fresh).toBeDefined();
    expect(r.runs.B.fresh.planner.end.population).toBeGreaterThan(0);
    expect(Object.keys(r.summary)).toEqual(['Off', 'B']);
  }, 60_000);

  it('target ids are unique and stable in form', () => {
    const ids = TARGETS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(pc|econ)\.[a-zA-Z.]+$/);
  });

  it('is deterministic', () => {
    const a = small(), b = small();
    const strip = (r: ReturnType<typeof small>) => JSON.stringify({ runs: r.runs, probes: r.probes });
    expect(strip(a)).toBe(strip(b));
  }, 120_000);
});
