import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import { PowerSystem } from '../sim/systems/PowerSystem';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { SewageSystem } from '../sim/systems/SewageSystem';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { ZONE_R, ZONE_C, ZONE_I, ROAD_STREET, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT } from '../sim/constants';
import { BALANCE } from '../data/balance';

function makeWorld(w = 16, h = 16) { return new World(w, h, 0); }

function forceBuildable(world: World, tx: number, ty: number) {
  const i = world.grid.idx(tx, ty);
  world.layers.terrain[i]   = 0;
  world.layers.building[i]  = 0;
  world.layers.roadClass[i] = 0;
  world.layers.zone[i]      = 0;
  world.layers.devLevel[i]  = 0;
  world.layers.abandoned[i] = 0;
  world.layers.distress[i]  = 0;
}

// Set up a developed zone tile at (tx, ty) with no power or water by default.
function setupDevelopedZone(world: World, tx: number, ty: number, zone = ZONE_R, dev = 1) {
  forceBuildable(world, tx, ty);
  const i = world.grid.idx(tx, ty);
  world.layers.zone[i]     = zone;
  world.layers.devLevel[i] = dev;
  world.layers.power[i]    = 0;
  world.layers.water[i]    = 0;
}

// Run AbandonmentSystem for N full distress intervals (tick advances by distressInterval each call).
function runNChecks(world: World, sys: AbandonmentSystem, n: number) {
  for (let k = 0; k < n; k++) {
    world.tick = k * BALANCE.abandonment.distressInterval;
    sys.update(world);
  }
}

// ─── AbandonmentSystem core ───────────────────────────────────────────────────

describe('AbandonmentSystem', () => {
  it('accumulates distress when power and water are missing', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);

    w.tick = 0;
    sys.update(w);
    expect(w.layers.distress[w.grid.idx(5, 5)]).toBe(1);

    w.tick = BALANCE.abandonment.distressInterval;
    sys.update(w);
    expect(w.layers.distress[w.grid.idx(5, 5)]).toBe(2);
  });

  it('does not accumulate distress when both power and water are present', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);
    w.layers.power[i] = 1;
    w.layers.water[i] = 1;

    w.tick = 0;
    sys.update(w);
    expect(w.layers.distress[i]).toBe(0);
    expect(w.layers.abandoned[i]).toBe(0);
  });

  it('drains distress when conditions are restored before abandonment threshold', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);

    // Accumulate some distress but not enough to abandon.
    w.layers.distress[i] = 5;

    // Now restore conditions.
    w.layers.power[i] = 1;
    w.layers.water[i] = 1;
    w.tick = 0;
    sys.update(w);
    expect(w.layers.distress[i]).toBe(4);
    expect(w.layers.abandoned[i]).toBe(0);
  });

  it('marks tile abandoned when distress reaches the threshold', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);
    // Set distress one below threshold — one more bad check should abandon.
    w.layers.distress[i] = BALANCE.abandonment.abandonThreshold - 1;

    w.tick = 0;
    sys.update(w);
    expect(w.layers.abandoned[i]).toBe(1);
  });

  it('emits tileAbandoned event when a tile is abandoned', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 3, 4);
    const i = w.grid.idx(3, 4);
    w.layers.distress[i] = BALANCE.abandonment.abandonThreshold - 1;

    const events: unknown[] = [];
    w.events.on('tileAbandoned', (p) => events.push(p));

    w.tick = 0;
    sys.update(w);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tx: 3, ty: 4 });
  });

  it('does not process undeveloped zone tiles', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    forceBuildable(w, 5, 5);
    const i = w.grid.idx(5, 5);
    world_setZone(w, 5, 5, ZONE_R);  // zone but dev=0

    w.tick = 0;
    sys.update(w);
    expect(w.layers.distress[i]).toBe(0);
    expect(w.layers.abandoned[i]).toBe(0);
  });

  it('skips already-abandoned tiles — abandonment is permanent', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);
    w.layers.abandoned[i] = 1;
    w.layers.distress[i] = BALANCE.abandonment.abandonThreshold;

    // Restore conditions — should NOT recover.
    w.layers.power[i] = 1;
    w.layers.water[i] = 1;

    const before = w.layers.distress[i];
    w.tick = 0;
    sys.update(w);
    expect(w.layers.abandoned[i]).toBe(1);       // still abandoned
    expect(w.layers.distress[i]).toBe(before);   // distress unchanged
  });

  it('resets distress on tiles that lose their zone', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);
    w.layers.distress[i] = 5;

    // Clear the zone — simulates the zone being painted ZONE_NONE externally.
    w.layers.zone[i]     = 0;
    w.layers.devLevel[i] = 0;

    w.tick = 0;
    sys.update(w);
    expect(w.layers.distress[i]).toBe(0);
  });

  it('accumulates distress when only power is missing', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);
    w.layers.water[i] = 1; // has water, no power

    w.tick = 0;
    sys.update(w);
    expect(w.layers.distress[i]).toBe(1);
  });

  it('accumulates distress when only water is missing', () => {
    const w = makeWorld();
    const sys = new AbandonmentSystem();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);
    w.layers.power[i] = 1; // has power, no water

    w.tick = 0;
    sys.update(w);
    expect(w.layers.distress[i]).toBe(1);
  });
});

