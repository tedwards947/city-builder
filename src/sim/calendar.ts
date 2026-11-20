import { BALANCE } from '../data/balance';

/** Game calendar helpers. Pure and derived from the day count, so saves need no change. */

/** Index 0 = Monday. Day 0 of the game is 1 Jan 1900, which really was a Monday. */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DAYS_PER_WEEK = 7;
export const SATURDAY = 5;

/** Day of week for a game day count (0 = Monday ... 6 = Sunday). */
export function dayOfWeek(totalDays: number): number {
  const d = Math.floor(totalDays);
  return ((d % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

export function isSaturday(totalDays: number): boolean {
  return dayOfWeek(totalDays) === SATURDAY;
}

/** Day of week (0 = Monday ... 6 = Sunday) for a sim tick. */
export function weekday(tick: number): number {
  return dayOfWeek(Math.floor(tick / BALANCE.ticksPerDay));
}

/** Whole days from this tick until the next given weekday (0-6). 0 means today is that weekday. */
export function daysUntil(tick: number, target: number): number {
  return (((target - weekday(tick)) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}
