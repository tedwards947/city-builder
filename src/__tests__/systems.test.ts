import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../sim/World';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { PowerSystem } from '../sim/systems/PowerSystem';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { SewageSystem } from '../sim/systems/SewageSystem';
import { PollutionSystem } from '../sim/systems/PollutionSystem';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import {
  ZONE_R, ZONE_C, ZONE_I,
  ROAD_STREET,
  BUILDING_POWER_PLANT,
  BUILDING_WATER_TOWER,
  BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE,
  BUILDING_FIRE,
  BUILDING_PARK,
} from '../sim/constants';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { LandValueSystem } from '../sim/systems/LandValueSystem';
import { BALANCE } from '../data/balance';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { PoliticsSystem } from '../sim/systems/PoliticsSystem';
import { CityCharacterSystem } from '../sim/systems/CityCharacterSystem';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceServiceBuildingCommand } from '../commands/PlaceServiceBuildingCommand';
import { resolvePalette } from '../render/CharacterPalette';

// Use a tiny world so tests are fast and grid positions are predictable.
// Seed 0 — we manually set up all the tile state we need.
function makeWorld(w = 16, h = 16) { return new World(w, h, 0); }

// Force a specific tile to be grass (terrain=0, building=0) so we can
// freely set up test scenarios without worrying about terrain RNG.
function forceBuildable(world: World, tx: number, ty: number) {
  const i = world.grid.idx(tx, ty);
  world.layers.terrain[i]   = 0; // TERRAIN_GRASS
  world.layers.building[i]  = 0; // BUILDING_NONE
  world.layers.roadClass[i] = 0;
  world.layers.zone[i]      = 0;
  world.layers.devLevel[i]  = 0;
}

// ─── NetworkSystem ────────────────────────────────────────────────────────────

describe('NetworkSystem', () => {
  it('assigns the same network id to connected road tiles', () => {
    const w = makeWorld();
    forceBuildable(w, 1, 0);
    forceBuildable(w, 2, 0);
    forceBuildable(w, 3, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(2, 0)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(3, 0)] = ROAD_STREET;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    const id1 = w.layers.roadNet[w.grid.idx(1, 0)];
    const id2 = w.layers.roadNet[w.grid.idx(2, 0)];
    const id3 = w.layers.roadNet[w.grid.idx(3, 0)];
    expect(id1).toBeGreaterThan(0);
    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });

  it('assigns different network ids to disconnected road segments', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    forceBuildable(w, 5, 0);
    w.layers.roadClass[w.grid.idx(0, 0)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(5, 0)] = ROAD_STREET;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    const idA = w.layers.roadNet[w.grid.idx(0, 0)];
    const idB = w.layers.roadNet[w.grid.idx(5, 0)];
    expect(idA).toBeGreaterThan(0);
    expect(idB).toBeGreaterThan(0);
    expect(idA).not.toBe(idB);
  });

  it('does not run if roadNetDirty is false', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.roadClass[w.grid.idx(0, 0)] = ROAD_STREET;
    w.layers.roadNet[w.grid.idx(0, 0)] = 99; // pre-set sentinel
    w.roadNetDirty = false;
    new NetworkSystem().update(w);
    expect(w.layers.roadNet[w.grid.idx(0, 0)]).toBe(99);
  });

  it('clears roadNetDirty after running', () => {
    const w = makeWorld();
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    expect(w.roadNetDirty).toBe(false);
  });
});

// ─── PowerSystem ──────────────────────────────────────────────────────────────

describe('PowerSystem', () => {
  it('powers the plant tile itself', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.building[w.grid.idx(5, 5)] = BUILDING_POWER_PLANT;
    w.powerPlants = [{ tx: 5, ty: 5 }];
    new NetworkSystem().update(w);
    new PowerSystem().update(w);
    expect(w.layers.power[w.grid.idx(5, 5)]).toBe(1);
  });

  it('powers a road tile adjacent to the plant', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    forceBuildable(w, 6, 5);
    w.layers.building[w.grid.idx(5, 5)] = BUILDING_POWER_PLANT;
    w.powerPlants = [{ tx: 5, ty: 5 }];
    w.layers.roadClass[w.grid.idx(6, 5)] = ROAD_STREET;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    new PowerSystem().update(w);
    expect(w.layers.power[w.grid.idx(6, 5)]).toBe(1);
  });

  it('power propagates along the full connected road network', () => {
    const w = makeWorld();
    // Plant at (0,0), road strip (1,0)→(4,0)
    forceBuildable(w, 0, 0);
    w.layers.building[w.grid.idx(0, 0)] = BUILDING_POWER_PLANT;
    w.powerPlants = [{ tx: 0, ty: 0 }];
    for (let x = 1; x <= 4; x++) {
      forceBuildable(w, x, 0);
      w.layers.roadClass[w.grid.idx(x, 0)] = ROAD_STREET;
    }
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    new PowerSystem().update(w);
    for (let x = 1; x <= 4; x++) {
      expect(w.layers.power[w.grid.idx(x, 0)]).toBe(1);
    }
  });

  it('zone tile adjacent to powered road receives power', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.building[w.grid.idx(0, 0)] = BUILDING_POWER_PLANT;
    w.powerPlants = [{ tx: 0, ty: 0 }];
    forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    forceBuildable(w, 2, 0);
    w.layers.zone[w.grid.idx(2, 0)] = ZONE_R;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    new PowerSystem().update(w);
    expect(w.layers.power[w.grid.idx(2, 0)]).toBe(1);
  });

  it('unpowered road network does not receive power', () => {
    const w = makeWorld();
    forceBuildable(w, 8, 8);
    w.layers.roadClass[w.grid.idx(8, 8)] = ROAD_STREET;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    new PowerSystem().update(w);
    expect(w.layers.power[w.grid.idx(8, 8)]).toBe(0);
  });

  it('tracks powerSupply = plantOutput × number of plants', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    forceBuildable(w, 1, 0);
    w.layers.building[w.grid.idx(0, 0)] = BUILDING_POWER_PLANT;
    w.layers.building[w.grid.idx(1, 0)] = BUILDING_POWER_PLANT;
    w.powerPlants = [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }];
    new NetworkSystem().update(w);
    new PowerSystem().update(w);
    expect(w.stats.powerSupply).toBe(BALANCE.power.plantOutput * 2);
  });
});

// ─── ZoneGrowthSystem ─────────────────────────────────────────────────────────

