// PoliticsSystem — regenerates political capital from citizen satisfaction;
// reacts to disruptive-action events published by Commands.
//
// Extensibility:
//   • Add a new satisfaction factor: implement SatisfactionFactor and push it
//     into PoliticsSystem.defaultFactors() + add its weight in balance.ts.
//   • Add a new disruptive action: add the PC cost to balance.ts disruptionCosts
//     and charge it directly in the Command (same pattern as money).
//   • Future: area-based PC (per-district satisfaction / district-level charges).

import type { World } from '../World';
import { ZONE_NONE, ZONE_R } from '../constants';
import { BALANCE } from '../../data/balance';

// ── Satisfaction factor interface ─────────────────────────────────────────────

export interface SatisfactionFactor {
  /** Must match a key in BALANCE.politicalCapital.satisfactionWeights. */
  readonly name: string;
  /** Returns a value in [0, 1]: 0 = worst, 1 = fully satisfied. */
  compute(world: World): number;
}

// ── Built-in factors ──────────────────────────────────────────────────────────

/** Fraction of developed residential zones with service-building coverage. */
const servicesCoverageFactor: SatisfactionFactor = {
  name: 'servicesCoverage',
  compute(world) {
    const { zone, devLevel, services } = world.layers;
    const n = world.grid.width * world.grid.height;
    let total = 0, covered = 0;
    for (let i = 0; i < n; i++) {
      if (zone[i] === ZONE_R && devLevel[i] > 0) {
        total++;
        if (services[i]) covered++;
      }
    }
    // No residents yet → neutral (1) so early game doesn't drag PC down.
    return total === 0 ? 1 : covered / total;
  },
};

/** Fraction of all developed zones with power coverage. */
const powerCoverageFactor: SatisfactionFactor = {
  name: 'powerCoverage',
  compute(world) {
    const { zone, devLevel, power } = world.layers;
    const n = world.grid.width * world.grid.height;
    let total = 0, covered = 0;
    for (let i = 0; i < n; i++) {
      if (zone[i] !== ZONE_NONE && devLevel[i] > 0) {
        total++;
        if (power[i]) covered++;
      }
    }
    return total === 0 ? 1 : covered / total;
  },
};

/** Fraction of all developed zones with water coverage. */
const waterCoverageFactor: SatisfactionFactor = {
  name: 'waterCoverage',
  compute(world) {
    const { zone, devLevel, water } = world.layers;
    const n = world.grid.width * world.grid.height;
    let total = 0, covered = 0;
    for (let i = 0; i < n; i++) {
      if (zone[i] !== ZONE_NONE && devLevel[i] > 0) {
        total++;
        if (water[i]) covered++;
      }
    }
    return total === 0 ? 1 : covered / total;
  },
};

// ── PoliticsSystem ────────────────────────────────────────────────────────────

export class PoliticsSystem {
  /** Ordered list of satisfaction factors. Add/remove to extend the system. */
  readonly factors: SatisfactionFactor[];

  constructor(factors?: SatisfactionFactor[]) {
    this.factors = factors ?? PoliticsSystem.defaultFactors();
  }

  /** The canonical default factor set. Extend by pushing to this array on the
   *  returned instance, or pass a custom array to the constructor. */
  static defaultFactors(): SatisfactionFactor[] {
    return [
      servicesCoverageFactor,
      powerCoverageFactor,
      waterCoverageFactor,
    ];
  }

  /**
   * Compute the overall satisfaction score in [0, 1].
   * Each factor is weighted by BALANCE.politicalCapital.satisfactionWeights[factor.name].
   * Factors with no matching weight contribute 0 to the total.
   * Exposed publicly so HUD / future systems can read it.
   */
  satisfaction(world: World): number {
    const weights = BALANCE.politicalCapital.satisfactionWeights;
    let weightedSum = 0;
    let weightTotal = 0;
    for (const factor of this.factors) {
      const w = weights[factor.name] ?? 0;
      if (w === 0) continue;
      weightedSum += factor.compute(world) * w;
      weightTotal += w;
    }
    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  }

  update(world: World): void {
    const cfg = BALANCE.politicalCapital;
    const sat = this.satisfaction(world);
    const regen = cfg.baseRegen + sat * cfg.satisfactionRegenBonus;
    world.budget.politicalCapital = Math.min(
      cfg.max,
      world.budget.politicalCapital + regen,
    );
    // Expose satisfaction on stats so HUD and other systems can read it
    // without recomputing.
    world.stats.satisfaction = sat;
  }
}
