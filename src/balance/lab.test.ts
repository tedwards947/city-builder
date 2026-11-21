import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { mergeReports, runLab, REPORT_SCHEMA } from './lab';
import { TARGETS } from './targets';

// The Balance Lab is a tool, not the game: these checks only say it runs, is
// deterministic, grades every target and leaves BALANCE as it found it.
describe('balance lab', () => {
  // The rail suite's fresh probe plays 360 days, too long here; rail.test.ts covers its probe. The lots suite (saved cities only, 3 × 360 days) is covered by lots.test.ts.
  const small = () => runLab({ suites: ['pc', 'econ', 'svc', 'trade', 'taxdebt', 'airport', 'landscape'], variants: ['Off', 'B'], econPresets: ['shipped', 'recommended'], svcPresets: ['nocap', 'shipped'], personas: ['planner', 'chaser', 'exploiter'], daysFresh: 40, cities: [{ id: 'fresh', kind: 'fresh', size: 128, seed: 7 }] });

  it('runs, grades every target for every variant, and restores BALANCE', () => {
    const before = JSON.stringify(BALANCE);
    const r = small();
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(r.schema).toBe(REPORT_SCHEMA);
    expect(r.targets.map(t => t.id)).toEqual(TARGETS.filter(t => t.suite !== 'rail' && t.suite !== 'lots' && t.suite !== 'stadium' && t.suite !== 'leisure' && t.suite !== 'connections').map(t => t.id));
    for (const t of r.targets) if (t.suite !== 'trade' && t.suite !== 'airport' && t.suite !== 'rail' && t.suite !== 'landscape') for (const v of t.suite === 'pc' ? ['Off', 'B'] : t.suite === 'econ' ? ['shipped', 'recommended'] : t.suite === 'taxdebt' ? ['shipped'] : ['nocap', 'shipped']) expect(t.results[v]?.fresh).toBeDefined();
    expect(r.econRuns.recommended.fresh.econ.moneyStart).toBeGreaterThan(0);
    expect(r.runs.B.fresh.planner.end.population).toBeGreaterThan(0);
    expect(Object.keys(r.summary)).toEqual(['Off', 'B']);
    expect(Object.keys(r.econSummary)).toEqual(['shipped', 'recommended']);
    expect(Object.keys(r.svcSummary)).toEqual(['nocap', 'shipped']);
    expect(r.svcRuns.shipped.fresh.kinds.school.buildings).toBeGreaterThanOrEqual(0);
    expect(Object.keys(r.taxDebtRuns.shipped.fresh.levels).map(Number)).toEqual([0, 5, 10, 15, 20]);
    expect(r.targets.find(t => t.id === 'land.treeBuffer')?.results.shipped?.fresh?.value).toBeGreaterThan(0);
  }, 60_000);

  it('target ids are unique and stable in form', () => {
    const ids = TARGETS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(pc|econ|svc|port|goods|debt|tax|airport|rail|land|vibe|water|lots|stadium|leisure|connections)\.[a-zA-Z.]+$/);
  });

  it('two runs merged (npm run balance --jobs) report what one run of both does', () => {
    const o = { svcPresets: ['shipped'], taxDebtPresets: ['shipped'], personas: ['planner' as const], daysFresh: 40, cities: [{ id: 'fresh', kind: 'fresh' as const, size: 128, seed: 7 }] };
    const both = runLab({ ...o, suites: ['svc', 'taxdebt'] });
    const merged = mergeReports([runLab({ ...o, suites: ['svc'] }), runLab({ ...o, suites: ['taxdebt'] })]);
    const strip = (r: typeof both) => JSON.stringify({ t: r.targets.map(t => [t.id, t.results]), svc: r.svcRuns, tax: r.taxDebtRuns, s: [r.svcSummary, r.taxDebtSummary], cities: r.cities });
    expect(strip(merged)).toBe(strip(both));
  }, 120_000);

  it('is deterministic', () => {
    const a = small(), b = small();
    const strip = (r: ReturnType<typeof small>) => JSON.stringify({ runs: r.runs, probes: r.probes, econ: r.econRuns, svc: r.svcRuns, taxdebt: r.taxDebtRuns });
    expect(strip(a)).toBe(strip(b));
  }, 120_000);
});
