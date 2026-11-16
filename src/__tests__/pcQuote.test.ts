import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { pcQuote, pcQuoteMany, pcCap, nuisanceRings, zonesCutOffByHighway } from '../sim/politics';
import type { PcQuoteAction } from '../sim/politics';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import type { Command } from '../commands/Command';
import { planAutoRoad } from '../input/autoRoad';
import { planZoneFill } from '../input/zoneFill';
import {
  ZONE_R, ZONE_C, ZONE_I, ROAD_STREET, ROAD_HIGHWAY,
  BUILDING_POWER_PLANT, BUILDING_SEWAGE_PLANT, BUILDING_PARK,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home, homes, residents, displacementCost, TEST_NUISANCE } from './pcTestWorld';

let w: World;
beforeEach(() => { w = landWorld(); });

describe('pcQuote: displacement and blight', () => {
  it('quotes nothing on empty land, off the map, or for an action that does nothing', () => {
    for (const a of [
      { type: 'bulldoze', tx: 5, ty: 5 },
      { type: 'zone', tx: 5, ty: 5, zone: ZONE_I },
      { type: 'building', tx: 5, ty: 5, kind: BUILDING_POWER_PLANT },
      { type: 'road', tx: 5, ty: 5, roadClass: ROAD_STREET },
      { type: 'bulldoze', tx: -1, ty: 99 },
    ] as PcQuoteAction[]) {
      expect(pcQuote(w, a)).toEqual({ cost: 0, reward: 0, affordable: true, shortfall: 0, displacedPopulation: 0, parts: [] });
    }
    home(w, 5, 5);
    // Painting homes residential again changes nothing, so it displaces nobody.
    expect(pcQuote(w, { type: 'zone', tx: 5, ty: 5, zone: ZONE_R }).cost).toBe(0);
    // A street where there is already a street.
    w.setRoad(8, 8, ROAD_STREET);
    expect(pcQuote(w, { type: 'road', tx: 8, ty: 8, roadClass: ROAD_STREET }).parts).toEqual([]);
  });

  it('quotes displacement for anything that removes an occupied home', () => {
    home(w, 5, 5, 3);
    const cost = displacementCost(3);
    for (const a of [
      { type: 'bulldoze', tx: 5, ty: 5 },
      { type: 'zone', tx: 5, ty: 5, zone: ZONE_C },
      { type: 'building', tx: 5, ty: 5, kind: BUILDING_PARK },
      { type: 'road', tx: 5, ty: 5, roadClass: ROAD_STREET },
    ] as PcQuoteAction[]) {
      const q = pcQuote(w, a);
      expect(q.cost).toBe(cost);
      expect(q.reward).toBe(0);
      expect(q.displacedPopulation).toBe(residents(3));
      expect(q.parts).toEqual([{ reason: 'displacement', tx: 5, ty: 5, amount: -cost, strength: 1 }]);
    }
  });

  it('is not affordable when PC does not cover the cost; rewards are always affordable', () => {
    home(w, 5, 5);
    w.budget.politicalCapital = displacementCost() - 1;
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).affordable).toBe(false);
    w.budget.politicalCapital = displacementCost();
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).affordable).toBe(true);

    w.layers.abandoned[w.grid.idx(5, 5)] = 1;
    w.budget.politicalCapital = 0;
    const q = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 });
    expect(q.affordable).toBe(true);
    expect(q.reward).toBe(2 * BALANCE.politicalCapital.disruptionCosts.abandonedBuildingReward);
    expect(q.parts[0].reason).toBe('blightCleared');
    // Rezoning a ruin clears it too; building or paving over it earns nothing.
    expect(pcQuote(w, { type: 'zone', tx: 5, ty: 5, zone: ZONE_R }).reward).toBe(q.reward);
    expect(pcQuote(w, { type: 'building', tx: 5, ty: 5, kind: BUILDING_PARK }).reward).toBe(0);
    expect(pcQuote(w, { type: 'road', tx: 5, ty: 5, roadClass: ROAD_STREET }).reward).toBe(0);
  });

  it('a highway quotes the homes it cuts off from every other road', () => {
    w.setRoad(10, 10, ROAD_STREET);
    home(w, 10, 9, 3);                       // only road is (10,10)
    home(w, 10, 11, 1);
    w.setRoad(11, 11, ROAD_STREET);          // (10,11) has another street
    w.setZone(9, 10, ZONE_C);
    w.layers.devLevel[w.grid.idx(9, 10)] = 2; // cut off, but shops are not residents
    expect(zonesCutOffByHighway(w, 10, 10)).toEqual([{ tx: 9, ty: 10 }, { tx: 10, ty: 9 }]);
    const q = pcQuote(w, { type: 'road', tx: 10, ty: 10, roadClass: ROAD_HIGHWAY });
    expect(q.parts).toEqual([{ reason: 'displacement', tx: 10, ty: 9, amount: -displacementCost(3), strength: 1 }]);
    expect(q.displacedPopulation).toBe(0);   // nobody lives on the road tile itself
    // The quote reads the world and leaves it alone.
    expect(w.layers.roadClass[w.grid.idx(10, 10)]).toBe(ROAD_STREET);
  });
});

