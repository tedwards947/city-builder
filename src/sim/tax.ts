// The city's tax level (owner's economy decision, 2026-11-17): one number the
// player sets, as a percentage. At the neutral level nothing changes. Above
// it the city collects proportionally more tax and residents are less
// satisfied (so political capital regenerates more slowly); below it, less
// tax and more satisfaction.
//
// Growth demand follows too, as it does for the per-zone rates: lower tax,
// zones grow faster.
//
// It is the big lever; the per-zone rates in world.budget.taxRates are fine
// control, and the two multiply. Numbers live in BALANCE.tax.level and are
// read live; the level itself is world.budget.taxLevel (saved).

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { regenPerTick } from './politics';

export interface TaxLevelRange { min: number; max: number; neutral: number; step: number }

/** The slider's range, its neutral point and its step, in percentage points. */
export function taxLevelRange(): TaxLevelRange {
  const { min, max, neutral, step } = BALANCE.tax.level;
  return { min, max, neutral, step };
}

/** What tax income is multiplied by at `level`: level ÷ neutral, exactly 1 at neutral. */
export function taxIncomeMult(level: number): number {
  const { neutral } = BALANCE.tax.level;
  return neutral > 0 ? level / neutral : 1;
}

/** What `level` adds to city satisfaction (0–1 scale): positive below neutral, negative above, 0 at neutral. */
export function taxSatisfactionDelta(level: number): number {
  const { neutral, satisfactionPerPoint } = BALANCE.tax.level;
  return (neutral - level) * satisfactionPerPoint;
}

/**
 * What growth demand in every zone is multiplied by at `level`:
 * (neutral ÷ level) ^ demandStrength, exactly 1 at neutral. With a strength
 * of 1 it is the same rule the per-zone rates follow; 0 switches it off.
 * Unbounded as the level nears 0: the caller clamps demand to its range.
 */
export function taxDemandMult(level: number): number {
  const { neutral, demandStrength } = BALANCE.tax.level as { neutral: number; demandStrength: number };
  if (level === neutral || demandStrength === 0) return 1;
  return level > 0 ? (neutral / level) ** demandStrength : Infinity;
}

/**
 * Tax exodus: the chance, each growth pass, that a developed home loses one
 * level at `level`. exodusPerPoint for every point above neutral; 0 at or
 * below neutral and while exodusPerPoint is 0. At most 1.
 */
export function taxExodusChance(level: number): number {
  const { neutral, exodusPerPoint } = BALANCE.tax.level as { neutral: number; exodusPerPoint: number };
  if (level <= neutral || !(exodusPerPoint > 0)) return 0;
  return Math.min(1, (level - neutral) * exodusPerPoint);
}

/** City satisfaction after the tax level's effect, kept within 0–1. `base` is satisfaction before it. */
export function withTaxSatisfaction(world: World, base: number): number {
  const delta = taxSatisfactionDelta(world.budget.taxLevel);
  return delta === 0 ? base : Math.max(0, Math.min(1, base + delta));
}

/**
 * Set the city's tax level. The value is kept within the range and snapped to
 * the step; returns the level actually set. Takes effect on the next tick.
 */
export function setTaxLevel(world: World, level: number): number {
  const { min, max, step } = BALANCE.tax.level;
  let next = Number.isFinite(level) ? level : world.budget.taxLevel;
  if (step > 0) next = Math.round(next / step) * step;
  next = Math.max(min, Math.min(max, next));
  const previous = world.budget.taxLevel;
  if (next !== previous) {
    world.budget.taxLevel = next;
    world.events.emit('taxLevelChanged', { level: next, previous });
  }
  return next;
}

// What the last tick's income and satisfaction were before the tax level
// touched them, so a preview does not have to work back from figures that may
// predate the current level (the game can be paused when the slider moves).
// Derived, not saved: after a load it is filled in by the first tick.
const bases = new WeakMap<World, { income?: number; other?: number; satisfaction?: number }>();

/**
 * EconomySystem: this tick's tax income before the tax level's multiplier, and the income that is
 * not tax (trade, airport trips, fares, tickets), which the tax level does not scale.
 */
export function noteIncomeBeforeTaxLevel(world: World, income: number, other = 0): void {
  const b = bases.get(world);
  if (b) { b.income = income; b.other = other; } else bases.set(world, { income, other });
}

/** PoliticsSystem: this tick's satisfaction before the tax level's effect. */
export function noteSatisfactionBeforeTaxLevel(world: World, satisfaction: number): void {
  const b = bases.get(world);
  if (b) b.satisfaction = satisfaction; else bases.set(world, { satisfaction });
}

/** What a tax level would do, for the readout beside the slider. Per-tick money figures. */
export interface TaxEffect {
  level: number;
  /** Tax income is multiplied by this (level ÷ neutral). */
  incomeMult: number;
  /** Projected tax income per tick at this level. */
  income: number;
  /** Income per tick that is not tax (exports, airport trips, fares, tickets): the tax level leaves it alone. */
  otherIncome: number;
  /** `income` minus the tax the city currently collects per tick. */
  incomeChange: number;
  /** Projected income (tax and other) minus current expenses, per tick: what the money does at this level. */
  net: number;
  /**
   * What growth demand in every zone is multiplied by, before the per-zone
   * rates and demand's own limits (so it can be Infinity at 0%).
   */
  demandMult: number;
  /** Tax exodus: the chance per growth pass that a developed home loses a level. 0 at or below neutral. */
  exodusChance: number;
  /** What the level adds to satisfaction (0–1 scale). */
  satisfactionDelta: number;
  /** Projected city satisfaction, 0–1. */
  satisfaction: number;
  /**
   * Political capital the city would regenerate per game day at that
   * satisfaction (negative = a drain). Regeneration stops at the cap, so a
   * city already at its cap gains nothing whatever this says.
   */
  pcRegenPerDay: number;
}

/**
 * What `level` (default: the current one) would do to income and
 * satisfaction, from the city's latest tick. Pure: changes nothing. It is
 * right while the game is paused too: `incomeChange` compares with the income
 * last collected, whatever level that was collected at.
 */
export function taxEffect(world: World, level: number = world.budget.taxLevel): TaxEffect {
  const base = bases.get(world);
  const now = taxIncomeMult(world.budget.taxLevel);
  const incomeMult = taxIncomeMult(level);
  // Income that is not tax, as the last tick had it; before any tick, all of the figure counts as tax.
  const other = base?.other ?? 0;
  const current = world.budget.income - other;
  // Income before the tax level's multiplier: as the last tick collected it, or (before any tick,
  // e.g. straight after a load) worked back from the current figure and level.
  const incomeBase = base?.income ?? (now > 0 ? current / now : 0);
  const income = incomeBase * incomeMult;
  const satisfactionDelta = taxSatisfactionDelta(level);
  const before = base?.satisfaction ?? world.stats.satisfaction - taxSatisfactionDelta(world.budget.taxLevel);
  const satisfaction = Math.max(0, Math.min(1, before + satisfactionDelta));
  return {
    level,
    incomeMult,
    income,
    otherIncome: other,
    incomeChange: income - current,
    net: income + other - world.budget.expenses,
    demandMult: taxDemandMult(level),
    exodusChance: taxExodusChance(level),
    satisfactionDelta,
    satisfaction,
    pcRegenPerDay: regenPerTick(world, satisfaction) * BALANCE.ticksPerDay,
  };
}
