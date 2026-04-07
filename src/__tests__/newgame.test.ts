import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { TERRAIN_WATER } from '../sim/constants';

function waterTileCount(world: World): number {
  let count = 0;
  for (let i = 0; i < world.layers.terrain.length; i++) {
    if (world.layers.terrain[i] === TERRAIN_WATER) count++;
  }
  return count;
}

describe('World terrain options', () => {
  it('waterAmount high produces more water tiles than low (same seed)', () => {
    const low  = new World(128, 128, 42, { waterAmount: 'low' });
    const high = new World(128, 128, 42, { waterAmount: 'high' });
    expect(waterTileCount(high)).toBeGreaterThan(waterTileCount(low));
  });

  it('waterAmount medium sits between low and high', () => {
    const low  = waterTileCount(new World(128, 128, 42, { waterAmount: 'low' }));
    const mid  = waterTileCount(new World(128, 128, 42, { waterAmount: 'medium' }));
    const high = waterTileCount(new World(128, 128, 42, { waterAmount: 'high' }));
    expect(mid).toBeGreaterThan(low);
    expect(mid).toBeLessThan(high);
  });

  it('terrain is deterministic — same seed + same options = same map', () => {
    const a = new World(64, 64, 7, { waterAmount: 'high' });
    const b = new World(64, 64, 7, { waterAmount: 'high' });
    expect(Array.from(a.layers.terrain)).toEqual(Array.from(b.layers.terrain));
  });

  it('different seeds produce different maps even with the same options', () => {
    const a = new World(64, 64, 1, { waterAmount: 'medium' });
    const b = new World(64, 64, 2, { waterAmount: 'medium' });
    expect(Array.from(a.layers.terrain)).not.toEqual(Array.from(b.layers.terrain));
  });

  it('default (no options) matches medium', () => {
    const def = new World(64, 64, 99);
    const med = new World(64, 64, 99, { waterAmount: 'medium' });
    expect(Array.from(def.layers.terrain)).toEqual(Array.from(med.layers.terrain));
  });

  it('terrainOptions is stored on the world for later inspection', () => {
    const w = new World(32, 32, 1, { waterAmount: 'low' });
    expect(w.terrainOptions.waterAmount).toBe('low');
  });

  it('map size affects world dimensions', () => {
    const small  = new World(128, 128, 1);
    const large  = new World(512, 512, 1);
    expect(small.grid.width).toBe(128);
    expect(large.grid.width).toBe(512);
    expect(small.layers.terrain.length).toBe(128 * 128);
    expect(large.layers.terrain.length).toBe(512 * 512);
  });
});

describe('Serializer preserves terrain options through save/load', () => {
  it('waterAmount survives a round-trip via Serializer', async () => {
    const { serialize, deserialize } = await import('../persistence/Serializer');
    const { SaveManager }            = await import('../persistence/SaveManager');
    const { SAVE_VERSION }           = await import('../persistence/SaveFormat');
    type IStore    = import('../persistence/SaveFormat').IStore;
    type SaveMeta  = import('../persistence/SaveFormat').SaveMeta;
    type SaveRecord = import('../persistence/SaveFormat').SaveRecord;
    type SlotInfo  = import('../persistence/SaveFormat').SlotInfo;
    type WorldSnapshot = import('../persistence/SaveFormat').WorldSnapshot;

    // Mini in-memory store
    const records = new Map<string, SaveRecord>();
    const store: IStore = {
      async save(u, s, meta, snapshot) {
        records.set(`${u}:${s}`, { version: SAVE_VERSION, userId: u, slot: s, meta, snapshot });
      },
      async load(u, s) { return records.get(`${u}:${s}`) ?? null; },
      async list(u) {
        return [...records.values()].filter(r => r.userId === u).map(r => ({ slot: r.slot, meta: r.meta }));
      },
      async delete(u, s) { records.delete(`${u}:${s}`); },
    };

    const world = new World(64, 64, 5, { waterAmount: 'low' });
    const mgr = new SaveManager(store);
    await mgr.saveGame(world, 1);

    const slots = await mgr.listSlots();
    expect(slots[0].meta.mapSettings?.waterAmount).toBe('low');
    expect(slots[0].meta.mapSettings?.width).toBe(64);

    // Deserialized world layers match original
    const loaded = await mgr.loadGame(1);
    expect(Array.from(loaded!.layers.terrain)).toEqual(Array.from(world.layers.terrain));
  });
});
