import './pcOffBaseline';
import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  ORDINANCES, ORDINANCE_IDS, ORDINANCE_MODIFIERS, enactOrdinance, repealOrdinance, ordinanceModifier, ordinanceState,
  upkeepScale, dailyUpkeepOf,
  enactBlocker, ordinancesEnabled,
} from '../sim/ordinances';
import { OrdinanceSystem } from '../sim/systems/OrdinanceSystem';
import { CommandHistory } from '../commands/CommandHistory';

type Numbers = { enactCost: number; dailyUpkeep: number; dailyMoney: number; modifiers: Record<string, number> };
const table = BALANCE.politicalCapital.ordinances as Record<string, Numbers>;
const saved = structuredClone(table);
afterEach(() => { for (const id of Object.keys(saved)) Object.assign(table[id], structuredClone(saved[id])); });

function world(pc = 100): World {
  const w = new World(16, 16, 1);
  w.budget.politicalCapital = pc;
  return w;
}
function events(w: World): string[] {
  const log: string[] = [];
  for (const e of ['ordinanceEnacted', 'ordinanceRepealed', 'ordinanceSuspended', 'ordinanceResumed'] as const) {
    w.events.on(e, (p) => log.push(`${e}:${p.id}`));
  }
  return log;
}

describe('ordinance registry', () => {
  it('has the eight ordinances (Rent Control parked), and with PC off: no cost, no upkeep, every modifier 1', () => {
    expect(ORDINANCES.map((o) => o.id)).toEqual([...ORDINANCE_IDS]);
    expect(ORDINANCE_IDS).toHaveLength(8);
    expect(ORDINANCE_IDS as readonly string[]).not.toContain('rentControl');
    for (const o of ORDINANCES) {
      expect(o.numbers, o.id).toBeDefined();
      expect([o.numbers.enactCost, o.numbers.dailyUpkeep, o.numbers.dailyMoney]).toEqual([0, 0, 0]);
      for (const [name, v] of Object.entries(o.numbers.modifiers)) {
        expect(ORDINANCE_MODIFIERS as readonly string[], `${o.id}.${name}`).toContain(name);
        expect(v).toBe(1);
      }
    }
  });

  it('modifiers are 1 with nothing enacted', () => {
    const w = world();
    for (const name of ORDINANCE_MODIFIERS) expect(ordinanceModifier(w, name)).toBe(1);
  });
});

describe('enacting and repealing', () => {
  it('enact charges the cost and applies modifiers; repeal refunds nothing', () => {
    table.curfew.enactCost = 30;
    table.curfew.modifiers.crime = 0.7;
    table.neighbourhoodWatch.modifiers.crime = 0.85;
    const w = world(100);
    const log = events(w);
    expect(enactOrdinance(w, 'curfew')).toBe(true);
    expect(w.budget.politicalCapital).toBe(70);
    expect(ordinanceState(w, 'curfew')).toBe('on');
    expect(enactOrdinance(w, 'curfew')).toBe(false);          // already on
    enactOrdinance(w, 'neighbourhoodWatch');
    expect(ordinanceModifier(w, 'crime')).toBeCloseTo(0.595);  // they multiply
    expect(repealOrdinance(w, 'curfew')).toBe(true);
    expect(w.budget.politicalCapital).toBe(70);
    expect(ordinanceModifier(w, 'crime')).toBeCloseTo(0.85);
    expect(repealOrdinance(w, 'curfew')).toBe(false);
    expect(log).toEqual(['ordinanceEnacted:curfew', 'ordinanceEnacted:neighbourhoodWatch', 'ordinanceRepealed:curfew']);
  });

  it("can't be enacted without the PC, or in debt", () => {
    table.cleanAirAct.enactCost = 50;
    const w = world(40);
    expect(ordinanceState(w, 'cleanAirAct')).toBe('cantAfford');
    expect(enactOrdinance(w, 'cleanAirAct')).toBe(false);
    expect(w.budget.politicalCapital).toBe(40);
    expect(enactBlocker(w, 'cleanAirAct')).toBe('notEnoughPc');
    w.budget.politicalCapital = 0;
    expect(ordinanceState(w, 'curfew')).toBe('cantAfford');   // free, but PC is not above 0
    expect(enactBlocker(w, 'curfew')).toBe('inDebt');
    w.budget.politicalCapital = 60;
    expect(enactBlocker(w, 'cleanAirAct')).toBeNull();
    enactOrdinance(w, 'cleanAirAct');
    expect(enactBlocker(w, 'cleanAirAct')).toBe('active');
  });

  it('are switched off with PC off', () => {
    expect(ordinancesEnabled()).toBe(false);
  });

  it('is not folded into the player action total', () => {
    table.curfew.enactCost = 10;
    const w = world(100);
    new CommandHistory(w);
    const actions: unknown[] = [];
    w.events.on('pcAction', (p) => actions.push(p));
    enactOrdinance(w, 'curfew');
    expect(actions).toEqual([]);
  });
});

