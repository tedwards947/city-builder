// Ribbon cuttings and closures: the PC a service building earns when it opens
// and costs when it closes. The shipped values are 0, so these tests set
// BALANCE's values for their duration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { pcQuote, pcQuoteMany, pcCap, regenPc } from '../sim/politics';
import { serviceOpeningValue, serviceClosureValue, coveredBy, serviceReach, touchesAccessRoad } from '../sim/serviceValue';
import type { ServiceValueConfig } from '../sim/serviceValue';
import {
  ROAD_STREET, ROAD_HIGHWAY, BUILDING_PARK, BUILDING_POLICE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_NONE,
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

  it('a closure is never refused: what the city cannot cover becomes debt', () => {
    street([4, 5, 6]);
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    const full = 3 * residents() * 2;
    w.budget.politicalCapital = 7;
    const q = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    expect(q.affordable).toBe(true);
    expect(q.cost).toBe(full);
    expect(q.shortfall).toBe(full - 7);
    expect(h.run(new BulldozeCommand(5, 9))).toBe(true);
    expect(w.budget.politicalCapital).toBe(7 - full);
    h.undo();
    expect(w.budget.politicalCapital).toBe(7);
    // Already in debt: it still goes through, and the debt deepens by the full cost.
    w.budget.politicalCapital = -10;
    const again = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    expect(again.affordable).toBe(true);
    expect(again.shortfall).toBe(full);
    expect(h.run(new BulldozeCommand(5, 9))).toBe(true);
    expect(w.budget.politicalCapital).toBe(-10 - full);
  });

  it('opening, spending the reward and closing cannot be farmed: it ends in debt', () => {
    street([4, 5, 6]);
    home(w, 20, 20, 3);                                             // something to spend PC on
    w.budget.politicalCapital = 0;
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));           // + 3 × residents
    const reward = w.budget.politicalCapital;
    expect(reward).toBe(3 * residents());
    w.budget.politicalCapital = 0;                                  // "spent" on something else
    h.run(new BulldozeCommand(5, 9));                               // close it
    expect(w.budget.politicalCapital).toBe(-reward * 2);
    // In debt, anything that costs PC is refused…
    const cmd = new BulldozeCommand(20, 20);
    expect(pcQuote(w, { type: 'bulldoze', tx: 20, ty: 20 }).affordable).toBe(false);
    expect(h.run(cmd)).toBe(false);
    expect(cmd.failReason).toBe('politicalCapital');
    // …but things that cost nothing, or earn PC, still go through.
    expect(h.run(new PlaceBuildingCommand(6, 9, BUILDING_PARK))).toBe(true);
    expect(w.budget.politicalCapital).toBe(-reward * 2 + reward);
  });

  it('regeneration pays a debt off; low satisfaction never deepens one', () => {
    w.budget.politicalCapital = -5;
    regenPc(w, 0.4);
    expect(w.budget.politicalCapital).toBeCloseTo(-4.6);
    regenPc(w, -0.4);
    expect(w.budget.politicalCapital).toBeCloseTo(-4.6);
    w.budget.politicalCapital = 0;
    regenPc(w, -0.4);
    expect(w.budget.politicalCapital).toBe(0);
    w.budget.politicalCapital = 0.1;
    regenPc(w, -0.4);
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
    expect(q.cost).toBe(2 * residents() * 2);
    expect(q.shortfall).toBe(2 * residents() * 2 - 3);
    expect(q.parts.length).toBe(2);
  });
});

describe('what a service building reaches', () => {
  it('coveredBy counts the standing buildings of a kind over each tile, and follows the map', () => {
    street([5]);
    const homeTile = w.grid.idx(5, 11);
    expect(coveredBy(w, BUILDING_PARK).get(homeTile)).toBeUndefined();
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    expect(coveredBy(w, BUILDING_PARK).get(homeTile)).toBe(1);
    h.run(new PlaceBuildingCommand(6, 9, BUILDING_PARK));
    expect(coveredBy(w, BUILDING_PARK).get(homeTile)).toBe(2);
    expect(coveredBy(w, BUILDING_POLICE).get(homeTile)).toBeUndefined();   // kinds are counted apart
    h.undo();
    expect(coveredBy(w, BUILDING_PARK).get(homeTile)).toBe(1);
    // Along the road, not as the crow flies: a home 3 tiles away with no road between is not covered.
    home(w, 5, 6);
    expect(coveredBy(w, BUILDING_PARK).get(w.grid.idx(5, 6))).toBeUndefined();
  });

  it('touchesAccessRoad: a street or avenue beside the spot, not a highway, not a diagonal', () => {
    street([]);
    expect(touchesAccessRoad(w, 5, 9)).toBe(true);
    expect(touchesAccessRoad(w, 5, 8)).toBe(false);
    w.setRoad(20, 20, ROAD_STREET);
    expect(touchesAccessRoad(w, 21, 21)).toBe(false);          // diagonal only
    w.setRoad(30, 5, ROAD_HIGHWAY);
    expect(touchesAccessRoad(w, 30, 4)).toBe(false);
  });

  it('serviceReach says what a spot would serve', () => {
    street([4, 5, 6, 20]);
    expect(serviceReach(w, 5, 9, BUILDING_PARK)).toEqual({ touchesRoad: true, homesCovered: 3 });
    expect(serviceReach(w, 5, 7, BUILDING_PARK)).toEqual({ touchesRoad: false, homesCovered: 0 });
  });

  it('a quote flags a service building that would not be connected, and still allows it', () => {
    street([5]);
    const off = pcQuote(w, { type: 'building', tx: 5, ty: 7, kind: BUILDING_PARK });
    expect(off.notConnected).toBe(true);
    expect(off.affordable).toBe(true);
    expect(h.run(new PlaceBuildingCommand(5, 7, BUILDING_PARK))).toBe(true);
    // Connected spots, and buildings that are not services, are not flagged.
    expect(pcQuote(w, { type: 'building', tx: 5, ty: 9, kind: BUILDING_PARK }).notConnected).toBeUndefined();
    expect(pcQuote(w, { type: 'building', tx: 8, ty: 7, kind: BUILDING_POWER_PLANT }).notConnected).toBeUndefined();
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 7 }).notConnected).toBeUndefined();
    // A merged quote carries the flag if any of its buildings has it.
    expect(pcQuoteMany(w, [
      { type: 'building', tx: 6, ty: 9, kind: BUILDING_PARK },
      { type: 'building', tx: 9, ty: 7, kind: BUILDING_POLICE },
    ]).notConnected).toBe(true);
  });

  it('the flag does not depend on the service values being switched on', () => {
    cfg.perResident = { ...shipped.perResident };
    street([5]);
    expect(pcQuote(w, { type: 'building', tx: 5, ty: 7, kind: BUILDING_PARK }).notConnected).toBe(true);
  });
});
