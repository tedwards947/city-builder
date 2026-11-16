// How political capital amounts are written everywhere in the interface:
// a diamond and a number, e.g. "◆ 12", "+◆ 9", "−◆ 3.5".

export const PC_SYMBOL = '◆';

/** A PC amount without a sign: whole numbers as they are, small fractions to one decimal. */
export function pcAmount(n: number): string {
  const a = Math.abs(n);
  if (a >= 10 || Number.isInteger(a)) return Math.round(a).toLocaleString('en-US');
  const one = Math.round(a * 10) / 10;
  return one === 0 ? '0.1' : Number.isInteger(one) ? one.toFixed(0) : one.toFixed(1);
}

/** A signed change, as floated over the map: "+◆ 9" or "−◆ 20". */
export function pcDelta(delta: number): string {
  return (delta < 0 ? '−' : '+') + PC_SYMBOL + ' ' + pcAmount(delta);
}

/**
 * The passive rate beside the HUD figure, per game day: "+1.6/day", "−0.8/day".
 * Empty when PC is not moving (at the cap, or nothing to report).
 */
export function pcRate(perDay: number): string {
  if (Math.abs(perDay) < 0.05) return '';
  return (perDay < 0 ? '−' : '+') + Math.abs(perDay).toFixed(1) + '/day';
}

/**
 * The small text beside the HUD figure. Normally the passive rate. Over the
 * cap the banked extra fades, so it reads "−0.4/day" ("bonus" when the fade
 * is off or too small to show; the two together overflow the HUD row); at the cap with nothing moving, "full".
 * `regenPerDay` and `fadePerDay` are per game day; the fade is a positive amount.
 */
export function pcHudRate(
  regenPerDay: number, fadePerDay: number, over: boolean, full: boolean,
  labels: { bonus: string; full: string },
): string {
  const rate = pcRate(regenPerDay - (over ? fadePerDay : 0));
  if (over) return rate || labels.bonus;
  return rate || (full ? labels.full : '');
}

/**
 * The HUD figure: "62 / 100", or "−12 / 100" in political debt. Rounds down,
 * so it never overstates what the city has or understates what it owes.
 */
export function pcOfCap(pc: number, cap: number): string {
  const whole = Math.floor(pc);
  return (whole < 0 ? '−' + -whole : String(whole)) + ' / ' + Math.round(cap);
}
