import { describe, it, expect } from 'vitest';
import { dayOfWeek, isSaturday, WEEKDAY_KEYS } from '../sim/calendar';

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
});
