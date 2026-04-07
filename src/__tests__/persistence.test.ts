import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { serialize, deserialize } from '../persistence/Serializer';
import { SaveManager, DEFAULT_USER_ID } from '../persistence/SaveManager';
import type { IStore, SaveMeta, SaveRecord, SlotInfo, WorldSnapshot } from '../persistence/SaveFormat';
import { SAVE_VERSION } from '../persistence/SaveFormat';
import { ZONE_R, ROAD_STREET, BUILDING_POWER_PLANT } from '../sim/constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWorld() {
  const w = new World(32, 32, 42);
  // Put some state in so the round-trip is meaningful.
  for (let ty = 0; ty < w.grid.height; ty++) {
    for (let tx = 0; tx < w.grid.width; tx++) {
      if (w.isBuildable(tx, ty)) {
        w.layers.terrain[w.grid.idx(tx, ty)] = 0;
        w.setRoad(tx, ty, ROAD_STREET);
        break;
      }
    }
    break;
  }
  // Find a buildable tile and zone it.
  for (let ty = 1; ty < w.grid.height; ty++) {
    for (let tx = 0; tx < w.grid.width; tx++) {
      if (w.isBuildable(tx, ty)) {
        w.setZone(tx, ty, ZONE_R);
        w.layers.devLevel[w.grid.idx(tx, ty)] = 2;
        break;
      }
    }
    break;
  }
  w.budget.money = 12345;
  w.stats.population = 88;
  w.tick = 500;
  return w;
}

// In-memory IStore — no IDB, no browser, fast to test.
class MemoryStore implements IStore {
  private readonly records = new Map<string, SaveRecord>();

  private key(userId: string, slot: number) { return `${userId}:${slot}`; }

  async save(userId: string, slot: number, meta: SaveMeta, snapshot: WorldSnapshot): Promise<void> {
    this.records.set(this.key(userId, slot), { version: SAVE_VERSION, userId, slot, meta, snapshot });
  }
  async load(userId: string, slot: number): Promise<SaveRecord | null> {
    return this.records.get(this.key(userId, slot)) ?? null;
  }
  async list(userId: string): Promise<SlotInfo[]> {
    return [...this.records.values()]
      .filter(r => r.userId === userId)
      .map(r => ({ slot: r.slot, meta: r.meta }));
  }
  async delete(userId: string, slot: number): Promise<void> {
    this.records.delete(this.key(userId, slot));
  }
}

// ── Serializer ────────────────────────────────────────────────────────────────

describe('Serializer round-trip', () => {
  it('preserves tick, budget, and stats', () => {
    const w = makeWorld();
    const restored = deserialize(serialize(w));
    expect(restored.tick).toBe(w.tick);
    expect(restored.budget.money).toBe(w.budget.money);
    expect(restored.stats.population).toBe(w.stats.population);
  });

  it('preserves all tile layers exactly', () => {
    const w = makeWorld();
    const restored = deserialize(serialize(w));
    const layers = ['terrain', 'zone', 'roadClass', 'building', 'devLevel', 'pollution'] as const;
    for (const layer of layers) {
      expect(Array.from(restored.layers[layer])).toEqual(Array.from(w.layers[layer]));
    }
    expect(Array.from(restored.layers.roadNet)).toEqual(Array.from(w.layers.roadNet));
  });

  it('preserves powerPlants list', () => {
    const w = new World(16, 16, 1);
    // force a buildable tile and place a plant
    const tx = 0, ty = 0;
    w.layers.terrain[w.grid.idx(tx, ty)] = 0;
    w.layers.building[w.grid.idx(tx, ty)] = 0;
    w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    const restored = deserialize(serialize(w));
    expect(restored.powerPlants).toHaveLength(1);
    expect(restored.powerPlants[0]).toEqual({ tx, ty });
  });

  it('snapshot is a deep copy — mutating the original does not affect it', () => {
    const w = makeWorld();
    const snapshot = serialize(w);
    const zoneBefore = snapshot.layers.zone[0];
    w.layers.zone[0] = 99;
    expect(snapshot.layers.zone[0]).toBe(zoneBefore);
  });

  it('restores world dimensions and seed', () => {
    const w = new World(48, 64, 777);
    const restored = deserialize(serialize(w));
    expect(restored.grid.width).toBe(48);
    expect(restored.grid.height).toBe(64);
    expect(restored.seed).toBe(777);
  });
});

// ── SaveManager ───────────────────────────────────────────────────────────────

describe('SaveManager', () => {
  let store: MemoryStore;
  let manager: SaveManager;

  beforeEach(() => {
    store = new MemoryStore();
    manager = new SaveManager(store);
  });

  it('uses DEFAULT_USER_ID when no userId provided', () => {
    expect(manager.userId).toBe(DEFAULT_USER_ID);
  });

  it('saveGame + loadGame round-trips the world', async () => {
    const w = makeWorld();
    await manager.saveGame(w, 1);
    const loaded = await manager.loadGame(1);
    expect(loaded).not.toBeNull();
    expect(loaded!.tick).toBe(w.tick);
    expect(loaded!.budget.money).toBe(w.budget.money);
    expect(loaded!.stats.population).toBe(w.stats.population);
  });

  it('loadGame returns null for a slot that was never saved', async () => {
    expect(await manager.loadGame(99)).toBeNull();
  });

  it('listSlots returns saved slots sorted by slot number', async () => {
    const w = makeWorld();
    await manager.saveGame(w, 3, 'Third');
    await manager.saveGame(w, 1, 'First');
    await manager.saveGame(w, 2, 'Second');
    const slots = await manager.listSlots();
    expect(slots.map(s => s.slot)).toEqual([1, 2, 3]);
    expect(slots[0].meta.name).toBe('First');
  });

  it('listSlots returns empty array when no saves exist', async () => {
    expect(await manager.listSlots()).toEqual([]);
  });

  it('deleteSlot removes the save', async () => {
    const w = makeWorld();
    await manager.saveGame(w, 1);
    await manager.deleteSlot(1);
    expect(await manager.loadGame(1)).toBeNull();
    expect(await manager.listSlots()).toHaveLength(0);
  });

  it('saves from different userIds are isolated', async () => {
    const alice = new SaveManager(store, 'alice');
    const bob   = new SaveManager(store, 'bob');
    const w = makeWorld();
    await alice.saveGame(w, 1, "Alice's city");
    expect(await bob.loadGame(1)).toBeNull();
    expect(await alice.listSlots()).toHaveLength(1);
    expect(await bob.listSlots()).toHaveLength(0);
  });

  it('overwrites an existing slot', async () => {
    const w = makeWorld();
    await manager.saveGame(w, 1, 'v1');
    w.tick = 9999;
    await manager.saveGame(w, 1, 'v2');
    const slots = await manager.listSlots();
    expect(slots).toHaveLength(1);
    const loaded = await manager.loadGame(1);
    expect(loaded!.tick).toBe(9999);
  });

  it('meta name defaults to "City <slot>" when not provided', async () => {
    const w = makeWorld();
    await manager.saveGame(w, 2);
    const slots = await manager.listSlots();
    expect(slots[0].meta.name).toBe('City 2');
  });

  it('meta includes tick, population, and money at save time', async () => {
    const w = makeWorld();
    await manager.saveGame(w, 1);
    const slots = await manager.listSlots();
    const meta = slots[0].meta;
    expect(meta.tick).toBe(w.tick);
    expect(meta.population).toBe(w.stats.population);
    expect(meta.money).toBe(w.budget.money);
  });
});