describe('pcQuote: nuisance near homes', () => {
  it('is switched off in the shipped balance', () => {
    homes(w, 4, 4, 8, 8);
    expect(pcQuote(w, { type: 'zone', tx: 9, ty: 6, zone: ZONE_I }).parts).toEqual([]);
    expect(pcQuote(w, { type: 'building', tx: 9, ty: 6, kind: BUILDING_POWER_PLANT }).parts).toEqual([]);
    expect(nuisanceRings({ zone: ZONE_I })).toEqual([]);
    expect(nuisanceRings({ kind: BUILDING_POWER_PLANT })).toEqual([]);
  });

  it('charges per resident, less the further away, and nothing beyond the radius', () => {
    home(w, 12, 10, 2);   // distance 2 → weight 1
    home(w, 10, 14, 3);   // distance 4 → weight 0.5
    home(w, 15, 11, 1);   // distance 6 → weight 0.25
    home(w, 17, 10, 3);   // distance 7 → out of reach
    const q = pcQuote(w, { type: 'zone', tx: 10, ty: 10, zone: ZONE_I }, TEST_NUISANCE);
    const byTile = new Map(q.parts.map(p => [`${p.tx},${p.ty}`, p]));
    expect(q.parts.length).toBe(3);
    expect(byTile.get('12,10')).toEqual({ reason: 'nuisance', tx: 12, ty: 10, amount: -residents(2), strength: 1 });
    expect(byTile.get('10,14')).toEqual({ reason: 'nuisance', tx: 10, ty: 14, amount: -residents(3) * 0.5, strength: 0.5 });
    expect(byTile.get('15,11')).toEqual({ reason: 'nuisance', tx: 15, ty: 11, amount: -residents(1) * 0.25, strength: 0.25 });
    expect(q.cost).toBe(residents(2) + residents(3) * 0.5 + residents(1) * 0.25);
    expect(q.displacedPopulation).toBe(0);
  });

  it('only occupied, non-abandoned homes object', () => {
    w.setZone(11, 10, ZONE_R);                                   // zoned, nobody there yet
    home(w, 9, 10); w.layers.abandoned[w.grid.idx(9, 10)] = 1;   // a ruin
    w.setZone(10, 11, ZONE_C); w.layers.devLevel[w.grid.idx(10, 11)] = 2;   // shops
    expect(pcQuote(w, { type: 'zone', tx: 10, ty: 10, zone: ZONE_I }, TEST_NUISANCE).parts).toEqual([]);
  });

  it('applies to industry, power and sewage plants at their own rates, and to nothing else', () => {
    home(w, 11, 10);
    w.setRoad(12, 10, ROAD_STREET);   // the home's own street, so a highway beside it cuts nothing off
    const cost = (a: PcQuoteAction) => pcQuote(w, a, TEST_NUISANCE).cost;
    expect(cost({ type: 'zone', tx: 10, ty: 10, zone: ZONE_I })).toBe(residents());
    expect(cost({ type: 'building', tx: 10, ty: 10, kind: BUILDING_POWER_PLANT })).toBe(2 * residents());
    expect(cost({ type: 'building', tx: 10, ty: 10, kind: BUILDING_SEWAGE_PLANT })).toBe(residents());
    expect(cost({ type: 'building', tx: 10, ty: 10, kind: BUILDING_PARK })).toBe(0);
    expect(cost({ type: 'zone', tx: 10, ty: 10, zone: ZONE_C })).toBe(0);
    expect(cost({ type: 'road', tx: 10, ty: 10, roadClass: ROAD_HIGHWAY })).toBe(0);
    expect(cost({ type: 'bulldoze', tx: 10, ty: 10 })).toBe(0);
  });

  it('land that is already industrial is not a new nuisance; replacing homes with industry is both', () => {
    home(w, 11, 10);
    w.setZone(10, 10, ZONE_I);
    w.layers.devLevel[w.grid.idx(10, 10)] = 1;
    w.layers.abandoned[w.grid.idx(10, 10)] = 1;   // repainting a ruined factory
    w.budget.politicalCapital = 50;
    const repaint = pcQuote(w, { type: 'zone', tx: 10, ty: 10, zone: ZONE_I }, TEST_NUISANCE);
    expect(repaint.cost).toBe(0);
    expect(repaint.reward).toBeGreaterThan(0);

    home(w, 20, 20, 3); home(w, 21, 20, 1);
    const q = pcQuote(w, { type: 'zone', tx: 20, ty: 20, zone: ZONE_I }, TEST_NUISANCE);
    expect(q.parts.map(p => p.reason)).toEqual(['displacement', 'nuisance']);
    expect(q.cost).toBe(displacementCost(3) + residents(1));
  });

  it('nuisanceRings are the bands the cost uses', () => {
    expect(nuisanceRings({ zone: ZONE_I }, TEST_NUISANCE)).toEqual(TEST_NUISANCE.bands);
    expect(nuisanceRings({ kind: BUILDING_POWER_PLANT }, TEST_NUISANCE)).toEqual(TEST_NUISANCE.bands);
    expect(nuisanceRings({ zone: ZONE_R }, TEST_NUISANCE)).toEqual([]);
    expect(nuisanceRings({ kind: BUILDING_PARK }, TEST_NUISANCE)).toEqual([]);
  });
});