describe('ZoneGrowthSystem', () => {
  // Build a minimal eligible setup: zone tile powered, with road access.
  function eligibleSetup(w: World, zoneTx = 2, zoneTy = 0) {
    // Power plant at (0,0), road at (1,0), zone at (2,0).
    forceBuildable(w, 0, 0);
    w.layers.building[w.grid.idx(0, 0)] = BUILDING_POWER_PLANT;
    w.powerPlants = [{ tx: 0, ty: 0 }];
    forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    forceBuildable(w, zoneTx, zoneTy);
    w.layers.zone[w.grid.idx(zoneTx, zoneTy)] = ZONE_R;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    new PowerSystem().update(w);
  }

  it('does not grow on off-interval ticks', () => {
    const w = makeWorld();
    eligibleSetup(w);
    // Set tick so it's NOT a growth tick.
    w.tick = BALANCE.growth.tickInterval - 1;
    const devBefore = w.layers.devLevel[w.grid.idx(2, 0)];
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(2, 0)]).toBe(devBefore);
  });

  it('never grows beyond maxLevel', () => {
    const w = makeWorld();
    eligibleSetup(w);
    w.stats.powerSupply = 9999;
    // Run many growth ticks to try to push past maxLevel.
    for (let i = 0; i < 1000; i++) {
      w.tick = i * BALANCE.growth.tickInterval;
      new ZoneGrowthSystem().update(w);
    }
    const dev = w.layers.devLevel[w.grid.idx(2, 0)];
    expect(dev).toBeLessThanOrEqual(BALANCE.growth.maxLevel);
  });

  it('unpowered zone does not grow', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    // power layer stays 0 — no plant set up
    w.stats.powerSupply = 9999; // but no tile-level power
    w.tick = BALANCE.growth.tickInterval;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(0);
  });

  it('zone without road access does not grow even if powered', () => {
    const w = makeWorld();
    // Power the tile directly but no road nearby.
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.power[w.grid.idx(0, 0)] = 1;
    w.stats.powerSupply = 9999;
    w.tick = BALANCE.growth.tickInterval;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(0);
  });
});

// ─── EconomySystem ────────────────────────────────────────────────────────────

describe('EconomySystem', () => {
  it('collects tax from a developed R zone', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    const before = w.budget.money;
    new EconomySystem().update(w);
    expect(w.budget.money).toBeGreaterThan(before);
  });

  it('tax scales with dev level', () => {
    const w1 = makeWorld();
    const w2 = makeWorld();
    forceBuildable(w1, 0, 0); w1.layers.zone[w1.grid.idx(0,0)] = ZONE_R; w1.layers.devLevel[w1.grid.idx(0,0)] = 1;
    forceBuildable(w2, 0, 0); w2.layers.zone[w2.grid.idx(0,0)] = ZONE_R; w2.layers.devLevel[w2.grid.idx(0,0)] = 2;
    const before1 = w1.budget.money, before2 = w2.budget.money;
    new EconomySystem().update(w1);
    new EconomySystem().update(w2);
    expect(w2.budget.money - before2).toBeGreaterThan(w1.budget.money - before1);
  });

  it('C zones earn more tax per level than R zones', () => {
    const wR = makeWorld(), wC = makeWorld();
    forceBuildable(wR, 0, 0); wR.layers.zone[wR.grid.idx(0,0)] = ZONE_R; wR.layers.devLevel[wR.grid.idx(0,0)] = 1;
    forceBuildable(wC, 0, 0); wC.layers.zone[wC.grid.idx(0,0)] = ZONE_C; wC.layers.devLevel[wC.grid.idx(0,0)] = 1;
    const beforeR = wR.budget.money, beforeC = wC.budget.money;
    new EconomySystem().update(wR);
    new EconomySystem().update(wC);
    expect(wC.budget.money - beforeC).toBeGreaterThan(wR.budget.money - beforeR);
  });

  it('I zones earn more tax per level than C zones', () => {
    const wC = makeWorld(), wI = makeWorld();
    forceBuildable(wC, 0, 0); wC.layers.zone[wC.grid.idx(0,0)] = ZONE_C; wC.layers.devLevel[wC.grid.idx(0,0)] = 1;
    forceBuildable(wI, 0, 0); wI.layers.zone[wI.grid.idx(0,0)] = ZONE_I; wI.layers.devLevel[wI.grid.idx(0,0)] = 1;
    const beforeC = wC.budget.money, beforeI = wI.budget.money;
    new EconomySystem().update(wC);
    new EconomySystem().update(wI);
    expect(wI.budget.money - beforeI).toBeGreaterThan(wC.budget.money - beforeC);
  });

  it('undeveloped zones contribute no tax', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    // devLevel stays 0
    const before = w.budget.money;
    new EconomySystem().update(w);
    // only maintenance costs apply — no road or plant, so net should be ~0
    expect(w.budget.income).toBe(0);
  });

  it('charges road maintenance per road tile', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(0, 0)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    const before = w.budget.money;
    new EconomySystem().update(w);
    // 2 road tiles × road maintenance rate
    expect(w.budget.expenses).toBeCloseTo(2 * BALANCE.maintenance.road);
    expect(w.budget.money).toBeCloseTo(before - 2 * BALANCE.maintenance.road);
  });

  it('charges power plant maintenance per plant', () => {
    const w = makeWorld();
    w.powerPlants = [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }];
    const before = w.budget.money;
    new EconomySystem().update(w);
    expect(w.budget.expenses).toBeCloseTo(2 * BALANCE.maintenance.powerPlant);
    expect(w.budget.money).toBeCloseTo(before - 2 * BALANCE.maintenance.powerPlant);
  });

  it('R zone population = popPerLevel × devLevel count', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 2;
    new EconomySystem().update(w);
    expect(w.stats.population).toBe(BALANCE.growth.popPerLevel[2]);
  });

  it('C and I zones do not contribute population', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_C;
    w.layers.devLevel[w.grid.idx(0, 0)] = 3;
    forceBuildable(w, 1, 0);
    w.layers.zone[w.grid.idx(1, 0)] = ZONE_I;
    w.layers.devLevel[w.grid.idx(1, 0)] = 3;
    new EconomySystem().update(w);
    expect(w.stats.population).toBe(0);
  });
});

// ─── WaterSystem ──────────────────────────────────────────────────────────────

describe('WaterSystem', () => {
  function setup() {
    const w = makeWorld();
    // Road at (2,0), water tower at (1,0), zone tile at (3,0)
    forceBuildable(w, 1, 0);
    forceBuildable(w, 2, 0);
    forceBuildable(w, 3, 0);
    w.layers.roadClass[w.grid.idx(2, 0)] = ROAD_STREET;
    w.layers.building[w.grid.idx(1, 0)] = BUILDING_WATER_TOWER;
    w.waterTowers = [{ tx: 1, ty: 0 }];
    w.layers.zone[w.grid.idx(3, 0)] = ZONE_R;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    return w;
  }

  it('clears water layer each tick', () => {
    const w = makeWorld();
    w.layers.water.fill(1);
    new WaterSystem().update(w);
    // No towers, so everything should be 0
    expect(w.layers.water.every(v => v === 0)).toBe(true);
  });

  it('tower tile itself is marked as having water', () => {
    const w = setup();
    new WaterSystem().update(w);
    expect(w.layers.water[w.grid.idx(1, 0)]).toBe(1);
  });

  it('adjacent road network gets water', () => {
    const w = setup();
    new WaterSystem().update(w);
    expect(w.layers.water[w.grid.idx(2, 0)]).toBe(1);
  });

  it('zone tile adjacent to serviced road gets water', () => {
    const w = setup();
    new WaterSystem().update(w);
    expect(w.layers.water[w.grid.idx(3, 0)]).toBe(1);
  });

  it('zone tile not near any serviced road has no water', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.zone[w.grid.idx(5, 5)] = ZONE_R;
    new WaterSystem().update(w);
    expect(w.layers.water[w.grid.idx(5, 5)]).toBe(0);
  });

  it('tower on disconnected road gives no water to other network', () => {
    const w = makeWorld();
    // Two disconnected road segments
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    forceBuildable(w, 5, 0); forceBuildable(w, 6, 0);
    w.layers.roadClass[w.grid.idx(0, 0)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(5, 0)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(6, 0)] = ROAD_STREET;
    // Tower only on first segment
    forceBuildable(w, 0, 1);
    w.layers.building[w.grid.idx(0, 1)] = BUILDING_WATER_TOWER;
    w.waterTowers = [{ tx: 0, ty: 1 }];
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    new WaterSystem().update(w);
    expect(w.layers.water[w.grid.idx(0, 0)]).toBe(1);
    expect(w.layers.water[w.grid.idx(5, 0)]).toBe(0);
  });

  it('tracks waterSupply as towers × towerOutput', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.building[w.grid.idx(0, 0)] = BUILDING_WATER_TOWER;
    w.layers.building[w.grid.idx(1, 0)] = BUILDING_WATER_TOWER;
    w.waterTowers = [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }];
    new WaterSystem().update(w);
    expect(w.stats.waterSupply).toBe(2 * BALANCE.water.towerOutput);
  });

  it('tracks waterDemand from developed zones', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 2;
    new WaterSystem().update(w);
    expect(w.stats.waterDemand).toBe(2 * BALANCE.water.perDevLevel);
  });
});

