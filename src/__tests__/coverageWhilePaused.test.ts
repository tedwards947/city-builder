// Power, water and service coverage are worked out each tick. With the clock
// stopped, a block built in the meantime showed "No power / No water" until
// the game ran again (owner's report, 2026-11-19). refreshCoverage reworks
// them without a tick; the game calls it after an edit while stopped.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { Scheduler } from '../sim/Scheduler';
import { createSystems, refreshCoverage } from '../sim/createSystems';
import { CommandHistory } from '../commands/CommandHistory';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { serialize } from '../persistence/Serializer';
const fingerprint = (w: World) => JSON.stringify(serialize(w));
import { BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, ROAD_STREET, ZONE_R } from '../sim/constants';

/** A street along y=10 with a power plant and a water tower on it, run for a few ticks. */
function town() {
  const w = new World(40, 40, 0);
  w.budget.money = 1e6;
  for (let x = 5; x <= 25; x++) w.setRoad(x, 10, ROAD_STREET);
  w.placeBuilding(6, 9, BUILDING_POWER_PLANT);
  w.placeBuilding(8, 9, BUILDING_WATER_TOWER);
  const sim = createSystems();
  const sched = new Scheduler(w, sim.systems);
  for (let k = 0; k < 4; k++) sched.tick();
  return { w, sim, sched, history: new CommandHistory(w) };
}

/** The owner's block: two rows of homes south of the street, and a new street below them, joined at the west end. */
function buildBlock(w: World, history: CommandHistory): void {
  for (let y = 11; y <= 13; y++) history.run(new BuildRoadCommand(5, y, ROAD_STREET));
  for (let x = 6; x <= 25; x++) history.run(new BuildRoadCommand(x, 13, ROAD_STREET));
  for (let x = 6; x <= 25; x++) for (const y of [11, 12]) history.run(new PaintZoneCommand(x, y, ZONE_R));
  void w;
}

describe('coverage while the clock is stopped', () => {
  it('a block built with no tick in between has no power or water on its far row until coverage is reworked', () => {
    const { w, sim, history } = town();
    expect(w.layers.power[w.grid.idx(10, 11)]).toBe(1);   // beside the working street
    expect(w.layers.power[w.grid.idx(10, 12)]).toBe(0);   // one tile further: out of reach
    buildBlock(w, history);
    expect(w.layers.power[w.grid.idx(10, 12)]).toBe(0);   // the bug: the new street has not been counted
    expect(w.layers.water[w.grid.idx(10, 12)]).toBe(0);

    refreshCoverage(w, sim);
    for (let x = 6; x <= 25; x++) for (const y of [11, 12]) {
      expect(w.layers.power[w.grid.idx(x, y)]).toBe(1);
      expect(w.layers.water[w.grid.idx(x, y)]).toBe(1);
    }
  });

  it('a street that does not join the working one still brings nothing', () => {
    const { w, sim, history } = town();
    for (let x = 6; x <= 25; x++) history.run(new BuildRoadCommand(x, 13, ROAD_STREET));
    refreshCoverage(w, sim);
    expect(w.layers.power[w.grid.idx(10, 12)]).toBe(0);
    expect(w.layers.power[w.grid.idx(10, 14)]).toBe(0);
  });

  it('reworking coverage changes nothing a tick would not, and the city plays on the same', () => {
    const a = town(), b = town();
    buildBlock(a.w, a.history);
    buildBlock(b.w, b.history);
    const tickBefore = a.w.tick;
    refreshCoverage(a.w, a.sim);
    refreshCoverage(a.w, a.sim);
    expect(a.w.tick).toBe(tickBefore);
    for (let k = 0; k < 60; k++) { a.sched.tick(); b.sched.tick(); }
    expect(fingerprint(a.w)).toEqual(fingerprint(b.w));
  });

  it('the history counts every change, so the game knows when to rework', () => {
    const { w, history } = town();
    const n0 = history.changes;
    history.run(new BuildRoadCommand(5, 11, ROAD_STREET));
    expect(history.changes).toBe(n0 + 1);
    history.undo();
    expect(history.changes).toBe(n0 + 2);
    history.redo();
    expect(history.changes).toBe(n0 + 3);
    history.beginBatch();
    history.run(new PaintZoneCommand(6, 11, ZONE_R));
    history.cancelBatch();
    expect(history.changes).toBe(n0 + 5);
    expect(w.layers.zone[w.grid.idx(6, 11)]).toBe(0);
  });
});
