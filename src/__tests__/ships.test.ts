import { describe, it, expect } from 'vitest';
import { shipRuns, shipsAt, shipPeriods, shipSprite, SHIP_DOCKED_S, SHIP_FADE_S } from '../render/clay/ships';
import { craneMove } from '../render/clay/portArt';

const W = 20;   // a 20×40 map
const idx = (x: number, y: number) => y * W + x;
// From the water off the docks at (10, 30): north to (10, 12), west to (2, 12), north to the edge at (2, 0).
const route: number[] = [];
for (let y = 30; y >= 12; y--) route.push(idx(10, y));
for (let x = 9; x >= 2; x--) route.push(idx(x, 12));
for (let y = 11; y >= 0; y--) route.push(idx(2, y));
const berth = { x: 10.5, y: 31.5, qx: 1, qy: 0 };
const runs = shipRuns(route, W);

describe('ship runs', () => {
  it('splits the lane into its straight runs, walked outwards, leaving out the ends by the docks and the edge', () => {
    expect(runs.map(r => [r.dx, r.dy])).toEqual([[0, -1], [-1, 0], [0, -1]]);
    expect(runs[0]).toMatchObject({ x: 10.5, y: 27.5, len: 15 });     // three tiles off the docks, to the corner
    expect(runs[2].y - runs[2].len).toBeCloseTo(1.5);                  // stops a tile short of the edge
  });

  it('drops runs too short for a ship', () => {
    const zig = [idx(5, 9), idx(5, 8), idx(5, 7), idx(5, 6), idx(4, 6), idx(4, 5), idx(3, 5), idx(3, 4), idx(3, 3), idx(3, 2), idx(3, 1), idx(3, 0)];
    expect(shipRuns(zig, W).map(r => r.len)).toEqual([4]);   // only the last leg north; the zigzag is left out
  });
});

describe('ship traffic', () => {
  const over = (spd: number, f: (s: ReturnType<typeof shipsAt>) => void) => { for (let t = 0; t < 600; t += 0.5) f(shipsAt(runs, berth, t, spd, 0.3)); };

  it('no trade, no ships', () => {
    over(0, s => expect(s).toHaveLength(0));
  });

  it('is sparse: at most one in, one out and one docked, and often none', () => {
    let empty = 0, n = 0;
    over(1, s => { expect(s.length).toBeLessThanOrEqual(3); if (s.length === 0) empty++; n++; });
    expect(empty / n).toBeGreaterThan(0.3);
  });

  it('passing ships sail along a straight run, never turning, on its right-hand side, fading in and out', () => {
    let seen = 0;
    over(5, s => { for (const st of s) {
      expect(st.a).toBeGreaterThanOrEqual(0); expect(st.a).toBeLessThanOrEqual(1);
      if (st.work >= 0) continue;
      seen++;
      expect(Math.abs(st.hx) + Math.abs(st.hy)).toBe(1);
      expect(runs.some(r => (r.dx === st.hx && r.dy === st.hy) || (r.dx === -st.hx && r.dy === -st.hy))).toBe(true);
      expect(Math.hypot(st.x - berth.x, st.y - berth.y)).toBeGreaterThan(3);
    } });
    expect(seen).toBeGreaterThan(0);
  });

  it('the docked ship lies along the quay, fading in as the cranes start', () => {
    const per = shipPeriods(5).dock;
    let docked = null;
    for (let t = 0; t < 10 * per && !docked; t += 0.25) docked = shipsAt(runs, berth, t, 5, 0.3).find(st => st.work >= 0 && st.work < 0.3) ?? null;
    expect(docked).not.toBeNull();
    expect(docked!.x).toBeCloseTo(10.5); expect(docked!.y).toBeCloseTo(31.5);
    expect(Math.abs(docked!.hx)).toBe(1);
    expect(docked!.a).toBeLessThan(0.25);
  });

  it('busier ports see ships more often, but never a stream', () => {
    expect(shipPeriods(10).lane).toBeLessThan(shipPeriods(1).lane);
    expect(shipPeriods(1000).lane).toBeGreaterThanOrEqual(16);
  });

  it('the debug button sends one ship on each lane right away, trade or not', () => {
    const s = shipsAt(runs, berth, 123, 0, 0.3, SHIP_FADE_S);
    expect(s).toHaveLength(3);
    expect(s.every(st => st.a === 1)).toBe(true);
    expect(shipsAt(runs, berth, 123, 0, 0.3, SHIP_DOCKED_S + 1)).toHaveLength(0);
  });
});

describe('ship sprite', () => {
  const st = (hx: number, hy: number, type: 'container' | 'freighter' = 'container') => ({ x: 0, y: 0, hx, hy, type, work: -1, a: 1 });
  it('side-on east, mirrored west, bow-on south, stern-on north; the freighter only side-on', () => {
    expect(shipSprite(st(1, 0))).toEqual({ name: 'ship-side', flip: false });
    expect(shipSprite(st(-1, 0, 'freighter'))).toEqual({ name: 'freighter-side', flip: true });
    expect(shipSprite(st(0, 1)).name).toBe('ship-south');
    expect(shipSprite(st(0, -1)).name).toBe('ship-north');
  });

  it('never picks a freighter for a north or south run', () => {
    for (let t = 0; t < 2000; t += 1) for (const s of shipsAt(runs, berth, t, 10, 0.7)) if (s.hy !== 0) expect(s.type).toBe('container');
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
