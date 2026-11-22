import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { connectionsResult, type ConnectionsResult } from './connections';
import { TARGETS, type EvalCtx } from './targets';
import { buildLivingCity } from '../__tests__/fixtures/testCity';

const grade = (r: ConnectionsResult | null, cityKind: 'save' | 'fresh' = 'save') => {
  const ctx: EvalCtx = { variant: 'shipped', city: 'x', cityKind, runs: {}, probes: null, refill: null, ordinancesOn: false, connections: r };
  return Object.fromEntries(TARGETS.filter((t) => t.suite === 'connections').map((t) => [t.id.split('.')[1], t.evaluate(ctx)]));
};
const hw = (meetPeak: number, meetBefore = 0.2, meetsClass = 2) => ({ meetsClass, meetBefore, meetPeak, visitorsIn: 0, dayTrippers: 50, trucks: 10, residentsOut: 15 });
const city: ConnectionsResult = {
  population: 20000,
  one: { ...hw(1.07), exportIncomePerDay: 640 },
  two: [hw(0.72), hw(1.19, 0.71)],
  industry: { base: 500, one: 505 },
  rail: { inPerTick: 120, trackPeak: 0.5, jammedBefore: 30, jammedAfter: 32, cleared: 4 },
};

describe('balance lab: connections targets', () => {
  it('a 20k city whose point meets an avenue: jammed with one point, not with two; exports, industry and rail graded', () => {
    const g = grade(city);
    for (const k of ['entryJam', 'twoPoints', 'exports', 'industryNeutral', 'railIn']) expect(g[k].pass, k).toBe(true);
    expect(grade({ ...city, one: { ...city.one!, meetPeak: 0.9 } }).entryJam.pass).toBe(false);
    expect(grade({ ...city, two: [hw(1.1), hw(0.5)] }).twoPoints.pass).toBe(false);
    // Graded on the load the joins add: an avenue already 0.75 full that one point takes to 1.69 and
    // two to 1.32 passes (0.57 ÷ 0.94 = 0.61), though its peak stays over 1.
    const busy = { ...city, one: { ...hw(1.69, 0.75), exportIncomePerDay: 0 }, two: [hw(1.32, 0.75), hw(1.2)] as [ReturnType<typeof hw>, ReturnType<typeof hw>] };
    expect(grade(busy).twoPoints).toMatchObject({ value: 0.606, pass: true });
    expect(grade({ ...busy, two: [hw(1.5, 0.75), hw(1.2)] }).twoPoints.pass).toBe(false);   // 0.80
    expect(grade({ ...city, industry: { base: 500, one: 450 } }).industryNeutral.pass).toBe(false);
    expect(grade({ ...city, rail: { inPerTick: 120, trackPeak: 0.9, jammedBefore: 30, jammedAfter: 30, cleared: 0 } }).railIn.pass).toBe(false);
  });

  it('the jam targets are n/a under 20k, where the point meets a street or highway, or where the avenue was full already', () => {
    expect(grade({ ...city, population: 12000 }).entryJam.pass).toBeNull();
    expect(grade({ ...city, one: { ...city.one!, meetsClass: 1 } }).entryJam.pass).toBeNull();
    expect(grade({ ...city, one: { ...city.one!, meetsClass: 3 } }).twoPoints.pass).toBeNull();
    expect(grade({ ...city, one: { ...city.one!, meetBefore: 1.2 } }).entryJam.pass).toBeNull();
    expect(grade({ ...city, two: undefined }).twoPoints.pass).toBeNull();
    expect(grade({ ...city, one: { ...city.one!, meetPeak: 0.2 } }).twoPoints.pass).toBeNull();   // joining added nothing
  });

  it('exports are graded on the district the probe builds when no industry is in reach, n/a with neither', () => {
    const none = { ...city, one: { ...city.one!, trucks: 0, exportIncomePerDay: 0 } };
    expect(grade(none).exports.pass).toBeNull();
    expect(grade({ ...none, exportsBuilt: { note: 'no room for an industry district by the point' } }).exports.pass).toBeNull();
    const built = grade({ ...none, exportsBuilt: { levels: 120, trucks: 10, exportIncomePerDay: 640 } }).exports;
    expect(built.pass).toBe(true);
    expect(built.note).toContain('built by the point');
    expect(grade({ ...none, exportsBuilt: { levels: 30, trucks: 3, exportIncomePerDay: 190 } }).exports.pass).toBe(false);
  });

  it('tourists with attractions are shown for information only, and n/a without the run', () => {
    expect(TARGETS.find((t) => t.id === 'connections.tourists')!.status).toBe('later');
    expect(grade(city).tourists.pass).toBeNull();
    const t = grade({ ...city, withAttractions: { placed: 3, one: { ...hw(0.82, 0.16), visitorsIn: 30 }, two: [hw(0.8, 0.16), hw(1.3, 0.7)] } }).tourists;
    expect(t.value).toBe(30);
    expect(t.note).toContain('0.97 of the added load');   // (0.8 − 0.16) ÷ (0.82 − 0.16)
  });

  it('railIn grades a line built for the probe and says so', () => {
    const built = { inPerTick: 67, trackPeak: 0.4, jammedBefore: 730, jammedAfter: 733, cleared: 0,
      built: { stations: 2, trackTiles: 167, nearStreets: 32, nearPeakBefore: 4.96, nearPeakAfter: 5.1, nearJammedBefore: 19, nearJammedAfter: 20 } };
    const g = grade({ ...city, rail: built }).railIn;
    expect(g.pass).toBe(true);
    expect(JSON.stringify(g)).toContain('line built for the probe: 2 stations');
    expect(grade({ ...city, rail: { ...built, trackPeak: 1.37 } }).railIn.pass).toBe(false);
    // The jam allowance: 5 tiles, or 2% of those already jammed if more (730 jammed: 14).
    expect(grade({ ...city, rail: { ...built, jammedAfter: 744 } }).railIn.pass).toBe(true);
    expect(grade({ ...city, rail: { ...built, jammedAfter: 745 } }).railIn.pass).toBe(false);
    expect(grade({ ...city, rail: { ...built, jammedBefore: 49, jammedAfter: 55 } }).railIn.pass).toBe(false);   // golden-1 size: 5
  });

  it('everything is n/a on fresh maps and where nothing can be joined', () => {
    for (const o of Object.values(grade(city, 'fresh'))) expect(o.pass).toBeNull();
    for (const o of Object.values(grade({ population: 20000, note: 'no connection point can be joined' }))) expect(o.pass).toBeNull();
    expect(grade({ ...city, rail: { note: 'no rail point can be joined' } }).railIn.pass).toBeNull();
  });
});

describe('balance lab: connections probe', () => {
  it('works on copies: the city and BALANCE are left as they were', () => {
    const { world } = buildLivingCity();
    const before = JSON.stringify(BALANCE), tick = world.tick, roads = world.index.roadCount, pop = world.stats.population;
    const r = connectionsResult(world, 1);
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(world.tick).toBe(tick);
    expect(world.index.roadCount).toBe(roads);
    expect(world.stats.population).toBe(pop);
    expect(r.population).toBeGreaterThan(0);
  }, 120_000);
});