describe('OrdinanceSystem', () => {
  it('charges upkeep once a day, never below 0, and money upkeep', () => {
    table.freeTransit.dailyUpkeep = 3;
    table.freeTransit.dailyMoney = 50;
    const w = world(10);
    enactOrdinance(w, 'freeTransit');
    const money = w.budget.money;
    const sys = new OrdinanceSystem();
    for (let t = 1; t <= BALANCE.ticksPerDay; t++) { w.tick = t; sys.update(w); }
    expect(w.budget.politicalCapital).toBe(7);
    expect(w.budget.money).toBe(money - 50);
    w.budget.politicalCapital = 2;
    w.tick = 2 * BALANCE.ticksPerDay; sys.update(w);
    expect(w.budget.politicalCapital).toBe(0);                // took the last 2, not 3
    expect(ordinanceState(w, 'freeTransit')).toBe('suspended');
  });

  it('PC upkeep scales with the cap, like regeneration; money upkeep does not', () => {
    table.freeTransit.dailyUpkeep = 0.5;
    table.freeTransit.dailyMoney = 50;
    const pc = BALANCE.politicalCapital as { capPerResident: number };
    const w = world(100);
    enactOrdinance(w, 'freeTransit');
    // Base cap: the factor is exactly 1.
    expect(upkeepScale(w)).toBe(1);
    expect(dailyUpkeepOf(w, 'freeTransit')).toBe(0.5);
    pc.capPerResident = 0.01;
    try {
      w.stats.population = 10_000;                            // cap 200
      expect(upkeepScale(w)).toBe(2);
      expect(dailyUpkeepOf(w, 'freeTransit')).toBe(1);
      const money = w.budget.money;
      w.budget.politicalCapital = 100;
      w.tick = BALANCE.ticksPerDay; new OrdinanceSystem().update(w);
      expect(w.budget.politicalCapital).toBe(99);
      expect(w.budget.money).toBe(money - 50);
    } finally {
      pc.capPerResident = 0;
    }
  });

  it('suspends at PC 0 or below (no effect, no upkeep) and resumes above 0', () => {
    table.curfew.modifiers.crime = 0.7;
    table.curfew.dailyUpkeep = 1;
    const w = world(5);
    const log = events(w);
    enactOrdinance(w, 'curfew');
    const sys = new OrdinanceSystem();
    w.budget.politicalCapital = -4;                          // political debt
    w.tick = 1; sys.update(w);
    expect(ordinanceState(w, 'curfew')).toBe('suspended');
    expect(ordinanceModifier(w, 'crime')).toBe(1);
    w.tick = BALANCE.ticksPerDay; sys.update(w);
    expect(w.budget.politicalCapital).toBe(-4);              // no upkeep while suspended
    w.budget.politicalCapital = 1;
    w.tick++; sys.update(w);
    expect(ordinanceState(w, 'curfew')).toBe('on');
    expect(ordinanceModifier(w, 'crime')).toBeCloseTo(0.7);
    expect(log).toEqual(['ordinanceEnacted:curfew', 'ordinanceSuspended:curfew', 'ordinanceResumed:curfew']);
  });
});
