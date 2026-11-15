import { describe, it, expect } from 'vitest';
import { RebakeBudget } from '../render/RebakeBudget';

describe('RebakeBudget (zoom smoothing)', () => {
  it('allows nothing while the tile size is changing', () => {
    const b = new RebakeBudget(3, 120);
    b.begin(16, 0);
    expect(b.allow(16)).toBe(false);
    b.begin(18, 16);                                   // still zooming
    expect(b.allow(18)).toBe(false);
    b.begin(18, 100);                                  // held, but not for long enough
    expect(b.allow(18)).toBe(false);
  });

  it('allows a few per frame once the size has held still', () => {
    const b = new RebakeBudget(3, 120);
    b.begin(16, 0);
    b.begin(16, 120);
    expect([b.allow(16), b.allow(16), b.allow(16), b.allow(16)]).toEqual([true, true, true, false]);
    b.begin(16, 136);                                  // next frame: a fresh allowance
    expect(b.allow(16)).toBe(true);
  });

  it('a new size starts the wait again', () => {
    const b = new RebakeBudget(3, 120);
    b.begin(16, 0);
    b.begin(16, 500);
    b.begin(20, 516);
    expect(b.allow(20)).toBe(false);
    b.begin(20, 636);
    expect(b.allow(20)).toBe(true);
  });

  it('always allows a caller drawing at another size, or with no frames at all', () => {
    const idle = new RebakeBudget(3, 120);
    expect(idle.allow(16)).toBe(true);                 // begin() never called
    const b = new RebakeBudget(1, 120);
    b.begin(16, 0);
    expect(b.allow(40)).toBe(true);                    // e.g. a preview drawn at its own size
    expect(b.allow(40)).toBe(true);
  });
});
