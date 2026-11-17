import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { FireSystem } from '../sim/systems/FireSystem';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import {
  ZONE_R, ZONE_I,
  BUILDING_FIRE,
} from '../sim/constants';
import { BALANCE } from '../data/balance';

function makeWorld(w = 16, h = 16) {
  return new World(w, h, 0);
}

function forceBuildable(world: World, tx: number, ty: number) {
  const i = world.grid.idx(tx, ty);
  world.layers.terrain[i] = 0; // TERRAIN_GRASS
  world.layers.building[i] = 0;
  world.layers.roadClass[i] = 0;
  world.layers.zone[i] = 0;
  world.layers.devLevel[i] = 0;
  world.layers.fireRisk[i] = 0;
  world.layers.fire[i] = 0;
  world.layers.fireStation[i] = 0;
}

describe('FireSystem', () => {
  it('generates fire risk in developed zones', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = 1;
    
    const sys = new FireSystem();
    for(let k = 0; k < 20; k++) sys.update(w);
    
    expect(w.layers.fireRisk[i]).toBeGreaterThan(0);
  });

  it('industrial zones have higher fire risk than residential', () => {
    const w1 = makeWorld(), w2 = makeWorld();
    const i = w1.grid.idx(5, 5);
    forceBuildable(w1, 5, 5); w1.layers.zone[i] = ZONE_R; w1.layers.devLevel[i] = 1;
    forceBuildable(w2, 5, 5); w2.layers.zone[i] = ZONE_I; w2.layers.devLevel[i] = 1;
    
    const sys = new FireSystem();
    for(let k = 0; k < 50; k++) {
      sys.update(w1);
      sys.update(w2);
    }
    
    expect(w2.layers.fireRisk[i]).toBeGreaterThan(w1.layers.fireRisk[i]);
  });

  it('fire station coverage reduces fire risk', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_I;
    w.layers.devLevel[i] = 3;
    
    const sys = new FireSystem();
    for(let k = 0; k < 50; k++) sys.update(w);
    const highRisk = w.layers.fireRisk[i];
    
    w.layers.fireStation[i] = 1;
    for(let k = 0; k < 50; k++) sys.update(w);
    
    expect(w.layers.fireRisk[i]).toBeLessThan(highRisk);
  });

  it('fires can ignite based on risk', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_I;
    w.layers.devLevel[i] = 3;
    w.layers.fireRisk[i] = 200;
    
    w.rng = () => 0; // force ignition
    const sys = new FireSystem();
    sys.update(w);
    
    expect(w.layers.fire[i]).toBeGreaterThan(0);
  });

  it('fires spread to neighbors', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    const ni = w.grid.idx(5, 6);
    forceBuildable(w, 5, 5);
    forceBuildable(w, 5, 6);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = 1;
    w.layers.zone[ni] = ZONE_R;
    w.layers.devLevel[ni] = 1;
    
    w.layers.fire[i] = 10;
    
    let rngCalls = 0;
    w.rng = () => {
      rngCalls++;
      if (rngCalls === 1) return 0.02; // spread check < spreadProbability (0.04)
      if (rngCalls === 2) return 0.8;  // neighbor index 3: [tx, ty+1] = [5, 6]
      return 0.5;
    };
    
    const sys = new FireSystem();
    sys.update(w);
    
    expect(w.layers.fire[ni]).toBeGreaterThan(0);
  });

  it('fire stations put out fires faster', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    w.layers.fire[i] = 20;
    w.layers.fireStation[i] = 1;
    
    const sys = new FireSystem();
    sys.update(w);
    
    expect(w.layers.fire[i]).toBe(15);
  });
});

