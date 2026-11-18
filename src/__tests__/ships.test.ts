import { describe, it, expect } from 'vitest';
import { shipRuns, shipsAt, shipPeriod, shipSprite, shipBob, SHIP_DOCKED_S, SHIP_FADE_S } from '../render/clay/ships';
import { craneMove } from '../render/clay/portArt';

const W = 40;   // a 40×60 map
const idx = (x: number, y: number) => y * W + x;
// From the water off the docks at (20, 50): north to (20, 30), west to (5, 30), north to the edge at (5, 0).
const route: number[] = [];
for (let y = 50; y >= 30; y--) route.push(idx(20, y));
for (let x = 19; x >= 5; x--) route.push(idx(x, 30));
for (let y = 29; y >= 0; y--) route.push(idx(5, y));
const berth = { x: 20.5, y: 51.5, qx: 1, qy: 0 };
const runs = shipRuns(route, W);

describe('ship runs', () => {
  it('are the straight runs of the lane, walked outwards, leaving out 8 tiles by the docks and 2 at the edge', () => {
    expect(runs.map(r => [r.dx, r.dy])).toEqual([[0, -1], [-1, 0], [0, -1]]);
    expect(runs[0]).toMatchObject({ x: 20.5, y: 42.5, len: 12 });     // out at sea: 8 tiles off the docks, to the corner
    expect(runs[2].y - runs[2].len).toBeCloseTo(2.5);                  // stops 2 tiles short of the edge
  });

  it('drop runs too short for a 2.25-tile ship, and a short lane has none (its port only has docked ships)', () => {
    const short = Array.from({ length: 12 }, (_, k) => idx(3, 11 - k));
    expect(shipRuns(short, W)).toEqual([]);
  });
});

describe('ship traffic', () => {
  const over = (spd: number, f: (s: ReturnType<typeof shipsAt>, t: number) => void) => { for (let t = 0; t < 1200; t += 0.5) f(shipsAt(runs, berth, t, spd, 0.3), t); };

  it('no trade, no ships', () => {
    over(0, s => expect(s).toHaveLength(0));
  });

  it('is rare: one ship about a port at a time, and often none', () => {
    let empty = 0, n = 0;
    over(50, s => { expect(s.length).toBeLessThanOrEqual(1); if (s.length === 0) empty++; n++; });
    expect(empty / n).toBeGreaterThan(0.3);
    expect(shipPeriod(1000)).toBe(30);   // even the busiest port: a turn every half minute
    expect(shipPeriod(0.5)).toBe(90);
  });

  it('passing ships stay out at sea on a straight run, never turning, fading in and out', () => {
    let seen = 0;
    over(5, s => { for (const st of s) {
      expect(st.a).toBeGreaterThanOrEqual(0); expect(st.a).toBeLessThanOrEqual(1);
      if (st.work >= 0) continue;
      seen++;
      expect(Math.abs(st.hx) + Math.abs(st.hy)).toBe(1);
      expect(runs.some(r => (r.dx === st.hx && r.dy === st.hy) || (r.dx === -st.hx && r.dy === -st.hy))).toBe(true);
      expect(Math.hypot(st.x - berth.x, st.y - berth.y)).toBeGreaterThan(7);
    } });
    expect(seen).toBeGreaterThan(0);
  });

  it('a docked ship lies at the berth along the quay, fading in as the cranes start', () => {
    let docked = null;
    for (let t = 0; t < 3000 && !docked; t += 0.25) docked = shipsAt(runs, berth, t, 5, 0.3).find(st => st.work >= 0 && st.work < 0.3) ?? null;
    expect(docked).not.toBeNull();
    expect(docked!.x).toBeCloseTo(20.5); expect(docked!.y).toBeCloseTo(51.5);
    expect(Math.abs(docked!.hx)).toBe(1);
    expect(docked!.a).toBeLessThan(0.25);
  });

  it('a port whose lane has no long run only ever shows docked ships', () => {
    for (let t = 0; t < 1200; t += 1) for (const st of shipsAt([], berth, t, 5, 0.3)) expect(st.work).toBeGreaterThanOrEqual(0);
  });

  it('the debug button shows a passing ship and a docked one right away, trade or not', () => {
    const s = shipsAt(runs, berth, 123, 0, 0.3, SHIP_FADE_S);
    expect(s).toHaveLength(2);
    expect(s.every(st => st.a === 1)).toBe(true);
    expect(shipsAt(runs, berth, 123, 0, 0.3, SHIP_DOCKED_S + 20)).toHaveLength(0);
  });

  it('ships bob gently, a few hundredths of a tile', () => {
    const st = { x: 3, y: 4, hx: 1, hy: 0, type: 'container' as const, work: -1, a: 1 };
    const b = Array.from({ length: 50 }, (_, k) => shipBob(st, k * 0.2));
    expect(Math.max(...b.map(Math.abs))).toBeLessThan(0.03);
    expect(Math.max(...b) - Math.min(...b)).toBeGreaterThan(0.01);
  });
});

describe('ship sprite', () => {
  const st = (hx: number, hy: number, type: 'container' | 'freighter' = 'container') => ({ x: 0, y: 0, hx, hy, type, work: -1, a: 1 });
  it('side-on east, mirrored west, bow-on south, stern-on north', () => {
    expect(shipSprite(st(1, 0))).toEqual({ name: 'ship-side', flip: false });
    expect(shipSprite(st(-1, 0, 'freighter'))).toEqual({ name: 'freighter-side', flip: true });
    expect(shipSprite(st(0, 1)).name).toBe('ship-south');
    expect(shipSprite(st(0, -1)).name).toBe('ship-north');
  });

  it('never picks a freighter for a north or south run (it only has a side-on look)', () => {
    for (let t = 0; t < 4000; t += 1) for (const s of shipsAt(runs, berth, t, 10, 0.7)) if (s.hy !== 0) expect(s.type).toBe('container');
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
