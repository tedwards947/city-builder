// Money trend arrow beside the HUD's money figure (owner, 2026-11-22): green arrows while the city
// earns more than it spends each tick, red while it spends more; a double arrow when the gap is large.

export type MoneyTrend = 'up2' | 'up' | 'flat' | 'down' | 'down2';

/** Below this share of the tick's turnover the budget counts as balanced (no arrow). */
export const TREND_FLAT_SHARE = 0.005;
/** At or above this share of the tick's turnover the arrow doubles. */
export const TREND_BIG_SHARE = 0.1;

/**
 * The trend for one tick's income and expenses. The gap is judged against the larger of the two,
 * so a $300 surplus is a single arrow for a city turning over $11k a tick and a double one for a
 * town turning over $1k.
 */
export function moneyTrend(income: number, expenses: number): MoneyTrend {
  const net = income - expenses;
  const turnover = Math.max(Math.abs(income), Math.abs(expenses));
  if (turnover <= 0 || Math.abs(net) < turnover * TREND_FLAT_SHARE) return 'flat';
  const big = Math.abs(net) >= turnover * TREND_BIG_SHARE;
  if (net > 0) return big ? 'up2' : 'up';
  return big ? 'down2' : 'down';
}

/** The glyph shown for a trend (empty when balanced). */
export const TREND_GLYPH: Record<MoneyTrend, string> = {
  // The doubles are stacked (owner, 2026-11-22), forced to text style (U+FE0E) so they take the colour, not emoji.
  up2: '\u23EB\uFE0E', up: '↑', flat: '', down: '↓', down2: '\u23EC\uFE0E',
};
