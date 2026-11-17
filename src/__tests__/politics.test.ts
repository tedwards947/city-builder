import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { pcCap, capScale, pcQuote, changePc, regenPc, regenRate, regenPerTick, fadeOverCap, overCapFadePerDay } from '../sim/politics';
import { ZONE_R, ZONE_C, BUILDING_PARK, ROAD_STREET } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { PoliticsSystem } from '../sim/systems/PoliticsSystem';
import { landWorld, home } from './pcTestWorld';

interface PcEvent { delta: number; reason: string; tx?: number; ty?: number; undo: boolean }
interface PcAction { delta: number; tx?: number; ty?: number; undo: boolean }

function listen(w: World): PcEvent[] {
  const seen: PcEvent[] = [];
  w.events.on('pcChanged', p => seen.push(p as unknown as PcEvent));
  return seen;
}

const HOME_COST = BALANCE.growth.popPerLevel[2] * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;

describe('politics: the PC write point', () => {
  let w: World;
  let seen: PcEvent[];
  beforeEach(() => { w = landWorld(); seen = listen(w); });

  it('pcCap is the balance maximum while the per-resident amount is switched off', () => {
    expect(BALANCE.politicalCapital.capPerResident).toBe(0);
    w.stats.population = 50_000;
    expect(pcCap(w)).toBe(BALANCE.politicalCapital.max);
  });

  it('pcCap grows with population when a per-resident amount is set', () => {
    const cfg = { max: 100, capPerResident: 0.01 };
    expect(pcCap(w, cfg)).toBe(100);
    w.stats.population = 2500;
    expect(pcCap(w, cfg)).toBe(125);
    w.stats.population = 10_000;
    expect(pcCap(w, cfg)).toBe(200);
  });

  it('changePc adds the delta and emits pcChanged with the tile', () => {
    w.budget.politicalCapital = 50;
    changePc(w, -12, 'displacement', { tx: 3, ty: 4 });
    expect(w.budget.politicalCapital).toBe(38);
    expect(seen).toEqual([{ delta: -12, reason: 'displacement', tx: 3, ty: 4, undo: false }]);
  });

  it('changePc with a zero delta does nothing and emits nothing', () => {
    changePc(w, 0, 'displacement');
    expect(seen).toEqual([]);
  });

  it('a blight reward stops at the cap and reports what it actually added', () => {
    w.budget.politicalCapital = pcCap(w) - 2;
    expect(changePc(w, 5, 'blightCleared')).toBe(2);
    expect(w.budget.politicalCapital).toBe(pcCap(w));
    expect(seen.map(e => e.delta)).toEqual([2]);
    // Already at or over the cap: nothing added, nothing taken, no event.
    expect(changePc(w, 5, 'blightCleared')).toBe(0);
    w.budget.politicalCapital = pcCap(w) + 40;
    expect(changePc(w, 5, 'blightCleared')).toBe(0);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 40);
    expect(seen.length).toBe(1);
  });

  it('undoing a cost is never cut at the cap, and costs apply in full over it', () => {
    w.budget.politicalCapital = pcCap(w) + 10;
    expect(changePc(w, -30, 'displacement')).toBe(-30);
    expect(changePc(w, 30, 'displacement', { undo: true })).toBe(30);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 10);
  });

  it('regenRate with the shipped numbers never drains: 0.1 at worst, 0.4 at best', () => {
    expect(BALANCE.politicalCapital.neutralSatisfaction).toBe(0);
    expect(regenRate(0)).toBeCloseTo(0.1);
    expect(regenRate(1)).toBeCloseTo(0.4);
  });

  it('regenRate is zero at the neutral point, positive above it, negative below', () => {
    const cfg = { baseRegen: 0, satisfactionRegenBonus: 0.5, neutralSatisfaction: 0.6 };
    expect(regenRate(0.6, cfg)).toBe(0);
    expect(regenRate(1, cfg)).toBeCloseTo(0.2);
    expect(regenRate(0.2, cfg)).toBeCloseTo(-0.2);
  });

  it('regenPerTick is the plain rate while the cap is the base cap', () => {
    w.stats.population = 40_000;                     // capPerResident is 0, so the cap does not move
    expect(regenPerTick(w, 1)).toBe(regenRate(1));
    expect(regenPerTick(w, 0.3)).toBe(regenRate(0.3));
  });

  it('regenPerTick scales with the cap, so a refill takes the same time at any size', () => {
    const pc = BALANCE.politicalCapital as { capPerResident: number };
    pc.capPerResident = 0.01;
    try {
      const small = regenPerTick(w, 1);              // cap 100
      w.stats.population = 10_000;                   // cap 200
      expect(pcCap(w)).toBe(200);
      expect(regenPerTick(w, 1)).toBeCloseTo(small * 2);
      expect(pcCap(w) / regenPerTick(w, 1)).toBeCloseTo(100 / small);   // ticks from empty to full
      // A drain scales the same way.
      expect(regenPerTick(w, 0)).toBeCloseTo(regenRate(0) * 2);
    } finally {
      pc.capPerResident = 0;
    }
  });

  it('displacement is the plain rate while the cap is the base cap', () => {
    w.stats.population = 40_000;                     // capPerResident is 0, so the cap does not move
    expect(capScale(w)).toBe(1);
    home(w, 5, 5);
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).cost).toBe(HOME_COST);
  });

  it('displacement scales with the cap, so a tower is the same share of the cap at any size', () => {
    const pc = BALANCE.politicalCapital as { capPerResident: number };
    const tower = BALANCE.growth.popPerLevel[3] * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;
    home(w, 5, 5, 3);
    home(w, 7, 5);
    pc.capPerResident = 0.01;
    try {
      const share = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).cost / pcCap(w);   // cap 100
      expect(share).toBeCloseTo(tower / 100);
      for (const population of [10_000, 40_000, 150_000]) {
        w.stats.population = population;
        expect(capScale(w)).toBeCloseTo(1 + population / 10_000);
        expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).cost / pcCap(w)).toBeCloseTo(share);
      }
      // What is charged is what was quoted, and undo gives exactly that back.
      w.stats.population = 10_000;                   // cap 200: twice the plain rate
      w.budget.politicalCapital = 150;
      const h = new CommandHistory(w);
      expect(pcQuote(w, { type: 'bulldoze', tx: 7, ty: 5 }).cost).toBe(HOME_COST * 2);
      expect(h.run(new BulldozeCommand(7, 5))).toBe(true);
      expect(w.budget.politicalCapital).toBe(150 - HOME_COST * 2);
      w.stats.population = 40_000;                   // the city changed size before the undo
      h.undo();
      expect(w.budget.politicalCapital).toBe(150);
      // A tower now costs more than the city has: refused.
      w.stats.population = 10_000;
      w.budget.politicalCapital = tower * 2 - 1;
      expect(h.run(new BulldozeCommand(5, 5))).toBe(false);
    } finally {
      pc.capPerResident = 0;
    }
  });

  it('a negative regenPc drains PC, over the cap too, but never below 0', () => {
    w.budget.politicalCapital = 10;
    regenPc(w, -0.25);
    expect(w.budget.politicalCapital).toBe(9.75);
    w.budget.politicalCapital = pcCap(w) + 20;
    regenPc(w, -0.5);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 19.5);
    w.budget.politicalCapital = 0.1;
    regenPc(w, -0.25);
    expect(w.budget.politicalCapital).toBe(0);
    regenPc(w, -0.25);
    expect(w.budget.politicalCapital).toBe(0);
    expect(seen).toEqual([]);
  });

  it('regenPc leaves PC that is over the cap alone', () => {
    w.budget.politicalCapital = pcCap(w) + 25;
    regenPc(w, 0.4);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 25);
  });

  it('regenPc stops at the cap and emits nothing', () => {
    w.budget.politicalCapital = pcCap(w) - 0.1;
    regenPc(w, 0.4);
    expect(w.budget.politicalCapital).toBe(pcCap(w));
    w.budget.politicalCapital = 10;
    regenPc(w, 0.4);
    expect(w.budget.politicalCapital).toBeCloseTo(10.4);
    expect(seen).toEqual([]);
  });
});

