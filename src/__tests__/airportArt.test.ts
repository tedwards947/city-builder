import { describe, it, expect } from 'vitest';
import { airportPlaneAt, bridgeOut, airportLivery, CYCLE_S, GATES, GATE_Y, RUNWAY } from '../render/clay/airport';
import { AIRPORT_SPRITES } from '../render/clay/airportSpriteData';

describe('the airport cycle', () => {
  const samples = Array.from({ length: CYCLE_S * 10 }, (_, k) => k / 10);

  it('moves smoothly: no jump between frames, whether on the ground or in the air', () => {
    for (let k = 1; k < samples.length; k++) {
      const a = airportPlaneAt(samples[k - 1]), b = airportPlaneAt(samples[k]);
      if (!a || !b) continue;
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.alt - a.alt)).toBeLessThan(1);
    }
  });

  it('lands on the runway, docks at the third gate while its bridge is out, and takes off out of sight', () => {
    expect(airportPlaneAt(12)).toMatchObject({ y: RUNWAY.y, alt: 0 });
    for (const c of [24.5, 32, 38.5]) { expect(airportPlaneAt(c)).toMatchObject({ x: GATES[2], y: GATE_Y }); expect(bridgeOut(c)).toBe(1); }
    for (const c of [0, 17, 21, 41, 47, 57]) expect(bridgeOut(c)).toBe(0);
    expect(airportPlaneAt(65.9)!.a).toBe(0);
    expect(airportPlaneAt(68)).toBeNull();
  });

  it('never parks on top of the planes standing at the first two gates', () => {
    for (const c of samples) {
      const p = airportPlaneAt(c);
      if (p && p.alt === 0 && Math.abs(p.y - GATE_Y) < 0.2) for (const g of GATES.slice(0, 2)) expect(Math.abs(p.x - g)).toBeGreaterThanOrEqual(1.5);
    }
  });
});

describe('liveries', () => {
  it('mostly the plain three, now and then the orca or the kawaii, never a panda', () => {
    const seen = new Map<string, number>();
    for (let n = 0; n < 2000; n++) { const l = airportLivery(n); seen.set(l, (seen.get(l) ?? 0) + 1); }
    expect([...seen.keys()].sort()).toEqual(['plane-blue', 'plane-kawaii', 'plane-navy', 'plane-orca', 'plane-red']);
    expect(seen.get('plane-orca')! / 2000).toBeLessThan(0.15);
    expect(seen.get('plane-kawaii')! / 2000).toBeLessThan(0.15);
  });

  it('every picture the airport draws has been baked', () => {
    for (const n of ['terminal', 'tower', 'hangar', 'bridge-long', 'bridge-short', 'plane-red', 'plane-navy', 'plane-blue', 'plane-orca', 'plane-kawaii', 'fuel', 'bags', 'tug', 'catering', 'stairs', 'fire']) {
      expect(AIRPORT_SPRITES[n], n).toBeDefined();
    }
  });
});

describe('planes stay in sight', () => {
  it('fades in at least 15 tiles before touchdown and only fades out 20 tiles past the runway start', () => {
    const first = Array.from({ length: 200 }, (_, k) => airportPlaneAt(k / 10)).find(p => p && p.a > 0.9)!;
    expect(first.x).toBeLessThan(-14);
    const late = Array.from({ length: 300 }, (_, k) => airportPlaneAt(55 + k / 30)).filter(p => p && p.a > 0.5);
    expect(Math.max(...late.map(p => p!.x))).toBeGreaterThan(22);
  });
});