// ─── ZoneGrowthSystem water requirement ───────────────────────────────────────

describe('ZoneGrowthSystem water requirement', () => {
  function makeGrowableWorld() {
    const w = makeWorld();
    // Road at (1,0), zone at (0,0) — road access satisfied
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    // Give surplus power
    w.stats.powerSupply = 9999;
    w.stats.powerDemand = 0;
    // Mark tile as powered
    w.layers.power[w.grid.idx(0, 0)] = 1;
    return w;
  }

  it('zone cannot develop at all without water coverage', () => {
    const w = makeGrowableWorld();
    w.stats.waterSupply = 0;
    w.stats.waterDemand = 0;
    w.layers.water[w.grid.idx(0, 0)] = 0;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(0); // blocked
  });

  it('zone can develop with both power and water coverage', () => {
    const w = makeGrowableWorld();
    w.stats.waterSupply = 9999;
    w.stats.waterDemand = 0;
    w.layers.water[w.grid.idx(0, 0)] = 1;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(1);
  });

  it('zone cannot grow past level 1 without water coverage', () => {
    const w = makeGrowableWorld();
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    w.stats.waterSupply = 9999;
    w.stats.waterDemand = 0;
    w.layers.water[w.grid.idx(0, 0)] = 0;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(1); // unchanged
  });

  it('zone can grow past level 1 with water coverage', () => {
    const w = makeGrowableWorld();
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    w.stats.waterSupply = 9999;
    w.stats.waterDemand = 0;
    w.layers.water[w.grid.idx(0, 0)] = 1;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(2);
  });
});

// ─── SewageSystem ─────────────────────────────────────────────────────────────

describe('SewageSystem', () => {
  function setup() {
    const w = makeWorld();
    // Road at (2,0), sewage plant at (1,0), zone tile at (3,0)
    forceBuildable(w, 1, 0);
    forceBuildable(w, 2, 0);
    forceBuildable(w, 3, 0);
    w.layers.roadClass[w.grid.idx(2, 0)] = ROAD_STREET;
    w.layers.building[w.grid.idx(1, 0)] = BUILDING_SEWAGE_PLANT;
    w.sewagePlants = [{ tx: 1, ty: 0 }];
    w.layers.zone[w.grid.idx(3, 0)] = ZONE_R;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    return w;
  }

  it('clears sewage layer each tick', () => {
    const w = makeWorld();
    w.layers.sewage.fill(1);
    new SewageSystem().update(w);
    expect(w.layers.sewage.every(v => v === 0)).toBe(true);
  });

  it('plant tile itself is marked as having sewage', () => {
    const w = setup();
    new SewageSystem().update(w);
    expect(w.layers.sewage[w.grid.idx(1, 0)]).toBe(1);
  });

  it('adjacent road network gets sewage coverage', () => {
    const w = setup();
    new SewageSystem().update(w);
    expect(w.layers.sewage[w.grid.idx(2, 0)]).toBe(1);
  });

  it('zone tile adjacent to serviced road gets sewage coverage', () => {
    const w = setup();
    new SewageSystem().update(w);
    expect(w.layers.sewage[w.grid.idx(3, 0)]).toBe(1);
  });

  it('zone tile not near serviced road has no sewage', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.zone[w.grid.idx(5, 5)] = ZONE_R;
    new SewageSystem().update(w);
    expect(w.layers.sewage[w.grid.idx(5, 5)]).toBe(0);
  });

  it('tracks sewageSupply as plants × plantOutput', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.building[w.grid.idx(0, 0)] = BUILDING_SEWAGE_PLANT;
    w.layers.building[w.grid.idx(1, 0)] = BUILDING_SEWAGE_PLANT;
    w.sewagePlants = [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }];
    new SewageSystem().update(w);
    expect(w.stats.sewageSupply).toBe(2 * BALANCE.sewage.plantOutput);
  });

  it('tracks sewageDemand only from zones at dev >= 2', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 1; // below threshold
    w.layers.zone[w.grid.idx(1, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(1, 0)] = 2; // at threshold
    new SewageSystem().update(w);
    expect(w.stats.sewageDemand).toBe(2 * BALANCE.sewage.perDevLevel);
  });
});

// ─── ZoneGrowthSystem sewage requirement ──────────────────────────────────────

describe('ZoneGrowthSystem sewage requirement', () => {
  function makeHighDensityWorld() {
    const w = makeWorld();
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 2;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    // Surplus power and water
    w.stats.powerSupply = 9999; w.stats.powerDemand = 0;
    w.stats.waterSupply = 9999; w.stats.waterDemand = 0;
    w.layers.power[w.grid.idx(0, 0)] = 1;
    w.layers.water[w.grid.idx(0, 0)] = 1;
    return w;
  }

  it('zone at level 2 cannot grow without sewage coverage', () => {
    const w = makeHighDensityWorld();
    w.stats.sewageSupply = 9999; w.stats.sewageDemand = 0;
    w.layers.sewage[w.grid.idx(0, 0)] = 0; // no coverage
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(2);
  });

  it('zone at level 2 can grow with sewage and services coverage', () => {
    const w = makeHighDensityWorld();
    w.stats.sewageSupply = 9999; w.stats.sewageDemand = 0;
    w.layers.sewage[w.grid.idx(0, 0)] = 1;
    w.layers.services[w.grid.idx(0, 0)] = 1; // services also required for 2→3
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(3);
  });

  it('sewage overload caps growth at level 2', () => {
    const w = makeHighDensityWorld();
    w.stats.sewageSupply = 0; w.stats.sewageDemand = 999; // overloaded
    w.layers.sewage[w.grid.idx(0, 0)] = 1;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(2);
  });

  it('zone at level 1 can grow to level 2 without sewage (sewage only required for 2->3)', () => {
    const w = makeHighDensityWorld();
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    w.stats.sewageSupply = 0; w.stats.sewageDemand = 0;
    w.layers.sewage[w.grid.idx(0, 0)] = 0;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(2);
  });
});

// ─── PollutionSystem ──────────────────────────────────────────────────────────

