// Political Capital number sets for the debug tuning panel's variant picker. Only the keys listed are changed; the rest keep their current
// value. balance.ts itself stays at the shipped numbers until a numbers-on PR.

/** The play-test starting set the owner accepted on 2026-11-16 (variant B until the engine's four sets land). */
const ACCEPTED_SET = {
  max: 100,
  capPerResident: 0.01,
  baseRegen: 0,
  satisfactionRegenBonus: 0.7,
  neutralSatisfaction: 0.75,
  disruptionCosts: { bulldozePerPop: 2.5, abandonedBuildingReward: 2.5 },
  nuisance: {
    bands: [{ within: 2, weight: 1 }, { within: 4, weight: 0.6 }, { within: 6, weight: 0.3 }],
    industrialPerResident: 0.08,
    buildingPerResident: { 1: 0.4, 3: 0.3 },
  },
  service: {
    perResident: { 4: 0.004, 5: 0.003, 6: 0.01, 7: 0.012, 8: 0.01 },
    repeatFactor: 0.5,
    closureMultiplier: 3,
  },
  establishedYears: 1.5,
  ordinancesEnabled: true,
  ordinances: {
    neighbourhoodWatch: { enactCost: 15, dailyUpkeep: 0.15, dailyMoney: 0, modifiers: { crime: 0.85 } },
    curfew: { enactCost: 25, dailyUpkeep: 0.3, dailyMoney: 0, modifiers: { crime: 0.7, commercialIncome: 0.9 } },
    cleanAirAct: { enactCost: 30, dailyUpkeep: 0.25, dailyMoney: 0, modifiers: { industrialPollution: 0.25, industrialGrowth: 0.8 } },
    businessIncentives: { enactCost: 25, dailyUpkeep: 0.2, dailyMoney: 0,
      modifiers: { commercialDemand: 1.25, industrialDemand: 1.25, commercialIncome: 0.85, industrialIncome: 0.85 } },
    freeTransit: { enactCost: 30, dailyUpkeep: 0.2, dailyMoney: 500, modifiers: { trafficTrips: 0.8 } },
    fastTrackPermits: { enactCost: 20, dailyUpkeep: 0.2, dailyMoney: 0, modifiers: { growth: 1.5, pollution: 1.1, crime: 1.1 } },
    eminentDomain: { enactCost: 40, dailyUpkeep: 0.4, dailyMoney: 0, modifiers: { displacementCost: 0.5, satisfaction: 0.9 } },
    heritageProtection: { enactCost: 30, dailyUpkeep: 0.2, dailyMoney: 0, modifiers: { establishedLandValue: 1.2, establishedDemolitionCost: 3 } },
  },
  requests: {
    spawnEveryDays: 10,
    kinds: {
      park: { days: 20, reward: 10, penalty: 5 },
      schoolOrHospital: { days: 20, reward: 10, penalty: 5 },
      policeOrFire: { days: 20, reward: 10, penalty: 5 },
      utilities: { days: 20, reward: 10, penalty: 5 },
      trafficJam: { days: 20, reward: 10, penalty: 5 },
      blight: { days: 20, reward: 10, penalty: 5 },
    },
  },
  milestones: [
    { population: 1000, reward: 20 },
    { population: 2500, reward: 30 },
    { population: 5000, reward: 40 },
    { population: 10000, reward: 60 },
    { population: 25000, reward: 100 },
    { population: 50000, reward: 150 },
  ],
};

export type PcVariantId = 'A' | 'B' | 'C' | 'D';

export interface PcVariant {
  id: PcVariantId;
  name: string;
  /** One line for the panel. */
  desc: string;
  /** A partial BALANCE.politicalCapital tree, applied over the shipped numbers. */
  values: Record<string, unknown>;
}

/**
 * The four play-test variants on the panel's picker. Choosing one resets to
 * the shipped numbers, then applies its values. The engine session designs
 * and dry-runs the sets; until they land, each is the accepted set (TODO).
 */
export const PC_VARIANTS: readonly PcVariant[] = [
  { id: 'A', name: 'Gentle', desc: 'TODO (engine): forgiving numbers', values: ACCEPTED_SET },
  { id: 'B', name: 'Balanced', desc: 'The accepted play-test starting set', values: ACCEPTED_SET },
  { id: 'C', name: 'Strict planner', desc: 'TODO (engine): costly disruption', values: ACCEPTED_SET },
  { id: 'D', name: 'Political', desc: 'TODO (engine): ordinances and requests matter most', values: ACCEPTED_SET },
];

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;

/**
 * Copy `from` into `into` in place: nested objects are filled rather than
 * replaced and lists are spliced, so sim code holding a reference to a list
 * (milestones, bands) sees the new values.
 */
export function applyValues(into: Tree, from: Tree): void {
  for (const key of Object.keys(from)) {
    const src = from[key], dst = into[key];
    if (Array.isArray(src) && Array.isArray(dst)) {
      dst.splice(0, dst.length, ...src.map((row) => (isTree(row) ? { ...row } : row)));
    } else if (isTree(src) && isTree(dst)) {
      applyValues(dst, src);
    } else {
      into[key] = src;
    }
  }
}
