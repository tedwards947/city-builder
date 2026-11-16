// Political Capital number sets for the debug tuning panel's "Load proposed"
// button. Only the keys listed are changed; the rest keep their current
// value. balance.ts itself stays at the shipped numbers until a numbers-on PR.

/** The play-test starting numbers the owner accepted (engine session's revised set, 2026-11-16). */
export const PROPOSED_PC = {
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
  milestones: [
    { population: 1000, reward: 20 },
    { population: 2500, reward: 30 },
    { population: 5000, reward: 40 },
    { population: 10000, reward: 60 },
    { population: 25000, reward: 100 },
    { population: 50000, reward: 150 },
  ],
};

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
