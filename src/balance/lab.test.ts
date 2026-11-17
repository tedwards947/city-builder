import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { runLab, REPORT_SCHEMA } from './lab';
import { TARGETS } from './targets';

// The Balance Lab is a tool, not the game: these checks only say it runs, is
// deterministic, grades every target and leaves BALANCE as it found it.
describe('balance lab', () => {
  const small = () => runLab({ variants: ['Off', 'B'], econPresets: ['shipped', 'recommended'], svcPresets: ['nocap', 'shipped'], personas: ['planner', 'chaser', 'exploiter'], daysFresh: 40, cities: [{ id: 'fresh', kind: 'fresh', size: 128, seed: 7 }] });

  it('runs, grades every target for every variant, and restores BALANCE', () => {
    const before = JSON.stringify(BALANCE);
    const r = small();
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(r.schema).toBe(REPORT_SCHEMA);
    expect(r.targets.map(t => t.id)).toEqual(TARGETS.map(t => t.id));
    for (const t of r.targets) for (const v of t.suite === 'pc' ? ['Off', 'B'] : t.suite === 'econ' ? ['shipped', 'recommended'] : ['nocap', 'shipped']) expect(t.results[v]?.fresh).toBeDefined();
    expect(r.econRuns.recommended.fresh.econ.moneyStart).toBeGreaterThan(0);
    expect(r.runs.B.fresh.planner.end.population).toBeGreaterThan(0);
    expect(Object.keys(r.summary)).toEqual(['Off', 'B']);
    expect(Object.keys(r.econSummary)).toEqual(['shipped', 'recommended']);
    expect(Object.keys(r.svcSummary)).toEqual(['nocap', 'shipped']);
    expect(r.svcRuns.shipped.fresh.kinds.school.buildings).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it('target ids are unique and stable in form', () => {
    const ids = TARGETS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(pc|econ|svc)\.[a-zA-Z.]+$/);
  });

  it('is deterministic', () => {
    const a = small(), b = small();
    const strip = (r: ReturnType<typeof small>) => JSON.stringify({ runs: r.runs, probes: r.probes, econ: r.econRuns, svc: r.svcRuns });
    expect(strip(a)).toBe(strip(b));
  }, 120_000);
});
