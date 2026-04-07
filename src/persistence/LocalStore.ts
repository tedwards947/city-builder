// IndexedDB-backed save store.
// DB: "city-builder", object store: "saves", compound key: [userId, slot].

import type { IStore, SaveMeta, SaveRecord, SlotInfo, WorldSnapshot } from './SaveFormat';
import { SAVE_VERSION } from './SaveFormat';

const DB_NAME    = 'city-builder';
const DB_VERSION = 1;
const STORE_NAME = 'saves';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'slot'] });
        // Index lets us list all saves for a user efficiently.
        store.createIndex('byUser', 'userId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export class LocalStore implements IStore {
  async save(userId: string, slot: number, meta: SaveMeta, snapshot: WorldSnapshot): Promise<void> {
    const db = await openDB();
    const record: SaveRecord = { version: SAVE_VERSION, userId, slot, meta, snapshot };
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await request(tx.objectStore(STORE_NAME).put(record));
  }

  async load(userId: string, slot: number): Promise<SaveRecord | null> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const raw = await request<unknown>(tx.objectStore(STORE_NAME).get([userId, slot]));
    return raw ? (raw as SaveRecord) : null;
  }

  async list(userId: string): Promise<SlotInfo[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('byUser');
    const records = await request<SaveRecord[]>(index.getAll(userId));
    return records.map(r => ({ slot: r.slot, meta: r.meta }));
  }

  async delete(userId: string, slot: number): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await request(tx.objectStore(STORE_NAME).delete([userId, slot]));
  }
}