describe('politics: commands report their PC changes', () => {
  let w: World;
  let seen: PcEvent[];
  beforeEach(() => { w = landWorld(); seen = listen(w); });

  it('bulldozing a home emits a displacement cost; undo emits its reverse', () => {
    home(w, 5, 5);
    const pc = w.budget.politicalCapital;
    const cmd = new BulldozeCommand(5, 5);
    expect(cmd.execute(w)).toBe(true);
    expect(seen).toEqual([{ delta: -HOME_COST, reason: 'displacement', tx: 5, ty: 5, undo: false }]);
    cmd.undo(w);
    expect(seen[1]).toEqual({ delta: HOME_COST, reason: 'displacement', tx: 5, ty: 5, undo: true });
    expect(w.budget.politicalCapital).toBe(pc);
  });

  it('clearing an abandoned building emits a blightCleared reward', () => {
    home(w, 5, 5);
    w.layers.abandoned[w.grid.idx(5, 5)] = 1;
    w.budget.politicalCapital = 50;
    new BulldozeCommand(5, 5).execute(w);
    const reward = 2 * BALANCE.politicalCapital.disruptionCosts.abandonedBuildingReward;
    expect(seen).toEqual([{ delta: reward, reason: 'blightCleared', tx: 5, ty: 5, undo: false }]);
  });

  it('rezoning, building and paving over a home each emit one displacement cost', () => {
    home(w, 5, 5); home(w, 7, 5); home(w, 9, 5);
    w.budget.politicalCapital = 1000;
    expect(new PaintZoneCommand(5, 5, ZONE_C).execute(w)).toBe(true);
    expect(new PlaceBuildingCommand(7, 5, BUILDING_PARK).execute(w)).toBe(true);
    expect(new BuildRoadCommand(9, 5, ROAD_STREET).execute(w)).toBe(true);
    expect(seen.map(e => [e.delta, e.reason, e.tx])).toEqual([
      [-HOME_COST, 'displacement', 5],
      [-HOME_COST, 'displacement', 7],
      [-HOME_COST, 'displacement', 9],
    ]);
    expect(w.budget.politicalCapital).toBeCloseTo(1000 - 3 * HOME_COST);
  });

  it('an action with no PC effect emits nothing', () => {
    new PaintZoneCommand(5, 5, ZONE_R).execute(w);
    new BuildRoadCommand(6, 6, ROAD_STREET).execute(w);
    expect(seen).toEqual([]);
  });

  it('a refused action emits nothing', () => {
    home(w, 5, 5);
    w.budget.politicalCapital = 0;
    expect(new BulldozeCommand(5, 5).execute(w)).toBe(false);
    expect(seen).toEqual([]);
  });

});

