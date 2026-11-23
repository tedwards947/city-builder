import { describe, it, expect } from 'vitest';
import { debtPauseDue, newDebtWatch } from './debtPause';

describe('auto-pause on going into debt', () => {
  it('pauses once on the step below 0, not again until money has recovered and dips again', () => {
    const w = newDebtWatch(), city = {};
    expect(debtPauseDue(w, city, 500)).toBe(false);     // watch starts
    expect(debtPauseDue(w, city, 10)).toBe(false);
    expect(debtPauseDue(w, city, -5)).toBe(true);       // into debt: pause
    expect(debtPauseDue(w, city, -50)).toBe(false);     // unpaused, still in debt: no second pause
    expect(debtPauseDue(w, city, -1)).toBe(false);
    expect(debtPauseDue(w, city, 0)).toBe(false);       // back at 0 re-arms
    expect(debtPauseDue(w, city, -2)).toBe(true);       // dips again: pause again
  });

  it('does not pause on loading a city already in debt, only after it has been out of debt', () => {
    const w = newDebtWatch(), city = {};
    expect(debtPauseDue(w, city, -1000)).toBe(false);   // loaded in debt
    expect(debtPauseDue(w, city, -900)).toBe(false);
    expect(debtPauseDue(w, city, 100)).toBe(false);
    expect(debtPauseDue(w, city, -1)).toBe(true);
  });

  it('a new or loaded city starts the watch afresh', () => {
    const w = newDebtWatch(), a = {}, b = {};
    expect(debtPauseDue(w, a, 100)).toBe(false);
    expect(debtPauseDue(w, b, -10)).toBe(false);        // switched to a city in debt: no pause
    expect(debtPauseDue(w, b, -20)).toBe(false);
  });
});
