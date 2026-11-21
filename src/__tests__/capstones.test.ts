// Capstones, phase 1 (CAPSTONE_DESIGN.md, sim/capstones.ts): the seven kinds.
// Shapes, one per city, population unlocks, costs, and the three utility
// capstones at work. Whole-city coverage for the four services is phase 2.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_SEWAGE_WORKS, BUILDING_WATERWORKS, BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL,
  BUILDING_NUCLEAR_PLANT, BUILDING_UNIVERSITY, BUILDING_POWER_PLANT, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_R,
} from '../sim/constants';
import { capstoneFor, capstoneKinds, capstoneOutputs, capstoneRow, capstoneWorking, isCapstone } from '../sim/capstones';
import { buildingShape, placementRules } from '../sim/buildingShapes';
import { buildingUnlocked, unlockPopulation } from '../sim/leisure';
import { headcountCost } from '../sim/runningCost';
import { NEEDS_ROAD } from '../sim/roadCutoff';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { PowerSystem } from '../sim/systems/PowerSystem';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { SewageSystem } from '../sim/systems/SewageSystem';
import { PollutionSystem } from '../sim/systems/PollutionSystem';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { serialize, deserialize } from '../persistence/Serializer';
import { toolbarItems, toolPrice, capstoneLocks } from '../ui/Toolbar';
import { landWorld, homes } from './pcTestWorld';

const ALL = [BUILDING_SEWAGE_WORKS, BUILDING_WATERWORKS, BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_NUCLEAR_PLANT, BUILDING_UNIVERSITY];
const ROW = 20;

let w: World;
const idx = (x: number, y: number) => w.grid.idx(x, y);
/** Make the city big enough for everything. */
const bigCity = () => { w.politics.peakPopulation = 1_000_000; };

// A street along y = 20 from x = 2 to 60.
beforeEach(() => {
  w = landWorld(64);
  w.budget.money = 100_000_000;
  for (let x = 2; x <= 60; x++) w.setRoad(x, ROW, ROAD_STREET);
});

