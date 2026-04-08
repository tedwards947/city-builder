// EventBus audit tests.
// Verifies that every alert-worthy event is emitted with the correct payload shape.

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { PowerSystem } from '../sim/systems/PowerSystem';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { SewageSystem } from '../sim/systems/SewageSystem';
import { CrimeSystem } from '../sim/systems/CrimeSystem';
import { FireSystem } from '../sim/systems/FireSystem';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import { HealthcareSystem } from '../sim/systems/HealthcareSystem';
import type { EventPayload } from '../sim/EventBus';
import {
  ZONE_R, ZONE_I,
  ROAD_STREET,
  BUILDING_POWER_PLANT,
  BUILDING_WATER_TOWER,
  BUILDING_SEWAGE_PLANT,
} from '../sim/constants';
import { BALANCE } from '../data/balance';

function makeWorld(w = 12, h = 12) { return new World(w, h, 0); }

// Force a tile to be plain grass with no occupant.
function forceBuildable(world: World, tx: number, ty: number) {
  const i = world.grid.idx(tx, ty);
  world.layers.terrain[i]   = 0;
  world.layers.building[i]  = 0;
  world.layers.roadClass[i] = 0;
  world.layers.zone[i]      = 0;
  world.layers.devLevel[i]  = 0;
}

// Collect all events of a given type fired during fn().
function capture(world: World, type: string, fn: () => void): EventPayload[] {
  const captured: EventPayload[] = [];
  world.events.on(type, p => captured.push(p));
  fn();
  world.events.off(type, p => captured.push(p));
  return captured;
}

// ─── Power shortage ──────────────────────────────────────────────────────────

describe('PowerSystem events', () => {
  it('emits powerShortage when demand exceeds supply', () => {
    const world = makeWorld();
    const sys = new PowerSystem();

    // Set up a developed zone with no plant — demand will exceed supply=0.
    forceBuildable(world, 5, 5);
    world.layers.zone[world.grid.idx(5, 5)]     = ZONE_R;
    world.layers.devLevel[world.grid.idx(5, 5)] = 3;

    const events = capture(world, 'powerShortage', () => sys.update(world));
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e).toMatchObject({ supply: 0, demand: expect.any(Number), deficit: expect.any(Number) });
    expect((e.demand as number)).toBeGreaterThan(0);
    expect((e.deficit as number)).toBe((e.demand as number) - (e.supply as number));
  });

  it('emits powerRestored after shortage clears', () => {
    const world = makeWorld();
    const sys = new PowerSystem();
    new NetworkSystem().update(world);

    // Create shortage on first tick.
    forceBuildable(world, 5, 5);
    world.layers.zone[world.grid.idx(5, 5)]     = ZONE_R;
    world.layers.devLevel[world.grid.idx(5, 5)] = 1;
    sys.update(world);  // shortageState = true

    // Place a plant and road so supply > demand.
    forceBuildable(world, 0, 0);
    forceBuildable(world, 1, 0);
    world.layers.roadClass[world.grid.idx(1, 0)] = ROAD_STREET;
    world.roadNetDirty = true;
    new NetworkSystem().update(world);
    world.buildings.push({ kind: BUILDING_POWER_PLANT, tx: 0, ty: 0 });

    const restored = capture(world, 'powerRestored', () => sys.update(world));
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ supply: expect.any(Number), demand: expect.any(Number) });
    expect((restored[0].supply as number)).toBeGreaterThan(0);
  });

  it('does NOT re-emit powerShortage on consecutive shortage ticks', () => {
    const world = makeWorld();
    const sys = new PowerSystem();
    forceBuildable(world, 5, 5);
    world.layers.zone[world.grid.idx(5, 5)]     = ZONE_R;
    world.layers.devLevel[world.grid.idx(5, 5)] = 1;

    sys.update(world); // first tick — emits
    const second = capture(world, 'powerShortage', () => sys.update(world));
    expect(second).toHaveLength(0); // no duplicate
  });
});

