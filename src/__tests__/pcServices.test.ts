// Ribbon cuttings and closures: the PC a service building earns when it opens
// and costs when it closes. The shipped values are 0, so these tests set
// BALANCE's values for their duration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { pcQuote, pcQuoteMany, pcCap } from '../sim/politics';
import { serviceOpeningValue, serviceClosureValue } from '../sim/serviceValue';
import type { ServiceValueConfig } from '../sim/serviceValue';
import {
  ROAD_STREET, BUILDING_PARK, BUILDING_POLICE, BUILDING_WATER_TOWER, BUILDING_NONE,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home, residents } from './pcTestWorld';

const cfg = BALANCE.politicalCapital.service as {
  perResident: Record<number, number>; repeatFactor: number; closureMultiplier: number;
};
const shipped = { perResident: { ...cfg.perResident }, repeatFactor: cfg.repeatFactor, closureMultiplier: cfg.closureMultiplier };

// Round numbers: 1 PC per resident for a park, 2 for police; a second
// building is worth half; closing costs twice what is lost.
const ON: ServiceValueConfig = { perResident: { 8: 1, 4: 2 }, repeatFactor: 0.5, closureMultiplier: 2 };

let w: World;
let h: CommandHistory;

/** A street along y = 10 from x = 2 to 28, with homes on its south side at the given x. */
function street(homesAt: number[], level = 2): void {
  for (let tx = 2; tx <= 28; tx++) w.setRoad(tx, 10, ROAD_STREET);
  for (const tx of homesAt) home(w, tx, 11, level);
}

beforeEach(() => {
  cfg.perResident = { ...ON.perResident };
  cfg.repeatFactor = ON.repeatFactor;
  cfg.closureMultiplier = ON.closureMultiplier;
  w = landWorld();
  h = new CommandHistory(w);
});
afterEach(() => {
  cfg.perResident = { ...shipped.perResident };
  cfg.repeatFactor = shipped.repeatFactor;
  cfg.closureMultiplier = shipped.closureMultiplier;
});