describe('the seven capstones', () => {
  it('are one for each need, numbered in the order they unlock', () => {
    expect(capstoneKinds()).toEqual(ALL);
    expect(ALL.map((k) => capstoneRow(k)!.need)).toEqual(['sewage', 'water', 'fire', 'police', 'hospital', 'power', 'school']);
    expect(ALL.map((k) => capstoneRow(k)!.unlockPopulation)).toEqual([10000, 12500, 15000, 20000, 25000, 30000, 40000]);
    expect(capstoneFor('power')).toBe(BUILDING_NUCLEAR_PLANT);
    expect(capstoneFor('school')).toBe(BUILDING_UNIVERSITY);
    expect(isCapstone(BUILDING_POWER_PLANT)).toBe(false);
    for (const k of ALL) expect(unlockPopulation(k)).toBe(capstoneRow(k)!.unlockPopulation);
  });

  it('have the footprints in the table: 4×4, the fire HQ 8×5, the hospital 6×4, the university 8×8', () => {
    const size = (k: number) => {
      const s = buildingShape(k);
      return [Math.max(...s.map(([dx]) => dx)) + 1, Math.max(...s.map(([, dy]) => dy)) + 1, s.length];
    };
    for (const k of [BUILDING_SEWAGE_WORKS, BUILDING_WATERWORKS, BUILDING_POLICE_HQ, BUILDING_NUCLEAR_PLANT]) expect(size(k)).toEqual([4, 4, 16]);
    expect(size(BUILDING_FIRE_HQ)).toEqual([8, 5, 40]);
    expect(size(BUILDING_GENERAL_HOSPITAL)).toEqual([6, 4, 24]);
    expect(size(BUILDING_UNIVERSITY)).toEqual([8, 8, 64]);
    for (const k of ALL) expect(buildingShape(k).length).toBe(capstoneRow(k)!.size[0] * capstoneRow(k)!.size[1]);
  });

  it('cost what the airport does to build, and nothing fixed to keep', () => {
    expect(ALL.map((k) => BALANCE.buildings[k].cost)).toEqual([1_000_000, 1_000_000, 1_250_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000]);
    for (const k of ALL) expect(BALANCE.buildings[k].maintenance).toBe(0);
    expect(toolPrice('university')).toMatchObject({ cost: '$3,000,000' });
  });

  it('are one per city, and only the Waterworks needs water beside it', () => {
    for (const k of ALL) {
      expect(placementRules(k).onePerCity, String(k)).toBe(true);
      expect(placementRules(k).needsWaterEdge === true, String(k)).toBe(k === BUILDING_WATERWORKS);
    }
    bigCity();
    expect(new PlaceBuildingCommand(4, ROW + 1, BUILDING_POLICE_HQ).execute(w)).toBe(true);
    const second = new PlaceBuildingCommand(20, ROW + 1, BUILDING_POLICE_HQ);
    expect(second.execute(w)).toBe(false);
    expect(second.failReason).toBe('alreadyBuilt');
    // A different capstone is fine.
    expect(new PlaceBuildingCommand(20, ROW + 1, BUILDING_SEWAGE_WORKS).execute(w)).toBe(true);
  });

  it('are locked until the city has had the population, and stay unlocked after', () => {
    const money = w.budget.money;
    const early = new PlaceBuildingCommand(4, ROW + 1, BUILDING_SEWAGE_WORKS);
    expect(buildingUnlocked(w, BUILDING_SEWAGE_WORKS)).toBe(false);
    expect(early.execute(w)).toBe(false);
    expect(early.failReason).toBe('locked');
    expect(w.budget.money).toBe(money);
    w.politics.peakPopulation = 10_000;                      // it once had 10,000
    expect(buildingUnlocked(w, BUILDING_SEWAGE_WORKS)).toBe(true);
    expect(buildingUnlocked(w, BUILDING_WATERWORKS)).toBe(false);
    expect(new PlaceBuildingCommand(4, ROW + 1, BUILDING_SEWAGE_WORKS).execute(w)).toBe(true);
    expect(w.budget.money).toBe(money - 1_000_000);
  });

  it('warn like any building that needs a road when their street is cut', () => {
    for (const k of ALL) expect(NEEDS_ROAD.has(k), String(k)).toBe(true);
  });

  it('survive a save and a load', () => {
    bigCity();
    expect(w.placeBuilding(4, ROW + 1, BUILDING_UNIVERSITY)).toBe(true);
    expect(w.placeBuilding(20, ROW + 1, BUILDING_FIRE_HQ, 0)).toBe(true);
    const back = deserialize(serialize(w));
    expect(back.buildings).toEqual(w.buildings);
    expect(back.buildingTilesAt(6, ROW + 3).length).toBe(64);
    expect(back.canPlaceBuilding(40, ROW + 1, BUILDING_UNIVERSITY)).toBe(false);
  });

  it('are offered by the toolbar to everyone, greyed out with the residents they need until unlocked', () => {
    const tools = toolbarItems().filter((i) => ['sewageWorks', 'waterworks', 'fireHq', 'policeHq', 'generalHospital', 'nuclearPlant', 'university'].includes(i.tool as string));
    expect(tools).toHaveLength(7);
    const was = capstoneLocks.need;
    try {
      capstoneLocks.need = (tool) => (tool === 'university' ? 40000 : 0);
      for (const i of tools) {
        expect(i.shown, i.key).toBeUndefined();
        expect(i.lockedAt?.(), i.key).toBe(i.tool === 'university' ? 40000 : 0);
      }
    } finally { capstoneLocks.need = was; }
  });
});

