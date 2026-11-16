import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ZONE_R, ZONE_I, BUILDING_POLICE, BUILDING_POWER_PLANT, TERRAIN_GRASS } from '../sim/constants';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { ECON_PRESETS } from '../ui/econPresets';

type Tree = Record<string, unknown>;
const tax = BALANCE.tax as { landValueFloor: number };
const upkeep = BALANCE.maintenance as { serviceMult: number };
afterEach(() => { tax.landValueFloor = 0; upkeep.serviceMult = 1; });

/** One home and one factory at land value 0, a police station and a power plant. */
function world(): World {
  const w = new World(8, 8, 1);
  w.layers.terrain.fill(TERRAIN_GRASS);
  for (const [x, z] of [[1, ZONE_R], [2, ZONE_I]] as const) {
    const i = w.grid.idx(x, 1);
    w.layers.zone[i] = z; w.layers.devLevel[i] = 2; w.layers.landValue[i] = 0;
  }
  w.placeBuilding(5, 5, BUILDING_POLICE);
  w.placeBuilding(6, 6, BUILDING_POWER_PLANT);
  return w;
}

describe('economy knobs', () => {
  it('ship at the values that change nothing', () => {
    expect(tax.landValueFloor).toBe(0);
    expect(upkeep.serviceMult).toBe(1);
  });

  it('landValueFloor lets homes on worthless land pay; industry is unaffected', () => {
    const w = world();
    new EconomySystem().update(w);
    const industryOnly = w.budget.income;                       // the home pays 0 at lv 0
    expect(industryOnly).toBeCloseTo(2 * BALANCE.tax.zoneI * BALANCE.tax.industryLandValueMult);
    tax.landValueFloor = 0.25;
    new EconomySystem().update(w);
    expect(w.budget.income - industryOnly).toBeCloseTo(2 * BALANCE.tax.zoneR * 0.25);
  });

  it('serviceMult scales service buildings only', () => {
    const w = world();
    const police = BALANCE.buildings[BUILDING_POLICE].maintenance;
    const plant = BALANCE.buildings[BUILDING_POWER_PLANT].maintenance;
    upkeep.serviceMult = 0.5;
    new EconomySystem().update(w);
    expect(w.budget.expenses).toBeCloseTo(police * 0.5 + plant);
  });

  it('presets name only settings that exist', () => {
    const paths = (t: Tree, p = ''): string[] => Object.entries(t).flatMap(([k, v]) =>
      v !== null && typeof v === 'object' ? paths(v as Tree, `${p}${k}.`) : [`${p}${k}`]);
    for (const preset of ECON_PRESETS) {
      for (const path of paths(preset.values)) {
        let node: unknown = BALANCE;
        for (const part of path.split('.')) node = (node as Tree)?.[part];
        expect(node, `${preset.id}: ${path}`).not.toBeUndefined();
      }
    }
  });
});
