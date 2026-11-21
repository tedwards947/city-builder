// The engine items of the outside code review (docs/REVIEW_2026-11-21.md):
// P1 (systems mark only what changed), A2 (a load does not generate a map),
// and the politics census (one pass for the four satisfaction factors).

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { BUILDING_POWER_PLANT, BUILDING_POLICE, ROAD_STREET, TERRAIN_WATER, VEG_NONE, ZONE_R, ZONE_C } from '../sim/constants';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { PowerSystem } from '../sim/systems/PowerSystem';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { SewageSystem } from '../sim/systems/SewageSystem';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { PoliticsSystem } from '../sim/systems/PoliticsSystem';
import { markLayerChanges } from '../sim/layerDirty';
import { serialize, deserialize } from '../persistence/Serializer';
import { CHUNK_SIZE } from '../sim/Grid';
import { landWorld, homes } from './pcTestWorld';

describe('P1: coverage systems mark only what changed', () => {
  let w: World;
  const systems = [new NetworkSystem(), new PowerSystem(), new WaterSystem(), new SewageSystem(), new ServiceSystem()];
  const tick = () => { w.tick++; for (const s of systems) s.update(w); };

  beforeEach(() => {
    w = landWorld(64);
    for (let x = 2; x <= 60; x++) w.setRoad(x, 20, ROAD_STREET);
    homes(w, 4, 19, 30, 19, 2);
    w.placeBuilding(40, 21, BUILDING_POWER_PLANT);
    tick();                                   // the first tick marks everything
    w.grid.clearDirty();
  });

  it('a tick on which nothing changed marks no chunk and leaves `edits` alone', () => {
    const edits = w.grid.edits;
    for (let k = 0; k < 5; k++) tick();
    expect(w.grid.dirtyChunks.size).toBe(0);
    expect(w.grid.edits).toBe(edits);
  });

  it('a change in coverage marks the chunks it touches, and no others', () => {
    w.placeBuilding(10, 21, BUILDING_POLICE);          // marks its own tile's chunk
    w.grid.clearDirty();
    tick();
    const dirty = [...w.grid.dirtyChunks];
    expect(dirty.length).toBeGreaterThan(0);
    // Police range is 15 road steps from x = 10: nothing east of x = 27 changes, so no chunk in the last column.
    const cols = w.grid.chunkCols;
    for (const id of dirty) expect(id % cols).toBeLessThan(Math.ceil(32 / CHUNK_SIZE));
    // And the next tick is quiet again.
    w.grid.clearDirty();
    tick();
    expect(w.grid.dirtyChunks.size).toBe(0);
  });

  it('losing power marks the tiles that lost it', () => {
    expect(w.layers.power[w.grid.idx(10, 19)]).toBe(1);
    w.clearTile(40, 21);
    w.grid.clearDirty();
    tick();
    expect(w.layers.power[w.grid.idx(10, 19)]).toBe(0);
    expect(w.grid.dirtyChunks.has(w.grid.chunkIdOf(10, 19))).toBe(true);
  });

  it('markLayerChanges: everything the first time, then one mark per changed tile\'s chunk, whatever the map\'s size', () => {
    const odd = new World(21, 13, 3, {}, false);       // 273 tiles: not a multiple of four
    const layer = new Uint8Array(21 * 13);
    markLayerChanges(odd, layer);
    expect(odd.grid.dirtyChunks.size).toBe(odd.grid.chunkCols * odd.grid.chunkRows);
    odd.grid.clearDirty();
    markLayerChanges(odd, layer);
    expect(odd.grid.dirtyChunks.size).toBe(0);
    layer[272] = 1;                                    // the very last tile (in the tail past the last whole word)
    layer[5] = 1;
    markLayerChanges(odd, layer);
    expect([...odd.grid.dirtyChunks].sort()).toEqual([odd.grid.chunkIdOf(5, 0), odd.grid.chunkIdOf(20, 12)].sort());
    odd.grid.clearDirty();
    markLayerChanges(odd, layer);
    expect(odd.grid.dirtyChunks.size).toBe(0);
  });
});

describe('A2: loading a save does not generate a map first', () => {
  it('a world made without a map is bare land with no trees and no connection points', () => {
    const bare = new World(128, 128, 5, {}, false);
    expect(bare.layers.terrain.some((v) => v === TERRAIN_WATER)).toBe(false);
    expect(bare.layers.vegetation.every((v) => v === VEG_NONE)).toBe(true);
    expect(bare.connections).toEqual([]);
    expect(new World(128, 128, 5).layers.terrain.some((v) => v === TERRAIN_WATER)).toBe(true);
  });

  it('a save still comes back exactly as it was, map, trees, points and random numbers', () => {
    const w = new World(128, 128, 5, { mapType: 'river', vegAmount: 'high' });
    for (let x = 60; x <= 70; x++) w.setRoad(x, 64, ROAD_STREET);
    const back = deserialize(serialize(w));
    expect(back.layers.terrain).toEqual(w.layers.terrain);
    expect(back.layers.vegetation).toEqual(w.layers.vegetation);
    expect(back.layers.roadClass).toEqual(w.layers.roadClass);
    expect(back.connections).toEqual(w.connections);
    // The city's random numbers start from the seed, as they did when a load generated the map too.
    expect(back.rng()).toBe(new World(128, 128, 5).rng());
  });
});

describe('the politics census', () => {
  it('the four factors in one pass give exactly what each gives alone', () => {
    const w = landWorld(48);
    for (let x = 2; x <= 40; x++) w.setRoad(x, 20, ROAD_STREET);
    homes(w, 4, 19, 30, 19, 3);
    for (let x = 4; x <= 20; x++) { w.setZone(x, 21, ZONE_C); w.layers.devLevel[w.grid.idx(x, 21)] = 2; }
    w.setZone(35, 19, ZONE_R);                               // zoned, not developed: counted nowhere
    for (let x = 4; x <= 30; x++) {
      const i = w.grid.idx(x, 19);
      w.layers.power[i] = x % 2; w.layers.water[i] = x % 3 === 0 ? 1 : 0; w.layers.services[i] = x < 15 ? 1 : 0; w.layers.crime[i] = (x * 37) % 256;
    }
    const politics = new PoliticsSystem();
    const alone = politics.factors.map((f) => f.compute(w));
    politics.satisfaction(w);
    expect(politics.lastFactors.map((f) => f.value)).toEqual(alone);
    expect(alone[0]).toBeCloseTo(11 / 27, 12);               // homes x 4–14 of 4–30 are served
    // An empty city is fully satisfied on every count.
    const empty = landWorld(16);
    new PoliticsSystem().factors.forEach((f) => expect(f.compute(empty)).toBe(1));
  });

  it('a factor asked after the layers change sees the change (nothing is kept between calls)', () => {
    const w = landWorld(32);
    homes(w, 4, 4, 8, 4, 2);
    const politics = new PoliticsSystem();
    politics.satisfaction(w);
    const power = politics.factors.find((f) => f.name === 'powerCoverage')!;
    expect(power.compute(w)).toBe(0);
    for (let x = 4; x <= 8; x++) w.layers.power[w.grid.idx(x, 4)] = 1;
    expect(power.compute(w)).toBe(1);
  });
});
