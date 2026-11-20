import { describe, it, expect, afterEach } from 'vitest';
import { BALANCE } from '../data/balance';
import { BUILDING_FIRE, BUILDING_HOSPITAL, BUILDING_POLICE, BUILDING_SCHOOL } from '../sim/constants';
import { headcountCost, perResidentCost, perUnitCost } from '../sim/runningCost';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { buildLivingCity, population } from './fixtures/testCity';
import { startSim } from '../balance/world';

/** The test city after a game day, so coverage and the utility stats are worked out. */
function city() { const { world } = buildLivingCity(); startSim(world).tick(BALANCE.ticksPerDay); return world; }

const rc = BALANCE.runningCost as { perResident: Record<number, number>; perUnit: Record<string, number>; largePlantMult: number; freeResidents: number };
const shipped = JSON.parse(JSON.stringify(rc));
afterEach(() => { Object.assign(rc, JSON.parse(JSON.stringify(shipped))); });

describe('running costs that grow with the city (sim/runningCost.ts)', () => {
  it('ships with ENGINEER 3\'s numbers (owner-approved pacing, 2026-11-20)', () => {
    expect(rc).toEqual({ perResident: { 4: 0.03, 5: 0.02, 6: 0.04, 7: 0.04 }, perUnit: { power: 0.05, water: 0.06, sewage: 0.04 }, largePlantMult: 0.6, freeResidents: 1000 });
    expect(perResidentCost(BUILDING_POLICE)).toBe(0.03);
    expect(perUnitCost('power', true)).toBeCloseTo(0.03, 9);
  });

  it('charges each covered resident, beyond the free ones, at its service\'s rate', () => {
    const world = city();
    const h = headcountCost(world);
    const pop = population(world);
    expect(pop).toBeGreaterThan(rc.freeResidents);
    expect(h.charged).toBeCloseTo((pop - rc.freeResidents) / pop, 9);
    for (const kind of [BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL]) {
      expect(h.residents[kind]).toBeLessThanOrEqual(pop);
      expect(h.services[kind]).toBeCloseTo(h.residents[kind] * rc.perResident[kind] / BALANCE.ticksPerDay * h.charged, 9);
    }
    expect(h.total).toBeGreaterThan(0);
  });

  it('a town under the free allowance pays nothing extra, and nothing is charged at rates of 0', () => {
    const world = city();
    rc.freeResidents = 1e9;
    expect(headcountCost(world).total).toBe(0);
    rc.freeResidents = shipped.freeResidents;
    rc.perResident = { 4: 0, 5: 0, 6: 0, 7: 0 };
    rc.perUnit = { power: 0, water: 0, sewage: 0 };
    expect(headcountCost(world).total).toBe(0);
  });

  it('the economy charges it on top of roads and buildings', () => {
    const world = city();
    const econ = new EconomySystem();
    econ.update(world);
    const withIt = world.budget.expenses, extra = headcountCost(world).total;
    rc.freeResidents = 1e9;
    econ.update(world);
    expect(withIt - world.budget.expenses).toBeCloseTo(extra, 6);
  });
});