describe('PollutionSystem', () => {
  it('industry zones emit pollution proportional to dev level', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_I;
    w.layers.devLevel[w.grid.idx(0, 0)] = 2;
    new PollutionSystem().update(w);
    expect(w.layers.pollution[w.grid.idx(0, 0)]).toBeGreaterThan(0);
  });

  it('higher dev level industry produces more pollution', () => {
    const w1 = makeWorld(), w2 = makeWorld();
    forceBuildable(w1, 0, 0); forceBuildable(w2, 0, 0);
    w1.layers.zone[w1.grid.idx(0, 0)] = ZONE_I; w1.layers.devLevel[w1.grid.idx(0, 0)] = 1;
    w2.layers.zone[w2.grid.idx(0, 0)] = ZONE_I; w2.layers.devLevel[w2.grid.idx(0, 0)] = 3;
    new PollutionSystem().update(w1);
    new PollutionSystem().update(w2);
    expect(w2.layers.pollution[w2.grid.idx(0, 0)]).toBeGreaterThan(w1.layers.pollution[w1.grid.idx(0, 0)]);
  });

  it('power plants emit pollution', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.building[w.grid.idx(0, 0)] = BUILDING_POWER_PLANT;
    w.powerPlants = [{ tx: 0, ty: 0 }];
    new PollutionSystem().update(w);
    expect(w.layers.pollution[w.grid.idx(0, 0)]).toBeGreaterThan(0);
  });

  it('pollution diffuses to neighbours', () => {
    const w = makeWorld();
    forceBuildable(w, 4, 4);
    w.layers.zone[w.grid.idx(4, 4)] = ZONE_I;
    w.layers.devLevel[w.grid.idx(4, 4)] = 3;
    // Run several ticks so diffusion has time to spread
    const sys = new PollutionSystem();
    for (let t = 0; t < 10; t++) sys.update(w);
    expect(w.layers.pollution[w.grid.idx(3, 4)]).toBeGreaterThan(0);
    expect(w.layers.pollution[w.grid.idx(5, 4)]).toBeGreaterThan(0);
  });

  it('pollution decays without sources', () => {
    const w = makeWorld();
    w.layers.pollution[w.grid.idx(0, 0)] = 200;
    const sys = new PollutionSystem();
    for (let t = 0; t < 20; t++) sys.update(w);
    expect(w.layers.pollution[w.grid.idx(0, 0)]).toBeLessThan(200);
  });

  it('undeveloped industry produces no pollution', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_I;
    // dev stays 0
    new PollutionSystem().update(w);
    expect(w.layers.pollution[w.grid.idx(0, 0)]).toBe(0);
  });

  it('R zones produce no pollution', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 3;
    new PollutionSystem().update(w);
    expect(w.layers.pollution[w.grid.idx(0, 0)]).toBe(0);
  });
});

// ─── ZoneGrowthSystem pollution penalty ───────────────────────────────────────

describe('ZoneGrowthSystem pollution penalty', () => {
  function makePollutedWorld() {
    const w = makeWorld();
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    w.stats.powerSupply = 9999; w.stats.powerDemand = 0;
    w.stats.waterSupply = 9999; w.stats.waterDemand = 0;
    w.layers.power[w.grid.idx(0, 0)] = 1;
    w.layers.water[w.grid.idx(0, 0)] = 1;
    return w;
  }

  it('R zone cannot grow when pollution exceeds threshold', () => {
    const w = makePollutedWorld();
    w.layers.pollution[w.grid.idx(0, 0)] = BALANCE.pollution.growthThreshold + 10;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(0);
  });

  it('R zone can grow when pollution is below threshold', () => {
    const w = makePollutedWorld();
    w.layers.pollution[w.grid.idx(0, 0)] = BALANCE.pollution.growthThreshold - 10;
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(1);
  });

  it('I zone is not blocked by its own pollution', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_I;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    w.stats.powerSupply = 9999; w.stats.powerDemand = 0;
    w.stats.waterSupply = 9999; w.stats.waterDemand = 0;
    w.layers.power[w.grid.idx(0, 0)] = 1;
    w.layers.water[w.grid.idx(0, 0)] = 1;
    w.layers.pollution[w.grid.idx(0, 0)] = 255; // maxed
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(1); // grew despite pollution
  });
});

// ─── ServiceSystem ────────────────────────────────────────────────────────────

describe('ServiceSystem', () => {
  it('clears services layer each tick', () => {
    const w = makeWorld();
    w.layers.services.fill(1);
    new ServiceSystem().update(w);
    expect(w.layers.services.every(v => v === 0)).toBe(true);
  });

  it('police station covers its own tile', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.building[w.grid.idx(5, 5)] = BUILDING_POLICE;
    w.serviceBuildings = [{ tx: 5, ty: 5, kind: BUILDING_POLICE }];
    new ServiceSystem().update(w);
    expect(w.layers.services[w.grid.idx(5, 5)]).toBe(1);
  });

  it('service building covers road tiles and adjacent zones within its range', () => {
    const w = makeWorld();
    // Police at (2,8), road running east: (3,8)…(8,8) — 5 hops from building.
    // Police range=5, so hop-5 tile (8,8) is the last covered road tile.
    forceBuildable(w, 2, 8);
    w.layers.building[w.grid.idx(2, 8)] = BUILDING_POLICE;
    for (let x = 3; x <= 8; x++) w.layers.roadClass[w.grid.idx(x, 8)] = ROAD_STREET;
    w.serviceBuildings = [{ tx: 2, ty: 8, kind: BUILDING_POLICE }];
    new ServiceSystem().update(w);
    // Tile at (6,8) — road hop 3 — covered.
    expect(w.layers.services[w.grid.idx(6, 8)]).toBe(1);
    // Tile at (9,8) — 1 tile off the hop-5 road endpoint — covered by radiation.
    expect(w.layers.services[w.grid.idx(9, 8)]).toBe(1);
    // Tile at (11,8) — 3 tiles off road endpoint — not covered.
    expect(w.layers.services[w.grid.idx(11, 8)]).toBe(0);
  });

  it('park covers a smaller road range than fire station', () => {
    // Both at (2,8). Road runs east: (3,8)…(8,8) — 5 hops.
    // Park range=3: reaches hop 3 = (6,8). Radiation covers (7,8).
    // Fire range=5: reaches hop 5 = (8,8). Radiation covers (9,8).
    const wPark = makeWorld(), wFire = makeWorld();
    for (const w of [wPark, wFire]) {
      forceBuildable(w, 2, 8);
      for (let x = 3; x <= 8; x++) w.layers.roadClass[w.grid.idx(x, 8)] = ROAD_STREET;
    }
    wPark.layers.building[wPark.grid.idx(2, 8)] = BUILDING_PARK;
    wPark.serviceBuildings = [{ tx: 2, ty: 8, kind: BUILDING_PARK }];
    wFire.layers.building[wFire.grid.idx(2, 8)] = BUILDING_FIRE;
    wFire.serviceBuildings = [{ tx: 2, ty: 8, kind: BUILDING_FIRE }];
    new ServiceSystem().update(wPark);
    new ServiceSystem().update(wFire);
    // (8,8) is at road hop 5 — beyond park range=3, not covered; within fire range=5, covered.
    expect(wPark.layers.services[wPark.grid.idx(8, 8)]).toBe(0);
    expect(wFire.layers.services[wFire.grid.idx(8, 8)]).toBe(1);
  });

  it('multiple service buildings both contribute to coverage', () => {
    const w = makeWorld();
    // Two police stations, each with their own short road stub pointing inward.
    // Police at (1,8): road (2,8)…(4,8) — 3 hops, covers to (5,8) by radiation.
    // Police at (14,8): road (13,8)…(11,8) — 3 hops, covers to (10,8) by radiation.
    // Gap at (6,8)–(9,8) — not reachable by either.
    forceBuildable(w, 1, 8); forceBuildable(w, 14, 8);
    for (let x = 2; x <= 4; x++) w.layers.roadClass[w.grid.idx(x, 8)] = ROAD_STREET;
    for (let x = 11; x <= 13; x++) w.layers.roadClass[w.grid.idx(x, 8)] = ROAD_STREET;
    w.serviceBuildings = [
      { tx: 1,  ty: 8, kind: BUILDING_POLICE },
      { tx: 14, ty: 8, kind: BUILDING_POLICE },
    ];
    new ServiceSystem().update(w);
    // Building tiles themselves covered.
    expect(w.layers.services[w.grid.idx(1,  8)]).toBe(1);
    expect(w.layers.services[w.grid.idx(14, 8)]).toBe(1);
    // Gap tile (8,8) not reachable by either road stub.
    expect(w.layers.services[w.grid.idx(8, 8)]).toBe(0);
  });

  it('no service buildings → no coverage', () => {
    const w = makeWorld();
    new ServiceSystem().update(w);
    expect(w.layers.services.every(v => v === 0)).toBe(true);
  });

  it('counts covered developed zones in stats', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.zone[w.grid.idx(5, 5)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(5, 5)] = 1;
    w.serviceBuildings = [{ tx: 5, ty: 5, kind: BUILDING_PARK }];
    new ServiceSystem().update(w);
    expect(w.stats.servicesCoveredZones).toBeGreaterThan(0);
  });
});

