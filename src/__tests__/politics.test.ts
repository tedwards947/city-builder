import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { pcCap, changePc, regenPc } from '../sim/politics';
import { ZONE_R, ZONE_C, BUILDING_PARK, ROAD_STREET } from '../sim/constants';
import { BALANCE } from '../data/balance';
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

  it('pcCap is the balance maximum', () => {
    expect(pcCap(w)).toBe(BALANCE.politicalCapital.max);
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

  it('changePc does not clamp at the cap', () => {
    w.budget.politicalCapital = pcCap(w);
    changePc(w, 5, 'blightCleared');
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 5);
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
