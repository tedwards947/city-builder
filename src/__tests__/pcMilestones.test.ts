// Population milestones: a one-off PC reward the first time the city reaches
// each threshold. The shipped list is empty, so these tests pass their own.

import './pcOffBaseline';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { PoliticsSystem } from '../sim/systems/PoliticsSystem';
import { CommandHistory } from '../commands/CommandHistory';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { dueMilestones, payMilestones, pcCap } from '../sim/politics';
import type { Milestone } from '../sim/politics';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';
import { landWorld, home, displacementCost } from './pcTestWorld';

const LADDER: Milestone[] = [
  { population: 1000, reward: 20 },
  { population: 2500, reward: 30 },
  { population: 5000, reward: 40 },
];

let w: World;
let seen: { population: number; reward: number }[];
beforeEach(() => {
  w = landWorld();
  seen = [];
  w.events.on('populationMilestone', p => seen.push(p as { population: number; reward: number }));
});

describe('population milestones', () => {
  it('the list is empty with PC off', () => {
    expect(BALANCE.politicalCapital.milestones).toEqual([]);
    w.stats.population = 99_999;
    w.budget.politicalCapital = 10;
    payMilestones(w);
    expect(w.budget.politicalCapital).toBe(10);
    expect(w.politics.peakPopulation).toBe(99_999);
  });

  it('dueMilestones are those above what was credited and at or below the population now', () => {
    expect(dueMilestones(0, 999, LADDER)).toEqual([]);
    expect(dueMilestones(0, 1000, LADDER)).toEqual([LADDER[0]]);
    expect(dueMilestones(1000, 1000, LADDER)).toEqual([]);
    expect(dueMilestones(900, 6000, LADDER)).toEqual(LADDER);
    // Order does not depend on how the list is written.
    expect(dueMilestones(0, 6000, [LADDER[2], LADDER[0], LADDER[1]])).toEqual(LADDER);
  });

  it('pays once on reaching a threshold, over the cap, and says so', () => {
    w.stats.population = 999;
    payMilestones(w, LADDER);
    expect(seen).toEqual([]);
    w.stats.population = 1004;
    payMilestones(w, LADDER);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 20);
    expect(seen).toEqual([{ population: 1000, reward: 20 }]);
    payMilestones(w, LADDER);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 20);
    expect(seen.length).toBe(1);
  });

  it('does not pay again when the population falls and comes back', () => {
    w.budget.politicalCapital = 0;
    w.stats.population = 1200;
    payMilestones(w, LADDER);
    w.stats.population = 700;
    payMilestones(w, LADDER);
    w.stats.population = 1300;
    payMilestones(w, LADDER);
    expect(w.budget.politicalCapital).toBe(20);
    expect(seen.length).toBe(1);
    expect(w.politics.peakPopulation).toBe(1300);
  });

  it('pays every threshold passed in one jump, smallest first', () => {
    w.budget.politicalCapital = 0;
    w.stats.population = 5200;
    payMilestones(w, LADDER);
    expect(w.budget.politicalCapital).toBe(90);
    expect(seen.map(s => s.population)).toEqual([1000, 2500, 5000]);
  });

  it('a city already credited for its people gets nothing for thresholds it has passed', () => {
    // What loading an old save does: peakPopulation starts at the save's population.
    w.politics.peakPopulation = 3000;
    w.stats.population = 3000;
    w.budget.politicalCapital = 0;
    payMilestones(w, LADDER);
    expect(w.budget.politicalCapital).toBe(0);
    w.stats.population = 5000;
    payMilestones(w, LADDER);
    expect(w.budget.politicalCapital).toBe(40);
    expect(seen).toEqual([{ population: 5000, reward: 40 }]);
  });

  it('survives a save and load without paying again', () => {
    w.budget.politicalCapital = 0;
    w.stats.population = 2600;
    payMilestones(w, LADDER);
    const loaded = deserialize(serialize(w));
    payMilestones(loaded, LADDER);
    expect(loaded.budget.politicalCapital).toBe(50);
    expect(loaded.politics.peakPopulation).toBe(2600);
  });
});

describe('population milestones in the running game', () => {
  const ladder = BALANCE.politicalCapital.milestones as Milestone[];
  beforeEach(() => { ladder.push(...LADDER); });
  afterEach(() => { ladder.length = 0; });

  it('PoliticsSystem pays a milestone on the tick the population reaches it', () => {
    const sys = new PoliticsSystem();
    w.budget.politicalCapital = 10;
    w.stats.population = 1000;
    sys.update(w);
    expect(w.budget.politicalCapital).toBeGreaterThanOrEqual(30);
    expect(seen).toEqual([{ population: 1000, reward: 20 }]);
    sys.update(w);
    expect(seen.length).toBe(1);
  });

  it('a milestone landing in the middle of a drag is not counted as part of the action', () => {
    const h = new CommandHistory(w);
    const actions: number[] = [];
    w.events.on('pcAction', p => actions.push(p.delta as number));
    home(w, 5, 5);
    w.budget.politicalCapital = 500;
    h.beginBatch();
    h.run(new BulldozeCommand(5, 5));
    w.stats.population = 1000;
    new PoliticsSystem().update(w);
    h.endBatch();
    expect(actions).toEqual([-displacementCost()]);
    // Undoing the drag gives back the displacement cost, not the milestone.
    const pc = w.budget.politicalCapital;
    h.undo();
    expect(w.budget.politicalCapital).toBe(pc + displacementCost());
  });
});