describe('the utility capstones', () => {
  const run = () => { new NetworkSystem().update(w); new PowerSystem().update(w); new WaterSystem().update(w); new SewageSystem().update(w); };

  it('supply far more than a city needs, to the road network their street belongs to', () => {
    homes(w, 30, ROW - 1, 50, ROW - 1, 3);
    run();
    expect(w.stats.powerSupply).toBe(0);
    expect(w.layers.power[idx(40, ROW - 1)]).toBe(0);
    expect(w.placeBuilding(4, ROW + 1, BUILDING_NUCLEAR_PLANT)).toBe(true);
    expect(w.placeBuilding(10, ROW + 1, BUILDING_SEWAGE_WORKS)).toBe(true);
    run();
    expect(capstoneOutputs('power')).toEqual({ [BUILDING_NUCLEAR_PLANT]: 1_000_000 });
    expect(w.stats.powerSupply).toBe(1_000_000);
    expect(w.stats.sewageSupply).toBe(1_000_000);
    expect(w.stats.powerSupply).toBeGreaterThan(w.stats.powerDemand * 100);
    expect(w.layers.power[idx(40, ROW - 1)]).toBe(1);
    expect(w.layers.sewage[idx(40, ROW - 1)]).toBe(1);
    expect(w.stats.waterSupply).toBe(0);
  });

  it('supply nothing with no street beside them: a single point of failure', () => {
    expect(w.placeBuilding(4, ROW + 1, BUILDING_NUCLEAR_PLANT)).toBe(true);
    run();
    expect(capstoneWorking(w, w.buildings[0])).toBe(true);
    for (let x = 2; x <= 9; x++) w.setRoad(x, ROW, ROAD_NONE);
    run();
    expect(capstoneWorking(w, w.buildings[0])).toBe(false);
    expect(w.stats.powerSupply).toBe(0);
  });

  it('the nuclear station makes no pollution', () => {
    expect(w.placeBuilding(4, ROW + 1, BUILDING_NUCLEAR_PLANT)).toBe(true);
    const pollution = new PollutionSystem();
    for (let k = 1; k <= 20; k++) { w.tick = k * 10; pollution.update(w); }
    expect(Math.max(...w.layers.pollution)).toBe(0);
  });

  it('the Waterworks is a pump: it must stand beside water, and supplies nothing once the water is gone', () => {
    expect(w.canPlaceBuilding(4, ROW + 1, BUILDING_WATERWORKS)).toBe(false);
    expect(w.placeBlocker(4, ROW + 1, BUILDING_WATERWORKS)).toBe('noWater');
    for (let y = ROW + 1; y <= ROW + 4; y++) w.layers.terrain[idx(8, y)] = TERRAIN_WATER;   // a strip of water east of the site
    expect(w.placeBuilding(4, ROW + 1, BUILDING_WATERWORKS)).toBe(true);
    run();
    expect(w.stats.waterSupply).toBe(1_000_000);
    for (let y = ROW + 1; y <= ROW + 4; y++) w.layers.terrain[idx(8, y)] = 0;               // filled in
    run();
    expect(w.stats.waterSupply).toBe(0);
    expect(capstoneWorking(w, w.buildings[0])).toBe(false);
  });
});

describe('what a capstone costs to run', () => {
  const R = BALANCE.runningCost as { freeResidents: number };
  const free = R.freeResidents;
  const perTick = 1 / BALANCE.ticksPerDay;
  const run = () => { new NetworkSystem().update(w); new PowerSystem().update(w); new WaterSystem().update(w); new SewageSystem().update(w); };

  it('a utility capstone at work costs its rate a day for every resident, on top of the units it supplies at the small plants\' rate', () => {
    R.freeResidents = 0;
    try {
      homes(w, 30, ROW - 1, 50, ROW - 1, 3);
      const population = 21 * BALANCE.growth.popPerLevel[3];
      run();
      expect(headcountCost(w).capstones).toEqual({});
      expect(w.placeBuilding(4, ROW + 1, BUILDING_NUCLEAR_PLANT)).toBe(true);
      run();
      const cost = headcountCost(w);
      expect(cost.capstones[BUILDING_NUCLEAR_PLANT]).toBeCloseTo(population * capstoneRow(BUILDING_NUCLEAR_PLANT)!.perResident * perTick, 6);
      expect(cost.utilities.power).toBeCloseTo(w.stats.powerDemand * BALANCE.runningCost.perUnit.power * perTick, 6);
      expect(cost.total).toBeCloseTo(cost.capstones[BUILDING_NUCLEAR_PLANT] + cost.utilities.power, 6);
    } finally { R.freeResidents = free; }
  });

  it('nothing while its street is cut, and a service capstone nothing yet (no coverage until phase 2)', () => {
    R.freeResidents = 0;
    try {
      homes(w, 30, ROW - 1, 50, ROW - 1, 3);
      expect(w.placeBuilding(4, ROW + 1, BUILDING_NUCLEAR_PLANT)).toBe(true);
      expect(w.placeBuilding(12, ROW + 1, BUILDING_POLICE_HQ)).toBe(true);
      for (let x = 2; x <= 9; x++) w.setRoad(x, ROW, ROAD_NONE);
      run();
      const cost = headcountCost(w);
      expect(cost.capstones[BUILDING_NUCLEAR_PLANT]).toBe(0);
      expect(cost.capstones[BUILDING_POLICE_HQ]).toBe(0);
    } finally { R.freeResidents = free; }
  });

  it('a home zone is unchanged by any of this: no capstone, no capstone cost', () => {
    w.setZone(30, ROW - 1, ZONE_R);
    expect(headcountCost(w).capstones).toEqual({});
  });
});
