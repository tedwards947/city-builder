import { describe, it, expect, afterEach } from 'vitest';
import { BALANCE } from '../data/balance';
import { pcQuote, chargeQuote, refundCharges, pcCap } from './politics';
import { cellTrust, cellCap, trustCell, localTrustEnabled } from './localTrust';
import { landWorld, homes, displacementCost } from '../__tests__/pcTestWorld';

const LT = (BALANCE.politicalCapital as unknown as { localTrust: { enabled: boolean; minCap: number } }).localTrust;
afterEach(() => { LT.enabled = false; });

// Cell 0 (tiles 0–11) holds a few homes; cell 1 (12–23 across) holds many: most of the city's residents.
function city() {
  const w = landWorld(48);
  homes(w, 1, 1, 2, 2);          // 4 homes in cell 0
  homes(w, 12, 0, 23, 11);       // 144 homes in cell 1
  w.budget.politicalCapital = 100;
  return w;
}

describe('local trust prototype (off by default)', () => {
  it('is off as shipped: quotes are as before', () => {
    expect(localTrustEnabled()).toBe(false);
    const w = city();
    const q = pcQuote(w, { type: 'bulldoze', tx: 1, ty: 1 });
    expect(q.affordable).toBe(true);
    expect(q.localBlocked).toBeUndefined();
  });

  it('a small cell holds its share of the cap (at least minCap) and refuses what it cannot cover, while the city could', () => {
    LT.enabled = true;
    const w = city(), cap = pcCap(w);
    const small = trustCell(w, 1, 1), big = trustCell(w, 15, 5);
    expect(cellCap(w, small, cap)).toBe(LT.minCap);                       // 40 of 1,480 residents: under the floor
    expect(cellCap(w, big, cap)).toBeCloseTo(cap * 1440 / 1480, 5);
    expect(displacementCost()).toBeGreaterThan(LT.minCap);
    const q = pcQuote(w, { type: 'bulldoze', tx: 1, ty: 1 });
    expect(q.affordable).toBe(false);
    expect(q.localBlocked).toBe(true);
    expect(w.budget.politicalCapital).toBeGreaterThan(q.cost);          // the city alone would allow it
  });

  it('charges the cell where the residents live, and undo gives it back', () => {
    LT.enabled = true;
    const w = city(), cap = pcCap(w), big = trustCell(w, 15, 5);
    const before = cellTrust(w, big, cap);
    const q = pcQuote(w, { type: 'bulldoze', tx: 15, ty: 5 });
    expect(q.affordable).toBe(true);
    const charges = chargeQuote(w, q, 15, 5);
    expect(cellTrust(w, big, cap)).toBeCloseTo(before - displacementCost(), 5);
    expect(cellTrust(w, trustCell(w, 1, 1), cap)).toBe(LT.minCap);      // another cell is untouched
    refundCharges(w, charges, 15, 5);
    expect(cellTrust(w, big, cap)).toBeCloseTo(before, 5);
  });
});
