import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { pcQuote, pcCap, chargeQuote, refundCharges } from '../sim/politics';
import { landWorld, home } from './pcTestWorld';

// Owner 2026-11-22: bulldozing a merged tower asked more PC than the whole cap, so it could never be afforded.
describe('no single action costs more than half the PC cap', () => {
  it('a bill over the limit is scaled down to it; one under it is unchanged', () => {
    const w = landWorld(16);
    const cap = pcCap(w), most = BALANCE.politicalCapital.maxActionShare * cap;
    // A level-3 home: 20 residents × 2.33 = 46.6, under the limit (75 at the base cap).
    home(w, 2, 2, 3);
    const small = pcQuote(w, { type: 'bulldoze', tx: 2, ty: 2 });
    expect(small.cost).toBeCloseTo(20 * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop, 5);
    // Zoning over a block of homes is one action per tile; a building over many homes is one action.
    for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) home(w, x, y, 3);
    const big = pcQuote(w, { type: 'building', tx: 6, ty: 6, kind: 9 });   // a 3×3 large power plant over 9 homes
    expect(9 * 20 * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop).toBeGreaterThan(most);
    expect(big.cost).toBeCloseTo(most, 5);
    expect(big.parts.reduce((s, p) => s + Math.min(0, p.amount), 0)).toBeCloseTo(-most, 5);
  });

  it('the capped price is what is charged and what undo gives back', () => {
    const w = landWorld(16);
    for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) home(w, x, y, 3);
    w.budget.politicalCapital = pcCap(w);
    const before = w.budget.politicalCapital;
    const q = pcQuote(w, { type: 'building', tx: 6, ty: 6, kind: 9 });
    expect(q.affordable).toBe(true);
    const charges = chargeQuote(w, q, 6, 6);
    expect(w.budget.politicalCapital).toBeCloseTo(before - q.cost, 5);
    refundCharges(w, charges, 6, 6);
    expect(w.budget.politicalCapital).toBeCloseTo(before, 5);
  });
});
