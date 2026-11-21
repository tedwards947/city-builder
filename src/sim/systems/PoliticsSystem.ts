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
import { regenPc, regenPerTick, payMilestones, fadeOverCap } from '../politics';
import { ordinanceModifier } from '../ordinances';
import { withTaxSatisfaction, noteSatisfactionBeforeTaxLevel } from '../tax';

// ── Satisfaction factor interface ─────────────────────────────────────────────

export interface SatisfactionFactor {
  /** Must match a key in BALANCE.politicalCapital.satisfactionWeights. */
  readonly name: string;
  /** Returns a value in [0, 1]: 0 = worst, 1 = fully satisfied. */
  compute(world: World): number;
}

// ── Built-in factors ──────────────────────────────────────────────────────────
//
// All four read the same developed zone tiles, so they share one pass over
// them (the census) while `satisfaction()` runs; asked on its own, a factor
// takes the census itself. Whole-number counts either way, so the values are
// exactly what four separate passes gave.

interface Census {
  /** Developed zone tiles of any kind, and how many of them have power and water; their crime, added up. */
  developed: number; powered: number; watered: number; crimeSum: number;
  /** Developed homes, and how many a service building covers. */
  homes: number; homesServed: number;
}

function takeCensus(world: World): Census {
  const { zone, devLevel, services, power, water, crime } = world.layers;
  const { zoned, zonedCount } = world.index;
  const c: Census = { developed: 0, powered: 0, watered: 0, crimeSum: 0, homes: 0, homesServed: 0 };
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    const z = zone[i];
    if (z === ZONE_NONE || devLevel[i] === 0) continue;
    c.developed++;
    if (power[i]) c.powered++;
    if (water[i]) c.watered++;
    c.crimeSum += crime[i];
    if (z === ZONE_R) { c.homes++; if (services[i]) c.homesServed++; }
  }
  return c;
}

/** The census being shared while satisfaction() runs its factors, taken when the first factor asks. */
let shared: { world: World; census: Census | null } | null = null;

function census(world: World): Census {
  if (shared && shared.world === world) return shared.census ??= takeCensus(world);
  return takeCensus(world);
}

/** Fraction of developed residential zones with service-building coverage. */
const servicesCoverageFactor: SatisfactionFactor = {
  name: 'servicesCoverage',
  compute(world) {
    const c = census(world);
    // No residents yet → neutral (1) so early game doesn't drag PC down.
    return c.homes === 0 ? 1 : c.homesServed / c.homes;
  },
};

/** Fraction of all developed zones with power coverage. */
const powerCoverageFactor: SatisfactionFactor = {
  name: 'powerCoverage',
  compute(world) {
    const c = census(world);
    return c.developed === 0 ? 1 : c.powered / c.developed;
  },
};

/** Fraction of all developed zones with water coverage. */
const waterCoverageFactor: SatisfactionFactor = {
  name: 'waterCoverage',
  compute(world) {
    const c = census(world);
    return c.developed === 0 ? 1 : c.watered / c.developed;
  },
};

/** Inverse of average crime across all developed zones. */
const crimeFactor: SatisfactionFactor = {
  name: 'crime',
  compute(world) {
    const c = census(world);
    if (c.developed === 0) return 1;
    const avg = c.crimeSum / c.developed;
    // Map 0-255 crime to 1-0 satisfaction.
    return Math.max(0, 1 - (avg / 255));
  },
};

// ── PoliticsSystem ────────────────────────────────────────────────────────────

export class PoliticsSystem {
  /** Ordered list of satisfaction factors. Add/remove to extend the system. */
  readonly factors: SatisfactionFactor[];
  /**
   * Each factor's value (0–1) and weight from the last `satisfaction()` call,
   * in the order of `factors`. For debug panels: reading it recomputes nothing.
   */
  readonly lastFactors: { name: string; value: number; weight: number }[] = [];

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
      crimeFactor,
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
    this.lastFactors.length = 0;
    // The built-in factors share one pass over the developed zones while this runs.
    shared = { world, census: null };
    try {
      for (const factor of this.factors) {
        const w = weights[factor.name] ?? 0;
        if (w === 0) continue;
        const value = factor.compute(world);
        this.lastFactors.push({ name: factor.name, value, weight: w });
        weightedSum += value * w;
        weightTotal += w;
      }
    } finally { shared = null; }
    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  }

  update(world: World): void {
    // Eminent Domain lowers city-wide satisfaction; the tax level raises or lowers it.
    const beforeTax = Math.min(1, this.satisfaction(world) * ordinanceModifier(world, 'satisfaction'));
    noteSatisfactionBeforeTaxLevel(world, beforeTax);
    const sat = withTaxSatisfaction(world, beforeTax);
    const regen = regenPerTick(world, sat);
    const before = world.budget.politicalCapital;
    regenPc(world, regen);
    world.politics.regen = world.budget.politicalCapital - before;
    // Once a game day, PC banked above the cap fades a little (off while the rate is 0).
    if (world.tick % BALANCE.ticksPerDay === 0) fadeOverCap(world);
    // Pay any population milestone newly reached, and remember the largest
    // population seen so none pays twice.
    payMilestones(world);
    // Expose satisfaction on stats so HUD and other systems can read it
    // without recomputing.
    world.stats.satisfaction = sat;
  }
}
