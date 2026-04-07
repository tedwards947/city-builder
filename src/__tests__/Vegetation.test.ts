import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import {
  TERRAIN_WATER, TERRAIN_GRASS,
  ZONE_R, ZONE_NONE,
  ROAD_STREET, ROAD_NONE,
  BUILDING_POWER_PLANT, BUILDING_NONE,
  VEG_NONE, VEG_TREE_1,
} from '../sim/constants';

describe('Vegetation generation', () => {
  it('generates trees on a new world', () => {
    const w = new World(64, 64, 123);
    let treeCount = 0;
    for (let i = 0; i < w.grid.width * w.grid.height; i++) {
      if (w.layers.vegetation[i] !== VEG_NONE) treeCount++;
    }
    expect(treeCount).toBeGreaterThan(0);
  });

  it('does not generate trees on water', () => {
    const w = new World(64, 64, 123);
    for (let i = 0; i < w.grid.width * w.grid.height; i++) {
      if (w.layers.terrain[i] === TERRAIN_WATER) {
        expect(w.layers.vegetation[i]).toBe(VEG_NONE);
      }
    }
  });

  it('is deterministic with the same seed', () => {
    const a = new World(32, 32, 42);
    const b = new World(32, 32, 42);
    expect(Array.from(a.layers.vegetation)).toEqual(Array.from(b.layers.vegetation));
  });

  it('differs across seeds', () => {
    const a = new World(32, 32, 1);
    const b = new World(32, 32, 2);
    expect(Array.from(a.layers.vegetation)).not.toEqual(Array.from(b.layers.vegetation));
  });

  it('shows shoreline bias (higher density near water)', () => {
    const w = new World(64, 64, 123);
    let nearWaterCount = 0;
    let nearWaterTrees = 0;
    let farWaterCount = 0;
    let farWaterTrees = 0;

    for (let y = 0; y < w.grid.height; y++) {
      for (let x = 0; x < w.grid.width; x++) {
        const i = w.grid.idx(x, y);
        if (w.layers.terrain[i] === TERRAIN_WATER) continue;

        let nearWater = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (w.grid.inBounds(nx, ny)) {
              if (w.layers.terrain[w.grid.idx(nx, ny)] === TERRAIN_WATER) {
                nearWater = true;
                break;
              }
            }
          }
          if (nearWater) break;
        }

        if (nearWater) {
          nearWaterCount++;
          if (w.layers.vegetation[i] !== VEG_NONE) nearWaterTrees++;
        } else {
          farWaterCount++;
          if (w.layers.vegetation[i] !== VEG_NONE) farWaterTrees++;
        }
      }
    }

    const nearRate = nearWaterTrees / nearWaterCount;
    const farRate = farWaterTrees / farWaterCount;
    expect(nearRate).toBeLessThan(farRate);
  });
});

describe('Vegetation clearing', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = new World(32, 32, 123);
    // Find a tile with trees.
    for (let y = 0; y < w.grid.height; y++) {
      for (let x = 0; x < w.grid.width; x++) {
        if (w.layers.vegetation[w.grid.idx(x, y)] !== VEG_NONE) {
          tx = x; ty = y;
          return;
        }
      }
    }
  });

  it('clears vegetation when a zone is placed', () => {
    w.setZone(tx, ty, ZONE_R);
    expect(w.getVegetation(tx, ty)).toBe(VEG_NONE);
  });

  it('clears vegetation when a road is placed', () => {
    w.setRoad(tx, ty, ROAD_STREET);
    expect(w.getVegetation(tx, ty)).toBe(VEG_NONE);
  });

  it('clears vegetation when a building is placed', () => {
    w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    expect(w.getVegetation(tx, ty)).toBe(VEG_NONE);
  });

  it('clears vegetation when clearTile is called', () => {
    w.clearTile(tx, ty);
    expect(w.getVegetation(tx, ty)).toBe(VEG_NONE);
  });
});
