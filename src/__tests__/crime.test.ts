import { describe, it, expect, vi } from 'vitest';
import { World } from '../sim/World';
import { CrimeSystem } from '../sim/systems/CrimeSystem';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { CanvasRenderer } from '../render/CanvasRenderer';
import {
  ZONE_R, ZONE_C, ZONE_I,
  BUILDING_POLICE,
  ROAD_STREET,
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
  world.layers.crime[i] = 0;
  world.layers.police[i] = 0;
}

describe('CrimeSystem', () => {
  it('generates crime in developed zones', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = 1;
    
    const sys = new CrimeSystem();
    // Run several times to allow smoothing to ramp up
    for(let k = 0; k < 20; k++) sys.update(w);
    
    expect(w.layers.crime[i]).toBeGreaterThan(0);
  });

  it('higher density generates more crime', () => {
    const w1 = makeWorld(), w2 = makeWorld();
    const i = w1.grid.idx(5, 5);
    forceBuildable(w1, 5, 5); w1.layers.zone[i] = ZONE_R; w1.layers.devLevel[i] = 1;
    forceBuildable(w2, 5, 5); w2.layers.zone[i] = ZONE_R; w2.layers.devLevel[i] = 3;
    
    const sys = new CrimeSystem();
    for(let k = 0; k < 50; k++) {
      sys.update(w1);
      sys.update(w2);
    }
    
    expect(w2.layers.crime[i]).toBeGreaterThan(w1.layers.crime[i]);
  });

  it('police coverage significantly reduces crime', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = 3;
    
    const sys = new CrimeSystem();
    // Ramping up crime without police
    for(let k = 0; k < 50; k++) sys.update(w);
    const highCrime = w.layers.crime[i];
    
    // Add police coverage
    w.layers.police[i] = 1;
    for(let k = 0; k < 50; k++) sys.update(w);
    
    expect(w.layers.crime[i]).toBeLessThan(highCrime);
    // Should be roughly 15% of the target
    expect(w.layers.crime[i]).toBeLessThan(60); 
  });

  it('crime decays when zone is removed', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    w.layers.crime[i] = 100;
    
    const sys = new CrimeSystem();
    sys.update(w);
    expect(w.layers.crime[i]).toBeLessThan(100);
  });
});

describe('Crime integration with other systems', () => {
  it('service system populates police layer', () => {
    const w = makeWorld();
    forceBuildable(w, 5, 5);
    w.layers.building[w.grid.idx(5, 5)] = BUILDING_POLICE;
    w.serviceBuildings = [{ tx: 5, ty: 5, kind: BUILDING_POLICE }];
    
    new ServiceSystem().update(w);
    expect(w.layers.police[w.grid.idx(5, 5)]).toBe(1);
  });

  it('high crime causes abandonment via AbandonmentSystem', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = 1;
    w.layers.power[i] = 1;
    w.layers.water[i] = 1;
    w.layers.crime[i] = BALANCE.crime.abandonThreshold + 10;
    
    const sys = new AbandonmentSystem();
    // Run enough times to exceed abandonment threshold
    const intervals = BALANCE.abandonment.abandonThreshold + 1;
    for(let k = 0; k < intervals * BALANCE.abandonment.distressInterval; k++) {
      w.tick = k;
      sys.update(w);
    }
    
    expect(w.layers.abandoned[i]).toBe(1);
  });

  it('high crime blocks growth in ZoneGrowthSystem', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    forceBuildable(w, 5, 5);
    w.layers.zone[i] = ZONE_R;
    w.layers.devLevel[i] = 1;
    w.layers.power[i] = 1;
    w.layers.water[i] = 1;
    w.layers.crime[i] = BALANCE.crime.growthThreshold + 10;
    
    // Add road for growth
    forceBuildable(w, 5, 6);
    w.layers.roadClass[w.grid.idx(5, 6)] = ROAD_STREET;
    new NetworkSystem().update(w);
    
    w.stats.powerSupply = 999;
    w.stats.waterSupply = 999;
    w.stats.rDemand = 2.0;
    
    const sys = new ZoneGrowthSystem();
    w.rng = () => 0; // force growth
    w.tick = 0;
    sys.update(w);
    
    expect(w.layers.devLevel[i]).toBe(1); // Blocked, did not grow to 2
  });

  it('CanvasRenderer.render accepts crimeOverlay parameter', () => {
    const w = makeWorld();
    const camera = {
      visibleTileBounds: () => ({ x0: 0, y0: 0, x1: 5, y1: 5 }),
      worldToScreen: () => ({ sx: 0, sy: 0 }),
      worldToScreenX: () => 0,
      worldToScreenY: () => 0,
      zoom: 1
    } as any;
    const mockCtx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      measureText: () => ({ width: 10 }),
      setLineDash: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      strokeRect: vi.fn(),
    } as any;
    const canvas = { getContext: () => mockCtx, width: 800, height: 600 } as any;
    const renderer = new CanvasRenderer(canvas);
    
    // Verify it doesn't throw when crimeOverlay is true
    expect(() => {
      renderer.render(w, camera, null, false, true, false, null, 0);
    }).not.toThrow();
  });
});