describe('politics: undo cannot bank PC over the cap', () => {
  let w: World;
  let h: CommandHistory;
  beforeEach(() => { w = landWorld(); h = new CommandHistory(w); });
  /** Let regeneration run until it has added `amount` (or the bar is full). */
  const regen = (amount: number) => regenPc(w, amount);

  it('an undo straight away gives the cost back in full', () => {
    home(w, 5, 5);
    h.run(new BulldozeCommand(5, 5));
    expect(w.budget.politicalCapital).toBe(pcCap(w) - HOME_COST);
    h.undo();
    expect(w.budget.politicalCapital).toBe(pcCap(w));
  });

  it('after PC has refilled, undo restores the homes but adds nothing on top of the full bar', () => {
    home(w, 5, 5); home(w, 6, 5);
    h.beginBatch();
    h.run(new BulldozeCommand(5, 5));
    h.run(new BulldozeCommand(6, 5));
    h.endBatch();
    regen(1000);                                     // time passes: refilled to the cap
    expect(w.budget.politicalCapital).toBe(pcCap(w));
    h.undo();
    expect(w.budget.politicalCapital).toBe(pcCap(w));
    expect(w.getZone(5, 5)).toBe(ZONE_R);
    expect(w.layers.devLevel[w.grid.idx(6, 5)]).toBe(2);
  });

  it('a partial refill gets the rest back, up to the cap', () => {
    home(w, 5, 5);
    h.run(new BulldozeCommand(5, 5));
    regen(10);
    h.undo();
    expect(w.budget.politicalCapital).toBeCloseTo(pcCap(w));
  });

  it('regeneration that would have happened anyway is kept', () => {
    home(w, 5, 5);
    w.budget.politicalCapital = 40;                  // well below the cap
    h.run(new BulldozeCommand(5, 5));                // 40 − 35 = 5
    regen(30);                                       // 35
    h.undo();
    expect(w.budget.politicalCapital).toBeCloseTo(70);   // 40 + 30, as if never bulldozed
  });

  it('PC over the cap before the action comes back in full, whatever was earned meanwhile', () => {
    home(w, 5, 5);
    w.budget.politicalCapital = pcCap(w) + 40;
    h.run(new BulldozeCommand(5, 5));
    changePc(w, 20, 'milestone');                    // a reward lands in between
    regen(1000);                                     // no effect: still over the cap
    h.undo();
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 60);
  });

  it('a drain in between does not eat the refund', () => {
    home(w, 5, 5);
    h.run(new BulldozeCommand(5, 5));                // 100 − 35 = 65
    regen(-5);                                       // 60
    h.undo();
    expect(w.budget.politicalCapital).toBeCloseTo(95);
  });

  it('redo charges again at the current price', () => {
    home(w, 5, 5);
    h.run(new BulldozeCommand(5, 5));
    regen(1000);
    h.undo();
    h.redo();
    expect(w.budget.politicalCapital).toBe(pcCap(w) - HOME_COST);
  });
});

