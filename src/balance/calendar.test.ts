import { BALANCE } from '../data/balance';
import { describe, it, expect } from 'vitest';
import { weekday, daysUntil, dayOfWeek, isSaturday, WEEKDAY_KEYS } from '../sim/calendar';

describe('calendar', () => {
  it('1 Jan 1900 (day 0) is a Monday', () => {
    expect(WEEKDAY_KEYS[dayOfWeek(0)]).toBe('mon');
  });
  it('cycles through the week and repeats every 7 days', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dayOfWeek(7)).toBe(0);
    expect(dayOfWeek(360)).toBe(360 % 7);
  });
  it('handles fractional and negative days', () => {
    expect(dayOfWeek(5.9)).toBe(5);
    expect(dayOfWeek(-1)).toBe(6);
  });
  it('finds Saturdays', () => {
    expect(isSaturday(5)).toBe(true);
    expect(isSaturday(12)).toBe(true);
    expect(isSaturday(6)).toBe(false);
  });

  it('weekday(tick) uses ticksPerDay', () => {
    const t = BALANCE.ticksPerDay;
    expect(weekday(0)).toBe(0);
    expect(weekday(t - 1)).toBe(0);
    expect(weekday(t)).toBe(1);
    expect(weekday(7 * t)).toBe(0);
  });
  it('daysUntil counts forward, 0 if today', () => {
    const t = BALANCE.ticksPerDay;
    expect(daysUntil(0, 5)).toBe(5);
    expect(daysUntil(5 * t, 5)).toBe(0);
    expect(daysUntil(6 * t, 5)).toBe(6);
  });
});
