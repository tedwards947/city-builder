import { describe, it, expect, vi } from 'vitest';
import { World } from '../sim/World';
import { FireSystem } from '../sim/systems/FireSystem';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import {
  ZONE_R, ZONE_C, ZONE_I,
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
      if (rngCalls === 1) return 0.05; // spread check < spreadProbability (0.1)
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
    w.serviceBuildings = [{ tx: 5, ty: 5, kind: BUILDING_FIRE }];
    
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