// ─── Water shortage ──────────────────────────────────────────────────────────

describe('WaterSystem events', () => {
  it('emits waterShortage when demand exceeds supply', () => {
    const world = makeWorld();
    const sys = new WaterSystem();
    forceBuildable(world, 5, 5);
    world.layers.zone[world.grid.idx(5, 5)]     = ZONE_R;
    world.layers.devLevel[world.grid.idx(5, 5)] = 2;

    const events = capture(world, 'waterShortage', () => sys.update(world));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ supply: 0, deficit: expect.any(Number) });
    expect((events[0].deficit as number)).toBeGreaterThan(0);
  });

  it('emits waterRestored after shortage clears', () => {
    const world = makeWorld();
    const sys = new WaterSystem();
    forceBuildable(world, 5, 5);
    world.layers.zone[world.grid.idx(5, 5)]     = ZONE_R;
    world.layers.devLevel[world.grid.idx(5, 5)] = 1;
    sys.update(world); // enter shortage

    // Add tower with road connection so supply >> demand.
    forceBuildable(world, 0, 0);
    forceBuildable(world, 1, 0);
    world.layers.roadClass[world.grid.idx(1, 0)] = ROAD_STREET;
    world.roadNetDirty = true;
    new NetworkSystem().update(world);
    world.buildings.push({ kind: BUILDING_WATER_TOWER, tx: 0, ty: 0 });

    const events = capture(world, 'waterRestored', () => sys.update(world));
    expect(events).toHaveLength(1);
  });
});

// ─── Sewage shortage ─────────────────────────────────────────────────────────

describe('SewageSystem events', () => {
  it('emits sewageShortage when demand exceeds supply', () => {
    const world = makeWorld();
    const sys = new SewageSystem();
    // Sewage demand kicks in at devLevel >= 2.
    forceBuildable(world, 5, 5);
    world.layers.zone[world.grid.idx(5, 5)]     = ZONE_R;
    world.layers.devLevel[world.grid.idx(5, 5)] = 2;

    const events = capture(world, 'sewageShortage', () => sys.update(world));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ supply: 0, deficit: expect.any(Number) });
  });

  it('emits sewageRestored after shortage clears', () => {
    const world = makeWorld();
    const sys = new SewageSystem();
    forceBuildable(world, 5, 5);
    world.layers.zone[world.grid.idx(5, 5)]     = ZONE_R;
    world.layers.devLevel[world.grid.idx(5, 5)] = 2;
    sys.update(world); // enter shortage

    forceBuildable(world, 0, 0);
    forceBuildable(world, 1, 0);
    world.layers.roadClass[world.grid.idx(1, 0)] = ROAD_STREET;
    world.roadNetDirty = true;
    new NetworkSystem().update(world);
    world.buildings.push({ kind: BUILDING_SEWAGE_PLANT, tx: 0, ty: 0 });

    const events = capture(world, 'sewageRestored', () => sys.update(world));
    expect(events).toHaveLength(1);
  });
});

// ─── Crime spike ─────────────────────────────────────────────────────────────

