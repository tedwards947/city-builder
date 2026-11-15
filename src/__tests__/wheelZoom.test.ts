import { describe, it, expect } from 'vitest';
import { wheelZoomFactor } from '../input/wheelZoom';

describe('wheelZoomFactor', () => {
  it('one mouse-wheel notch is 10%, in either direction', () => {
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.1, 10);      // scroll up: zoom in
    expect(wheelZoomFactor(100)).toBeCloseTo(1 / 1.1, 10);   // scroll down: zoom out
  });

  it('zooming in and out by the same amount cancels exactly', () => {
    expect(wheelZoomFactor(-37) * wheelZoomFactor(37)).toBeCloseTo(1, 12);
  });

  it('small trackpad events zoom a little, and add up to the same as one big one', () => {
    const small = wheelZoomFactor(-4);
    expect(small).toBeGreaterThan(1);
    expect(small).toBeLessThan(1.005);
    let total = 1;
    for (let k = 0; k < 25; k++) total *= small;             // 25 × 4 px = one notch
    expect(total).toBeCloseTo(1.1, 10);
  });

  it('a notch reported in lines or pages is still a sensible step', () => {
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(1.1, 10);     // 3 lines = one notch
    expect(wheelZoomFactor(1, 2)).toBeCloseTo(1 / 1.25, 10); // a page: capped
  });

  it('caps a single huge event at 25%', () => {
    expect(wheelZoomFactor(-5000)).toBeCloseTo(1.25, 10);
    expect(wheelZoomFactor(5000)).toBeCloseTo(1 / 1.25, 10);
  });

  it('a pinch zooms faster per pixel than a scroll', () => {
    expect(wheelZoomFactor(-5, 0, true)).toBeCloseTo(Math.exp(0.05), 10);
    expect(wheelZoomFactor(-5, 0, true)).toBeGreaterThan(wheelZoomFactor(-5));
  });

  it('ignores zero and nonsense deltas', () => {
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(NaN)).toBe(1);
    expect(wheelZoomFactor(Infinity)).toBe(1);
  });
});
