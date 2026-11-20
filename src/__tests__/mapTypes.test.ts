// Map types for a new city (sim/terrainGen.ts): River, Coastal, Lakes, Bay
// and Random. Each is the same for the same seed, leaves enough land, keeps a
// dry start area at the middle of the map joined to a good share of it, and
// has its forests in patches. The classic generator is what a World gets when
// no type is passed, unchanged.

import { describe, it, expect } from 'vitest';
import { World, type WaterAmount } from '../sim/World';
import { BUILDING_SEAPORT, TERRAIN_GRASS, TERRAIN_SAND, TERRAIN_WATER, VEG_NONE } from '../sim/constants';
import { MAP_KINDS, MIN_LAND, START, landFromStart, mapKindFor, type MapKind } from '../sim/terrainGen';
import { openWaterOf } from '../sim/openWater';

const WATERS: WaterAmount[] = ['low', 'medium', 'high'];
const SEEDS = [1, 2, 3, 7, 42, 99, 1234, 55555, 987654321, 4294967295];

const same = (a: World, b: World): boolean =>
  a.layers.terrain.every((v, i) => v === b.layers.terrain[i]) && a.layers.vegetation.every((v, i) => v === b.layers.vegetation[i]);

function count(layer: Uint8Array, test: (v: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < layer.length; i++) if (test(layer[i])) n++;
  return n;
}

/** Share of trees with at least three trees among their eight neighbours: high when trees stand in woods, low when scattered. */
function clumped(w: World): number {
  const { width, height } = w.grid, v = w.layers.vegetation;
  let trees = 0, inWood = 0;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    if (v[y * width + x] === VEG_NONE) continue;
    trees++;
    let near = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && v[(y + dy) * width + x + dx] !== VEG_NONE) near++;
    if (near >= 3) inWood++;
  }
  return trees ? inWood / trees : 0;
}

/** Share of the map's 16×16 blocks of dry land that have at most two trees: open country. */
function openBlocks(w: World): number {
  const { width, height } = w.grid, v = w.layers.vegetation, t = w.layers.terrain;
  let blocks = 0, open = 0;
  for (let by = 0; by + 16 <= height; by += 16) for (let bx = 0; bx + 16 <= width; bx += 16) {
    let trees = 0, wet = 0;
    for (let y = by; y < by + 16; y++) for (let x = bx; x < bx + 16; x++) {
      if (v[y * width + x] !== VEG_NONE) trees++;
      if (t[y * width + x] === TERRAIN_WATER) wet++;
    }
    if (wet > 0) continue;
    blocks++;
    if (trees <= 2) open++;
  }
  return blocks ? open / blocks : 0;
}

describe('the classic map', () => {
  it('is what a World gets with no map type, and with "classic"', () => {
    const plain = new World(96, 96, 7, { waterAmount: 'high', vegAmount: 'medium' });
    const named = new World(96, 96, 7, { waterAmount: 'high', vegAmount: 'medium', mapType: 'classic' });
    expect(same(plain, named)).toBe(true);
    expect(mapKindFor('classic', 7)).toBeNull();
  });

  it('is not what any new type draws', () => {
    const classic = new World(96, 96, 7);
    for (const kind of MAP_KINDS) expect(same(classic, new World(96, 96, 7, { mapType: kind }))).toBe(false);
  });
});

