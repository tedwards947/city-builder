// Vibe variants mix in by strength (owner, 2026-11-27): a vibe area should not flip to one design all at once.
import { describe, it, expect } from 'vitest';
import { clayVibeShare, lotDraw } from '../render/clay/ClaySprites';

const vibe = (green: number, egalitarian = 0) => ({ green, egalitarian, planned: 0, isNight: false });

describe('vibe variant mix', () => {
  it('shows no variant up to the threshold, then a rising share up to 60% at full lean', () => {
    expect(clayVibeShare(vibe(0))).toBe(0);
    expect(clayVibeShare(vibe(0.25))).toBe(0);
    const mid = clayVibeShare(vibe(0.5)), full = clayVibeShare(vibe(100 / 128));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(full);
    expect(full).toBeCloseTo(0.6);
    expect(clayVibeShare(vibe(-1))).toBeCloseTo(0.6);   // either end of the axis
    expect(clayVibeShare(vibe(0, -0.9))).toBeCloseTo(0.6);
  });

  it("gives each lot a fixed draw, spread evenly, so the share decides how many lots change and none flickers", () => {
    expect(lotDraw(1234, 77)).toBe(lotDraw(1234, 77));
    let under = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const d = lotDraw(i, (i * 37) & 255);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(1);
      if (d < 0.3) under++;
    }
    expect(under / n).toBeGreaterThan(0.28);
    expect(under / n).toBeLessThan(0.32);
  });
});
