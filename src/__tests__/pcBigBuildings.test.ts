// Political capital for buildings of more than one tile: the quote covers the
// whole shape (every home under it is displaced, a nuisance is felt from the
// nearest tile), and the command charges exactly that.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../sim/World';
import {
  ROAD_STREET, BUILDING_POWER_PLANT, BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_SEWAGE_PLANT,
} from '../sim/constants';
import { pcQuote } from '../sim/politics';
import type { NuisanceConfig } from '../sim/politics';
import { serviceReach } from '../sim/serviceValue';
import type { ServiceValueConfig } from '../sim/serviceValue';
import { setBuildingShape, clearBuildingShape } from '../sim/buildingShapes';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { BALANCE } from '../data/balance';
import { landWorld, home, residents, displacementCost, TEST_NUISANCE, withoutActionCap } from './pcTestWorld';

// These tests check the PC formulas' own prices: the one-action limit is tested in pcActionCap.test.ts.
withoutActionCap();

// TEST_NUISANCE with the large power plant switched on too: 2 PC per resident at full weight.
const NUISANCE: NuisanceConfig = { ...TEST_NUISANCE, buildingPerResident: { ...TEST_NUISANCE.buildingPerResident, [BUILDING_LARGE_POWER_PLANT]: 2 } };
const LARGE = BUILDING_LARGE_POWER_PLANT; // 3×3, anchor top-left

describe('PC quote for a building of several tiles', () => {
  let w: World;
  beforeEach(() => {
    w = landWorld(32);
    w.budget.politicalCapital = 1e6;
  });

  it('displaces every home under its shape, not just the one under its anchor', () => {
    home(w, 10, 10);          // under the anchor
    home(w, 12, 10);          // top-right corner
    home(w, 11, 12, 3);       // bottom row, a bigger home
    home(w, 13, 10);          // just outside: not displaced
    const q = pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: LARGE });
    expect(q.cost).toBeCloseTo(2 * displacementCost(2) + displacementCost(3));
    expect(q.displacedPopulation).toBe(2 * residents(2) + residents(3));
    expect(q.parts.map(p => [p.reason, p.tx, p.ty])).toEqual([
      ['displacement', 10, 10], ['displacement', 12, 10], ['displacement', 11, 12],
    ]);
  });

  it('counts homes under tiles other than the anchor even when the anchor tile is empty', () => {
    home(w, 12, 12);
    const q = pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: LARGE });
    expect(q.cost).toBeCloseTo(displacementCost(2));
    expect(q.displacedPopulation).toBe(residents(2));
  });

  it('is empty where the building cannot go', () => {
    home(w, 10, 10);
    w.setRoad(12, 12, ROAD_STREET);                       // a road under one corner
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: LARGE }).parts).toEqual([]);
    expect(pcQuote(w, { type: 'building', tx: 30, ty: 10, kind: LARGE }).parts).toEqual([]); // off the edge
  });

  it('is a nuisance from its nearest tile, not from its anchor', () => {
    // The plant covers x 10–12, y 10–12.
    home(w, 14, 11);          // 2 from the right edge (5 from the anchor): full weight
    home(w, 16, 12);          // 4 from the edge: half weight
    home(w, 18, 10);          // 6 from the edge: quarter weight
    home(w, 19, 10);          // 7: out of range
    home(w, 9, 9);            // diagonal to the anchor: 2 away, full weight
    home(w, 11, 11);          // under the plant: displaced, not a neighbour
    const q = pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: LARGE }, NUISANCE);
    const nuisance = q.parts.filter(p => p.reason === 'nuisance').map(p => [p.tx, p.ty, p.strength, p.amount]);
    const pop = residents(2);
    expect(nuisance).toEqual([
      [9, 9, 1, -(pop * 2)],
      [18, 10, 0.25, -(pop * 2 * 0.25)],
      [14, 11, 1, -(pop * 2)],
      [16, 12, 0.5, -(pop * 2 * 0.5)],
    ]);
    expect(q.parts.filter(p => p.reason === 'displacement').map(p => [p.tx, p.ty])).toEqual([[11, 11]]);
    expect(q.cost).toBeCloseTo(pop * 2 * 2.75 + displacementCost(2));
  });

  it('a one-tile building is priced exactly as before: from its own tile', () => {
    home(w, 14, 11);
    const q = pcQuote(w, { type: 'building', tx: 10, ty: 11, kind: BUILDING_POWER_PLANT }, NUISANCE);
    // 4 away: half weight, at the small plant's rate of 2.
    expect(q.parts).toEqual([{ reason: 'nuisance', tx: 14, ty: 11, amount: -(residents(2) * 2 * 0.5), strength: 0.5 }]);
  });

  it('the shipped numbers charge no nuisance for the large plants', () => {
    home(w, 14, 11);
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: LARGE }).parts).toEqual([]);
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: BUILDING_LARGE_SEWAGE_PLANT }).parts).toEqual([]);
  });
});

