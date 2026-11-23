// Ribbon cuttings and closures: the PC a service building earns when it opens
// and costs when it closes. The shipped values are 0, so these tests set
// BALANCE's values for their duration.

import './pcOffBaseline';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { pcQuote, pcQuoteMany, pcCap, regenPc } from '../sim/politics';
import { serviceOpeningValue, serviceClosureValue, coveredBy, serviceReach, touchesAccessRoad, homesWithinReach } from '../sim/serviceValue';
import type { ServiceValueConfig } from '../sim/serviceValue';
import {
  ROAD_STREET, ROAD_HIGHWAY, BUILDING_PARK, BUILDING_POLICE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_NONE,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home, residents, withoutActionCap } from './pcTestWorld';

// These tests check the PC formulas' own prices: the one-action limit is tested in pcActionCap.test.ts.
withoutActionCap();

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
  it('is switched off with PC off, with a closure multiplier of at least 1', () => {
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

  it('moving a service is cheap: homes still covered by another are charged what they lose, once', () => {
    street([5]);
    w.budget.politicalCapital = 500;
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));          // +1 × residents
    h.run(new PlaceBuildingCommand(6, 9, BUILDING_PARK));          // +0.5 × residents
    expect(w.budget.politicalCapital).toBe(500 + residents() * 1.5);
    const closeOld = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    // They still have the other park: the half the old one was worth, with no multiplier.
    expect(closeOld.cost).toBe(residents() * 0.5);
    expect(serviceClosureValue(w, 5, 9)[0].strength).toBe(0.5);
    h.run(new BulldozeCommand(5, 9));
    // The move as a whole (open the new one, close the old one) cost nothing.
    expect(w.budget.politicalCapital).toBe(500 + residents());
    // Closing the last one costs the full value, times the multiplier.
    expect(pcQuote(w, { type: 'bulldoze', tx: 6, ty: 9 }).cost).toBe(residents() * 2);
    expect(serviceClosureValue(w, 6, 9)[0].strength).toBe(1);
  });

  it('closing the only one of its kind costs the multiplier in full, as before', () => {
    street([4, 5, 6, 7]);
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_POLICE));
    const q = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    expect(q.cost).toBe(4 * residents() * 2 * 2);                   // 4 homes × 2 per resident × multiplier 2
    expect(q.parts.every(part => part.strength === 1)).toBe(true);
    // A park nearby is a different kind: it does not soften the police closure.
    h.run(new PlaceBuildingCommand(8, 9, BUILDING_PARK));
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 }).cost).toBe(4 * residents() * 2 * 2);
  });

  it('a move is charged in full only for the homes it leaves with nothing', () => {
    // Parks reach 6 road steps. The old park at x = 5 covers the homes at 2 and 8; the new one at
    // x = 14 covers 8 and 20. Moving keeps the home at 8 served and abandons the one at 2.
    street([2, 8, 20]);
    w.budget.politicalCapital = 500;
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    expect(w.budget.politicalCapital).toBe(500 + 2 * residents());
    h.run(new PlaceBuildingCommand(14, 9, BUILDING_PARK));          // 20 is new (full), 8 is shared (half)
    expect(w.budget.politicalCapital).toBe(500 + 3.5 * residents());
    const close = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 });
    const byHome = Object.fromEntries(close.parts.map(part => [part.tx, part.amount]));
    expect(byHome).toEqual({ 2: -residents() * 2, 8: -residents() * 0.5 });   // stranded: ×2; still served: its half, once
    h.run(new BulldozeCommand(5, 9));
    // Net of the move: +1.5 for the new park, −2.5 for closing the old one.
    expect(w.budget.politicalCapital).toBe(500 + 2 * residents() - residents());
  });

  it('opening and closing in a loop never comes out ahead, wherever the two buildings stand', () => {
    for (const [a, b] of [[5, 6], [5, 14], [5, 20], [8, 9]]) {
      w = landWorld();
      h = new CommandHistory(w);
      street([2, 3, 6, 8, 9, 12, 15, 20, 21]);
      h.run(new PlaceBuildingCommand(a, 9, BUILDING_PARK));         // the city starts with park A
      w.budget.politicalCapital = 1000;
      for (let lap = 0; lap < 3; lap++) {
        const before = w.budget.politicalCapital;
        h.run(new PlaceBuildingCommand(b, 9, BUILDING_PARK));       // open B
        h.run(new BulldozeCommand(a, 9));                           // close A: the move
        h.run(new PlaceBuildingCommand(a, 9, BUILDING_PARK));       // open A again
        h.run(new BulldozeCommand(b, 9));                           // close B: back where it started
        expect(w.budget.politicalCapital).toBeLessThanOrEqual(before);
      }
    }
  });

  it('with three overlapping buildings, closing one charges each home by what it has left', () => {
    street([8]);
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));
    h.run(new PlaceBuildingCommand(7, 9, BUILDING_PARK));
    h.run(new PlaceBuildingCommand(9, 9, BUILDING_PARK));
    // Two others remain: a quarter of the value, once.
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 9 }).cost).toBe(residents() * 0.25);
    h.run(new BulldozeCommand(5, 9));
    expect(pcQuote(w, { type: 'bulldoze', tx: 7, ty: 9 }).cost).toBe(residents() * 0.5);
    h.run(new BulldozeCommand(7, 9));
    expect(pcQuote(w, { type: 'bulldoze', tx: 9, ty: 9 }).cost).toBe(residents() * 2);   // the last one
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

