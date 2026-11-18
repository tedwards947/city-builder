import { describe, it, expect } from 'vitest';
import { shipPath, shipsAt, shipPeriods, along, SHIP_DOCKED_S, SHIP_FADE_S } from '../render/clay/ships';
import { craneMove } from '../render/clay/portArt';

// A 20×10 map; the route runs from the water off the docks at (10, 3) north to the edge at (10, 0).
const W = 20, H = 10;
const idx = (x: number, y: number) => y * W + x;
const route = [idx(10, 3), idx(10, 2), idx(10, 1), idx(10, 0)];
const berth = { x: 10.5, y: 3.5, qx: 1, qy: 0 };

describe('ship path', () => {
  it('starts off the map beyond the edge the route ends on and ends at the berth', () => {
    const p = shipPath(route, W, H, berth);
    expect(p.pts[0].y).toBeLessThan(0);
    expect(p.pts[p.pts.length - 1]).toEqual({ x: 10.5, y: 3.5 });
    expect(p.total).toBeGreaterThan(4);
  });

  it('rounds corners: no point of a bent route is a sharp tile centre', () => {
    const bent = [idx(10, 3), idx(9, 3), idx(9, 2), idx(9, 1), idx(9, 0)];
    const p = shipPath(bent, W, H, berth);
    expect(p.pts.some(q => q.x === 9.5 && q.y === 3.5)).toBe(false);
    const mid = along(p, p.total / 2);
    expect(Math.hypot(mid.dx, mid.dy)).toBeCloseTo(1, 5);
  });
});

describe('ship traffic', () => {
  // A long channel: in from the north edge of a tall map down to the berth.
  const H2 = 40, idx2 = (x: number, y: number) => y * W + x;
  const long = Array.from({ length: 31 }, (_, k) => idx2(10, 30 - k));
  const b2 = { x: 10.5, y: 31.5, qx: 1, qy: 0 };
  const p = shipPath(long, W, H2, b2);
  const over = (spd: number, f: (s: ReturnType<typeof shipsAt>) => void) => { for (let t = 0; t < 600; t += 0.5) f(shipsAt(p, b2, t, spd, 0.3)); };

  it('comes onto the map a few tiles along the path', () => {
    expect(p.edge).toBeGreaterThan(3);
    expect(p.edge).toBeLessThan(5);
  });

  it('no trade, no ships', () => {
    over(0, s => expect(s).toHaveLength(0));
  });

  it('is sparse: at most one in, one out and one docked, and often none', () => {
    let empty = 0, n = 0;
    over(1, s => { expect(s.length).toBeLessThanOrEqual(3); if (s.length === 0) empty++; n++; });
    expect(empty / n).toBeGreaterThan(0.3);
  });

  it('passing ships stay on the map, clear of the berth, and fade in and out', () => {
    let seen = 0;
    over(5, s => { for (const st of s) {
      expect(st.a).toBeGreaterThanOrEqual(0); expect(st.a).toBeLessThanOrEqual(1);
      if (st.work >= 0) continue;
      seen++;
      expect(st.y).toBeGreaterThan(2);
      expect(Math.hypot(st.x - b2.x, st.y - b2.y)).toBeGreaterThan(3.5);
    } });
    expect(seen).toBeGreaterThan(0);
  });

  it('the docked ship lies along the quay, fading in as the cranes start', () => {
    const per = shipPeriods(5).dock;
    let docked = null;
    for (let t = 0; t < 10 * per && !docked; t += 0.25) docked = shipsAt(p, b2, t, 5, 0.3).find(st => st.work >= 0 && st.work < 0.3) ?? null;
    expect(docked).not.toBeNull();
    expect(docked!.x).toBeCloseTo(10.5); expect(docked!.y).toBeCloseTo(31.5);
    expect(Math.abs(docked!.hx)).toBeCloseTo(1, 5);
    expect(docked!.sp).toBe(0);
    expect(docked!.a).toBeLessThan(0.25);
  });

  it('busier ports see ships more often', () => {
    expect(shipPeriods(10).lane).toBeLessThan(shipPeriods(1).lane);
    expect(shipPeriods(1000).lane).toBeGreaterThanOrEqual(16);   // never a stream
  });

  it('the debug button sends one ship on each lane right away, trade or not', () => {
    const s = shipsAt(p, b2, 123, 0, 0.3, SHIP_FADE_S);
    expect(s).toHaveLength(3);
    expect(s.every(st => st.a === 1)).toBe(true);
    expect(shipsAt(p, b2, 123, 0, 0.3, SHIP_DOCKED_S + 1)).toHaveLength(0);
  });
});

describe('crane move', () => {
  it('lifts on the quay, runs out with the box, lowers it over the ship and comes back empty', () => {
    expect(craneMove(0)).toMatchObject({ x: 0, carry: true });
    expect(craneMove(3).carry).toBe(true);
    expect(craneMove(5.49)).toMatchObject({ x: 1, carry: true });
    expect(craneMove(5.49).d).toBeGreaterThan(0.99);
    expect(craneMove(8).carry).toBe(false);
    expect(craneMove(10)).toEqual(craneMove(0));
  });
});