describe('pcQuote: the blight reward stops at the cap', () => {
  const REWARD = 2 * BALANCE.politicalCapital.disruptionCosts.abandonedBuildingReward;
  const ruin = (tx: number, ty: number) => { home(w, tx, ty); w.layers.abandoned[w.grid.idx(tx, ty)] = 1; };

  it('quotes only the room below the cap, and the command banks exactly that', () => {
    ruin(5, 5);
    w.budget.politicalCapital = pcCap(w) - 2;
    const q = pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 });
    expect(q.reward).toBe(2);
    expect(q.parts[0].amount).toBe(REWARD);        // the part keeps its full amount
    const cmd = new BulldozeCommand(5, 5);
    cmd.execute(w);
    expect(w.budget.politicalCapital).toBe(pcCap(w));
    cmd.undo(w);
    expect(w.budget.politicalCapital).toBe(pcCap(w) - 2);
  });

  it('at or over the cap it earns nothing, and takes nothing away', () => {
    ruin(5, 5); ruin(6, 5);
    w.budget.politicalCapital = pcCap(w);
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).reward).toBe(0);
    new BulldozeCommand(5, 5).execute(w);
    expect(w.budget.politicalCapital).toBe(pcCap(w));

    w.budget.politicalCapital = pcCap(w) + 30;
    const cmd = new PaintZoneCommand(6, 5, ZONE_R);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 30);
    cmd.undo(w);
    expect(w.budget.politicalCapital).toBe(pcCap(w) + 30);
  });

  it('a merged quote for several ruins is capped as a whole', () => {
    ruin(5, 5); ruin(6, 5); ruin(7, 5);
    w.budget.politicalCapital = pcCap(w) - 7;
    const q = pcQuoteMany(w, [5, 6, 7].map(tx => ({ type: 'bulldoze' as const, tx, ty: 5 })));
    expect(q.reward).toBe(7);
    expect(q.parts.length).toBe(3);
  });
});

describe('pcQuoteMany', () => {
  it('adds nuisance up per home across tiles, keeping the strongest strength', () => {
    home(w, 13, 10);
    const tiles = [10, 11, 12].map(tx => ({ type: 'zone' as const, tx, ty: 10, zone: ZONE_I }));
    const q = pcQuoteMany(w, tiles, TEST_NUISANCE);
    // Distances 3, 2, 1 → weights 0.5, 1, 1.
    expect(q.parts).toEqual([{ reason: 'nuisance', tx: 13, ty: 10, amount: -residents() * 2.5, strength: 1 }]);
    expect(q.cost).toBe(residents() * 2.5);
    w.budget.politicalCapital = q.cost - 1;
    expect(pcQuoteMany(w, tiles, TEST_NUISANCE).affordable).toBe(false);
  });

  it('counts a home cut off by two highway tiles once', () => {
    w.setRoad(10, 10, ROAD_STREET);
    w.setRoad(11, 11, ROAD_STREET);
    home(w, 11, 10, 3);                      // between the two, no other road
    const one = pcQuote(w, { type: 'road', tx: 10, ty: 10, roadClass: ROAD_HIGHWAY });
    expect(one.cost).toBe(0);                // (11,11) still serves it
    w.setRoad(11, 11, ROAD_HIGHWAY);
    const q = pcQuoteMany(w, [
      { type: 'road', tx: 10, ty: 10, roadClass: ROAD_HIGHWAY },
      { type: 'road', tx: 10, ty: 10, roadClass: ROAD_HIGHWAY },
    ]);
    expect(q.cost).toBe(displacementCost(3));
    expect(q.parts.length).toBe(1);
  });

  it('sums displacement over a drag and reports everyone displaced', () => {
    homes(w, 5, 5, 7, 5, 1);
    const q = pcQuoteMany(w, [5, 6, 7, 8].map(tx => ({ type: 'bulldoze' as const, tx, ty: 5 })));
    expect(q.cost).toBe(3 * displacementCost(1));
    expect(q.displacedPopulation).toBe(3 * residents(1));
  });
});

