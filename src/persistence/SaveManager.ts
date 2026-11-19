// High-level save/load API. All operations are scoped to a userId.
//
// Default userId is 'local' — a stranger can play without signing in and
// their saves persist in IndexedDB under that key. When auth is added,
// construct SaveManager with the real user ID:
//
//   new SaveManager(store, currentUser.id)
//
// No other code changes needed. The store interface already carries userId
// on every call, so LocalStore and a future RemoteStore both work the same way.

import type { IStore, SlotInfo, SaveMeta } from './SaveFormat';
import { SAVE_VERSION, migrate } from './SaveFormat';
import { serialize, deserialize, type VibeBootstrapper } from './Serializer';
import type { World } from '../sim/World';
import { encodeSaveFile, decodeSaveFile } from './SaveFile';

export const DEFAULT_USER_ID = 'local';

export class SaveManager {
  private readonly store: IStore;
  readonly userId: string;
  private readonly bootstrapper?: VibeBootstrapper;

  constructor(store: IStore, userId: string = DEFAULT_USER_ID, bootstrapper?: VibeBootstrapper) {
    this.store = store;
    this.userId = userId;
    this.bootstrapper = bootstrapper;
  }

  async saveGame(world: World, slot: number, name?: string): Promise<void> {
    await this.store.save(this.userId, slot, this._meta(world, name ?? `City ${slot}`), serialize(world));
  }

  /** The city as the text of a save file (see SaveFile.ts). Touches no slot. */
  exportGame(world: World, name: string): string {
    return encodeSaveFile(this._meta(world, name), serialize(world));
  }

  /** A city from the text of a save file. Throws a readable Error if the file is no good. */
  importGame(text: string): World {
    return deserialize(decodeSaveFile(text).snapshot, this.bootstrapper);
  }

  private _meta(world: World, name: string): SaveMeta {
    return {
      name,
      savedAt:    Date.now(),
      tick:       world.tick,
      population: world.stats.population,
      money:      world.budget.money,
      mapSettings: {
        width:       world.grid.width,
        height:      world.grid.height,
        waterAmount: world.terrainOptions.waterAmount ?? 'medium',
      },
    };
  }

  /**
   * The city in `slot`, upgraded to the current save version; null if the
   * slot is empty. Throws NewerSaveError for a save from a newer build, or
   * another Error if the save cannot be read.
   *
   * `backupSlot`: for a slot the game writes to by itself (the autosave).
   * When the stored save is NOT of the current version, or cannot be read,
   * it is first copied there as it is, so that the next autosave, which
   * overwrites `slot`, cannot lose it: a bad upgrade can be recovered.
   * (A backup already there from a newer build than this one is kept instead.)
   */
  async loadGame(slot: number, backupSlot?: number): Promise<World | null> {
    const raw = await this.store.load(this.userId, slot);
    if (!raw) return null;
    const keep = async (): Promise<void> => {
      if (backupSlot === undefined) return;
      try {
        // A backup from a NEWER build than this save is a city this build could not open: it is not replaced.
        const held = await this.store.load(this.userId, backupSlot) as { version?: number } | null;
        if (held && (held.version ?? 0) > SAVE_VERSION && (held.version ?? 0) > ((raw as { version?: number }).version ?? 0)) return;
        await this.store.copy(this.userId, slot, backupSlot);
      } catch (err) { console.warn('Could not keep a copy of the old save:', err); }
    };
    let world: World;
    try {
      const record = migrate(raw);
      world = deserialize(record.snapshot, this.bootstrapper);
    } catch (err) {
      await keep();
      throw err;
    }
    if ((raw as { version?: number }).version !== SAVE_VERSION) await keep();
    return world;
  }

  async listSlots(): Promise<SlotInfo[]> {
    const slots = await this.store.list(this.userId);
    return slots.sort((a, b) => a.slot - b.slot);
  }

  async deleteSlot(slot: number): Promise<void> {
    await this.store.delete(this.userId, slot);
  }
}