describe('service value', () => {
  it('is switched off in the shipped balance, with a closure multiplier of at least 1', () => {
    expect(Object.values(shipped.perResident).every(v => v === 0)).toBe(true);
    expect(shipped.closureMultiplier).toBeGreaterThanOrEqual(1);
    expect(shipped.repeatFactor).toBeGreaterThanOrEqual(0);
    expect(shipped.repeatFactor).toBeLessThanOrEqual(1);
    street([5, 6]);
    expect(serviceOpeningValue(w, 5, 9, BUILDING_PARK, shipped)).toEqual([]);
  });

  it('opening earns the residents covered; homes out of reach and empty lots count for nothing', () => {
    // A park reaches 3 road tiles each way from where it stands (plus one tile beside the road).
    street([4, 5, 6, 20]);
    w.setZone(7, 11, 1);                        // zoned residential, nobody there yet
    const parts = serviceOpeningValue(w, 5, 9, BUILDING_PARK);
    expect(parts.map(p => `${p.tx},${p.ty}`).sort()).toEqual(['4,11', '5,11', '6,11']);
    expect(parts.every(p => p.amount === residents() && p.strength === 1)).toBe(true);

    const q = pcQuote(w, { type: 'building', tx: 5, ty: 9, kind: BUILDING_PARK });
    expect(q.reward).toBe(3 * residents());
    expect(q.cost).toBe(0);
    expect(q.parts.every(p => p.reason === 'serviceOpened')).toBe(true);
  });

  it('a park with no street beside it covers only itself, so it earns nothing', () => {
    home(w, 5, 6);
    expect(pcQuote(w, { type: 'building', tx: 5, ty: 5, kind: BUILDING_PARK }).reward).toBe(0);
  });

  it('a building that is not a service earns nothing', () => {
    street([5]);
    expect(pcQuote(w, { type: 'building', tx: 5, ty: 9, kind: BUILDING_WATER_TOWER }).parts).toEqual([]);
  });

  it('the command banks the reward, over the cap too, and undo takes it back', () => {
    street([4, 5, 6]);
    const reward = 3 * residents();
    expect(w.budget.politicalCapital).toBe(pcCap(w));
    expect(h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK))).toBe(true);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + reward);
    h.undo();
    expect(w.budget.politicalCapital).toBe(pcCap(w));
    expect(w.layers.building[w.grid.idx(5, 9)]).toBe(BUILDING_NONE);
    h.redo();
    expect(w.budget.politicalCapital).toBe(pcCap(w) + reward);
  });

  it('a second park covering the same homes is worth half, a third a quarter', () => {
    street([5]);
    const first = pcQuote(w, { type: 'building', tx: 5, ty: 9, kind: BUILDING_PARK }).reward;
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    const second = pcQuote(w, { type: 'building', tx: 6, ty: 9, kind: BUILDING_PARK });
    h.run(new PlaceBuildingCommand(6, 9, BUILDING_PARK));
    const third = pcQuote(w, { type: 'building', tx: 4, ty: 9, kind: BUILDING_PARK });
    expect(first).toBe(residents());
    expect(second.reward).toBe(residents() * 0.5);
    expect(second.parts[0].strength).toBe(0.5);
    expect(third.reward).toBe(residents() * 0.25);
    // A different kind is counted on its own.
    expect(pcQuote(w, { type: 'building', tx: 7, ty: 9, kind: BUILDING_POLICE }).reward).toBe(2 * residents());
  });

  it('closing costs what is lost times the multiplier; undo gives it back', () => {
    street([4, 5, 6]);
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    const lost = 3 * residents();
    const q = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    expect(q.cost).toBe(lost * 2);
    expect(q.shortfall).toBe(0);
    expect(q.affordable).toBe(true);
    expect(q.parts.every(p => p.reason === 'serviceClosed' && p.amount === -residents() * 2)).toBe(true);
    w.budget.politicalCapital = 500;
    expect(h.run(new BulldozeCommand(5, 9))).toBe(true);
    expect(w.budget.politicalCapital).toBe(500 - lost * 2);
    h.undo();
    expect(w.budget.politicalCapital).toBe(500);
    expect(w.layers.building[w.grid.idx(5, 9)]).toBe(BUILDING_PARK);
  });

  it('opening then closing never comes out ahead', () => {
    street([4, 5, 6]);
    w.budget.politicalCapital = 500;
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    h.run(new BulldozeCommand(5, 9));
    expect(w.budget.politicalCapital).toBeLessThan(500);
  });

  it('moving a service is cheap: homes still covered by another lose little', () => {
    street([5]);
    w.budget.politicalCapital = 500;
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));          // +1 × residents
    h.run(new PlaceBuildingCommand(6, 9, BUILDING_PARK));          // +0.5 × residents
    const closeOld = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    expect(closeOld.cost).toBe(residents() * 0.5 * 2);             // they still have the other park
    h.run(new BulldozeCommand(5, 9));
    // Closing the last one costs the full value.
    expect(pcQuote(w, { type: 'bulldoze', tx: 6, ty: 9 }).cost).toBe(residents() * 2);
    expect(serviceClosureValue(w, 6, 9)[0].strength).toBe(1);
  });

  it('a closure is never refused: it takes what PC there is and says how much went unpaid', () => {
    street([4, 5, 6]);
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    const full = 3 * residents() * 2;
    w.budget.politicalCapital = 7;
    const q = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    expect(q.affordable).toBe(true);
    expect(q.cost).toBe(7);
    expect(q.shortfall).toBe(full - 7);
    const cmd = new BulldozeCommand(5, 9);
    expect(h.run(cmd)).toBe(true);
    expect(w.budget.politicalCapital).toBe(0);
    h.undo();
    expect(w.budget.politicalCapital).toBe(7);                     // exactly what was taken
    // At zero it still goes through, free.
    w.budget.politicalCapital = 0;
    expect(h.run(new BulldozeCommand(5, 9))).toBe(true);
    expect(w.budget.politicalCapital).toBe(0);
  });

  it('follows the map: new homes and new roads change the quote', () => {
    street([5]);
    const at = { type: 'building' as const, tx: 5, ty: 9, kind: BUILDING_PARK };
    expect(pcQuote(w, at).reward).toBe(residents());
    home(w, 4, 11); home(w, 6, 11);
    expect(pcQuote(w, at).reward).toBe(3 * residents());
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 }).cost).toBe(3 * residents() * 2);
    // Cut the street on both sides of the park: only the home right by it is still covered.
    w.clearTile(3, 10); w.clearTile(7, 10);
    home(w, 9, 11);
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 }).cost).toBe(3 * residents() * 2);
    w.clearTile(4, 10); w.clearTile(6, 10);
    expect(serviceClosureValue(w, 5, 9).map(p => p.tx).sort()).toEqual([4, 5, 6]);
  });

  it('a merged quote adds up the buildings and keeps closures unrefusable', () => {
    street([5, 20]);
    w.budget.politicalCapital = 500;
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    h.run(new PlaceBuildingCommand(20, 9, BUILDING_PARK));
    w.budget.politicalCapital = 3;
    const q = pcQuoteMany(w, [
      { type: 'bulldoze', tx: 5, ty: 9 },
      { type: 'bulldoze', tx: 20, ty: 9 },
    ]);
    expect(q.affordable).toBe(true);
    expect(q.cost).toBe(3);
    expect(q.shortfall).toBe(2 * residents() * 2 - 3);
    expect(q.parts.length).toBe(2);
  });
});
