import { describe, it, expect } from 'vitest';
import { debtHud, timeInOffice } from '../ui/debtFormat';
import type { DebtStatus } from '../sim/debt';

const L = { ofLimit: 'Debt {pct}% of limit', overLimit: 'Debt over the limit', voteIn: 'Council vote in {days} days', voteIn1: 'Council vote in 1 day' };
const status = (money: number, limit: number, daysLeft: number | null = null, graceDays = 30): DebtStatus => ({
  limit, inDebt: money < 0, pastHalf: money < -limit / 2, overLimit: money < -limit, daysLeft, graceDays, gameOver: false,
});

describe('debtHud', () => {
  it('shows nothing out of debt', () => {
    expect(debtHud(500, status(500, 20000), L).show).toBe(false);
  });
  it('is plain under half the limit, amber past it', () => {
    expect(debtHud(-4000, status(-4000, 20000), L)).toMatchObject({ show: true, tone: 'plain', label: 'Debt 20% of limit', fill: 0.2 });
    expect(debtHud(-11200, status(-11200, 20000), L)).toMatchObject({ tone: 'amber', label: 'Debt 56% of limit' });
  });
  it('never says 100% while still within the limit', () => {
    expect(debtHud(-19999, status(-19999, 20000), L).label).toBe('Debt 99% of limit');
  });
  it('counts down past the limit: the bar is the time left', () => {
    const h = debtHud(-21900, status(-21900, 20000, 23), L);
    expect(h).toMatchObject({ countdown: true, tone: 'red', label: 'Council vote in 23 days' });
    expect(h.fill).toBeCloseTo(23 / 30);
    expect(debtHud(-21900, status(-21900, 20000, 1), L).label).toBe('Council vote in 1 day');
  });
  it('only warns past the limit when the countdown is switched off', () => {
    expect(debtHud(-21900, status(-21900, 20000, null, 0), L)).toMatchObject({ countdown: false, tone: 'red', fill: 1, label: 'Debt over the limit' });
  });
});

describe('timeInOffice', () => {
  it('gives months in the first year, then whole years', () => {
    expect(timeInOffice(95)).toEqual({ n: 3, unit: 'months' });
    expect(timeInOffice(360 * 14 + 200)).toEqual({ n: 14, unit: 'years' });
  });
});
