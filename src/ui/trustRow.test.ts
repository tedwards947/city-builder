import { describe, it, expect, afterEach } from 'vitest';
import { BALANCE } from '../data/balance';
import { trustRow } from './TileInfoPanel';
import { landWorld, homes } from '../__tests__/pcTestWorld';

const LT = (BALANCE.politicalCapital as unknown as { localTrust: { enabled: boolean } }).localTrust;
afterEach(() => { LT.enabled = false; });

describe('Inspect: the local trust row (debug-only prototype)', () => {
  it('is empty as shipped', () => {
    const w = landWorld(24);
    homes(w, 1, 1, 3, 3);
    expect(trustRow(w, 2, 2)).toBe('');
  });

  it('shows the cell trust and cap when the prototype is on', () => {
    LT.enabled = true;
    const w = landWorld(24);
    homes(w, 1, 1, 3, 3);
    const row = trustRow(w, 2, 2);
    expect(row).toContain('Neighbourhood trust');
    expect(row).toMatch(/\d+ \/ \d+/);
  });
});
