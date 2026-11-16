import { describe, it, expect } from 'vitest';
import { hoverPcPreview, pcActionForTool, pcLabel } from '../ui/pcPreview';
import { landWorld, home, homes, displacementCost, TEST_NUISANCE } from './pcTestWorld';

describe('political capital preview at the pointer', () => {
  it('is nothing for tools and places where PC does not come into it', () => {
    const w = landWorld();
    expect(hoverPcPreview(w, 'none', { tx: 5, ty: 5 })).toBeNull();
    expect(hoverPcPreview(w, 'inspect', { tx: 5, ty: 5 })).toBeNull();
    expect(hoverPcPreview(w, 'bulldoze', { tx: 5, ty: 5 })).toBeNull();       // empty land
    expect(hoverPcPreview(w, 'park', { tx: 5, ty: 5 }, TEST_NUISANCE)).toBeNull();
    // With the shipped numbers (all 0) a power plant shows nothing either.
    expect(hoverPcPreview(w, 'power', { tx: 5, ty: 5 })).toBeNull();
  });

  it('shows the cost of displacing a home under the bulldozer', () => {
    const w = landWorld();
    home(w, 5, 5);
    const p = hoverPcPreview(w, 'bulldoze', { tx: 5, ty: 5 })!;
    expect(p.rings).toEqual([]);
    expect(p.tints).toEqual([]);
    expect(p.label).toBe('◆ ' + displacementCost());
    expect(p.ok).toBe(true);
  });

  it('gives an unpopular building its rings, and reads 0 on empty land', () => {
    const w = landWorld();
    const p = hoverPcPreview(w, 'power', { tx: 16, ty: 16 }, TEST_NUISANCE)!;
    expect(p.rings.map(r => r.within)).toEqual([2, 4, 6]);
    expect(p.tints).toEqual([]);
    expect(p.label).toBe('◆ 0');
    expect(p.ok).toBe(true);
  });

  it('tints the homes that object, stronger the nearer they are', () => {
    const w = landWorld();
    home(w, 17, 16);   // 1 away: full weight
    home(w, 16, 21);   // 5 away: outer band
    home(w, 16, 26);   // 10 away: out of range
    const p = hoverPcPreview(w, 'power', { tx: 16, ty: 16 }, TEST_NUISANCE)!;
    const at = (tx: number, ty: number) => p.tints.find(t => t.tx === tx && t.ty === ty)?.strength;
    expect(at(17, 16)).toBe(1);
    expect(at(16, 21)).toBe(0.25);
    expect(at(16, 26)).toBeUndefined();
    expect(p.label.startsWith('◆ ')).toBe(true);
    expect(p.label).not.toBe('◆ 0');
  });

  it('is not ok when the city cannot cover it', () => {
    const w = landWorld();
    homes(w, 14, 14, 15, 18);
    w.budget.politicalCapital = 1;
    expect(hoverPcPreview(w, 'power', { tx: 16, ty: 16 }, TEST_NUISANCE)!.ok).toBe(false);
    expect(hoverPcPreview(w, 'zoneI', { tx: 16, ty: 16 }, TEST_NUISANCE)!.ok).toBe(false);
  });

  it('maps tools to engine actions', () => {
    expect(pcActionForTool('zoneI', 1, 2)?.type).toBe('zone');
    expect(pcActionForTool('avenue', 1, 2)?.type).toBe('road');
    expect(pcActionForTool('hospital', 1, 2)?.type).toBe('building');
    expect(pcActionForTool('none', 1, 2)).toBeNull();
  });

  it('writes a quote as a price tag', () => {
    const q = { cost: 0, reward: 0, affordable: true, shortfall: 0, displacedPopulation: 0, parts: [] };
    expect(pcLabel(q)).toBe('');
    expect(pcLabel(q, true)).toBe('◆ 0');
    expect(pcLabel({ ...q, cost: 18 })).toBe('◆ 18');
    expect(pcLabel({ ...q, cost: 18, reward: 3 })).toBe('◆ 18 +◆ 3');
  });
});