// ─── ZoneGrowthSystem services requirement ────────────────────────────────────

describe('ZoneGrowthSystem services requirement', () => {
  function makeServiceWorld() {
    const w = makeWorld();
    forceBuildable(w, 0, 0); forceBuildable(w, 1, 0);
    w.layers.roadClass[w.grid.idx(1, 0)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 2;
    w.roadNetDirty = true;
    new NetworkSystem().update(w);
    // Surplus power, water, sewage
    w.stats.powerSupply = 9999; w.stats.powerDemand = 0;
    w.stats.waterSupply = 9999; w.stats.waterDemand = 0;
    w.stats.sewageSupply = 9999; w.stats.sewageDemand = 0;
    w.layers.power[w.grid.idx(0, 0)] = 1;
    w.layers.water[w.grid.idx(0, 0)] = 1;
    w.layers.sewage[w.grid.idx(0, 0)] = 1;
    return w;
  }

  it('zone at level 2 cannot grow to level 3 without services coverage', () => {
    const w = makeServiceWorld();
    w.layers.services[w.grid.idx(0, 0)] = 0; // no services
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(2);
  });

  it('zone at level 2 can grow to level 3 with services coverage', () => {
    const w = makeServiceWorld();
    w.layers.services[w.grid.idx(0, 0)] = 1; // covered
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(3);
  });

  it('zone at level 1 can grow to level 2 without services (services only required for 2->3)', () => {
    const w = makeServiceWorld();
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    w.layers.services[w.grid.idx(0, 0)] = 0; // no services
    w.rng = () => 0;
    w.tick = 0;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(0, 0)]).toBe(2);
  });
});

// ─── LandValueSystem ──────────────────────────────────────────────────────────

describe('LandValueSystem', () => {
  it('does not run on non-interval ticks', () => {
    const w = makeWorld();
    w.layers.landValue.fill(50);
    w.tick = BALANCE.growth.tickInterval - 1;
    new LandValueSystem().update(w);
    expect(w.layers.landValue[0]).toBe(50); // unchanged
  });

  it('smooths land value toward base when no modifiers', () => {
    const w = makeWorld();
    w.layers.landValue.fill(0); // start below base
    w.tick = 0;
    new LandValueSystem().update(w);
    expect(w.layers.landValue[0]).toBeGreaterThan(0);
  });

  it('service coverage increases land value', () => {
    const wBase = makeWorld(), wSvc = makeWorld();
    wBase.layers.landValue.fill(0);
    wSvc.layers.landValue.fill(0);
    wSvc.layers.services.fill(1);
    wBase.tick = 0; wSvc.tick = 0;
    new LandValueSystem().update(wBase);
    new LandValueSystem().update(wSvc);
    expect(wSvc.layers.landValue[0]).toBeGreaterThan(wBase.layers.landValue[0]);
  });

  it('pollution decreases land value', () => {
    const wClean = makeWorld(), wPoll = makeWorld();
    wClean.layers.landValue.fill(200);
    wPoll.layers.landValue.fill(200);
    wPoll.layers.pollution[4] = 200;
    wClean.tick = 0; wPoll.tick = 0;
    new LandValueSystem().update(wClean);
    new LandValueSystem().update(wPoll);
    expect(wPoll.layers.landValue[4]).toBeLessThan(wClean.layers.landValue[4]);
  });

  it('R demand is high when C+I dev exceeds R dev', () => {
    const w = makeWorld();
    for (let x = 0; x < 5; x++) {
      forceBuildable(w, x, 0);
      w.layers.zone[w.grid.idx(x, 0)] = ZONE_C;
      w.layers.devLevel[w.grid.idx(x, 0)] = 3;
    }
    forceBuildable(w, 0, 1);
    w.layers.zone[w.grid.idx(0, 1)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 1)] = 1;
    w.tick = 0;
    new LandValueSystem().update(w);
    expect(w.stats.rDemand).toBeGreaterThan(1.0);
  });

  it('C demand is high when R dev exceeds C dev', () => {
    const w = makeWorld();
    for (let x = 0; x < 8; x++) {
      forceBuildable(w, x, 0);
      w.layers.zone[w.grid.idx(x, 0)] = ZONE_R;
      w.layers.devLevel[w.grid.idx(x, 0)] = 3;
    }
    w.tick = 0;
    new LandValueSystem().update(w);
    expect(w.stats.cDemand).toBeGreaterThan(1.0);
  });

  it('demand is clamped between min and max', () => {
    const w = makeWorld();
    for (let x = 0; x < 15; x++) {
      forceBuildable(w, x, 0);
      w.layers.zone[w.grid.idx(x, 0)] = ZONE_R;
      w.layers.devLevel[w.grid.idx(x, 0)] = 3;
    }
    w.tick = 0;
    new LandValueSystem().update(w);
    expect(w.stats.rDemand).toBeGreaterThanOrEqual(BALANCE.demand.min);
    expect(w.stats.rDemand).toBeLessThanOrEqual(BALANCE.demand.max);
    expect(w.stats.cDemand).toBeGreaterThanOrEqual(BALANCE.demand.min);
    expect(w.stats.cDemand).toBeLessThanOrEqual(BALANCE.demand.max);
  });

  it('writes avgLandValue to stats', () => {
    const w = makeWorld();
    w.tick = 0;
    new LandValueSystem().update(w);
    expect(w.stats.avgLandValue).toBeGreaterThan(0);
  });
});

// ─── EconomySystem — land value & tax rates ───────────────────────────────────