describe('CrimeSystem events', () => {
  it('emits crimeSpike with correct payload when avg crime exceeds threshold', () => {
    const world = makeWorld();
    const sys = new CrimeSystem();

    // Set many developed I zones (high crime base rate) with no police — force high crime.
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        forceBuildable(world, x, y);
        const i = world.grid.idx(x, y);
        world.layers.zone[i]     = ZONE_I;
        world.layers.devLevel[i] = 3;
        // Pre-seed crime above alert threshold so smoothing lands us above it immediately.
        world.layers.crime[i]    = BALANCE.crime.alertThreshold + 20;
      }
    }

    const events = capture(world, 'crimeSpike', () => sys.update(world));
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e).toMatchObject({
      avgCrime:      expect.any(Number),
      threshold:     BALANCE.crime.alertThreshold,
      affectedTiles: expect.any(Number),
    });
    expect((e.avgCrime as number)).toBeGreaterThan(BALANCE.crime.alertThreshold);
    expect((e.affectedTiles as number)).toBeGreaterThan(0);
  });

  it('respects cooldown — does not re-emit until cooldown expires', () => {
    const world = makeWorld();
    const sys = new CrimeSystem();

    for (let x = 0; x < 4; x++) {
      forceBuildable(world, x, 0);
      const i = world.grid.idx(x, 0);
      world.layers.zone[i]     = ZONE_I;
      world.layers.devLevel[i] = 3;
      world.layers.crime[i]    = BALANCE.crime.alertThreshold + 30;
    }

    sys.update(world); // tick 0 — emits
    const second = capture(world, 'crimeSpike', () => {
      world.tick = 1;
      sys.update(world);
    });
    expect(second).toHaveLength(0);

    // Advance tick past cooldown.
    const afterCooldown = capture(world, 'crimeSpike', () => {
      world.tick = BALANCE.crime.alertCooldownTicks + 1;
      sys.update(world);
    });
    expect(afterCooldown).toHaveLength(1);
  });
});

// ─── Fire ignition ───────────────────────────────────────────────────────────

describe('FireSystem events', () => {
  it('emits fireIgnition with tx/ty/zone/devLevel when a tile ignites', () => {
    const world = makeWorld();
    const sys = new FireSystem();

    forceBuildable(world, 3, 3);
    const i = world.grid.idx(3, 3);
    world.layers.zone[i]     = ZONE_R;
    world.layers.devLevel[i] = 2;
    // Keep fire reset and fireRisk pinned high each tick so ignition probability
    // stays near 0.003825/tick (0.0003 * 255/20). Over 2000 ticks the chance of
    // zero ignitions is (1-0.003825)^2000 < 0.1% — effectively guaranteed.
    world.layers.fire[i]    = 0;
    world.layers.fireRisk[i] = 255;

    let fired = false;
    const events: EventPayload[] = [];
    world.events.on('fireIgnition', p => { events.push(p); fired = true; });

    for (let t = 0; t < 2000 && !fired; t++) {
      world.layers.fireRisk[i] = 255; // prevent risk from decaying
      sys.update(world);
      world.layers.fire[i] = 0; // reset so ignition can re-trigger each tick
    }

    expect(fired).toBe(true);
    expect(events[0]).toMatchObject({ tx: 3, ty: 3, zone: ZONE_R, devLevel: 2 });
  });

  it('emits fireSpreading with tx/ty of the tile fire spread to', () => {
    const world = makeWorld();
    const sys = new FireSystem();

    // Place two adjacent zones — one burning, one ready to catch fire.
    forceBuildable(world, 5, 5);
    forceBuildable(world, 6, 5);
    const src = world.grid.idx(5, 5);
    const dst = world.grid.idx(6, 5);
    world.layers.zone[src]     = ZONE_I;
    world.layers.devLevel[src] = 3;
    world.layers.zone[dst]     = ZONE_I;
    world.layers.devLevel[dst] = 3;
    world.layers.fire[src]     = BALANCE.fire.burnDuration; // already burning

    let spreadFired = false;
    const events: EventPayload[] = [];
    world.events.on('fireSpreading', p => { events.push(p); spreadFired = true; });

    // Run until spread event fires (spread prob ~0.04/tick, so expect within ~100 ticks).
    for (let t = 0; t < 300 && !spreadFired; t++) {
      world.layers.fire[src] = BALANCE.fire.burnDuration; // keep source burning
      world.layers.fire[dst] = 0;                         // reset target
      sys.update(world);
    }

    expect(spreadFired).toBe(true);
    expect(events[0]).toMatchObject({ tx: expect.any(Number), ty: expect.any(Number) });
  });
});

// ─── Abandonment ─────────────────────────────────────────────────────────────

