// Debt as a failure condition (owner's economy decision, 2026-11-17).
//
// A city may run a debt down to a limit that grows with the city: so many
// days of its current expenses, with a floor so a tiny city has some room.
// Warnings go out at half the limit and at the limit. Past the limit a
// countdown runs; if the city stays past the limit for the whole of it, the
// council removes the mayor: game over, final for that city (load a save or
// start again). Climbing back within the limit resets the countdown in full.
// The countdown is off while debtGraceDays is 0: the limit then only warns.
// While money is below zero, political capital also drains once a day.
//
// Numbers live in BALANCE.budget and are read live. The state that must
// survive a save is on world.budget: `debtOverTicks` and `gameOver`.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { changePc, capScale } from './politics';

/** How far below zero the city's money may go before the countdown starts (a positive number). */
export function debtLimit(world: World): number {
  const b = BALANCE.budget;
  return Math.max(b.debtLimitMin, world.budget.expenses * BALANCE.ticksPerDay * b.debtLimitDays);
}

export interface DebtStatus {
  /** How far below zero money may go, as a positive number. */
  limit: number;
  /** Money is below zero. */
  inDebt: boolean;
  /** Money is below minus half the limit. */
  pastHalf: boolean;
  /** Money is below minus the limit: the countdown is running. */
  overLimit: boolean;
  /** Whole game days until game over while past the limit; null otherwise. */
  daysLeft: number | null;
  /** The length of the countdown, in game days. */
  graceDays: number;
  gameOver: boolean;
}

function daysLeftOf(world: World): number {
  const graceTicks = BALANCE.budget.debtGraceDays * BALANCE.ticksPerDay;
  return Math.max(0, Math.ceil((graceTicks - world.budget.debtOverTicks) / BALANCE.ticksPerDay));
}

/** Where the city stands with its debt, for the HUD, the Budget panel and the game-over screen. */
export function debtStatus(world: World): DebtStatus {
  const limit = debtLimit(world);
  const money = world.budget.money;
  const overLimit = money < -limit;
  return {
    limit,
    inDebt: money < 0,
    pastHalf: money < -limit / 2,
    overLimit,
    daysLeft: overLimit && !world.budget.gameOver && BALANCE.budget.debtGraceDays > 0 ? daysLeftOf(world) : null,
    graceDays: BALANCE.budget.debtGraceDays,
    gameOver: world.budget.gameOver,
  };
}

/** Which warnings have gone out in the current spell of debt (kept by EconomySystem, not saved). */
export interface DebtWarnings { half: boolean; limit: boolean }

/**
 * One tick of the debt rule, after the tick's income and expenses are in:
 * warnings, the countdown, the daily PC drain, and game over.
 */
export function updateDebt(world: World, warned: DebtWarnings): void {
  const budget = world.budget;
  if (budget.gameOver) return;
  const money = budget.money;
  const limit = debtLimit(world);
  const dayTurned = world.tick % BALANCE.ticksPerDay === 0;

  if (money < -limit / 2) {
    if (!warned.half) { warned.half = true; world.events.emit('debtWarning', { level: 'half', money, limit }); }
  } else {
    warned.half = false;
  }

  if (money < -limit) {
    if (!warned.limit) { warned.limit = true; world.events.emit('debtWarning', { level: 'limit', money, limit }); }
    // No countdown while debtGraceDays is 0: the limit only warns.
    if (BALANCE.budget.debtGraceDays <= 0) { budget.debtOverTicks = 0; return drainPc(world, dayTurned); }
    const first = budget.debtOverTicks === 0;
    budget.debtOverTicks++;
    if (budget.debtOverTicks >= BALANCE.budget.debtGraceDays * BALANCE.ticksPerDay) {
      budget.gameOver = true;
      world.events.emit('gameOver', { reason: 'debt', money, limit });
      return;
    }
    if (first || dayTurned) world.events.emit('debtCountdown', { daysLeft: daysLeftOf(world), money, limit });
  } else {
    budget.debtOverTicks = 0;
    warned.limit = false;
  }

  drainPc(world, dayTurned);
}

/** Residents lose patience with a city in the red: PC drains once a day, scaled like regeneration. */
function drainPc(world: World, dayTurned: boolean): void {
  if (world.budget.money >= 0 || !dayTurned) return;
  const drain = Math.min(BALANCE.budget.debtPcDrainPerDay * capScale(world), Math.max(0, world.budget.politicalCapital));
  if (drain > 0) changePc(world, -drain, 'debt');
}

/**
 * Debug only (the ?debug=true game-over screen's cheat): add money, reset the
 * countdown and clear game over, so play can go on.
 */
export function reviveFromDebt(world: World, amount: number): void {
  world.budget.money += amount;
  world.budget.debtOverTicks = 0;
  world.budget.gameOver = false;
  world.events.emit('debtRevived', { money: world.budget.money });
}
