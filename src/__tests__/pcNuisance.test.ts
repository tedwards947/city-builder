// The cost of unpopular things near homes, with the rates switched on. The
// shipped rates are 0, so these tests set BALANCE's rates for their duration.

import './pcOffBaseline';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { pcQuote, nuisanceRings } from '../sim/politics';
import { planZoneFill } from '../input/zoneFill';
import {
  ZONE_R, ZONE_C, ZONE_I, ZONE_NONE, ROAD_STREET,
  BUILDING_POWER_PLANT, BUILDING_SEWAGE_PLANT, BUILDING_WATER_TOWER, BUILDING_NONE,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home, homes, residents, TEST_NUISANCE } from './pcTestWorld';

const cfg = BALANCE.politicalCapital.nuisance as {
  bands: { within: number; weight: number }[];
  industrialPerResident: number;
  buildingPerResident: Record<number, number>;
};
const shipped = {
  bands: cfg.bands.map(b => ({ ...b })),
  industrialPerResident: cfg.industrialPerResident,
  buildingPerResident: { ...cfg.buildingPerResident },
};

let w: World;
let h: CommandHistory;
let actions: { delta: number; undo: boolean }[];

beforeEach(() => {
  cfg.bands = TEST_NUISANCE.bands.map(b => ({ ...b }));
  cfg.industrialPerResident = TEST_NUISANCE.industrialPerResident;
  cfg.buildingPerResident = { ...TEST_NUISANCE.buildingPerResident };
  w = landWorld();
  h = new CommandHistory(w);
  actions = [];
  w.events.on('pcAction', p => actions.push({ delta: p.delta as number, undo: p.undo as boolean }));
});
afterEach(() => {
  cfg.bands = shipped.bands.map(b => ({ ...b }));
  cfg.industrialPerResident = shipped.industrialPerResident;
  cfg.buildingPerResident = { ...shipped.buildingPerResident };
});

