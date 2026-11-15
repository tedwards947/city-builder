import { describe, it, expect } from 'vitest';
import { planWildTrees, wildDensity, wildVariant, WILD_SPECIES, WILD_VARIANTS } from '../render/clay/wildTrees';
import { WILD_TREE_RECTS } from '../render/clay/wildTreeData';

describe('wild trees', () => {
  it('has shapes for every species', () => {
    for (const species of WILD_SPECIES) expect(WILD_TREE_RECTS[species]?.length ?? 0).toBeGreaterThan(0);
  });

  it('plans one, two or four trees by density, back to front, inside reach of the tile', () => {
    for (let veg = 1; veg <= WILD_SPECIES.length; veg++) {
      for (let variant = 0; variant < WILD_VARIANTS; variant++) {
        for (let density = 1; density <= 3; density++) {
          const trees = planWildTrees(veg, variant, density);
          expect(trees).toHaveLength([0, 1, 2, 4][density]);
          for (let n = 0; n < trees.length; n++) {
            const t = trees[n];
            expect(t.shape).toBeLessThan(WILD_TREE_RECTS[t.species].length);
            expect(t.x).toBeGreaterThan(0); expect(t.x).toBeLessThan(1);
            expect(t.y).toBeGreaterThan(0.3); expect(t.y).toBeLessThan(1.1);
            if (n > 0) expect(t.y).toBeGreaterThanOrEqual(trees[n - 1].y);
          }
        }
      }
    }
  });

  it('is deterministic and a lone tree is always the tile\'s own species', () => {
    expect(planWildTrees(3, 5, 3)).toEqual(planWildTrees(3, 5, 3));
    for (let veg = 1; veg <= WILD_SPECIES.length; veg++) {
      for (let variant = 0; variant < WILD_VARIANTS; variant++) {
        expect(planWildTrees(veg, variant, 1)[0].species).toBe(WILD_SPECIES[veg - 1]);
      }
    }
  });

  it('plans nothing for an unknown species', () => {
    expect(planWildTrees(0, 0, 3)).toEqual([]);
    expect(planWildTrees(9, 0, 3)).toEqual([]);
  });

  it('rates lone trees 1, forest edges 2 and interiors 3', () => {
    expect(wildDensity(0)).toBe(1);
    expect(wildDensity(2)).toBe(2);
    expect(wildDensity(8)).toBe(3);
  });

  it('picks a stable variant in range for any tile', () => {
    for (let ty = 0; ty < 40; ty++) for (let tx = 0; tx < 40; tx++) {
      const v = wildVariant(tx, ty);
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(WILD_VARIANTS);
      expect(wildVariant(tx, ty)).toBe(v);
    }
  });
});
