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
import { migrate } from './SaveFormat';
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

  async loadGame(slot: number): Promise<World | null> {
    const raw = await this.store.load(this.userId, slot);
    if (!raw) return null;
    const record = migrate(raw);
    return deserialize(record.snapshot, this.bootstrapper);
  }

  async listSlots(): Promise<SlotInfo[]> {
    const slots = await this.store.list(this.userId);
    return slots.sort((a, b) => a.slot - b.slot);
  }

  async deleteSlot(slot: number): Promise<void> {
    await this.store.delete(this.userId, slot);
  }
}
