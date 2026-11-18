// The Political Capital numbers are on: the shipped BALANCE.politicalCapital
// is the Balance Lab's tuned set (preset T). These check the shipped numbers
// themselves (most PC test files start from PC_OFF, see pcOffBaseline.ts) and
// that a city saved before the numbers shipped loads and runs under them.

import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { PC_OFF } from '../data/pcOff';
import { applyValues } from '../ui/pcPresets';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { serialize, deserialize } from '../persistence/Serializer';
import { ordinancesEnabled } from '../sim/ordinances';
import { pcCap } from '../sim/politics';
import { buildLivingCity } from './fixtures/testCity';

const PC = BALANCE.politicalCapital;

describe('the shipped Political Capital numbers', () => {
  it('are switched on', () => {
    expect(PC.max).toBe(150);
    expect(PC.capPerResident).toBeGreaterThan(0);
    expect(PC.neutralSatisfaction).toBeGreaterThan(0);
    expect(PC.milestones.length).toBe(6);
    expect(PC.requests.spawnEveryDays).toBeGreaterThan(0);
    for (const k of Object.values(PC.requests.kinds)) expect(k.days).toBeGreaterThan(0);
    expect(ordinancesEnabled()).toBe(true);
    expect(PC.establishedYears).toBeGreaterThan(0);
    expect(Object.values(PC.service.perResident).every((v) => v > 0)).toBe(true);
    expect(BALANCE.budget.debtPcDrainPerDay).toBe(0.75);
  });

  it('keep closing a service dearer than opening one, so it cannot be farmed', () => {
    expect(PC.service.closureMultiplier).toBeGreaterThanOrEqual(1);
  });

  it('a city saved before the numbers shipped loads and runs, with no windfall for milestones it had passed', () => {
    const shipped = structuredClone(PC);
    let json: string;
    try {
      applyValues(PC as never, structuredClone(PC_OFF) as never);      // the numbers the save was made under
      const { world } = buildLivingCity();
      const scheduler = new Scheduler(world, createSystems().systems);
      while (world.tick < 40) scheduler.tick();
      expect(world.stats.population).toBeGreaterThan(PC.max);          // a real city…
      expect(world.politics.requests).toEqual([]);                     // …with nothing PC-related in it
      json = JSON.stringify(serialize(world));
    } finally {
      applyValues(PC as never, shipped as never);
    }
    expect(PC).toEqual(shipped);

    const world = deserialize(JSON.parse(json));
    const paid: number[] = [];
    world.events.on('populationMilestone', (m) => { paid.push((m as { population: number }).population); });
    const before = world.budget.politicalCapital;
    const population = world.stats.population;
    const scheduler = new Scheduler(world, createSystems().systems);
    scheduler.tick();
    expect(paid.filter((p) => p <= population)).toEqual([]);           // passed milestones stay passed
    expect(Math.abs(world.budget.politicalCapital - before)).toBeLessThan(2);
    for (let k = 0; k < 30 * BALANCE.ticksPerDay; k++) scheduler.tick(); // a month under the shipped numbers
    expect(world.budget.gameOver).toBe(false);
    expect(Number.isFinite(world.budget.politicalCapital)).toBe(true);
    expect(world.budget.politicalCapital).toBeGreaterThanOrEqual(0);
    expect(world.budget.politicalCapital).toBeLessThanOrEqual(pcCap(world) + 600); // the cap, plus rewards that may go over it
    expect(world.politics.requests.length).toBeLessThanOrEqual(PC.requests.maxOpen);
  });
});
