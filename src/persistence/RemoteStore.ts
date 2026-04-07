// Remote (server-backed) save store — stub for Phase 8.
// Implements the same IStore interface as LocalStore so SaveManager can
// switch between local and remote storage without any other changes.
//
// When implementing: POST/GET/DELETE /api/saves with userId in the auth token,
// not the URL — the server extracts it from the session.

import type { IStore, SaveMeta, SaveRecord, SlotInfo, WorldSnapshot } from './SaveFormat';

export class RemoteStore implements IStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  save(_userId: string, _slot: number, _meta: SaveMeta, _snapshot: WorldSnapshot): Promise<void> {
    return Promise.reject(new Error('RemoteStore not implemented yet (Phase 8)'));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  load(_userId: string, _slot: number): Promise<SaveRecord | null> {
    return Promise.reject(new Error('RemoteStore not implemented yet (Phase 8)'));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  list(_userId: string): Promise<SlotInfo[]> {
    return Promise.reject(new Error('RemoteStore not implemented yet (Phase 8)'));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete(_userId: string, _slot: number): Promise<void> {
    return Promise.reject(new Error('RemoteStore not implemented yet (Phase 8)'));
  }
}
