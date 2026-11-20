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
//   8 — added visualVariant layer (Lot ID for persistent graphics)
//   9 — added politics (peak population for milestones, last PC regeneration)
//  10 — train stations shrank (persistence/stationResize.ts)
//  11 — merged 2×2 lots: devLevel may be 4, with the new `lot` layer (sim/lots.ts). Nothing to upgrade: an
//       older save has no merged lots. The number went up so that an older build refuses a newer save
//       rather than misreading level 4.

import { shrinkStations } from './stationResize';

export const SAVE_VERSION = 11;

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
  politics: {
    peakPopulation: number;
    regen: number;
    // Added after v9 without a version bump: missing in older saves, which
    // load with no ordinances.
    ordinances?: { active: string[]; suspended: string[] };
    requests?: { id: number; kind: string; x0: number; y0: number; x1: number; y1: number; openedTick: number; deadlineTick: number; needAtOpen?: number; seed?: number; homes?: number[]; samples?: number[]; heldDays?: number }[];
    nextRequestId?: number;
    /** Added without a version bump: missing in older saves, where every kind may ask. */
    requestNotBefore?: Record<string, number>;
  };
  buildings: { tx: number; ty: number; kind: number; rot?: number }[];
  /** Added without a version bump: written only when the city has markers (sim/markers.ts). */
  markers?: { x: number; y: number; kind: string; zoom?: number; label?: string }[];
  /** Added without a version bump: written only while the city is the tutorial city (tutorial/rules.ts). */
  tutorial?: { step: number; service?: string; forHome?: boolean };
  /** The last event day's result (sim/eventDays.ts). Added without a version bump: missing = none yet. */
  lastEvent?: { tick: number; tx: number; ty: number; wanted: number; arrived: number; seats: number; stuckResidents: number; pc: number; declined: number };
  /**
   * Never saved: set by an upgrade step (migrate) that changed something the
   * player should be told about, and shown once after the load (World.loadNotes).
   */
  upgradeNotes?: { stationsRebuilt?: number };
  // Typed arrays are stored as-is — IndexedDB handles structured clone.
  // For wire transport (Phase 8), Serializer will convert to/from ArrayBuffer.
  layers: {
    terrain:   Uint8Array;
    zone:      Uint8Array;
    roadClass: Uint8Array;
    building:  Uint8Array;
    vegetation: Uint8Array;
    devLevel:  Uint8Array;
    /** Merged 2×2 lots (sim/lots.ts). Optional: saves from before version 11 have none. */
    lot?:      Uint8Array;
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
    visualVariant: Uint8Array;
    // Optional: saves written before the vibe layers existed lack these.
    vibeEgalitarian?: Uint8Array;
    vibeGreen?:       Uint8Array;
    vibePlanned?:     Uint8Array;
    // Optional: saves written before rail existed lack it (no track).
    rail?: Uint8Array;
    // Optional: saves written before lots kept their age lack it (their clocks start at load).
    developedSince?:  Uint16Array;
    /** world.lotStreak (sim/lots.ts). Added without a version bump: missing = every streak starts from 0. */
    lotStreak?:       Uint8Array;
    /** world.eventStrain (sim/eventDays.ts). Added without a version bump: missing = no strain anywhere. */
    eventStrain?:     Uint8Array;
  };
}

export interface SaveRecord {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
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
  /**
   * Copy the record in slot `from` to slot `to` exactly as stored (its save
   * version included, so an old save stays an old save), replacing what is
   * there. Does nothing if `from` is empty.
   */
  copy(userId: string, from: number, to: number): Promise<void>;
  save(userId: string, slot: number, meta: SaveMeta, snapshot: WorldSnapshot): Promise<void>;
  load(userId: string, slot: number): Promise<SaveRecord | null>;
  list(userId: string): Promise<SlotInfo[]>;
  delete(userId: string, slot: number): Promise<void>;
}

// ── Migration ─────────────────────────────────────────────────────────────────

/** A save written by a newer build than this one: it cannot be read here, and must not be half-loaded. */
export class NewerSaveError extends Error {
  readonly saveVersion: number;
  constructor(saveVersion: number) {
    super(`This city was saved by a newer version of the game (save version ${saveVersion}; this one reads up to ${SAVE_VERSION}). Reload the page to get the latest version.`);
    this.name = 'NewerSaveError';
    this.saveVersion = saveVersion;
  }
}

/** The record upgraded, step by step, to the current save version. Throws NewerSaveError for a save newer than this build. */
export function migrate(raw: unknown): SaveRecord {
  const r = raw as { version?: number };
  let rec = raw as SaveRecord;
  if (!r.version || r.version === 1) rec = upgradeV1toV2(rec);
  if ((rec as { version: number }).version === 2) rec = upgradeV2toV3(rec);
  if ((rec as { version: number }).version === 3) rec = upgradeV3toV4(rec);
  if ((rec as { version: number }).version === 4) rec = upgradeV4toV5(rec);
  if ((rec as { version: number }).version === 5) rec = upgradeV5toV6(rec);
  if ((rec as { version: number }).version === 6) rec = upgradeV6toV7(rec);
  if ((rec as { version: number }).version === 7) rec = upgradeV7toV8(rec);
  if ((rec as { version: number }).version === 8) rec = upgradeV8toV9(rec);
  if ((rec as { version: number }).version === 9) rec = { ...rec, version: 10, snapshot: shrinkStations(rec.snapshot) };
  if ((rec as { version: number }).version === 10) rec = { ...rec, version: 11 };
  if ((rec as { version: number }).version === 11) return rec;
  if ((rec as { version: number }).version > SAVE_VERSION) throw new NewerSaveError((rec as { version: number }).version);
  throw new Error(`Unknown save version: ${(rec as { version: number }).version}`);
}

function upgradeV8toV9(v8: SaveRecord): SaveRecord {
  const snap = v8.snapshot;
  return {
    ...v8,
    version: 9,
    snapshot: {
      ...snap,
      // The city is credited for the people it already has, so population
      // milestones it has passed count as reached and pay nothing on load.
      politics: { peakPopulation: snap.stats?.population ?? 0, regen: 0 },
    },
  };
}

function upgradeV7toV8(v7: SaveRecord): SaveRecord {
  const snap = v7.snapshot;
  const n = snap.width * snap.height;
  return {
    ...v7,
    version: 8,
    snapshot: {
      ...snap,
      layers: {
        ...snap.layers,
        visualVariant: new Uint8Array(n),
      },
    },
  };
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