describe('commands charge exactly what pcQuote quotes', () => {
  const cases: [string, PcQuoteAction, () => Command][] = [
    ['bulldoze', { type: 'bulldoze', tx: 5, ty: 5 }, () => new BulldozeCommand(5, 5)],
    ['zone', { type: 'zone', tx: 5, ty: 5, zone: ZONE_C }, () => new PaintZoneCommand(5, 5, ZONE_C)],
    ['building', { type: 'building', tx: 5, ty: 5, kind: BUILDING_PARK }, () => new PlaceBuildingCommand(5, 5, BUILDING_PARK)],
    ['road', { type: 'road', tx: 5, ty: 5, roadClass: ROAD_STREET }, () => new BuildRoadCommand(5, 5, ROAD_STREET)],
  ];
  for (const [name, action, make] of cases) {
    it(`${name}: over a home, over a ruin, and refused when unaffordable`, () => {
      for (const ruin of [false, true]) {
        const world = landWorld();
        home(world, 5, 5, 3);
        if (ruin) world.layers.abandoned[world.grid.idx(5, 5)] = 1;
        if (ruin) world.budget.politicalCapital = 50;
        const q = pcQuote(world, action);
        const before = world.budget.politicalCapital;
        const cmd = make();
        expect(cmd.execute(world)).toBe(true);
        expect(world.budget.politicalCapital).toBe(before - q.cost + q.reward);
        cmd.undo(world);
        expect(world.budget.politicalCapital).toBe(before);
      }
      const world = landWorld();
      home(world, 5, 5, 3);
      world.budget.politicalCapital = 1;
      expect(pcQuote(world, action).affordable).toBe(false);
      const cmd = make();
      expect(cmd.execute(world)).toBe(false);
      expect(cmd.failReason).toBe('politicalCapital');
      expect(world.budget.politicalCapital).toBe(1);
    });
  }

  it('a highway that cuts homes off charges its quote and undo restores them', () => {
    w.setRoad(10, 10, ROAD_STREET);
    home(w, 10, 9, 3);
    const q = pcQuote(w, { type: 'road', tx: 10, ty: 10, roadClass: ROAD_HIGHWAY });
    const before = w.budget.politicalCapital;
    const cmd = new BuildRoadCommand(10, 10, ROAD_HIGHWAY);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.politicalCapital).toBe(before - q.cost);
    expect(w.layers.abandoned[w.grid.idx(10, 9)]).toBe(1);
    cmd.undo(w);
    expect(w.budget.politicalCapital).toBe(before);
    expect(w.layers.abandoned[w.grid.idx(10, 9)]).toBe(0);
  });
});

describe('plans carry a PC quote', () => {
  it('auto road: homes in the way', () => {
    homes(w, 6, 5, 7, 5, 1);
    const tiles = [5, 6, 7, 8].map(tx => ({ tx, ty: 5 }));
    const plan = planAutoRoad(w, tiles, ROAD_STREET);
    expect(plan.pc.cost).toBe(2 * displacementCost(1));
    expect(plan.pc.affordable).toBe(true);
    w.budget.politicalCapital = 0;
    expect(planAutoRoad(w, tiles, ROAD_STREET).pc.affordable).toBe(false);
  });

  it('zone fill: free of PC with nuisance costs off', () => {
    for (let tx = 0; tx < 20; tx++) w.setRoad(tx, 10, ROAD_STREET);
    homes(w, 4, 11, 12, 11);
    const plan = planZoneFill(w, { tx: 8, ty: 9 }, ZONE_I);
    expect(plan.tiles.length).toBeGreaterThan(0);
    expect(plan.pc).toEqual({ cost: 0, reward: 0, affordable: true, shortfall: 0, displacedPopulation: 0, parts: [] });
  });
});