describe('homesWithinReach', () => {
  const xs = (tiles: number[]) => tiles.map(i => i % w.grid.width).sort((a, b) => a - b);

  it('lists the occupied homes within the kind\'s range in road steps of a spot, the spot included', () => {
    const reach = BALANCE.service.coverageRange[BUILDING_PARK];
    street([3, 5, 6, 12, 20]);                       // homes along y = 11, street along y = 10
    w.setZone(8, 11, 1);                             // zoned, nobody there yet
    const from = homesWithinReach(w, 5, 11, BUILDING_PARK);
    // From the home at x = 5: the road is reached at (5,10), `reach` steps each way, plus one tile beside the last step.
    expect(xs(from)).toEqual([3, 5, 6, 12].filter(x => Math.abs(x - 5) <= reach + 1));
    expect(from).toContain(w.grid.idx(5, 11));       // the seed home itself
    expect(xs(from)).not.toContain(8);               // an empty lot is not a home
    expect(xs(from)).not.toContain(20);              // out of reach
  });

  it('is what a building on that spot would cover, so one building beside the seed serves the cluster', () => {
    street([4, 5, 6, 7, 20]);
    const cluster = homesWithinReach(w, 5, 11, BUILDING_PARK);
    h.run(new PlaceBuildingCommand(5, 9, BUILDING_PARK));          // across the street from the seed
    const covered = coveredBy(w, BUILDING_PARK);
    expect(cluster.every(i => covered.has(i))).toBe(true);
  });

  it('follows roads, not straight lines, and takes a range of its own', () => {
    street([5]);
    home(w, 5, 7);                                   // 3 tiles north of the street, no road to it
    expect(homesWithinReach(w, 5, 11, BUILDING_PARK)).not.toContain(w.grid.idx(5, 7));
    // A spot that touches no street or avenue reaches only itself.
    expect(homesWithinReach(w, 5, 7, BUILDING_PARK)).toEqual([w.grid.idx(5, 7)]);
    street([5, 9]);
    expect(xs(homesWithinReach(w, 5, 11, BUILDING_PARK, 1))).toEqual([5]);
    expect(xs(homesWithinReach(w, 5, 11, BUILDING_PARK, 3))).toEqual([5, 9]);
  });
});
