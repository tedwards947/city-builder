// Identities are worked out once a game day, not every tick (Inspect with ?debug=true ran at ~1 fps).
import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { cellIdentities, identityStats } from '../sim/identity';
import { landWorld } from './pcTestWorld';

describe('cellIdentities cache', () => {
  it('a second call in the same day, even after ticks and edits, does not recompute; the next day does', () => {
    const w = landWorld(32);
    const a = cellIdentities(w), n = identityStats.computes;
    w.tick += 1; w.grid.edits++;
    expect(cellIdentities(w)).toBe(a);
    w.tick = BALANCE.ticksPerDay - 1;
    expect(cellIdentities(w)).toBe(a);
    expect(identityStats.computes).toBe(n);
    w.tick = BALANCE.ticksPerDay;
    expect(cellIdentities(w)).not.toBe(a);
    expect(identityStats.computes).toBe(n + 1);
  });
});