describe('Fire integration', () => {
  it('service system populates fireStation layer', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.building[w.grid.idx(5, 5)] = BUILDING_FIRE;
    w.buildings = [{ tx: 5, ty: 5, kind: BUILDING_FIRE }];
    
    new ServiceSystem().update(w);
    expect(w.layers.fireStation[w.grid.idx(5, 5)]).toBe(1);
  });

  it('active fire causes abandonment via AbandonmentSystem', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = 1;
    w.layers.power[i] = 1;
    w.layers.water[i] = 1;
    w.layers.fire[i] = 10;
    
    const sys = new AbandonmentSystem();
    const intervals = Math.ceil(BALANCE.abandonment.abandonThreshold / 2) + 1;
    for(let k = 0; k < intervals * BALANCE.abandonment.distressInterval; k++) {
      w.tick = k;
      sys.update(w);
      if (w.layers.abandoned[i]) break;
    }
    
    expect(w.layers.abandoned[i]).toBe(1);
  });
});

describe('FireSystem: fireReport sums up the fires no fire station reaches', () => {
  type Report = { burning: number; started: number; damaged: number; tx: number; ty: number };
  const COOLDOWN = BALANCE.fire.reportCooldownTicks;

  function town() {
    const w = new World(16, 16, 0);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) forceBuildable(w, x, y);
    const reports: Report[] = [];
    w.events.on('fireReport', p => { reports.push({ ...(p as unknown as Report) }); });
    // No chance ignitions or spreads: the tests light their own fires.
    w.rng = () => 0.999;
    return { w, reports, sys: new FireSystem() };
  }
  function house(w: World, tx: number, ty: number, level = 2) {
    const i = w.grid.idx(tx, ty);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = level;
    return i;
  }
  function tick(w: World, sys: FireSystem, n = 1) { for (let k = 0; k < n; k++) { w.tick++; sys.update(w); } }

  it('says nothing while nothing burns', () => {
    const { w, reports, sys } = town();
    house(w, 3, 3);
    tick(w, sys, 3 * COOLDOWN);
    expect(reports).toEqual([]);
  });

  it('says nothing about a fire a fire station reaches', () => {
    const { w, reports, sys } = town();
    const i = house(w, 3, 3);
    w.layers.fireStation[i] = 1;
    w.setFire(3, 3, BALANCE.fire.burnDuration);
    tick(w, sys, 3 * COOLDOWN);
    expect(w.layers.fire[i]).toBe(0);
    expect(w.layers.devLevel[i]).toBe(2);
    expect(reports).toEqual([]);
  });

  it('reports an uncovered fire at once, with its tile', () => {
    const { w, reports, sys } = town();
    house(w, 3, 3);
    house(w, 9, 4);
    w.setFire(3, 3, BALANCE.fire.burnDuration);
    w.setFire(9, 4, BALANCE.fire.burnDuration);
    tick(w, sys);
    expect(reports).toHaveLength(1);
    expect(reports[0].burning).toBe(2);
    expect(reports[0].damaged).toBe(0);
  });

  it('reports at most once per cooldown, and folds the damage into the next report', () => {
    const { w, reports, sys } = town();
    const i = house(w, 3, 3);
    w.setFire(3, 3, BALANCE.fire.burnDuration);
    tick(w, sys);
    expect(reports).toHaveLength(1);
    tick(w, sys, COOLDOWN - 1);                      // the fire burns out and damages the house meanwhile
    expect(w.layers.devLevel[i]).toBe(1);
    expect(reports).toHaveLength(1);
    tick(w, sys);
    expect(reports).toHaveLength(2);
    expect(reports[1]).toEqual({ burning: 0, started: 0, damaged: 1, tx: 3, ty: 3 });
    tick(w, sys, 3 * COOLDOWN);                      // nothing more to say
    expect(reports).toHaveLength(2);
  });

  it('marks an ignition as covered or not, and counts only uncovered ones as started', () => {
    const { w, reports, sys } = town();
    const a = house(w, 3, 3), c = house(w, 9, 9);
    w.layers.fireStation[c] = 1;
    const seen: { tx: number; covered?: boolean }[] = [];
    w.events.on('fireIgnition', p => { seen.push({ tx: p.tx as number, covered: p.covered as boolean }); });
    w.layers.fireRisk[a] = 255; w.layers.fireRisk[c] = 255;
    w.rng = () => 0;                                  // everything that can ignite does
    tick(w, sys);
    expect(seen).toEqual([{ tx: 3, covered: false }, { tx: 9, covered: true }]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ burning: 1, started: 1, tx: 3, ty: 3 });
  });
});
