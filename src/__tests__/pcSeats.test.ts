// Ribbon cuttings and closures for kinds with a capacity: priced by the
// residents who gain or lose a seat. Capacities and PC values ship as 0, so
// these tests set BALANCE's values for their duration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { pcQuote } from '../sim/politics';
import { seatsIfOpened, seatsIfClosed } from '../sim/serviceCapacity';
import { ROAD_STREET, BUILDING_SCHOOL, BUILDING_PARK } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home } from './pcTestWorld';

const cfg = BALANCE.politicalCapital.service as { perResident: Record<number, number>; repeatFactor: number; closureMultiplier: number };
const capacity = BALANCE.service.capacity as Record<number, number>;
const shipped = { perResident: { ...cfg.perResident }, repeatFactor: cfg.repeatFactor, closureMultiplier: cfg.closureMultiplier, capacity: { ...capacity } };

let w: World;
let h: CommandHistory;

/** A street along y = 10 from x = 2 to 28, with 10-resident homes on its south side at the given x. */
function street(homesAt: number[]): void {
  for (let tx = 2; tx <= 28; tx++) w.setRoad(tx, 10, ROAD_STREET);
  for (const tx of homesAt) home(w, tx, 11);
}
const open = (tx: number) => pcQuote(w, { type: 'building', tx, ty: 9, kind: BUILDING_SCHOOL });
const close = (tx: number) => pcQuote(w, { type: 'bulldoze', tx, ty: 9 });
const build = (tx: number) => h.run(new PlaceBuildingCommand(tx, 9, BUILDING_SCHOOL));

beforeEach(() => {
  // 1 PC per resident for a school or a park; closing costs twice what is lost; a school seats 30.
  cfg.perResident = { 6: 1, 8: 1 };
  cfg.repeatFactor = 0.5;
  cfg.closureMultiplier = 2;
  capacity[BUILDING_SCHOOL] = 30;
  w = landWorld();
  h = new CommandHistory(w);
  w.budget.politicalCapital = 1000;
});
afterEach(() => {
  cfg.perResident = { ...shipped.perResident };
  cfg.repeatFactor = shipped.repeatFactor;
  cfg.closureMultiplier = shipped.closureMultiplier;
  for (const k in capacity) delete capacity[k];
  Object.assign(capacity, shipped.capacity);
});

describe('service value by seats', () => {
  it('a school earns for the residents it seats, not for everyone it reaches', () => {
    street([10, 11, 12, 13, 14]);
    const q = open(10);
    expect(q.reward).toBe(30);
    expect(q.parts.map((p) => p.tx).sort((a, b) => a - b)).toEqual([10, 11, 12]);
    expect(seatsIfOpened(w, 10, 9, BUILDING_SCHOOL)).toMatchObject({ gainedResidents: 30, lostResidents: 0, seatedAtNew: 30 });
    expect(build(10)).toBe(true);
    expect(w.budget.politicalCapital).toBe(1030);
  });

  it('a second school over homes that already have seats earns nothing; there is no repeat discount to collect', () => {
    street([10, 11, 12]);
    build(10);
    expect(open(12).reward).toBe(0);
    expect(open(12).cost).toBe(0);
    // A park, which has no capacity, still follows the repeat rule.
    h.run(new PlaceBuildingCommand(20, 9, BUILDING_PARK));
    expect(pcQuote(w, { type: 'building', tx: 21, ty: 9, kind: BUILDING_PARK }).reward).toBe(0);     // no homes near
    home(w, 20, 11);
    expect(pcQuote(w, { type: 'building', tx: 21, ty: 9, kind: BUILDING_PARK }).reward).toBe(5);     // second park: half
  });

  it('a school that relieves a full one earns for the overflow it seats', () => {
    street([10, 11, 12, 13, 14]);
    build(10);                                       // seats 10, 11, 12; 13 and 14 go without
    const q = open(14);
    expect(q.reward).toBe(20);
    expect(q.parts.map((p) => p.tx).sort((a, b) => a - b)).toEqual([13, 14]);
  });

  it('closing the only school costs everyone seated, times the multiplier; unseated homes lose nothing', () => {
    street([10, 11, 12, 13, 14]);
    build(10);
    const q = close(10);
    expect(q.cost).toBe(30 * 2);
    expect(q.parts.length).toBe(3);
    expect(seatsIfClosed(w, w.grid.idx(10, 9), BUILDING_SCHOOL)).toMatchObject({ gainedResidents: 0, lostResidents: 30 });
  });

  it('closing a school whose residents find seats elsewhere costs nothing, so moving is cheap', () => {
    street([10, 11, 12]);
    build(10);
    build(12);                                       // room for all three at either
    expect(w.budget.politicalCapital).toBe(1030);
    expect(close(10).cost).toBe(0);
    h.run(new BulldozeCommand(10, 9));
    expect(w.budget.politicalCapital).toBe(1030);
    // Now it is the only one again.
    expect(close(12).cost).toBe(60);
  });

  it('closing one of two full schools costs only the residents the other has no room for', () => {
    street([8, 9, 10, 14, 15, 16]);
    build(9);
    build(15);                                       // each seats its own three
    const q = close(9);
    expect(q.cost).toBe(30 * 2);                     // the east school is full: 8, 9, 10 are stranded
    capacity[BUILDING_SCHOOL] = 50;
    expect(close(9).cost).toBe(10 * 2);              // the east school takes two of the three homes
  });

  it('opening and closing in a loop never comes out ahead', () => {
    for (const cap of [20, 30, 50, 1000]) {
      for (const [a, b] of [[9, 10], [9, 15], [9, 20], [12, 13]]) {
        capacity[BUILDING_SCHOOL] = cap;
        w = landWorld();
        h = new CommandHistory(w);
        street([4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 21, 22]);
        w.placeBuilding(a, 9, BUILDING_SCHOOL);       // the city starts with school A
        w.budget.politicalCapital = 1000;
        for (let lap = 0; lap < 3; lap++) {
          const before = w.budget.politicalCapital;
          h.run(new PlaceBuildingCommand(b, 9, BUILDING_SCHOOL));   // open B
          h.run(new BulldozeCommand(a, 9));                         // close A: the move
          h.run(new PlaceBuildingCommand(a, 9, BUILDING_SCHOOL));   // open A again
          h.run(new BulldozeCommand(b, 9));                         // close B: back where it started
          expect(w.budget.politicalCapital).toBeLessThanOrEqual(before);
        }
      }
    }
  });

  it('what is charged is what was quoted, and undo gives it back exactly', () => {
    street([10, 11, 12, 13, 14]);
    const q = open(10);
    build(10);
    expect(w.budget.politicalCapital).toBe(1000 + q.reward);
    const c = close(10);
    h.run(new BulldozeCommand(10, 9));
    expect(w.budget.politicalCapital).toBe(1000 + q.reward - c.cost);
    h.undo();
    expect(w.budget.politicalCapital).toBe(1000 + q.reward);
    h.undo();
    expect(w.budget.politicalCapital).toBe(1000);
  });

  it('with the capacity off, a school is priced by reach and the repeat rule, as before', () => {
    capacity[BUILDING_SCHOOL] = 0;
    street([10, 11, 12, 13, 14]);
    expect(open(10).reward).toBe(50);
    build(10);
    expect(open(12).reward).toBe(25);
  });
});
