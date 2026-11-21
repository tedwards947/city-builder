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
    expect(grade({ ...city, industry: { base: 500, one: 450 } }).industryNeutral.pass).toBe(false);
    expect(grade({ ...city, rail: { inPerTick: 120, trackPeak: 0.9, jammedBefore: 30, jammedAfter: 30, cleared: 0 } }).railIn.pass).toBe(false);
  });

  it('the jam targets are n/a under 20k, where the point meets a street or highway, or where the avenue was full already', () => {
    expect(grade({ ...city, population: 12000 }).entryJam.pass).toBeNull();
    expect(grade({ ...city, one: { ...city.one!, meetsClass: 1 } }).entryJam.pass).toBeNull();
    expect(grade({ ...city, one: { ...city.one!, meetsClass: 3 } }).twoPoints.pass).toBeNull();
    expect(grade({ ...city, one: { ...city.one!, meetBefore: 1.2 } }).entryJam.pass).toBeNull();
    expect(grade({ ...city, two: undefined }).twoPoints.pass).toBeNull();
  });

  it('exports are n/a with no industry in reach; everything is n/a on fresh maps and where nothing can be joined', () => {
    expect(grade({ ...city, one: { ...city.one!, trucks: 0, exportIncomePerDay: 0 } }).exports.pass).toBeNull();
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