describe('placing a building of several tiles charges its quote', () => {
  const cfg = BALANCE.politicalCapital.nuisance as { buildingPerResident: Record<number, number> };
  let w: World;
  let history: CommandHistory;
  beforeEach(() => {
    w = landWorld(32);
    w.budget.money = 1e6;
    w.budget.politicalCapital = 80;
    history = new CommandHistory(w);
    cfg.buildingPerResident[LARGE] = 0.1;
  });
  afterEach(() => { cfg.buildingPerResident[LARGE] = 0; });

  it('charges displacement for every home under it plus the nuisance, and undo gives it back', () => {
    home(w, 12, 12);          // under the far corner
    home(w, 14, 11);          // a neighbour, 2 from the edge
    const quote = pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: LARGE });
    expect(quote.cost).toBeCloseTo(displacementCost(2) + residents(2) * 0.1);
    const placed: { displacedPopulation: number; pcCost: number }[] = [];
    w.events.on('buildingPlaced', p => { placed.push({ displacedPopulation: p.displacedPopulation as number, pcCost: p.pcCost as number }); });

    expect(history.run(new PlaceBuildingCommand(10, 10, LARGE))).toBe(true);
    expect(w.budget.politicalCapital).toBeCloseTo(80 - quote.cost);
    expect(placed).toEqual([{ displacedPopulation: residents(2), pcCost: displacementCost(2) }]);

    history.undo();
    expect(w.budget.politicalCapital).toBeCloseTo(80);
    expect(w.layers.devLevel[w.grid.idx(12, 12)]).toBe(2);   // the home is back
  });

  it('is refused, charging nothing, when the city cannot cover the whole shape', () => {
    for (let x = 10; x <= 12; x++) for (let y = 10; y <= 12; y++) home(w, x, y, 3);
    w.budget.politicalCapital = displacementCost(3) * 2;      // enough for two homes, not nine
    const cmd = new PlaceBuildingCommand(10, 10, LARGE);
    expect(history.run(cmd)).toBe(false);
    expect(cmd.failReason).toBe('politicalCapital');
    expect(w.budget.politicalCapital).toBe(displacementCost(3) * 2);
    expect(w.buildings).toEqual([]);
  });
});

describe('a service building of several tiles (test kind)', () => {
  // A 2×1 test kind that serves homes like a park: coverage and a PC value.
  const KIND = 210;
  const SERVICE: ServiceValueConfig = { perResident: { [KIND]: 1 }, repeatFactor: 0.5, closureMultiplier: 2 };
  const ranges = BALANCE.service.coverageRange as Record<number, number>;
  let w: World;
  beforeEach(() => {
    setBuildingShape(KIND, [[0, 0], [1, 0]]);
    ranges[KIND] = 4;
    w = landWorld(32);
    w.budget.politicalCapital = 50;
  });
  afterEach(() => {
    clearBuildingShape(KIND);
    delete ranges[KIND];
  });

  it('is connected by a road beside any of its tiles, and reaches homes from there', () => {
    for (let y = 6; y <= 12; y++) w.setRoad(12, y, ROAD_STREET);   // runs past the far tile (11, 10), not the anchor (10, 10)
    home(w, 13, 7);
    const q = pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: KIND }, undefined, SERVICE);
    expect(q.notConnected).toBeUndefined();
    expect(q.reward).toBeCloseTo(residents(2));
    expect(serviceReach(w, 10, 10, KIND)).toEqual({ touchesRoad: true, homesCovered: 1 });
    // One tile further left it touches nothing.
    const far = pcQuote(w, { type: 'building', tx: 9, ty: 10, kind: KIND }, undefined, SERVICE);
    expect(far.notConnected).toBe(true);
    expect(far.reward).toBe(0);
    expect(serviceReach(w, 9, 10, KIND)).toEqual({ touchesRoad: false, homesCovered: 0 });
  });

  it('closing it costs the same whichever of its tiles is bulldozed', () => {
    for (let y = 6; y <= 12; y++) w.setRoad(12, y, ROAD_STREET);
    home(w, 13, 7);
    w.placeBuilding(10, 10, KIND);
    const fromAnchor = pcQuote(w, { type: 'bulldoze', tx: 10, ty: 10 }, undefined, SERVICE);
    const fromFar = pcQuote(w, { type: 'bulldoze', tx: 11, ty: 10 }, undefined, SERVICE);
    expect(fromAnchor.cost).toBeCloseTo(residents(2) * 2);
    expect(fromFar.cost).toBeCloseTo(fromAnchor.cost);
    expect(fromFar.parts).toEqual(fromAnchor.parts);

    const history = new CommandHistory(w);
    expect(history.run(new BulldozeCommand(11, 10))).toBe(true);
    expect(w.buildings).toEqual([]);
  });
});
