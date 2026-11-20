import { describe, it, expect, vi } from 'vitest';

let gateway = false;
vi.mock('../sim/leisureTraffic', async (orig) => {
  const real = await orig<typeof import('../sim/leisureTraffic')>();
  return { ...real, hasGateway: () => gateway };
});

import { residentsOnlyWarning } from '../ui/ToastPanel';
import { BUILDING_MUSEUM, BUILDING_POLICE } from '../sim/constants';

describe('residents-only warning', () => {
  const world = {} as never;
  it('fires for the museum with no airport', () => {
    gateway = false;
    expect(residentsOnlyWarning(world, BUILDING_MUSEUM)).toBe(true);
  });
  it('does not fire for a police station', () => {
    gateway = false;
    expect(residentsOnlyWarning(world, BUILDING_POLICE)).toBe(false);
  });
  it('does not fire when a gateway exists', () => {
    gateway = true;
    expect(residentsOnlyWarning(world, BUILDING_MUSEUM)).toBe(false);
  });
});
