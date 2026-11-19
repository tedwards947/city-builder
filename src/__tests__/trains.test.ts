import { describe, it, expect } from 'vitest';
import { buildRuns, trainAt, headway, CARS, CAR_LEN, CAR_GAP } from '../render/clay/trains';
import { BUILDING_STATION } from '../sim/constants';
import { landWorld } from './pcTestWorld';

describe('train runs', () => {
  it('cuts track into runs at junctions and dead ends, through bends and stations', () => {
    const w = landWorld(40, 40);
    // An L: 6 tiles east, a bend, 4 tiles south; then a branch off the middle (a junction).
    for (let x = 5; x <= 10; x++) expect(w.layTrack(x, 5)).toBe(true);
    for (let y = 6; y <= 9; y++) expect(w.layTrack(10, y)).toBe(true);
    let runs = buildRuns(w);
    expect(runs.length).toBe(1);
    expect(runs[0].len).toBeGreaterThan(8); expect(runs[0].len).toBeLessThan(10);
    expect(w.layTrack(7, 6)).toBe(true);   // a stub south from (7, 5): a junction there
    runs = buildRuns(w);
    expect(runs.length).toBe(3);
  });

  it('knows where a station platform lies along its run', () => {
    const w = landWorld(40, 40);
    for (let x = 2; x <= 20; x++) if (x < 8 || x > 11) expect(w.layTrack(x, 10)).toBe(true);
    expect(w.placeBuilding(8, 9, BUILDING_STATION, 0)).toBe(true);   // platform on row 10, x 8–11
    const runs = buildRuns(w);
    expect(runs.length).toBe(1);
    expect(runs[0].stop).toBeCloseTo(7.5, 0);   // the platform's middle, 7.5 tiles from the west end's centre
  });
});

describe('a train', () => {
  it('fades in, slows to a stop with its middle at the platform, waits, and fades out at the far end', () => {
    const len = 20, stop = 10, half = CARS * (CAR_LEN + CAR_GAP) / 2;
    expect(trainAt(0, len, stop)!.a).toBe(0);
    let t = 0, last = -1, stoppedFor = 0;
    for (; t < 60; t += 0.05) {
      const p = trainAt(t, len, stop); if (!p) break;
      expect(p.s).toBeGreaterThanOrEqual(last); if (Math.abs(p.s - last) < 1e-9) stoppedFor += 0.05; last = p.s;
    }
    expect(stoppedFor).toBeGreaterThan(2.5);
    expect(trainAt(t - 0.05, len, stop)!.a).toBeLessThan(0.2);
    // While stopped, its middle is at the platform's.
    for (let u = 0; u < 30; u += 0.05) { const p = trainAt(u, len, stop)!; if (p && p.a === 1 && Math.abs(trainAt(u + 0.05, len, stop)!.s - p.s) < 1e-9) { expect(p.s - half).toBeCloseTo(stop, 5); break; } }
  });

  it('comes more often on a busier line', () => {
    expect(headway(0)).toBe(60);
    expect(headway(1)).toBeLessThan(headway(0.3));
    expect(headway(5)).toBe(headway(1));
  });
});
