import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { PC_VARIANTS, applyValues } from '../ui/pcPresets';
import { TUNED_T } from '../balance/tunedT';
import { PC_OFF } from '../data/pcOff';

const PROPOSED_PC = PC_VARIANTS.find((v) => v.id === 'B')!.values;

type Tree = Record<string, unknown>;

/** Every leaf path in a preset, e.g. "nuisance.buildingPerResident.1". */
function paths(t: Tree, prefix = ''): string[] {
  return Object.entries(t).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? paths(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}`]);
}

describe('PC tuning presets', () => {
  it('has the five variants, each naming only settings that exist in BALANCE.politicalCapital', () => {
    expect(PC_VARIANTS.map((v) => v.id)).toEqual(['A', 'B', 'C', 'D', 'T']);
    for (const path of PC_VARIANTS.flatMap((v) => paths(v.values as Tree).map((p) => `${v.id}:${p}`))) {
      const [, keyPath] = path.split(':');
      let node: unknown = BALANCE.politicalCapital;
      for (const part of keyPath.split('.')) node = (node as Tree)?.[part];
      expect(node, path).not.toBeUndefined();
    }
  });

  it("uses the lab's tuned set for T, so the panel and the nightly grade the same numbers", () => {
    expect(PC_VARIANTS.find((v) => v.id === 'T')!.values).toBe(TUNED_T);
  });

  it('ships T: T is read from BALANCE.politicalCapital and covers exactly the numbers Off does', () => {
    expect(paths(TUNED_T).sort()).toEqual(paths(PC_OFF).sort());
    expect(TUNED_T.max).toBe(150);
    const target = structuredClone(BALANCE.politicalCapital) as unknown as Tree;
    applyValues(target, structuredClone(PC_OFF));
    expect(target).not.toEqual(BALANCE.politicalCapital);
    applyValues(target, structuredClone(TUNED_T));
    expect(target).toEqual(BALANCE.politicalCapital);     // Off, then T, is the shipped numbers again
  });

  it('Off switches every Political Capital effect off', () => {
    const off = structuredClone(BALANCE.politicalCapital) as unknown as Tree;
    applyValues(off, structuredClone(PC_OFF));
    const leaves = (t: unknown): number[] => (typeof t === 'object' && t !== null ? Object.values(t).flatMap(leaves) : [t as number]);
    expect(off.milestones).toEqual([]);
    expect(off.ordinancesEnabled).toBe(false);
    expect((off.requests as Tree).spawnEveryDays).toBe(0);
    expect([off.capPerResident, off.overCapFadePerDay, off.neutralSatisfaction, off.establishedYears]).toEqual([0, 0, 0, 0]);
    expect(leaves((off.service as Tree).perResident).every((v) => v === 0)).toBe(true);
    expect(leaves((off.nuisance as Tree).buildingPerResident).every((v) => v === 0)).toBe(true);
    expect((off.nuisance as Tree).industrialPerResident).toBe(0);
    for (const o of Object.values(off.ordinances as Record<string, Tree>)) {
      expect([o.enactCost, o.dailyUpkeep, o.dailyMoney]).toEqual([0, 0, 0]);
      expect(leaves(o.modifiers).every((v) => v === 1)).toBe(true);
    }
  });

  it('applies values in place, keeping list identity', () => {
    const target = structuredClone(BALANCE.politicalCapital) as unknown as Tree;
    const milestones = target.milestones;
    const bands = (target.nuisance as Tree).bands;
    applyValues(target, structuredClone(PROPOSED_PC) as unknown as Tree);
    expect(target.milestones).toBe(milestones);
    expect((target.nuisance as Tree).bands).toBe(bands);
    expect(target.milestones).toEqual((PROPOSED_PC as Tree).milestones);
    expect(target.neutralSatisfaction).toBe(0.75);
    expect(((target.service as Tree).perResident as Tree)[7]).toBe(0.0086);  // variant B, rescaled for the #116 ranges
    expect((target.satisfactionWeights as Tree).crime).toBe(BALANCE.politicalCapital.satisfactionWeights.crime);
  });
});
