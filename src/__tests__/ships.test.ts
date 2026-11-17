import { describe, it, expect } from 'vitest';
import { shipPath, shipAt, along, visitSeconds, SHIP_DOCKED_S, DAY_S } from '../render/clay/ships';
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

describe('ship timeline', () => {
  const p = shipPath(route, W, H, berth);
  const visit = visitSeconds(p), tIn = (visit - SHIP_DOCKED_S) / 2;

  it('no trade, no ships', () => {
    expect(shipAt(p, berth, 5, 0, 0)).toBeNull();
  });

  it('sails in, lies at the berth along the quay while docked, then sails out', () => {
    const coming = shipAt(p, berth, tIn / 2, 1, 0)!;
    expect(coming.work).toBe(-1);
    expect(coming.sp).toBeGreaterThan(0);
    expect(coming.hy).toBeGreaterThan(0.9);          // heading south, towards the port

    const docked = shipAt(p, berth, tIn + 5, 1, 0)!;
    expect(docked.work).toBeCloseTo(5, 5);
    expect(docked.sp).toBe(0);
    expect(docked.x).toBeCloseTo(10.5); expect(docked.y).toBeCloseTo(3.5);
    expect(Math.abs(docked.hx)).toBeCloseTo(1, 5);   // lying along the quay

    const going = shipAt(p, berth, tIn + SHIP_DOCKED_S + tIn / 2, 1, 0)!;
    expect(going.work).toBe(-1);
    expect(going.hy).toBeLessThan(-0.9);              // heading north, out to sea
  });

  it('spaces ships by ships a day, one at a time', () => {
    const slow = 0.01, period = DAY_S / slow;          // one ship every 100 days
    expect(shipAt(p, berth, visit + 10, slow, 0)).toBeNull();
    expect(shipAt(p, berth, period + 1, slow, 0)).not.toBeNull();
    // Brisk trade can't overlap visits: the next ship sets out after the last has gone.
    expect(shipAt(p, berth, visit + 1, 100, 0)).toBeNull();
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
