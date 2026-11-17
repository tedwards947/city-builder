// The large utilities: a 3×3 power plant and 2×2 water and sewage plants.
// Their numbers are placeholders; these tests pin the rules, not the values.

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import {
  ROAD_STREET,
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT,
} from '../sim/constants';
import { buildingShape, block, footprintTiles } from '../sim/buildingShapes';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { PowerSystem } from '../sim/systems/PowerSystem';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { SewageSystem } from '../sim/systems/SewageSystem';
import { PollutionSystem } from '../sim/systems/PollutionSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { BALANCE } from '../data/balance';
import { landWorld } from './pcTestWorld';

const LARGE = [
  { name: 'power', large: BUILDING_LARGE_POWER_PLANT, small: BUILDING_POWER_PLANT, size: 3,
    largeOut: () => BALANCE.power.largePlantOutput, smallOut: () => BALANCE.power.plantOutput,
    supply: (w: World) => { new PowerSystem().update(w); return w.stats.powerSupply; }, layer: (w: World) => w.layers.power },
  { name: 'water', large: BUILDING_LARGE_WATER_PLANT, small: BUILDING_WATER_TOWER, size: 2,
    largeOut: () => BALANCE.water.largePlantOutput, smallOut: () => BALANCE.water.towerOutput,
    supply: (w: World) => { new WaterSystem().update(w); return w.stats.waterSupply; }, layer: (w: World) => w.layers.water },
  { name: 'sewage', large: BUILDING_LARGE_SEWAGE_PLANT, small: BUILDING_SEWAGE_PLANT, size: 2,
    largeOut: () => BALANCE.sewage.largePlantOutput, smallOut: () => BALANCE.sewage.plantOutput,
    supply: (w: World) => { new SewageSystem().update(w); return w.stats.sewageSupply; }, layer: (w: World) => w.layers.sewage },
];

describe('large utilities', () => {
  let w: World;
  beforeEach(() => {
    w = landWorld(24);
    w.budget.money = 1e6;
    for (let x = 2; x <= 20; x++) w.setRoad(x, 10, ROAD_STREET);   // one street; plants go just below it
  });

  for (const u of LARGE) {
    describe(u.name, () => {
      it(`is a ${u.size}×${u.size} block anchored at its top-left tile`, () => {
        expect(buildingShape(u.large)).toEqual(block(u.size, u.size));
      });

      it('supplies its own output once when a street touches its edge, and covers its own tiles', () => {
        expect(w.placeBuilding(4, 11, u.large)).toBe(true);
        new NetworkSystem().update(w);
        expect(u.supply(w)).toBe(u.largeOut());
        for (const i of footprintTiles(24, 24, 4, 11, u.large)!) expect(u.layer(w)[i]).toBe(1);
      });

      it('supplies nothing when no street touches it', () => {
        expect(w.placeBuilding(4, 13, u.large)).toBe(true);        // two rows below the street
        new NetworkSystem().update(w);
        expect(u.supply(w)).toBe(0);
      });

      it('adds to the small ones on the same network', () => {
        w.placeBuilding(4, 11, u.large);
        w.placeBuilding(12, 11, u.small);
        w.placeBuilding(14, 11, u.small);
        new NetworkSystem().update(w);
        expect(u.supply(w)).toBe(u.largeOut() + 2 * u.smallOut());
      });

      it('placeholder numbers: more output per $ of cost and of upkeep than the small one', () => {
        const big = BALANCE.buildings[u.large], small = BALANCE.buildings[u.small];
        expect(big.cost).toBeGreaterThan(small.cost);
        expect(big.maintenance).toBeGreaterThan(small.maintenance);
        expect(u.largeOut() / big.cost).toBeGreaterThan(u.smallOut() / small.cost);
        expect(u.largeOut() / big.maintenance).toBeGreaterThan(u.smallOut() / small.maintenance);
      });

      it('costs its price once, counts once for upkeep, and bulldozing it refunds nothing but removes it whole', () => {
        const history = new CommandHistory(w);
        const before = w.budget.money;
        expect(history.run(new PlaceBuildingCommand(4, 11, u.large))).toBe(true);
        expect(w.budget.money).toBe(before - BALANCE.buildings[u.large].cost);
        expect(w.buildings).toEqual([{ tx: 4, ty: 11, kind: u.large }]);

        w.tick = BALANCE.ticksPerDay;
        new EconomySystem().update(w);
        // Upkeep: the 19 street tiles and this one building.
        expect(w.budget.expenses).toBeCloseTo(19 * BALANCE.roadClasses[ROAD_STREET].maintenance + BALANCE.buildings[u.large].maintenance, 6);

        expect(history.run(new BulldozeCommand(4 + u.size - 1, 11 + u.size - 1))).toBe(true); // its far corner
        expect(w.buildings).toEqual([]);
        history.undo();
        expect(w.buildings).toEqual([{ tx: 4, ty: 11, kind: u.large }]);
      });

      it('cannot be placed across the street', () => {
        expect(new CommandHistory(w).run(new PlaceBuildingCommand(4, 10 - u.size + 1, u.large))).toBe(false);
        expect(w.buildings).toEqual([]);
      });
    });
  }

  it('a large power plant smokes from every tile; the large water and sewage plants do not', () => {
    w.placeBuilding(4, 11, BUILDING_LARGE_POWER_PLANT);
    w.placeBuilding(12, 11, BUILDING_LARGE_WATER_PLANT);
    w.placeBuilding(16, 11, BUILDING_LARGE_SEWAGE_PLANT);
    const sys = new PollutionSystem();
    sys.update(w);
    for (const i of footprintTiles(24, 24, 4, 11, BUILDING_LARGE_POWER_PLANT)!) expect(w.layers.pollution[i]).toBeGreaterThan(0);
    for (const i of footprintTiles(24, 24, 12, 11, BUILDING_LARGE_WATER_PLANT)!) expect(w.layers.pollution[i]).toBe(0);
    for (const i of footprintTiles(24, 24, 16, 11, BUILDING_LARGE_SEWAGE_PLANT)!) expect(w.layers.pollution[i]).toBe(0);
  });

  it('a large power plant pollutes more in total than a small one, but less per unit of power', () => {
    const total = (kind: number) => {
      const world = landWorld(24);
      world.placeBuilding(10, 10, kind);
      const sys = new PollutionSystem();
      for (let t = 0; t < 200; t++) sys.update(world);
      return world.layers.pollution.reduce((a, v) => a + v, 0);
    };
    const large = total(BUILDING_LARGE_POWER_PLANT), small = total(BUILDING_POWER_PLANT);
    expect(large).toBeGreaterThan(small);
    expect(large / BALANCE.power.largePlantOutput).toBeLessThan(small / BALANCE.power.plantOutput);
  });
});
