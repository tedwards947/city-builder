import { describe, it, expect } from 'vitest';
import { moneyTrend, TREND_GLYPH } from '../ui/moneyTrend';

describe('moneyTrend', () => {
  it('is flat when the budget balances or nothing moves', () => {
    expect(moneyTrend(0, 0)).toBe('flat');
    expect(moneyTrend(10_000, 10_020)).toBe('flat');   // 0.2% of turnover
    expect(TREND_GLYPH.flat).toBe('');
  });

  it('shows a single arrow for a small surplus or deficit', () => {
    expect(moneyTrend(11_392, 11_127)).toBe('up');      // fullcity: +$265 on $11.4k
    expect(moneyTrend(10_000, 10_500)).toBe('down');
  });

  it('shows a double arrow when the gap is a tenth of turnover or more', () => {
    expect(moneyTrend(1_000, 700)).toBe('up2');
    expect(moneyTrend(1_000, 1_200)).toBe('down2');
    expect(moneyTrend(0, 50)).toBe('down2');            // spending with no income at all
  });

  it('judges the gap against turnover, not in dollars', () => {
    expect(moneyTrend(11_000, 10_700)).toBe('up');      // $300 on $11k
    expect(moneyTrend(1_000, 700)).toBe('up2');         // $300 on $1k
  });
});