describe('nuisance cost, switched on', () => {
  it('the rates are all zero with PC off', () => {
    expect(shipped.industrialPerResident).toBe(0);
    expect(Object.values(shipped.buildingPerResident).every(v => v === 0)).toBe(true);
  });

  it('industry in empty land costs only money', () => {
    const pc = w.budget.politicalCapital, money = w.budget.money;
    expect(h.run(new PaintZoneCommand(10, 10, ZONE_I))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pc);
    expect(w.budget.money).toBe(money - BALANCE.costs.zoneI);
    expect(actions).toEqual([]);
  });

  it('industry near homes charges its quote; undo and redo are exact', () => {
    home(w, 12, 10, 2);     // distance 2 → full weight
    home(w, 10, 13, 3);     // distance 3 → half
    const cost = residents(2) + residents(3) * 0.5;
    expect(pcQuote(w, { type: 'zone', tx: 10, ty: 10, zone: ZONE_I }).cost).toBe(cost);
    const pc = w.budget.politicalCapital;
    expect(h.run(new PaintZoneCommand(10, 10, ZONE_I))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pc - cost);
    h.undo();
    expect(w.budget.politicalCapital).toBe(pc);
    expect(w.getZone(10, 10)).toBe(ZONE_NONE);
    h.redo();
    expect(w.budget.politicalCapital).toBe(pc - cost);
    expect(actions).toEqual([
      { delta: -cost, undo: false }, { delta: cost, undo: true }, { delta: -cost, undo: false },
    ]);
  });

  it('power and sewage plants charge at their own rates; a water tower does not', () => {
    home(w, 11, 10);
    const pc = w.budget.politicalCapital;
    expect(h.run(new PlaceBuildingCommand(10, 10, BUILDING_POWER_PLANT))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pc - 2 * residents());
    h.undo();
    expect(w.budget.politicalCapital).toBe(pc);
    expect(w.layers.building[w.grid.idx(10, 10)]).toBe(BUILDING_NONE);
    expect(h.run(new PlaceBuildingCommand(10, 10, BUILDING_SEWAGE_PLANT))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pc - residents());
    expect(h.run(new PlaceBuildingCommand(11, 11, BUILDING_WATER_TOWER))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pc - residents());
  });

  it('is refused, with nothing changed, when PC does not cover it', () => {
    home(w, 11, 10, 3);
    w.budget.politicalCapital = residents(3) - 1;
    const money = w.budget.money;
    const cmd = new PaintZoneCommand(10, 10, ZONE_I);
    expect(h.run(cmd)).toBe(false);
    expect(cmd.failReason).toBe('politicalCapital');
    expect(w.getZone(10, 10)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(money);
    expect(w.budget.politicalCapital).toBe(residents(3) - 1);
    const plant = new PlaceBuildingCommand(10, 10, BUILDING_POWER_PLANT);
    expect(h.run(plant)).toBe(false);
    expect(plant.failReason).toBe('politicalCapital');
  });

  it('homes that arrive after the nuisance cost nothing, and only homes complain', () => {
    h.run(new PaintZoneCommand(10, 10, ZONE_I));
    const pc = w.budget.politicalCapital;
    // Zoning and growing homes next to industry is free of PC.
    expect(h.run(new PaintZoneCommand(11, 10, ZONE_R))).toBe(true);
    home(w, 11, 10, 3);
    expect(w.budget.politicalCapital).toBe(pc);
    // Shops next door do not object to more industry.
    w.setZone(20, 20, ZONE_C);
    w.layers.devLevel[w.grid.idx(20, 20)] = 3;
    expect(h.run(new PaintZoneCommand(21, 20, ZONE_I))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pc);
  });

  it('removing industry or a plant refunds nothing', () => {
    home(w, 11, 10);
    h.run(new PaintZoneCommand(10, 10, ZONE_I));
    const pc = w.budget.politicalCapital;
    expect(h.run(new BulldozeCommand(10, 10))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pc);
  });

  it('a drag charges tile by tile and stops where PC runs out', () => {
    home(w, 10, 11, 3);                         // beside the row being zoned
    const perTile = [residents(3), residents(3), residents(3), residents(3) * 0.5];   // distances 1, 2, 2, 3… from x = 10, 11, 9, 12
    w.budget.politicalCapital = perTile[0] + perTile[1] + 1;
    h.beginBatch();
    const done: boolean[] = [];
    for (const tx of [10, 11, 9, 12]) done.push(h.run(new PaintZoneCommand(tx, 10, ZONE_I)));
    h.endBatch();
    expect(done).toEqual([true, true, false, false]);
    expect(w.budget.politicalCapital).toBe(1);
    // The whole drag reports once.
    expect(actions).toEqual([{ delta: -(perTile[0] + perTile[1]), undo: false }]);
    h.undo();
    expect(w.budget.politicalCapital).toBe(perTile[0] + perTile[1] + 1);
  });

  it('a fill is all or nothing: its plan says so, and a refused batch changes nothing', () => {
    for (let tx = 0; tx < 24; tx++) w.setRoad(tx, 10, ROAD_STREET);
    homes(w, 6, 11, 12, 11, 1);                 // homes along the south side
    const plan = planZoneFill(w, { tx: 9, ty: 9 }, ZONE_I);   // industry along the north side
    expect(plan.tiles.length).toBeGreaterThan(8);
    expect(plan.pc.cost).toBeGreaterThan(0);
    expect(plan.pc.parts.every(p => p.reason === 'nuisance' && p.ty === 11)).toBe(true);
    w.budget.politicalCapital = plan.pc.cost - 1;
    expect(planZoneFill(w, { tx: 9, ty: 9 }, ZONE_I).pc.affordable).toBe(false);

    // What InputController does on a fill click: run every tile, cancel on a refusal.
    const pc = w.budget.politicalCapital, money = w.budget.money;
    h.beginBatch();
    let refused = false;
    for (const t of plan.tiles) {
      const cmd = new PaintZoneCommand(t.tx, t.ty, ZONE_I);
      if (!h.run(cmd) && cmd.failReason) { refused = true; break; }
    }
    expect(refused).toBe(true);
    h.cancelBatch();
    expect(w.budget.politicalCapital).toBe(pc);
    expect(w.budget.money).toBe(money);
    for (const t of plan.tiles) expect(w.getZone(t.tx, t.ty)).toBe(ZONE_NONE);
    expect(actions).toEqual([]);

    // With enough PC the fill costs exactly what the plan quoted.
    w.budget.politicalCapital = plan.pc.cost + 5;
    h.beginBatch();
    for (const t of plan.tiles) h.run(new PaintZoneCommand(t.tx, t.ty, ZONE_I));
    h.endBatch();
    expect(w.budget.politicalCapital).toBeCloseTo(5);
    expect(actions.length).toBe(1);
    expect(actions[0].delta).toBeCloseTo(-plan.pc.cost);
  });

  it('the preview rings follow the switched-on bands', () => {
    expect(nuisanceRings({ zone: ZONE_I }).map(b => b.within)).toEqual([2, 4, 6]);
    expect(nuisanceRings({ kind: BUILDING_WATER_TOWER })).toEqual([]);
    expect(nuisanceRings({ zone: ZONE_R })).toEqual([]);
  });
});
