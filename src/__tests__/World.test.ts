import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import {
  TERRAIN_WATER,
  ZONE_NONE, ZONE_R, ZONE_C,
  ROAD_NONE, ROAD_STREET,
  BUILDING_NONE, BUILDING_POWER_PLANT,
} from '../sim/constants';
import { BALANCE } from '../data/balance';

// A small world with a known-grass tile at (0,0) is faster to construct
// than a full 256×256 world. We use seed 999 which keeps (0,0) as grass.
function makeWorld(seed = 999) {
  return new World(32, 32, seed);
}

// Find a grass tile guaranteed to not be water in our 32×32 test world.
function grassTile(w: World): { tx: number; ty: number } {
  for (let ty = 0; ty < w.grid.height; ty++) {
    for (let tx = 0; tx < w.grid.width; tx++) {
      if (w.isBuildable(tx, ty)) return { tx, ty };
    }
  }
  throw new Error('no buildable tile found');
}

describe('World construction', () => {
  it('starts with the configured money', () => {
    const w = makeWorld();
    expect(w.budget.money).toBe(BALANCE.startingMoney);
  });

  it('tick starts at 0', () => {
    const w = makeWorld();
    expect(w.tick).toBe(0);
  });

  it('all layers have length width×height', () => {
    const w = makeWorld();
    const n = w.grid.width * w.grid.height;
    for (const layer of Object.values(w.layers)) {
      expect(layer.length).toBe(n);
    }
  });

  it('terrain generation is deterministic — same seed same map', () => {
    const a = new World(32, 32, 42);
    const b = new World(32, 32, 42);
    expect(Array.from(a.layers.terrain)).toEqual(Array.from(b.layers.terrain));
  });

  it('terrain generation differs across seeds', () => {
    const a = new World(32, 32, 1);
    const b = new World(32, 32, 2);
    expect(Array.from(a.layers.terrain)).not.toEqual(Array.from(b.layers.terrain));
  });
});

describe('World.setZone', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('sets the zone byte on a buildable tile', () => {
    const ok = w.setZone(tx, ty, ZONE_R);
    expect(ok).toBe(true);
    expect(w.getZone(tx, ty)).toBe(ZONE_R);
  });

  it('returns false and does nothing on water', () => {
    // find a water tile
    for (let y = 0; y < w.grid.height; y++) {
      for (let x = 0; x < w.grid.width; x++) {
        if (w.layers.terrain[w.grid.idx(x, y)] === TERRAIN_WATER) {
          const ok = w.setZone(x, y, ZONE_R);
          expect(ok).toBe(false);
          expect(w.getZone(x, y)).toBe(ZONE_NONE);
          return;
        }
      }
    }
  });

  it('resets devLevel when zone type changes', () => {
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[w.grid.idx(tx, ty)] = 2;
    w.setZone(tx, ty, ZONE_C);
    expect(w.layers.devLevel[w.grid.idx(tx, ty)]).toBe(0);
  });

  it('does not reset devLevel when zone type stays the same', () => {
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[w.grid.idx(tx, ty)] = 2;
    w.setZone(tx, ty, ZONE_R);
    expect(w.layers.devLevel[w.grid.idx(tx, ty)]).toBe(2);
  });
});

describe('World.setRoad', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('sets the road byte on a buildable tile', () => {
    const ok = w.setRoad(tx, ty, ROAD_STREET);
    expect(ok).toBe(true);
    expect(w.getRoad(tx, ty)).toBe(ROAD_STREET);
  });

  it('clears any existing zone when road is placed', () => {
    w.setZone(tx, ty, ZONE_R);
    w.setRoad(tx, ty, ROAD_STREET);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
  });

  it('marks roadNetDirty when road changes', () => {
    w.roadNetDirty = false;
    w.setRoad(tx, ty, ROAD_STREET);
    expect(w.roadNetDirty).toBe(true);
  });
});

describe('World.placeBuilding', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('places a power plant and adds it to the list', () => {
    const ok = w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    expect(ok).toBe(true);
    expect(w.getBuilding(tx, ty)).toBe(BUILDING_POWER_PLANT);
    expect(w.powerPlants).toHaveLength(1);
    expect(w.powerPlants[0]).toEqual({ tx, ty });
  });

  it('clears zone and road on the tile', () => {
    w.setZone(tx, ty, ZONE_R);
    w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.getRoad(tx, ty)).toBe(ROAD_NONE);
  });

  it('returns false if tile is already occupied by a building', () => {
    w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    const ok = w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    expect(ok).toBe(false);
    expect(w.powerPlants).toHaveLength(1);
  });
});

describe('World.clearTile', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('clears zone, road, building, and devLevel', () => {
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[w.grid.idx(tx, ty)] = 3;
    w.clearTile(tx, ty);
    const i = w.grid.idx(tx, ty);
    expect(w.layers.zone[i]).toBe(ZONE_NONE);
    expect(w.layers.roadClass[i]).toBe(ROAD_NONE);
    expect(w.layers.building[i]).toBe(BUILDING_NONE);
    expect(w.layers.devLevel[i]).toBe(0);
  });

  it('removes power plant from list when cleared', () => {
    w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    expect(w.powerPlants).toHaveLength(1);
    w.clearTile(tx, ty);
    expect(w.powerPlants).toHaveLength(0);
  });

  it('marks roadNetDirty when a road is cleared', () => {
    w.setRoad(tx, ty, ROAD_STREET);
    w.roadNetDirty = false;
    w.clearTile(tx, ty);
    expect(w.roadNetDirty).toBe(true);
  });
});
