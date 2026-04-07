// Save file schema and storage interface.
//
// VERSION history:
//   1 — initial format
//   2 — added serviceBuildings entity list and services layer (coverage system)
//   3 — added landValue layer; taxRates to budget; demand + avgLandValue to stats
//   4 — added abandoned + distress layers (Phase 7.5 abandonment)

export const SAVE_VERSION = 4;

// ── Data shapes ──────────────────────────────────────────────────────────────

export interface SaveMeta {
  name: string;
  savedAt: number;    // Date.now()
  tick: number;
  population: number;
  money: number;
  // Optional — informational only. Terrain is restored from saved bytes,
  // not regenerated, so these don't affect loading.
  mapSettings?: {
    width: number;
    height: number;
    waterAmount: 'low' | 'medium' | 'high';
  };
}

export interface WorldSnapshot {
  width: number;
  height: number;
  seed: number;
  tick: number;
  budget: {
    money: number;
    politicalCapital: number;
    income: number;
    expenses: number;
    taxRates: { R: number; C: number; I: number };
  };
  stats: {
    population: number;
    powerSupply: number;
    powerDemand: number;
    waterSupply: number;
    waterDemand: number;
    sewageSupply: number;
    sewageDemand: number;
    servicesCoveredZones: number;
    rDemand: number;
    cDemand: number;
    iDemand: number;
    avgLandValue: number;
  };
  character: {
    egalitarian: number;
    green: number;
    planned: number;
  };
  powerPlants: { tx: number; ty: number }[];
  waterTowers: { tx: number; ty: number }[];
  sewagePlants: { tx: number; ty: number }[];
  serviceBuildings: { tx: number; ty: number; kind: number }[];
  // Typed arrays are stored as-is — IndexedDB handles structured clone.
  // For wire transport (Phase 8), Serializer will convert to/from ArrayBuffer.
  layers: {
    terrain:   Uint8Array;
    zone:      Uint8Array;
    roadClass: Uint8Array;
    building:  Uint8Array;
    devLevel:  Uint8Array;
    power:     Uint8Array;
    water:     Uint8Array;
    sewage:    Uint8Array;
    services:  Uint8Array;
    landValue: Uint8Array;
    roadNet:   Uint16Array;
    pollution: Uint8Array;
    abandoned: Uint8Array;
    distress:  Uint8Array;
  };
}

export interface SaveRecord {
  version: 1 | 2 | 3 | 4;
  userId: string;
  slot: number;
  meta: SaveMeta;
  snapshot: WorldSnapshot;
}

export interface SlotInfo {
  slot: number;
  meta: SaveMeta;
}

// ── Storage interface ─────────────────────────────────────────────────────────
//
// All methods are scoped to a userId so implementations (local or remote)
// naturally store data per-user. Swap LocalStore for RemoteStore — or use
// both — without changing SaveManager.

export interface IStore {
  save(userId: string, slot: number, meta: SaveMeta, snapshot: WorldSnapshot): Promise<void>;
  load(userId: string, slot: number): Promise<SaveRecord | null>;
  list(userId: string): Promise<SlotInfo[]>;
  delete(userId: string, slot: number): Promise<void>;
}

// ── Migration ─────────────────────────────────────────────────────────────────

export function migrate(raw: unknown): SaveRecord {
  const r = raw as { version?: number };
  let rec = raw as SaveRecord;
  if (!r.version || r.version === 1) rec = upgradeV1toV2(rec);
  if ((rec as { version: number }).version === 2) rec = upgradeV2toV3(rec);
  if ((rec as { version: number }).version === 3) rec = upgradeV3toV4(rec);
  if ((rec as { version: number }).version === 4) return rec;
  throw new Error(`Unknown save version: ${(rec as { version: number }).version}`);
}

function upgradeV1toV2(v1: SaveRecord): SaveRecord {
  const snap = v1.snapshot as WorldSnapshot & { serviceBuildings?: unknown[] };
  const n = snap.width * snap.height;
  return {
    ...v1,
    version: 2,
    snapshot: {
      ...snap,
      stats: { ...snap.stats, servicesCoveredZones: 0 },
      serviceBuildings: [],
      layers: { ...snap.layers, services: new Uint8Array(n) },
    },
  };
}

function upgradeV3toV4(v3: SaveRecord): SaveRecord {
  const snap = v3.snapshot;
  const n = snap.width * snap.height;
  return {
    ...v3,
    version: 4,
    snapshot: {
      ...snap,
      layers: {
        ...snap.layers,
        abandoned: new Uint8Array(n),
        distress:  new Uint8Array(n),
      },
    },
  };
}

function upgradeV2toV3(v2: SaveRecord): SaveRecord {
  const snap = v2.snapshot;
  const n = snap.width * snap.height;
  return {
    ...v2,
    version: 3,
    snapshot: {
      ...snap,
      budget: {
        ...snap.budget,
        taxRates: { R: 0.8, C: 1.2, I: 1.5 },
      },
      stats: {
        ...snap.stats,
        rDemand: 1, cDemand: 1, iDemand: 1, avgLandValue: 80,
      },
      layers: { ...snap.layers, landValue: new Uint8Array(n).fill(80) },
    },
  };
}
