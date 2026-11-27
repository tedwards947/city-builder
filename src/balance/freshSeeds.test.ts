import { describe, it, expect } from 'vitest';
import { combineFreshSeeds, type Report } from './lab';

/** A report with one target graded on three seeds of a fresh map and one saved city. */
function report(cells: Record<string, { value: unknown; pass: boolean | null; miss?: number; note?: string }>): Report {
  return {
    cities: [{ id: 'fresh-128@s7', kind: 'fresh', population: 500 }, { id: 'fresh-128@s11', kind: 'fresh', population: 700 }, { id: 'fresh-128@s23', kind: 'fresh', population: 900 }, { id: 'golden-1', kind: 'save', population: 35_000 }],
    targets: [{ id: 'econ.firstYearBank', suite: 'econ', results: { shipped: { ...cells, 'golden-1': { value: 1, pass: true } } } }],
  } as unknown as Report;
}

describe('a fresh map graded over seeds', () => {
  it('passes when most seeds pass, with the median seed\'s value and every seed in the note', () => {
    const r = report({ 'fresh-128@s7': { value: 36_000, pass: true, miss: 0 }, 'fresh-128@s11': { value: 15_000, pass: false, miss: 15_000 }, 'fresh-128@s23': { value: 41_000, pass: true, miss: 0 } });
    combineFreshSeeds(r);
    const cell = r.targets[0].results.shipped;
    expect(Object.keys(cell).sort()).toEqual(['fresh-128', 'golden-1']);
    expect(cell['fresh-128'].pass).toBe(true);
    expect([36_000, 41_000]).toContain(cell['fresh-128'].value);
    expect(cell['fresh-128'].note).toContain('2 of 3 seeds pass');
    expect(cell['fresh-128'].seeds).toEqual({ s7: { value: 36_000, pass: true }, s11: { value: 15_000, pass: false }, s23: { value: 41_000, pass: true } });
    expect(r.cities.map(c => c.id)).toEqual(['fresh-128', 'golden-1']);
    expect(r.cities[0].population).toBe(700);
  });

  it('fails when most seeds fail, showing the closest failing seed; n/a everywhere stays n/a', () => {
    const r = report({ 'fresh-128@s7': { value: 10, pass: false, miss: 20 }, 'fresh-128@s11': { value: 25, pass: false, miss: 5 }, 'fresh-128@s23': { value: 40, pass: true, miss: 0 } });
    combineFreshSeeds(r);
    const c = r.targets[0].results.shipped['fresh-128'];
    expect(c.pass).toBe(false);
    expect(c.value).toBe(25);
    expect(c.miss).toBe(5);
    const n = report({ 'fresh-128@s7': { value: null, pass: null }, 'fresh-128@s11': { value: null, pass: null }, 'fresh-128@s23': { value: null, pass: null } });
    combineFreshSeeds(n);
    expect(n.targets[0].results.shipped['fresh-128'].pass).toBe(null);
  });
});