// ─── clearTile clears abandonment state ───────────────────────────────────────

describe('World.clearTile clears abandonment', () => {
  it('resets abandoned and distress layers when a tile is bulldozed', () => {
    const w = makeWorld();
    setupDevelopedZone(w, 5, 5);
    const i = w.grid.idx(5, 5);
    w.layers.abandoned[i] = 1;
    w.layers.distress[i]  = BALANCE.abandonment.abandonThreshold;

    w.clearTile(5, 5);
    expect(w.layers.abandoned[i]).toBe(0);
    expect(w.layers.distress[i]).toBe(0);
  });
});

// ─── setZone clears abandonment state ────────────────────────────────────────

describe('World.setZone clears abandonment on re-zone', () => {
  it('clears abandoned and distress when zone type changes', () => {
    const w = makeWorld();
    setupDevelopedZone(w, 5, 5, ZONE_R);
    const i = w.grid.idx(5, 5);
    w.layers.abandoned[i] = 1;
    w.layers.distress[i]  = BALANCE.abandonment.abandonThreshold;

    // Re-zone to a different type — should reset abandonment.
    w.setZone(5, 5, ZONE_C);
    expect(w.layers.abandoned[i]).toBe(0);
    expect(w.layers.distress[i]).toBe(0);
    expect(w.layers.devLevel[i]).toBe(0);
  });

  it('does not clear abandonment when re-zoning to the same type', () => {
    const w = makeWorld();
    setupDevelopedZone(w, 5, 5, ZONE_R);
    const i = w.grid.idx(5, 5);
    w.layers.abandoned[i] = 1;
    w.layers.distress[i]  = BALANCE.abandonment.abandonThreshold;

    // Re-zone to the same type — abandonment persists (it's still the same building).
    w.setZone(5, 5, ZONE_R);
    expect(w.layers.abandoned[i]).toBe(1);
  });
});

// ─── EconomySystem ────────────────────────────────────────────────────────────

describe('EconomySystem skips abandoned tiles', () => {
  it('generates no income from abandoned tiles', () => {
    const w = makeWorld();
    const eco = new EconomySystem();

    setupDevelopedZone(w, 5, 5, ZONE_C, 2);
    const i = w.grid.idx(5, 5);
    w.layers.landValue[i] = 128; // neutral multiplier

    // First measure income without abandonment.
    eco.update(w);
    const incomeNormal = w.budget.income;
    expect(incomeNormal).toBeGreaterThan(0);

    // Now abandon the tile.
    w.layers.abandoned[i] = 1;
    w.budget.money = 0; w.budget.income = 0; w.budget.expenses = 0;
    eco.update(w);
    expect(w.budget.income).toBe(0);
  });

  it('counts no population for abandoned residential tiles', () => {
    const w = makeWorld();
    const eco = new EconomySystem();

    setupDevelopedZone(w, 5, 5, ZONE_R, 2);

    eco.update(w);
    const popNormal = w.stats.population;
    expect(popNormal).toBeGreaterThan(0);

    w.layers.abandoned[w.grid.idx(5, 5)] = 1;
    eco.update(w);
    expect(w.stats.population).toBe(0);
  });
});

