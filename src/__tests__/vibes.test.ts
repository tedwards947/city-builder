import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { BALANCE } from '../data/balance';
import {
  ZONE_R, ZONE_I,
  BUILDING_PARK,
} from '../sim/constants';

describe('Localized Vibe System', () => {
  let world: World;
  let vibeSystem: VibeSystem;

  beforeEach(() => {
    world = new World(16, 16, 42);
    vibeSystem = new VibeSystem();
  });

  describe('Initialization', () => {
    it('initializes vibe layers to neutral (128)', () => {
      const n = world.grid.width * world.grid.height;
      for (let i = 0; i < n; i++) {
        expect(world.layers.vibeGreen[i]).toBe(128);
        expect(world.layers.vibeEgalitarian[i]).toBe(128);
        expect(world.layers.vibePlanned[i]).toBe(128);
      }
    });
  });

  describe('Spatial Nudges', () => {
    it('nudges vibeGreen positive when a park is placed', () => {
      vibeSystem.update(world); // Register listeners
      world.placeBuilding(5, 5, BUILDING_PARK);
      world.events.emit('buildingPlaced', { tx: 5, ty: 5, kind: BUILDING_PARK });
      
      const i = world.grid.idx(5, 5);
      expect(world.layers.vibeGreen[i]).toBeGreaterThan(128);
      expect(world.layers.vibeEgalitarian[i]).toBeGreaterThan(128);
    });

    it('nudges vibeGreen negative when industrial zone is painted', () => {
      vibeSystem.update(world);
      world.setZone(2, 2, ZONE_I);
      world.events.emit('zonePainted', { tx: 2, ty: 2, zone: ZONE_I });
      
      const i = world.grid.idx(2, 2);
      expect(world.layers.vibeGreen[i]).toBeLessThan(128);
    });
  });

  describe('Diffusion and Decay', () => {
    it('diffuses vibes to neighboring tiles over time', () => {
      vibeSystem.update(world);
      
      // Manually set a strong vibe at center
      const centerIdx = world.grid.idx(8, 8);
      world.layers.vibeGreen[centerIdx] = 255;
      
      // Run simulation for several cycles (simulation runs every 4 ticks)
      for (let t = 0; t < 20; t++) {
        world.tick = t;
        vibeSystem.update(world);
      }
      
      // Neighbor should now have some green vibe
      const neighborIdx = world.grid.idx(8, 9);
      expect(world.layers.vibeGreen[neighborIdx]).toBeGreaterThan(128);
      expect(world.layers.vibeGreen[neighborIdx]).toBeLessThan(255);
    });

    it('decays vibes back toward neutral (128) when sources are gone', () => {
      const i = world.grid.idx(5, 5);
      world.layers.vibeGreen[i] = 200;
      
      // Run many ticks
      for (let t = 0; t < 100; t++) {
        world.tick = t;
        vibeSystem.update(world);
      }
      
      expect(world.layers.vibeGreen[i]).toBeLessThan(200);
      expect(world.layers.vibeGreen[i]).toBeGreaterThanOrEqual(128);
    });
  });

  describe('Nudge scaling', () => {
    it('a single zone paint moves the tile modestly instead of saturating it', () => {
      vibeSystem.update(world);
      const i = world.grid.idx(4, 4);
      world.events.emit('zonePainted', { tx: 4, ty: 4, zone: ZONE_R });
      for (const layer of [world.layers.vibeEgalitarian, world.layers.vibeGreen, world.layers.vibePlanned]) {
        expect(layer[i]).toBeGreaterThan(128);
        expect(layer[i]).toBeLessThanOrEqual(128 + BALANCE.vibe.nudgeMaxBytes);
      }
      world.events.emit('zonePainted', { tx: 6, ty: 6, zone: ZONE_I });
      const j = world.grid.idx(6, 6);
      expect(world.layers.vibeGreen[j]).toBeLessThan(128);
      expect(world.layers.vibeGreen[j]).toBeGreaterThanOrEqual(128 - BALANCE.vibe.nudgeMaxBytes);
    });

    it('caps even a very large nudge at nudgeMaxBytes', () => {
      vibeSystem.update(world);
      world.events.emit('tileCleared', { tx: 3, ty: 3, displacedPopulation: 20 });
      const i = world.grid.idx(3, 3);
      expect(world.layers.vibeEgalitarian[i]).toBe(128 - BALANCE.vibe.nudgeMaxBytes);
    });
  });

  describe('Decay of uniform regions', () => {
    it('a uniformly non-neutral map decays all the way back to 128', () => {
      world.layers.vibeGreen.fill(200);
      world.layers.vibePlanned.fill(60);
      // Expected (200-128) / decayProbability steps; run 3× that for margin.
      const steps = Math.ceil((72 / BALANCE.vibe.decayProbability) * 3);
      for (let s = 1; s <= steps; s++) {
        world.tick = s * BALANCE.vibe.simInterval;
        vibeSystem.update(world);
      }
      const n = world.grid.width * world.grid.height;
      for (let i = 0; i < n; i++) {
        expect(world.layers.vibeGreen[i]).toBe(128);
        expect(world.layers.vibePlanned[i]).toBe(128);
      }
    });

    it('a neutral map stays neutral and consumes no rng', () => {
      const before = world.rng();
      const w2 = new World(16, 16, 42);
      for (let t = 0; t < 40; t++) { w2.tick = t; vibeSystem.update(w2); }
      expect(w2.rng()).toBe(before);
      expect(w2.layers.vibeGreen.every(v => v === 128)).toBe(true);
    });
  });

  describe('Global Averaging (Legacy Support)', () => {
    it('updates global world.character based on averages of spatial layers', () => {
      // Set half the map to max green
      const n = world.grid.width * world.grid.height;
      for (let i = 0; i < n / 2; i++) {
        world.layers.vibeGreen[i] = 255;
      }
      
      vibeSystem.update(world);
      
      // Global green axis should now be positive
      expect(world.character.green).toBeGreaterThan(0);
    });
  });

  describe('Bootstrapping', () => {
    it('seeds vibes correctly from existing infrastructure', () => {
      // Pre-set a park and industrial zone without emitting events
      world.layers.building[world.grid.idx(2, 2)] = BUILDING_PARK;
      world.layers.zone[world.grid.idx(10, 10)] = ZONE_I;
      
      vibeSystem.bootstrapVibes(world);
      
      expect(world.layers.vibeGreen[world.grid.idx(2, 2)]).toBeGreaterThan(128);
      expect(world.layers.vibeGreen[world.grid.idx(10, 10)]).toBeLessThan(128);
    });
  });

  describe('World Fire Counter', () => {
    it('increments and decrements fireCount in World', () => {
      expect(world.fireCount).toBe(0);
      world.setFire(5, 5, 100);
      expect(world.fireCount).toBe(1);
      expect(world.hasFires).toBe(true);
      
      world.setFire(5, 5, 0);
      expect(world.fireCount).toBe(0);
      expect(world.hasFires).toBe(false);
    });

    it('recomputes fireCount from layer data', () => {
      world.layers.fire[world.grid.idx(1, 1)] = 50;
      world.layers.fire[world.grid.idx(2, 2)] = 100;
      // Counter is still 0 because we bypassed setFire
      expect(world.fireCount).toBe(0);
      
      world.recomputeFireCount();
      expect(world.fireCount).toBe(2);
    });
  });
});
