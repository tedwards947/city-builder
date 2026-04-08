// Save file schema and storage interface.
//
// VERSION history:
//   1 — initial format
//   2 — added serviceBuildings entity list and services layer (coverage system)
//   3 — added landValue layer; taxRates to budget; demand + avgLandValue to stats
//   4 — added abandoned + distress layers (Phase 7.5 abandonment)
//   5 — added fireRisk, fire, fireStation layers (Phase 7.5 fire)
//   6 — added missing derived layers (crime, education, sickness, etc.) and missing stats
//   7 — unified powerPlants/waterTowers/sewagePlants/serviceBuildings into buildings[]

export const SAVE_VERSION = 7;

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
    avgCongestion: number;
    satisfaction: number;
  };
  character: {
    egalitarian: number;
    green: number;
    planned: number;
  };
  buildings: { tx: number; ty: number; kind: number }[];
  // Typed arrays are stored as-is — IndexedDB handles structured clone.
  // For wire transport (Phase 8), Serializer will convert to/from ArrayBuffer.
  layers: {
    terrain:   Uint8Array;
    zone:      Uint8Array;
    roadClass: Uint8Array;
    building:  Uint8Array;
    vegetation: Uint8Array;
    devLevel:  Uint8Array;
    power:     Uint8Array;
    water:     Uint8Array;
    sewage:    Uint8Array;
    services:  Uint8Array;
    landValue: Uint8Array;
    roadNet:   Uint16Array;
    pollution: Uint8Array;
    crime:      Uint8Array;
    police:     Uint8Array;
    congestion:    Uint8Array;
    accessibility: Uint8Array;
    abandoned:  Uint8Array;
    distress:   Uint8Array;
    fireRisk:   Uint8Array;
    fire:       Uint8Array;
    fireStation: Uint8Array;
    school:     Uint8Array;
    education:  Uint8Array;
    hospital:   Uint8Array;
    sickness:   Uint8Array;
    recentDeath: Uint8Array;
  };
}

export interface SaveRecord {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7;
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
  if ((rec as { version: number }).version === 4) rec = upgradeV4toV5(rec);
  if ((rec as { version: number }).version === 5) rec = upgradeV5toV6(rec);
  if ((rec as { version: number }).version === 6) rec = upgradeV6toV7(rec);
  if ((rec as { version: number }).version === 7) return rec;
  throw new Error(`Unknown save version: ${(rec as { version: number }).version}`);
}

function upgradeV6toV7(v6: SaveRecord): SaveRecord {
  const snap = v6.snapshot as any;
  const buildings = [
    ...(snap.powerPlants  ?? []).map((p: { tx: number; ty: number }) => ({ ...p, kind: 1 })),
    ...(snap.waterTowers  ?? []).map((p: { tx: number; ty: number }) => ({ ...p, kind: 2 })),
    ...(snap.sewagePlants ?? []).map((p: { tx: number; ty: number }) => ({ ...p, kind: 3 })),
    ...(snap.serviceBuildings ?? []),
  ];
  const { powerPlants: _pp, waterTowers: _wt, sewagePlants: _sp, serviceBuildings: _sb, ...restSnap } = snap;
  return {
    ...v6,
    version: 7,
    snapshot: { ...restSnap, buildings },
  };
}

function upgradeV5toV6(v5: SaveRecord): SaveRecord {
  const snap = v5.snapshot;
  const n = snap.width * snap.height;
  return {
    ...v5,
    version: 6,
    snapshot: {
      ...snap,
      stats: {
        ...snap.stats,
        avgCongestion: 0,
        satisfaction: 1,
      },
      layers: {
        ...snap.layers,
        vegetation: new Uint8Array(n),
        crime:      new Uint8Array(n),
        police:     new Uint8Array(n),
        congestion:    new Uint8Array(n),
        accessibility: new Uint8Array(n),
        school:     new Uint8Array(n),
        education:  new Uint8Array(n),
        hospital:   new Uint8Array(n),
        sickness:   new Uint8Array(n),
        recentDeath: new Uint8Array(n),
      },
    },
  };
}

function upgradeV4toV5(v4: SaveRecord): SaveRecord {
  const snap = v4.snapshot;
  const n = snap.width * snap.height;
  return {
    ...v4,
    version: 5,
    snapshot: {
      ...snap,
      layers: {
        ...snap.layers,
        fireRisk: new Uint8Array(n),
        fire:     new Uint8Array(n),
        fireStation: new Uint8Array(n),
      },
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

function upgradeV1toV2(v1: SaveRecord): SaveRecord {
  const snap = v1.snapshot as any;
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
