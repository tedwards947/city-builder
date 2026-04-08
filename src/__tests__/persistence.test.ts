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
    // Set some values in new layers
    const i = w.grid.idx(5, 5);
    w.layers.crime[i] = 123;
    w.layers.sickness[i] = 45;
    w.layers.education[i] = 200;
    w.layers.congestion[i] = 80;
    w.layers.vegetation[i] = 1;

    const restored = deserialize(serialize(w));
    const layers = [
      'terrain', 'zone', 'roadClass', 'building', 'devLevel', 'pollution',
      'crime', 'sickness', 'education', 'congestion', 'vegetation',
      'abandoned', 'distress', 'fireRisk', 'fire', 'fireStation',
      'police', 'school', 'hospital', 'recentDeath', 'accessibility'
    ] as const;
    for (const layer of layers) {
      expect(Array.from(restored.layers[layer])).toEqual(Array.from(w.layers[layer]));
    }
    expect(Array.from(restored.layers.roadNet)).toEqual(Array.from(w.layers.roadNet));
  });

  it('preserves all stats exactly', () => {
    const w = makeWorld();
    w.stats.avgCongestion = 42;
    w.stats.satisfaction = 0.75;
    const restored = deserialize(serialize(w));
    expect(restored.stats.avgCongestion).toBe(42);
    expect(restored.stats.satisfaction).toBe(0.75);
  });

  it('preserves buildings list', () => {
    const w = new World(16, 16, 1);
    // force a buildable tile and place a plant
    const tx = 0, ty = 0;
    w.layers.terrain[w.grid.idx(tx, ty)] = 0;
    w.layers.building[w.grid.idx(tx, ty)] = 0;
    w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    const restored = deserialize(serialize(w));
    expect(restored.buildings).toHaveLength(1);
    expect(restored.buildings[0]).toEqual({ tx, ty, kind: BUILDING_POWER_PLANT });
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

// ── Migration ─────────────────────────────────────────────────────────────────

import { migrate } from '../persistence/SaveFormat';

describe('Migration', () => {
  it('upgrades v5 to v7 adding new layers, stats, and unified buildings list', () => {
    // Construct a partial v5 save record
    const v5: any = {
      version: 5,
      userId: 'test',
      slot: 1,
      meta: { name: 'Test', savedAt: 0, tick: 10, population: 0, money: 0 },
      snapshot: {
        width: 10,
        height: 10,
        seed: 1,
        tick: 10,
        budget: { money: 0, politicalCapital: 100, income: 0, expenses: 0, taxRates: { R: 0.8, C: 1.2, I: 1.5 } },
        stats: { population: 0, powerSupply: 0, powerDemand: 0, waterSupply: 0, waterDemand: 0, sewageSupply: 0, sewageDemand: 0, servicesCoveredZones: 0, rDemand: 1, cDemand: 1, iDemand: 1, avgLandValue: 80 },
        character: { egalitarian: 0, green: 0, planned: 0 },
        powerPlants: [], waterTowers: [], sewagePlants: [], serviceBuildings: [],
        layers: {
          terrain: new Uint8Array(100),
          zone: new Uint8Array(100),
          roadClass: new Uint8Array(100),
          building: new Uint8Array(100),
          devLevel: new Uint8Array(100),
          power: new Uint8Array(100),
          water: new Uint8Array(100),
          sewage: new Uint8Array(100),
          services: new Uint8Array(100),
          landValue: new Uint8Array(100),
          roadNet: new Uint16Array(100),
          pollution: new Uint8Array(100),
          abandoned: new Uint8Array(100),
          distress: new Uint8Array(100),
          fireRisk: new Uint8Array(100),
          fire: new Uint8Array(100),
          fireStation: new Uint8Array(100),
        }
      }
    };

    const migrated = migrate(v5);
    expect(migrated.version).toBe(7);
    expect(migrated.snapshot.stats.avgCongestion).toBe(0);
    expect(migrated.snapshot.stats.satisfaction).toBe(1);
    expect(migrated.snapshot.layers.crime).toBeDefined();
    expect(migrated.snapshot.layers.crime.length).toBe(100);
    expect(migrated.snapshot.layers.education).toBeDefined();
    expect(migrated.snapshot.layers.sickness).toBeDefined();
    expect(migrated.snapshot.layers.vegetation).toBeDefined();
    expect(migrated.snapshot.buildings).toBeDefined();
    expect(Array.isArray(migrated.snapshot.buildings)).toBe(true);
  });
});