describe('politics: one pcAction per finished player action', () => {
  let w: World;
  let h: CommandHistory;
  let actions: PcAction[];
  beforeEach(() => {
    w = landWorld();
    w.budget.politicalCapital = 1000;
    h = new CommandHistory(w);
    actions = [];
    w.events.on('pcAction', p => actions.push(p as unknown as PcAction));
  });

  it('a single command reports its change; undo and redo report theirs', () => {
    home(w, 5, 5);
    h.run(new BulldozeCommand(5, 5));
    h.undo();
    h.redo();
    expect(actions).toEqual([
      { delta: -HOME_COST, tx: 5, ty: 5, undo: false },
      { delta: HOME_COST, tx: 5, ty: 5, undo: true },
      { delta: -HOME_COST, tx: 5, ty: 5, undo: false },
    ]);
  });

  it('a batch reports one total, at the tile of its last change', () => {
    home(w, 5, 5); home(w, 6, 5); home(w, 7, 5);
    h.beginBatch();
    h.run(new BulldozeCommand(5, 5));
    h.run(new BulldozeCommand(6, 5));
    h.run(new BulldozeCommand(7, 5));
    h.run(new BuildRoadCommand(8, 5, ROAD_STREET));   // no PC effect
    expect(actions).toEqual([]);
    h.endBatch();
    expect(actions).toEqual([{ delta: -3 * HOME_COST, tx: 7, ty: 5, undo: false }]);
    h.undo();
    expect(actions[1]).toEqual({ delta: 3 * HOME_COST, tx: 5, ty: 5, undo: true });
  });

  it('a cancelled batch reports nothing, and leaves nothing behind for the next action', () => {
    home(w, 5, 5); home(w, 6, 5);
    h.beginBatch();
    h.run(new BulldozeCommand(5, 5));
    h.cancelBatch();
    expect(actions).toEqual([]);
    expect(w.budget.politicalCapital).toBe(1000);
    h.run(new BulldozeCommand(6, 5));
    expect(actions).toEqual([{ delta: -HOME_COST, tx: 6, ty: 5, undo: false }]);
  });

  it('actions with no PC effect, and refused ones, report nothing', () => {
    h.run(new PaintZoneCommand(5, 5, ZONE_R));
    home(w, 9, 9);
    w.budget.politicalCapital = 0;
    h.run(new BulldozeCommand(9, 9));
    expect(actions).toEqual([]);
  });
});

describe('politics: PC banked above the cap fades', () => {
  const cfg = BALANCE.politicalCapital as { overCapFadePerDay: number };
  let w: World;
  beforeEach(() => { w = landWorld(); });
  afterEach(() => { cfg.overCapFadePerDay = 0; });

  it('is switched off in the shipped balance: a hoard stays put', () => {
    expect(cfg.overCapFadePerDay).toBe(0);
    w.budget.politicalCapital = pcCap(w) + 500;
    expect(fadeOverCap(w)).toBe(0);
    const sys = new PoliticsSystem();
    for (let t = 0; t <= 20 * BALANCE.ticksPerDay; t++) { w.tick = t; sys.update(w); }
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 500);
  });

  it('takes a share of the excess, and nothing at or below the cap', () => {
    w.budget.politicalCapital = pcCap(w) + 200;
    expect(fadeOverCap(w, 0.02)).toBeCloseTo(4);
    expect(w.budget.politicalCapital).toBeCloseTo(pcCap(w) + 196);
    w.budget.politicalCapital = pcCap(w);
    expect(fadeOverCap(w, 0.02)).toBe(0);
    w.budget.politicalCapital = 30;
    expect(fadeOverCap(w, 0.02)).toBe(0);
    w.budget.politicalCapital = -10;                 // in debt
    expect(fadeOverCap(w, 0.02)).toBe(0);
    expect(w.budget.politicalCapital).toBe(-10);
  });

  it('never takes PC below the cap, even at a silly rate', () => {
    w.budget.politicalCapital = pcCap(w) + 50;
    fadeOverCap(w, 5);
    expect(w.budget.politicalCapital).toBe(pcCap(w));
  });

  it('runs once per game day in the system: about half the excess is gone after 35 days at 2%', () => {
    cfg.overCapFadePerDay = 0.02;
    w.budget.politicalCapital = pcCap(w) + 400;
    expect(overCapFadePerDay(w)).toBeCloseTo(8);
    const sys = new PoliticsSystem();
    for (let t = 1; t <= 35 * BALANCE.ticksPerDay; t++) { w.tick = t; sys.update(w); }
    const excess = w.budget.politicalCapital - pcCap(w);
    expect(excess).toBeCloseTo(400 * 0.98 ** 35, 5);
    expect(excess).toBeGreaterThan(190);
    expect(excess).toBeLessThan(210);
  });

  it('a reward can still take PC over the cap; it just does not stay for ever', () => {
    cfg.overCapFadePerDay = 0.02;
    w.budget.politicalCapital = pcCap(w);
    changePc(w, 60, 'milestone');
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 60);
    const sys = new PoliticsSystem();
    for (let t = 1; t <= 400 * BALANCE.ticksPerDay; t++) { w.tick = t; sys.update(w); }
    expect(w.budget.politicalCapital - pcCap(w)).toBeLessThan(0.1);
    expect(w.budget.politicalCapital).toBeGreaterThanOrEqual(pcCap(w));
  });
});
