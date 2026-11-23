import { describe, it, expect, afterEach } from 'vitest';
import { BALANCE } from '../data/balance';
import { pcQuote, chargeQuote, refundCharges, pcCap } from './politics';
import { cellTrust, cellCap, trustCell, localTrustEnabled, refillPerTick } from './localTrust';
import { landWorld, homes, displacementCost } from '../__tests__/pcTestWorld';

const LT = (BALANCE.politicalCapital as unknown as { localTrust: { enabled: boolean; minCap: number; cityGate: boolean; displacements: number; spill: number; homeShare: number; refillDays: number } }).localTrust;
afterEach(() => { LT.enabled = false; LT.cityGate = true; LT.displacements = 0; LT.spill = 0; LT.homeShare = 0; LT.refillDays = 0; });

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

  it('slice 2: cells sized in displacements, and with the city gate off only the cells refuse', () => {
    LT.enabled = true; LT.cityGate = false; LT.displacements = 2;
    const w = city(), cap = pcCap(w), small = trustCell(w, 1, 1);
    expect(cellCap(w, small, cap)).toBeCloseTo(2 * displacementCost(), 5);   // its homes are all level 2
    w.budget.politicalCapital = 0;                                            // the city could not pay…
    const q = pcQuote(w, { type: 'bulldoze', tx: 1, ty: 1 });
    expect(q.affordable).toBe(true);                                          // …but the cell can, and only it decides
    chargeQuote(w, q, 1, 1); chargeQuote(w, pcQuote(w, { type: 'bulldoze', tx: 2, ty: 1 }), 2, 1);
    const third = pcQuote(w, { type: 'bulldoze', tx: 1, ty: 2 });
    expect(third.affordable).toBe(false);                                     // two displacements spent: the third is refused
    expect(third.localBlocked).toBe(true);
  });

  it('slice 3: a loss spills onto the neighbouring cells (down to 0), and undo gives that back too', () => {
    LT.enabled = true; LT.cityGate = false; LT.displacements = 3; LT.spill = 0.3;
    const w = city(), cap = pcCap(w), small = trustCell(w, 1, 1), big = trustCell(w, 15, 5);
    const smallBefore = cellTrust(w, small, cap), bigBefore = cellTrust(w, big, cap);
    const q = pcQuote(w, { type: 'bulldoze', tx: 15, ty: 5 });
    const charges = chargeQuote(w, q, 15, 5);
    expect(cellTrust(w, big, cap)).toBeCloseTo(bigBefore - displacementCost(), 5);
    expect(cellTrust(w, small, cap)).toBeCloseTo(smallBefore - 0.3 * displacementCost(), 5);   // cell 0 is cell 1's neighbour
    refundCharges(w, charges, 15, 5);
    expect(cellTrust(w, small, cap)).toBeCloseTo(smallBefore, 5);
    expect(cellTrust(w, big, cap)).toBeCloseTo(bigBefore, 5);
  });

  it('play-feel: a cell holds a quarter of its homes, refills in a straight line, and only demolition is refused', () => {
    LT.enabled = true; LT.cityGate = false; LT.homeShare = 0.25; LT.refillDays = 30;
    const w = city(), cap = pcCap(w), big = trustCell(w, 15, 5);
    expect(cellCap(w, big, cap)).toBeCloseTo(0.25 * 144 * displacementCost(), 5);   // 144 level-2 homes
    expect(refillPerTick(cellCap(w, big, cap), cap, 0.1) * 30 * BALANCE.ticksPerDay).toBeCloseTo(cellCap(w, big, cap), 5);
    expect(refillPerTick(100, cap, -0.1)).toBe(0);                                   // paused while the city's mood drains PC
    // A quarter of 144 homes is 36: the 37th is refused.
    let cleared = 0;
    for (let y = 0; y < 12 && cleared < 40; y++) for (let x = 12; x < 24 && cleared < 40; x++) {
      const q = pcQuote(w, { type: 'bulldoze', tx: x, ty: y });
      if (!q.affordable) { expect(q.localBlocked).toBe(true); y = 99; break; }
      chargeQuote(w, q, x, y); w.setZone(x, y, 0); cleared++;
    }
    expect(cleared).toBe(36);
  });
});
