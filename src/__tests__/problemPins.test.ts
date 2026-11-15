import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { findProblemClusters, pinRadius, crimeProblem, healthProblem, CRIME_BADGE_MIN } from '../render/clay/problemPins';
import { ZONE_R, ZONE_C } from '../sim/constants';

function town(): World {
  const w = new World(32, 32, 1);
  w.layers.terrain.fill(0);
  return w;
}
function lot(w: World, x: number, y: number, zone: number, crime = 0, sickness = 0): number {
  const i = y * 32 + x;
  w.layers.zone[i] = zone; w.layers.devLevel[i] = 1; w.layers.crime[i] = crime; w.layers.sickness[i] = sickness;
  return i;
}

describe('problem clusters', () => {
  it('finds nothing in a healthy town', () => {
    const w = town();
    for (let x = 2; x < 8; x++) lot(w, x, 2, ZONE_R, 20, 30);
    expect(findProblemClusters(w)).toEqual([]);
  });

  it('groups touching high-crime lots into one district with a count and a centre', () => {
    const w = town();
    for (let x = 4; x < 8; x++) for (let y = 4; y < 6; y++) lot(w, x, y, ZONE_C, 200);
    const pins = findProblemClusters(w);
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ kind: 'crime', count: 8 });
    expect(pins[0].x).toBeCloseTo(6); // tiles 4..7 → centre at 6.0
    expect(pins[0].y).toBeCloseTo(5);
  });

  it('keeps a district whole across a one-tile road, and splits it across a wider gap', () => {
    const w = town();
    lot(w, 4, 4, ZONE_R, 150); lot(w, 6, 4, ZONE_R, 150); // one tile between
    expect(findProblemClusters(w)).toHaveLength(1);
    lot(w, 10, 4, ZONE_R, 150); // three tiles from the nearest
    expect(findProblemClusters(w).map((p) => p.count).sort()).toEqual([1, 2]);
  });

  it('reports crime and health separately, and is repeatable', () => {
    const w = town();
    for (let x = 4; x < 7; x++) lot(w, x, 4, ZONE_R, 200, 200);
    lot(w, 20, 20, ZONE_C, 0, 250); // sick shops do not count: only homes
    const pins = findProblemClusters(w);
    expect(pins.map((p) => `${p.kind}:${p.count}`).sort()).toEqual(['crime:3', 'health:3']);
    expect(findProblemClusters(w)).toEqual(pins);
  });

  it('ignores empty lots and abandoned homes', () => {
    const w = town();
    const empty = lot(w, 4, 4, ZONE_R, 250, 250); w.layers.devLevel[empty] = 0;
    const abandoned = lot(w, 10, 10, ZONE_R, 0, 250); w.layers.abandoned[abandoned] = 1;
    expect(findProblemClusters(w)).toEqual([]);
    expect(crimeProblem(w, empty)).toBe(false);
    expect(healthProblem(w, abandoned)).toBe(false);
  });

  it('uses a higher bar for per-building badges', () => {
    const w = town();
    const i = lot(w, 4, 4, ZONE_R, 80);
    expect(crimeProblem(w, i)).toBe(true);
    expect(crimeProblem(w, i, CRIME_BADGE_MIN)).toBe(false);
  });

  it('grows pins with district size, up to a cap', () => {
    expect(pinRadius(40)).toBeGreaterThan(pinRadius(4));
    expect(pinRadius(4)).toBeGreaterThan(pinRadius(1));
    expect(pinRadius(100000)).toBe(26);
  });
});