describe('EconomySystem land value and tax rates', () => {
  it('high land value produces more tax than low land value', () => {
    const wLow = makeWorld(), wHigh = makeWorld();
    forceBuildable(wLow, 0, 0);  wLow.layers.zone[wLow.grid.idx(0,0)]  = ZONE_R; wLow.layers.devLevel[wLow.grid.idx(0,0)]  = 1;
    forceBuildable(wHigh, 0, 0); wHigh.layers.zone[wHigh.grid.idx(0,0)] = ZONE_R; wHigh.layers.devLevel[wHigh.grid.idx(0,0)] = 1;
    wLow.layers.landValue[wLow.grid.idx(0,0)]   = 64;
    wHigh.layers.landValue[wHigh.grid.idx(0,0)] = 200;
    new EconomySystem().update(wLow);
    new EconomySystem().update(wHigh);
    expect(wHigh.budget.income).toBeGreaterThan(wLow.budget.income);
  });

  it('higher tax rate increases income', () => {
    const wLow = makeWorld(), wHigh = makeWorld();
    forceBuildable(wLow, 0, 0);  wLow.layers.zone[wLow.grid.idx(0,0)]  = ZONE_R; wLow.layers.devLevel[wLow.grid.idx(0,0)]  = 1;
    forceBuildable(wHigh, 0, 0); wHigh.layers.zone[wHigh.grid.idx(0,0)] = ZONE_R; wHigh.layers.devLevel[wHigh.grid.idx(0,0)] = 1;
    wLow.layers.landValue[wLow.grid.idx(0,0)]   = 128;
    wHigh.layers.landValue[wHigh.grid.idx(0,0)] = 128;
    wLow.budget.taxRates.R  = 0.5;
    wHigh.budget.taxRates.R = 2.0;
    new EconomySystem().update(wLow);
    new EconomySystem().update(wHigh);
    expect(wHigh.budget.income).toBeGreaterThan(wLow.budget.income);
  });
});

// ─── TransitSystem ────────────────────────────────────────────────────────────

describe('TransitSystem', () => {
  // Advance world tick to a multiple of flowInterval so the system runs.
  function runAt(world: World, tick: number) {
    world.tick = tick;
    new TransitSystem().update(world);
  }
  const interval = BALANCE.transit.flowInterval;

  it('no zones → all congestion stays 0', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.roadClass[w.grid.idx(5, 5)] = ROAD_STREET;
    runAt(w, interval);
    expect(w.layers.congestion[w.grid.idx(5, 5)]).toBe(0);
    expect(w.stats.avgCongestion).toBe(0);
  });

  it('developed zone near road raises congestion on that road tile', () => {
    const w = makeWorld();
    // Road at (5,5), R zone at (5,6) distance=1
    forceBuildable(w, 5, 5); forceBuildable(w, 5, 6);
    w.layers.roadClass[w.grid.idx(5, 5)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(5, 6)]     = ZONE_R;
    w.layers.devLevel[w.grid.idx(5, 6)] = 2;
    runAt(w, interval);
    expect(w.layers.congestion[w.grid.idx(5, 5)]).toBeGreaterThan(0);
  });

  it('non-road tiles always have congestion 0', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.zone[w.grid.idx(5, 5)]     = ZONE_R;
    w.layers.devLevel[w.grid.idx(5, 5)] = 3;
    runAt(w, interval);
    expect(w.layers.congestion[w.grid.idx(5, 5)]).toBe(0);
  });

  it('road between R and C zones is busier than road only near R', () => {
    const w = makeWorld();
    // Road A at (3,3) flanked by R zone (2,3) and C zone (4,3)
    forceBuildable(w, 3, 3); forceBuildable(w, 2, 3); forceBuildable(w, 4, 3);
    w.layers.roadClass[w.grid.idx(3, 3)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(2, 3)]      = ZONE_R;
    w.layers.devLevel[w.grid.idx(2, 3)]  = 2;
    w.layers.zone[w.grid.idx(4, 3)]      = ZONE_C;
    w.layers.devLevel[w.grid.idx(4, 3)]  = 2;

    // Road B at (8,8) only near an R zone
    forceBuildable(w, 8, 8); forceBuildable(w, 9, 8);
    w.layers.roadClass[w.grid.idx(8, 8)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(9, 8)]      = ZONE_R;
    w.layers.devLevel[w.grid.idx(9, 8)]  = 2;

    runAt(w, interval);
    expect(w.layers.congestion[w.grid.idx(3, 3)])
      .toBeGreaterThan(w.layers.congestion[w.grid.idx(8, 8)]);
  });

  it('higher devLevel produces higher congestion', () => {
    const wLow = makeWorld(), wHigh = makeWorld();
    for (const w of [wLow, wHigh]) {
      forceBuildable(w, 5, 5); forceBuildable(w, 5, 6);
      w.layers.roadClass[w.grid.idx(5, 5)] = ROAD_STREET;
      w.layers.zone[w.grid.idx(5, 6)]      = ZONE_R;
    }
    wLow.layers.devLevel[wLow.grid.idx(5, 6)]   = 1;
    wHigh.layers.devLevel[wHigh.grid.idx(5, 6)] = 3;
    runAt(wLow, interval);
    runAt(wHigh, interval);
    expect(wHigh.layers.congestion[wHigh.grid.idx(5, 5)])
      .toBeGreaterThan(wLow.layers.congestion[wLow.grid.idx(5, 5)]);
  });

  it('I zones produce more load than C zones at same devLevel (iAttrRate > cAttrRate)', () => {
    const wC = makeWorld(), wI = makeWorld();
    for (const w of [wC, wI]) {
      forceBuildable(w, 5, 5); forceBuildable(w, 5, 6);
      w.layers.roadClass[w.grid.idx(5, 5)] = ROAD_STREET;
      w.layers.devLevel[w.grid.idx(5, 6)]  = 2;
    }
    wC.layers.zone[wC.grid.idx(5, 6)] = ZONE_C;
    wI.layers.zone[wI.grid.idx(5, 6)] = ZONE_I;
    runAt(wC, interval);
    runAt(wI, interval);
    expect(wI.layers.congestion[wI.grid.idx(5, 5)])
      .toBeGreaterThan(wC.layers.congestion[wC.grid.idx(5, 5)]);
  });

  it('does not run on ticks not divisible by flowInterval', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5); forceBuildable(w, 5, 6);
    w.layers.roadClass[w.grid.idx(5, 5)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(5, 6)]      = ZONE_R;
    w.layers.devLevel[w.grid.idx(5, 6)]  = 3;
    // Run at a non-multiple tick — congestion should stay 0
    w.tick = interval - 1;
    new TransitSystem().update(w);
    expect(w.layers.congestion[w.grid.idx(5, 5)]).toBe(0);
  });

  it('avgCongestion is 0 with no roads', () => {
    const w = makeWorld();
    runAt(w, interval);
    expect(w.stats.avgCongestion).toBe(0);
  });

  it('zone beyond spreadRadius has no effect on road', () => {
    const w = makeWorld();
    const r = BALANCE.transit.spreadRadius;
    // Road at (0,0), zone at (0, r+2) — beyond radius
    forceBuildable(w, 0, 0); forceBuildable(w, 0, r + 2);
    w.layers.roadClass[w.grid.idx(0, 0)]     = ROAD_STREET;
    w.layers.zone[w.grid.idx(0, r + 2)]      = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, r + 2)]  = 3;
    runAt(w, interval);
    expect(w.layers.congestion[w.grid.idx(0, 0)]).toBe(0);
  });

  it('road at diagonal corner of spread square (manhattan dist > r) has zero congestion', () => {
    // Regression for negative-weight wrap-around bug:
    // the kernel iterated a square but weighted by manhattan distance.
    // At dx=r, dy=r the weight is 1-(2r/r+1) < 0 → negative flow →
    // Uint8Array wraps to high congestion.  After the fix (diamond clip),
    // the road at (zx+r, zy+r) is outside the manhattan radius and must be 0.
    const w = makeWorld(16, 16);
    const r = BALANCE.transit.spreadRadius;
    const zx = 0, zy = 0;          // zone origin
    const rx = zx + r, ry = zy + r; // diagonal corner, manhattan dist = 2r
    forceBuildable(w, zx, zy);
    forceBuildable(w, rx, ry);
    w.layers.zone[w.grid.idx(zx, zy)]     = ZONE_R;
    w.layers.devLevel[w.grid.idx(zx, zy)] = 3;
    w.layers.roadClass[w.grid.idx(rx, ry)] = ROAD_STREET;
    runAt(w, interval);
    expect(w.layers.congestion[w.grid.idx(rx, ry)]).toBe(0);
  });
});

