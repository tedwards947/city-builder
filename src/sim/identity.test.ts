import { describe, it, expect } from 'vitest';
import { nearestType, cellIdentities, IDENTITY_TYPES, type Traits } from './identity';
import { identityRow } from '../ui/TileInfoPanel';
import { buildLivingCity } from '../__tests__/fixtures/testCity';

const flat: Traits = { egalitarian: 0, green: 0, planned: 0, density: 0, wealth: 0, shops: 0, industry: 0 };

describe('neighbourhood identities (debug-only prototype)', () => {
  it('each type is the nearest to its own profile', () => {
    expect(nearestType({ ...flat, density: -1, shops: -0.6, planned: 0.6, green: 0.4, industry: -0.4 })).toBe('familySuburb');
    expect(nearestType({ ...flat, wealth: -1, industry: 1, egalitarian: 0.6, green: -0.4 })).toBe('workingClass');
    expect(nearestType({ ...flat, green: 1, wealth: 1, density: -0.6, industry: -0.8 })).toBe('leafyWealthy');
    expect(nearestType({ ...flat, density: 1.2, shops: 1.2 })).toBe('downtown');
    expect(nearestType({ ...flat, shops: 0.6, planned: -1.2, egalitarian: 0.6 })).toBe('creative');
  });

  it('labels the cells of a living city, each with one of the five types', () => {
    const { world } = buildLivingCity();
    const ids = [...cellIdentities(world).values()];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(IDENTITY_TYPES).toContain(id.type);
  });

  it('Inspect: the row shows only under ?debug=true', () => {
    const { world } = buildLivingCity();
    const id = [...cellIdentities(world).values()][0];
    const tx = (id.cell % Math.ceil(world.grid.width / 12)) * 12 + 6, ty = Math.floor(id.cell / Math.ceil(world.grid.width / 12)) * 12 + 6;
    expect(identityRow(world, tx, ty, false)).toBe('');
    const row = identityRow(world, tx, ty, true);
    expect(row).toContain('Neighbourhood:');
    expect(row).toContain('density');
    expect(row).not.toContain('identityType');   // the type is translated, not shown as a key
  });
});