describe.each(MAP_KINDS)('a %s map', (kind: MapKind) => {
  it('is the same for the same seed and settings, and different for another seed', () => {
    for (const water of WATERS) {
      const a = new World(128, 128, 31, { mapType: kind, waterAmount: water, vegAmount: 'medium' });
      const b = new World(128, 128, 31, { mapType: kind, waterAmount: water, vegAmount: 'medium' });
      expect(same(a, b)).toBe(true);
    }
    const a = new World(128, 128, 31, { mapType: kind }), c = new World(128, 128, 32, { mapType: kind });
    expect(a.layers.terrain.every((v, i) => v === c.layers.terrain[i])).toBe(false);
  });

  it('has water, enough land, and a dry start area joined to a good share of the map', () => {
    for (const size of [128, 256]) for (const water of WATERS) for (const seed of SEEDS) {
      const w = new World(size, size, seed, { mapType: kind, waterAmount: water });
      const t = w.layers.terrain, n = size * size, tag = `${kind} ${size} ${water} seed ${seed}`;
      const wet = count(t, (v) => v === TERRAIN_WATER);
      expect(wet, tag).toBeGreaterThan(0);
      expect((n - wet) / n, tag).toBeGreaterThanOrEqual(MIN_LAND);
      expect(landFromStart(t, size, size) / n, tag).toBeGreaterThanOrEqual(START.minLandShare);
      // The start area: land, and no trees, for START.radius tiles round the middle.
      const mid = size / 2;
      for (let y = mid - START.radius; y <= mid + START.radius; y++) for (let x = mid - START.radius; x <= mid + START.radius; x++) {
        if ((x - mid) ** 2 + (y - mid) ** 2 > START.radius ** 2) continue;
        expect(t[y * size + x], tag).not.toBe(TERRAIN_WATER);
        expect(w.layers.vegetation[y * size + x], tag).toBe(VEG_NONE);
      }
      // Buildable land (not water) the player can use at once, around the start.
      expect(w.isBuildable(mid, mid), tag).toBe(true);
    }
  });

  it('has sand along its shores and trees only on grass', () => {
    const w = new World(128, 128, 5, { mapType: kind, vegAmount: 'high' });
    const t = w.layers.terrain, N = 128;
    expect(count(t, (v) => v === TERRAIN_SAND)).toBeGreaterThan(0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (w.layers.vegetation[i] !== VEG_NONE) expect(t[i]).toBe(TERRAIN_GRASS);
      if (t[i] !== TERRAIN_GRASS) continue;
      // Grass never touches water: there is sand between.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N) expect(t[ny * N + nx]).not.toBe(TERRAIN_WATER);
      }
    }
  });

  it('has its forests in patches, more of them with more vegetation', () => {
    const low = new World(256, 256, 11, { mapType: kind, vegAmount: 'low' });
    const high = new World(256, 256, 11, { mapType: kind, vegAmount: 'high' });
    const trees = (w: World): number => count(w.layers.vegetation, (v) => v !== VEG_NONE);
    expect(trees(low)).toBeGreaterThan(0);
    expect(trees(high)).toBeGreaterThan(trees(low) * 1.5);
    expect(clumped(low)).toBeGreaterThan(0.75);
    // Woods and open country: far more of the land is nearly treeless than on the classic map, which has small clusters everywhere.
    expect(openBlocks(low)).toBeGreaterThan(0.3);
    expect(openBlocks(low)).toBeGreaterThan(openBlocks(new World(256, 256, 11, { vegAmount: 'low' })) * 2);
    // Every species turns up.
    for (let sp = 1; sp <= 6; sp++) expect(count(high.layers.vegetation, (v) => v === sp)).toBeGreaterThan(0);
  });

  it('still starts dry on a small, very wet map', () => {
    for (const seed of SEEDS) {
      const w = new World(64, 64, seed, { mapType: kind, waterAmount: 'high' });
      expect(landFromStart(w.layers.terrain, 64, 64)).toBeGreaterThan(0);
      expect(w.isBuildable(32, 32)).toBe(true);
    }
  });
});

describe('the sea', () => {
  it.each(['coastal', 'bay'] as const)('a %s map has water open to the map edge, and room for a seaport', (kind) => {
    for (const seed of SEEDS) {
      const w = new World(128, 128, seed, { mapType: kind });
      expect(openWaterOf(w.layers.terrain, 128, 128).some((v) => v === 1), `${kind} seed ${seed}`).toBe(true);
      let fits = false;
      for (let y = 0; y < 128 && !fits; y++) for (let x = 0; x < 128 && !fits; x++) {
        if (w.layers.terrain[y * 128 + x] !== TERRAIN_SAND) continue;       // a seaport's yard starts at the shore
        for (let rot = 0; rot < 4 && !fits; rot++) fits = w.canPlaceBuilding(x, y, BUILDING_SEAPORT, rot);
      }
      expect(fits, `${kind} seed ${seed}: somewhere a seaport fits`).toBe(true);
    }
  });

  it('a river reaches the edge of the map too', () => {
    for (const seed of SEEDS) {
      const w = new World(128, 128, seed, { mapType: 'river' });
      expect(openWaterOf(w.layers.terrain, 128, 128).some((v) => v === 1)).toBe(true);
    }
  });
});

describe('a random map', () => {
  it('is one of the four kinds, chosen by the seed, and every kind comes up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const kind = mapKindFor('random', seed)!;
      seen.add(kind);
      if (seed <= 6) expect(same(new World(96, 96, seed, { mapType: 'random' }), new World(96, 96, seed, { mapType: kind }))).toBe(true);
    }
    expect([...seen].sort()).toEqual([...MAP_KINDS].sort());
  });
});
