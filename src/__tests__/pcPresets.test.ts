import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { PROPOSED_PC, applyValues } from '../ui/pcPresets';

type Tree = Record<string, unknown>;

/** Every leaf path in a preset, e.g. "nuisance.buildingPerResident.1". */
function paths(t: Tree, prefix = ''): string[] {
  return Object.entries(t).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? paths(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}`]);
}

describe('PC tuning presets', () => {
  it('only names settings that exist in BALANCE.politicalCapital', () => {
    for (const path of paths(PROPOSED_PC as unknown as Tree)) {
      let node: unknown = BALANCE.politicalCapital;
      for (const part of path.split('.')) node = (node as Tree)?.[part];
      expect(node, path).not.toBeUndefined();
    }
  });

  it('applies values in place, keeping list identity', () => {
    const target = structuredClone(BALANCE.politicalCapital) as unknown as Tree;
    const milestones = target.milestones;
    const bands = (target.nuisance as Tree).bands;
    applyValues(target, structuredClone(PROPOSED_PC) as unknown as Tree);
    expect(target.milestones).toBe(milestones);
    expect((target.nuisance as Tree).bands).toBe(bands);
    expect(target.milestones).toEqual(PROPOSED_PC.milestones);
    expect(target.neutralSatisfaction).toBe(0.6);
    expect(((target.service as Tree).perResident as Tree)[7]).toBe(0.06);
    expect((target.satisfactionWeights as Tree).crime).toBe(BALANCE.politicalCapital.satisfactionWeights.crime);
  });
});