// ─── Congestion feedback into ZoneGrowthSystem ────────────────────────────────

describe('ZoneGrowthSystem — congestion feedback', () => {
  // Build two worlds with identical eligible R zones next to a road.
  // One world has congestion=0 on that road; the other has congestion=255.
  // Run many growth ticks with the same seed and count how many tiles grew.
  function buildCongestionWorld(congestionLevel: number) {
    // Use a large world to get many eligible zone tiles and a stable average.
    const w = new World(16, 16, 42);
    // Strip all terrain variation and build a road column at x=8, zone tiles at x=7 and x=9.
    for (let y = 0; y < 16; y++) {
      for (let x = 6; x <= 10; x++) forceBuildable(w, x, y);
      w.layers.roadClass[w.grid.idx(8, y)] = ROAD_STREET;
      w.layers.zone[w.grid.idx(7, y)]      = ZONE_R;
      w.layers.zone[w.grid.idx(9, y)]      = ZONE_R;
      w.layers.power[w.grid.idx(7, y)]     = 1;
      w.layers.power[w.grid.idx(9, y)]     = 1;
      w.layers.water[w.grid.idx(7, y)]     = 1;
      w.layers.water[w.grid.idx(9, y)]     = 1;
      w.layers.congestion[w.grid.idx(8, y)] = congestionLevel;
    }
    w.stats.powerSupply  = 9999; w.stats.powerDemand  = 0;
    w.stats.waterSupply  = 9999; w.stats.waterDemand  = 0;
    w.stats.sewageSupply = 9999; w.stats.sewageDemand = 0;
    w.stats.rDemand      = 1.0;
    return w;
  }

  it('high congestion reduces zone growth compared to zero congestion', () => {
    const wFree = buildCongestionWorld(0);
    const wCong = buildCongestionWorld(255);
    let growFree = 0, growCong = 0;
    const ticks = 30;
    for (let t = 0; t < ticks; t++) {
      const tick = t * BALANCE.growth.tickInterval;
      wFree.tick = tick; new ZoneGrowthSystem().update(wFree);
      wCong.tick = tick; new ZoneGrowthSystem().update(wCong);
    }
    for (let y = 0; y < 16; y++) {
      growFree += wFree.layers.devLevel[wFree.grid.idx(7, y)];
      growFree += wFree.layers.devLevel[wFree.grid.idx(9, y)];
      growCong += wCong.layers.devLevel[wCong.grid.idx(7, y)];
      growCong += wCong.layers.devLevel[wCong.grid.idx(9, y)];
    }
    expect(growCong).toBeLessThan(growFree);
  });

  it('congestion=0 does not reduce growth (congestionMult=1)', () => {
    // With congestion=0, mult = 1 - 0 = 1.0 → no penalty.
    // Growth should still occur over many ticks.
    const w = buildCongestionWorld(0);
    let grew = 0;
    for (let t = 0; t < 200; t++) {
      w.tick = t * BALANCE.growth.tickInterval;
      new ZoneGrowthSystem().update(w);
    }
    for (let y = 0; y < 16; y++) {
      grew += w.layers.devLevel[w.grid.idx(7, y)];
      grew += w.layers.devLevel[w.grid.idx(9, y)];
    }
    expect(grew).toBeGreaterThan(0);
  });
});

// ─── PoliticsSystem ───────────────────────────────────────────────────────────

describe('PoliticsSystem', () => {
  it('regenerates PC by at least baseRegen per tick', () => {
    const w = makeWorld();
    w.budget.politicalCapital = 0;
    new PoliticsSystem().update(w);
    expect(w.budget.politicalCapital).toBeGreaterThanOrEqual(BALANCE.politicalCapital.baseRegen);
  });

  it('does not exceed max PC', () => {
    const w = makeWorld();
    w.budget.politicalCapital = BALANCE.politicalCapital.max - 0.1;
    new PoliticsSystem().update(w);
    expect(w.budget.politicalCapital).toBeLessThanOrEqual(BALANCE.politicalCapital.max);
  });

  it('satisfaction is 1 when city has no developed zones (neutral early game)', () => {
    const w = makeWorld();
    const sys = new PoliticsSystem();
    expect(sys.satisfaction(w)).toBe(1);
  });

  it('satisfaction reflects services coverage on developed R zones', () => {
    const w = makeWorld();
    // Two developed R zones — both powered+watered, only one has services.
    for (const tx of [0, 1]) {
      forceBuildable(w, tx, 0);
      const i = w.grid.idx(tx, 0);
      w.layers.zone[i] = ZONE_R; w.layers.devLevel[i] = 1;
      w.layers.power[i] = 1; w.layers.water[i] = 1;
    }
    w.layers.services[w.grid.idx(0, 0)] = 1; // only tile 0 has services
    const sys = new PoliticsSystem();
    const sat = sys.satisfaction(w);
    // servicesCoverage=0.5 (w=0.5), powerCoverage=1.0 (w=0.25), waterCoverage=1.0 (w=0.25)
    // weighted = (0.5*0.5 + 1.0*0.25 + 1.0*0.25) / 1.0 = 0.75
    expect(sat).toBeCloseTo(0.75, 5);
  });

  it('writes satisfaction to world.stats', () => {
    const w = makeWorld();
    new PoliticsSystem().update(w);
    expect(w.stats.satisfaction).toBeDefined();
    expect(w.stats.satisfaction).toBeGreaterThanOrEqual(0);
    expect(w.stats.satisfaction).toBeLessThanOrEqual(1);
  });

  it('custom factors override defaults', () => {
    const w = makeWorld();
    const fakeFactor = { name: 'test', compute: vi.fn(() => 0.5) };
    const sys = new PoliticsSystem([fakeFactor]);
    // Weights table has no 'test' key → weighted sum = 0 → satisfaction = 0.
    expect(sys.satisfaction(w)).toBe(0);
    expect(fakeFactor.compute).not.toHaveBeenCalled(); // weight=0 → skipped
  });
});

// ─── BulldozeCommand + political capital gating ───────────────────────────────