// ─── Resource demand ──────────────────────────────────────────────────────────

describe('PowerSystem excludes abandoned from demand', () => {
  it('does not count abandoned tiles toward power demand', () => {
    const w = makeWorld();
    const net = new NetworkSystem();
    const pwr = new PowerSystem();

    // Place a road and power plant.
    forceBuildable(w, 0, 0); w.layers.roadClass[w.grid.idx(0, 0)] = ROAD_STREET;
    w.roadNetDirty = true; net.update(w);
    forceBuildable(w, 0, 1); w.placeBuilding(0, 1, BUILDING_POWER_PLANT);

    // Develop a zone next to the road.
    forceBuildable(w, 1, 0);
    w.layers.zone[w.grid.idx(1, 0)]     = ZONE_R;
    w.layers.devLevel[w.grid.idx(1, 0)] = 2;

    pwr.update(w);
    const demandNormal = w.stats.powerDemand;
    expect(demandNormal).toBeGreaterThan(0);

    // Abandon it.
    w.layers.abandoned[w.grid.idx(1, 0)] = 1;
    pwr.update(w);
    expect(w.stats.powerDemand).toBe(0);
  });
});

describe('WaterSystem excludes abandoned from demand', () => {
  it('does not count abandoned tiles toward water demand', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.zone[w.grid.idx(5, 5)]     = ZONE_I;
    w.layers.devLevel[w.grid.idx(5, 5)] = 3;

    new WaterSystem().update(w);
    expect(w.stats.waterDemand).toBeGreaterThan(0);

    w.layers.abandoned[w.grid.idx(5, 5)] = 1;
    new WaterSystem().update(w);
    expect(w.stats.waterDemand).toBe(0);
  });
});

describe('SewageSystem excludes abandoned from demand', () => {
  it('does not count abandoned tiles toward sewage demand', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.zone[w.grid.idx(5, 5)]     = ZONE_R;
    w.layers.devLevel[w.grid.idx(5, 5)] = 3;

    new SewageSystem().update(w);
    expect(w.stats.sewageDemand).toBeGreaterThan(0);

    w.layers.abandoned[w.grid.idx(5, 5)] = 1;
    new SewageSystem().update(w);
    expect(w.stats.sewageDemand).toBe(0);
  });
});

// ─── ZoneGrowthSystem ────────────────────────────────────────────────────────

describe('ZoneGrowthSystem skips abandoned tiles', () => {
  it('does not grow an abandoned tile even when all conditions are met', () => {
    const w = makeWorld();

    // Set up a fully serviced tile that should be eligible for growth.
    forceBuildable(w, 5, 5);
    const i = w.grid.idx(5, 5);
    w.layers.zone[i]     = ZONE_R;
    w.layers.devLevel[i] = 1;
    w.layers.power[i]    = 1;
    w.layers.water[i]    = 1;
    w.layers.abandoned[i] = 1;

    // Road next to it.
    forceBuildable(w, 6, 5); w.layers.roadClass[w.grid.idx(6, 5)] = ROAD_STREET;

    // Surplus conditions met.
    w.stats.powerSupply  = 9999; w.stats.powerDemand  = 0;
    w.stats.waterSupply  = 9999; w.stats.waterDemand  = 0;
    w.stats.sewageSupply = 9999; w.stats.sewageDemand = 0;

    const before = w.layers.devLevel[i];
    // Run many growth cycles — devLevel should never change.
    const sys = new ZoneGrowthSystem();
    for (let t = 0; t < 500; t++) {
      w.tick = t * BALANCE.growth.tickInterval;
      sys.update(w);
    }
    expect(w.layers.devLevel[i]).toBe(before);
  });
});

// ─── helper (avoids using World.setZone for the undeveloped-zone test) ────────
function world_setZone(world: World, tx: number, ty: number, zone: number) {
  const i = world.grid.idx(tx, ty);
  world.layers.zone[i]     = zone;
  world.layers.devLevel[i] = 0;
}
