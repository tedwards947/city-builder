import { describe, it, expect } from 'vitest';
import { cloneWorld } from './world';
import { DERIVED_LAYERS } from '../persistence/SaveFormat';
import { buildLivingCity } from '../__tests__/fixtures/testCity';

describe('balance lab: cloneWorld', () => {
  it('copies the derived layers as they are (save v12 leaves them out of a save; a copy must match its source)', () => {
    const w = buildLivingCity().world;
    // Traffic-made layers a load would leave at 0, and coverage as the source has it.
    w.layers.congestion.fill(7);
    w.layers.accessibility.fill(9);
    const c = cloneWorld(w);
    const a = w.layers as unknown as Record<string, ArrayLike<number>>, b = c.layers as unknown as Record<string, ArrayLike<number>>;
    for (const name of DERIVED_LAYERS) expect(Array.from(b[name]), name).toEqual(Array.from(a[name]));
    expect(c.layers.congestion).not.toBe(w.layers.congestion);   // a copy, not the same array
  });
});