describe('BulldozeCommand political capital', () => {
  it('does not charge PC when bulldozing empty / undeveloped tile', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 0; // undeveloped
    const pcBefore = w.budget.politicalCapital;
    new BulldozeCommand(0, 0).execute(w);
    expect(w.budget.politicalCapital).toBe(pcBefore);
  });

  it('charges PC proportional to displaced population', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 1; // dev level 1 = popPerLevel[1] pop
    const pop = BALANCE.growth.popPerLevel[1];
    const expectedPcCost = pop * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;
    const pcBefore = w.budget.politicalCapital;
    new BulldozeCommand(0, 0).execute(w);
    expect(w.budget.politicalCapital).toBeCloseTo(pcBefore - expectedPcCost);
  });

  it('blocks bulldoze when political capital is insufficient', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 3; // level 3 = high cost
    w.budget.politicalCapital = 0; // no PC
    const ok = new BulldozeCommand(0, 0).execute(w);
    expect(ok).toBe(false);
    expect(w.layers.zone[w.grid.idx(0, 0)]).toBe(ZONE_R); // tile unchanged
  });

  it('restores PC on undo', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    const pcBefore = w.budget.politicalCapital;
    const cmd = new BulldozeCommand(0, 0);
    cmd.execute(w);
    cmd.undo(w);
    expect(w.budget.politicalCapital).toBeCloseTo(pcBefore);
  });
});

// ─── PaintZoneCommand + political capital gating ──────────────────────────────

describe('PaintZoneCommand political capital', () => {
  it('does not charge PC when painting onto an empty tile', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    const pcBefore = w.budget.politicalCapital;
    new PaintZoneCommand(0, 0, ZONE_R).execute(w);
    expect(w.budget.politicalCapital).toBe(pcBefore);
  });

  it('does not charge PC when repainting same zone type', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 2;
    const pcBefore = w.budget.politicalCapital;
    new PaintZoneCommand(0, 0, ZONE_R).execute(w); // same zone type
    expect(w.budget.politicalCapital).toBe(pcBefore);
  });

  it('charges PC when overwriting a populated R zone with a different zone', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    const pop = BALANCE.growth.popPerLevel[1];
    const expectedPcCost = pop * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;
    const pcBefore = w.budget.politicalCapital;
    new PaintZoneCommand(0, 0, ZONE_C).execute(w);
    expect(w.budget.politicalCapital).toBeCloseTo(pcBefore - expectedPcCost);
  });

  it('blocks overwrite when political capital is insufficient', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 3;
    w.budget.politicalCapital = 0;
    const ok = new PaintZoneCommand(0, 0, ZONE_I).execute(w);
    expect(ok).toBe(false);
    expect(w.layers.zone[w.grid.idx(0, 0)]).toBe(ZONE_R);
  });

  it('restores PC on undo after overwrite', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 1;
    const pcBefore = w.budget.politicalCapital;
    const cmd = new PaintZoneCommand(0, 0, ZONE_C);
    cmd.execute(w);
    cmd.undo(w);
    expect(w.budget.politicalCapital).toBeCloseTo(pcBefore);
  });
});

// ─── CityCharacterSystem ──────────────────────────────────────────────────────

describe('CityCharacterSystem', () => {
  it('starts all axes at 0', () => {
    const w = makeWorld();
    expect(w.character.egalitarian).toBe(0);
    expect(w.character.green).toBe(0);
    expect(w.character.planned).toBe(0);
  });

  it('nudges green axis negative when industrial zone is painted', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    const sys = new CityCharacterSystem();
    sys.update(w); // register listeners
    new PaintZoneCommand(0, 0, ZONE_I).execute(w);
    expect(w.character.green).toBeLessThan(0);
  });

  it('nudges green axis positive when park is placed', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    const sys = new CityCharacterSystem();
    sys.update(w);
    new PlaceServiceBuildingCommand(0, 0, BUILDING_PARK).execute(w);
    expect(w.character.green).toBeGreaterThan(0);
  });

  it('nudges egalitarian axis positive when service building placed', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    const sys = new CityCharacterSystem();
    sys.update(w);
    new PlaceServiceBuildingCommand(0, 0, BUILDING_POLICE).execute(w);
    expect(w.character.egalitarian).toBeGreaterThan(0);
  });

  it('nudges planned axis positive when road is built', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    const sys = new CityCharacterSystem();
    sys.update(w);
    w.setRoad(0, 0, ROAD_STREET);
    w.events.emit('roadBuilt', { tx: 0, ty: 0, cost: 10 });
    expect(w.character.planned).toBeGreaterThan(0);
  });

  it('nudges egalitarian/planned negative when population is displaced', () => {
    const w = makeWorld();
    forceBuildable(w, 0, 0);
    w.layers.zone[w.grid.idx(0, 0)] = ZONE_R;
    w.layers.devLevel[w.grid.idx(0, 0)] = 2;
    const sys = new CityCharacterSystem();
    sys.update(w);
    new BulldozeCommand(0, 0).execute(w);
    expect(w.character.egalitarian).toBeLessThan(0);
    expect(w.character.planned).toBeLessThan(0);
  });

  it('decays axes toward zero each tick', () => {
    const w = makeWorld();
    w.character.green = 50;
    w.character.egalitarian = -30;
    const sys = new CityCharacterSystem();
    sys.update(w); // first update registers listeners + decays
    expect(w.character.green).toBeLessThan(50);
    expect(w.character.egalitarian).toBeGreaterThan(-30);
  });

  it('clamps axes to axisMax', () => {
    const w = makeWorld();
    w.character.green = BALANCE.character.axisMax - 0.1;
    const sys = new CityCharacterSystem();
    sys.update(w); // register listeners
    // Place many parks to push past the max
    for (let x = 0; x < 10; x++) {
      forceBuildable(w, x, 5);
      new PlaceServiceBuildingCommand(x, 5, BUILDING_PARK).execute(w);
    }
    expect(w.character.green).toBeLessThanOrEqual(BALANCE.character.axisMax);
  });
});

// ─── CharacterPalette ─────────────────────────────────────────────────────────

describe('CharacterPalette.resolvePalette', () => {
  const axisMax = BALANCE.character.axisMax;

  it('returns base palette at neutral character', () => {
    const p = resolvePalette({ egalitarian: 0, green: 0, planned: 0 }, axisMax);
    expect(p.grass).toBe('#3a5a3a');
    expect(p.zoneI).toBe('#a07a3a');
  });

  it('shifts grass toward green-variant at max green', () => {
    const neutral = resolvePalette({ egalitarian: 0, green: 0,       planned: 0 }, axisMax);
    const green   = resolvePalette({ egalitarian: 0, green: axisMax,  planned: 0 }, axisMax);
    expect(green.grass).not.toBe(neutral.grass);
    // Green variant grass should be different from base
    expect(green.grass).toBe('#2d5228');
  });

  it('shifts industrial zone more vivid at max industrial', () => {
    const neutral    = resolvePalette({ egalitarian: 0, green: 0,        planned: 0 }, axisMax);
    const industrial = resolvePalette({ egalitarian: 0, green: -axisMax, planned: 0 }, axisMax);
    expect(industrial.zoneI).not.toBe(neutral.zoneI);
  });

  it('building palette arrays are lerped per element', () => {
    const industrial = resolvePalette({ egalitarian: 0, green: -axisMax, planned: 0 }, axisMax);
    expect(industrial.buildingI).toHaveLength(3);
    expect(industrial.buildingI[0]).not.toBe('#c89850'); // shifted from base
  });

  it('axes are independent — green shift does not affect egalitarian colors', () => {
    const onlyGreen = resolvePalette({ egalitarian: 0, green: axisMax, planned: 0 }, axisMax);
    const base      = resolvePalette({ egalitarian: 0, green: 0,       planned: 0 }, axisMax);
    // zoneR is only modified by egalitarian/laissez-faire, not green
    expect(onlyGreen.zoneR).toBe(base.zoneR);
  });
});