describe('AbandonmentSystem events', () => {
  it('emits tileAbandoned with tx/ty/zone/level when distress reaches threshold', () => {
    const world = makeWorld();
    const sys = new AbandonmentSystem();

    forceBuildable(world, 4, 4);
    const i = world.grid.idx(4, 4);
    world.layers.zone[i]     = ZONE_R;
    world.layers.devLevel[i] = 2;
    // No power/water — every check adds distress. Pre-seed distress to one below threshold.
    world.layers.distress[i] = BALANCE.abandonment.abandonThreshold - 1;
    world.layers.power[i]    = 0;
    world.layers.water[i]    = 0;

    const events: EventPayload[] = [];
    world.events.on('tileAbandoned', p => events.push(p));

    // Run enough ticks to accumulate the final point of distress.
    for (let t = 0; t < 20; t++) {
      world.tick = t * BALANCE.abandonment.distressInterval;
      sys.update(world);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ tx: 4, ty: 4, zone: ZONE_R, level: 2 });
  });
});

// ─── Healthcare events ────────────────────────────────────────────────────────

describe('HealthcareSystem events', () => {
  it('emits deathEvent with tx/ty when a death occurs', () => {
    const world = makeWorld();
    const sys = new HealthcareSystem();

    forceBuildable(world, 2, 2);
    const i = world.grid.idx(2, 2);
    world.layers.zone[i]     = ZONE_R;
    world.layers.devLevel[i] = 3;
    world.layers.sickness[i] = 255; // max sickness — highest death probability
    world.layers.hospital[i] = 0;

    let deathFired = false;
    const events: EventPayload[] = [];
    world.events.on('deathEvent', p => { events.push(p); deathFired = true; });

    // At sickness=255: deathChance = baseDeathChance + deathChanceMax ≈ 0.003001/tick.
    // Expected ~330 ticks before death; run up to 2000.
    for (let t = 0; t < 2000 && !deathFired; t++) sys.update(world);

    expect(deathFired).toBe(true);
    expect(events[0]).toMatchObject({ tx: 2, ty: 2 });
  });

  it('emits healthcareCrisis when city-wide average sickness exceeds threshold', () => {
    const world = makeWorld();
    const sys = new HealthcareSystem();

    // Pre-seed many R zones with sickness well above crisis threshold.
    for (let x = 0; x < 6; x++) {
      forceBuildable(world, x, 0);
      const i = world.grid.idx(x, 0);
      world.layers.zone[i]     = ZONE_R;
      world.layers.devLevel[i] = 2;
      world.layers.sickness[i] = BALANCE.healthcare.crisisThreshold + 50;
    }

    const events = capture(world, 'healthcareCrisis', () => sys.update(world));
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e).toMatchObject({
      avgSickness:   expect.any(Number),
      threshold:     BALANCE.healthcare.crisisThreshold,
      affectedTiles: expect.any(Number),
    });
    expect((e.avgSickness as number)).toBeGreaterThan(BALANCE.healthcare.crisisThreshold);
    expect((e.affectedTiles as number)).toBeGreaterThan(0);
  });

  it('respects cooldown — does not re-emit healthcareCrisis until cooldown expires', () => {
    const world = makeWorld();
    const sys = new HealthcareSystem();

    for (let x = 0; x < 4; x++) {
      forceBuildable(world, x, 0);
      const i = world.grid.idx(x, 0);
      world.layers.zone[i]     = ZONE_R;
      world.layers.devLevel[i] = 1;
      world.layers.sickness[i] = BALANCE.healthcare.crisisThreshold + 50;
    }

    sys.update(world); // tick 0 — emits
    const second = capture(world, 'healthcareCrisis', () => {
      world.tick = 1;
      sys.update(world);
    });
    expect(second).toHaveLength(0);

    const afterCooldown = capture(world, 'healthcareCrisis', () => {
      world.tick = BALANCE.healthcare.crisisCooldownTicks + 1;
      sys.update(world);
    });
    expect(afterCooldown).toHaveLength(1);
  });
});
