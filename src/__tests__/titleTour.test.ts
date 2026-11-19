// The title screen: which spots the camera tour visits (title/tourSpots.ts), how it moves
// (title/CameraTour.ts) and when the title is shown (title/launch.ts).

import { describe, it, expect } from 'vitest';
import { Camera } from '../render/Camera';
import { TILE_SIZE } from '../render/Projection';
import { BUILDING_AIRPORT, BUILDING_STATION, ROAD_STREET, ZONE_R } from '../sim/constants';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { CameraTour, TOUR, easeInOut, flightPose, flightSeconds, type Pose } from '../title/CameraTour';
import { dayStamp, markTitleSeen, titleDue, wantTitle } from '../title/launch';
import { SPOT_ZOOM, findTourSpots, nextTourSpot, type TourSpot } from '../title/tourSpots';
import { landWorld } from './pcTestWorld';

const spot = (kind: TourSpot['kind'], tx: number, ty: number, score = 1): TourSpot => ({ kind, tx, ty, zoom: SPOT_ZOOM[kind], score });

describe('finding spots', () => {
  it('an empty map offers one wide view of its middle', () => {
    const spots = findTourSpots(landWorld(64));
    expect(spots).toEqual([{ kind: 'overview', tx: 32, ty: 32, zoom: SPOT_ZOOM.overview, score: 0.5 }]);
  });

  it('finds the airport, a station and a cluster of towers, each at its middle', () => {
    const w = landWorld(96);
    expect(w.placeBuilding(40, 60, BUILDING_AIRPORT)).toBe(true);        // 12×5
    for (let x = 8; x <= 14; x++) expect(w.setRoad(x, 13, ROAD_STREET)).toBe(true);
    expect(w.placeBuilding(10, 12, BUILDING_STATION)).toBe(true);        // three tiles, x 10–12
    for (let x = 62; x <= 65; x++) { w.setZone(x, 14, ZONE_R); w.layers.devLevel[w.grid.idx(x, 14)] = 3; }
    const spots = findTourSpots(w);
    const of = (kind: string) => spots.filter(s => s.kind === kind);
    expect(of('airport')).toHaveLength(1);
    expect(of('airport')[0]).toMatchObject({ tx: 45.5, ty: 62 });
    expect(of('station')).toHaveLength(1);
    expect(of('station')[0]).toMatchObject({ tx: 11, ty: 12 });
    expect(of('towers')).toHaveLength(1);
    expect(of('towers')[0]).toMatchObject({ tx: 63.5, ty: 14 });
    expect(of('overview')).toHaveLength(1);
    // Two towers are not a cluster.
    const few = landWorld(64);
    for (let x = 20; x <= 21; x++) { few.setZone(x, 14, ZONE_R); few.layers.devLevel[few.grid.idx(x, 14)] = 3; }
    expect(findTourSpots(few).some(s => s.kind === 'towers')).toBe(false);
  });

  it('finds the busiest road, and a jam where a road carries more than it can', () => {
    const w = landWorld(96);
    for (let x = 5; x <= 90; x++) expect(w.setRoad(x, 40, ROAD_STREET)).toBe(true);
    new TransitSystem().recompute(w);
    const d = w.traffic!;
    const at = (x: number) => w.grid.idx(x, 40);
    d.markets[0].volume[at(20)] = 5;                // a little traffic
    d.markets[0].volume[at(70)] = 40;               // more, still under a street's capacity?
    let spots = findTourSpots(w);
    const busy = spots.filter(s => s.kind === 'busyRoad' || s.kind === 'jam');
    expect(busy.length).toBe(2);
    expect(busy.slice().sort((a, b) => b.score - a.score)[0]).toMatchObject({ tx: 70, ty: 40 });
    d.markets[0].volume[at(20)] = 1e6;              // far over capacity: a jam
    spots = findTourSpots(w);
    expect(spots.filter(s => s.kind === 'jam')[0]).toMatchObject({ tx: 20, ty: 40, score: 1 });
    // One long jam is one spot per square of the map, not one per tile.
    for (let x = 5; x <= 90; x++) d.markets[0].volume[at(x)] = 1e6;
    expect(findTourSpots(w).filter(s => s.kind === 'jam').length).toBeLessThanOrEqual(4);
  });
});

describe('choosing the next spot', () => {
  const spots = [spot('jam', 10, 10), spot('jam', 60, 10), spot('airport', 40, 60), spot('towers', 80, 80), spot('station', 12, 80)];

  it('never the same place twice running, nor the same kind when there is a choice', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const recent: TourSpot[] = [];
    for (let k = 0; k < 300; k++) {
      const next = nextTourSpot(spots, recent, random)!;
      const last = recent[recent.length - 1];
      if (last) {
        expect(next).not.toBe(last);
        expect(next.kind).not.toBe(last.kind);
      }
      expect(recent.slice(-3)).not.toContain(next);
      recent.push(next);
    }
    // Every spot gets its turn.
    for (const s of spots) expect(recent).toContain(s);
  });

  it('with two spots it alternates; with one it stays; with none there is nothing', () => {
    const two = [spot('jam', 10, 10), spot('jam', 60, 10)];
    expect(nextTourSpot(two, [two[0]])).toBe(two[1]);
    expect(nextTourSpot(two, [two[0], two[1]])).toBe(two[0]);
    expect(nextTourSpot([two[0]], [two[0]])).toBe(two[0]);
    expect(nextTourSpot([], [])).toBeNull();
  });

  it('a higher score is picked more often', () => {
    const pair = [spot('jam', 10, 10, 1), spot('airport', 60, 60, 0.1)];
    let seed = 3, first = 0;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 400; k++) if (nextTourSpot(pair, [], random) === pair[0]) first++;
    expect(first).toBeGreaterThan(320);
  });
});

describe('the flight', () => {
  const a: Pose = { x: 0, y: 0, zoom: 2 }, b: Pose = { x: 4000, y: 1000, zoom: 1.5 };

  it('starts on the first pose, ends on the second, and eases at both ends', () => {
    expect(flightPose(a, b, 0, 800)).toEqual(a);
    const end = flightPose(a, b, 1, 800);
    expect(end.x).toBeCloseTo(b.x); expect(end.y).toBeCloseTo(b.y); expect(end.zoom).toBeCloseTo(b.zoom);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    // Slow at the ends, fast in the middle.
    const moved = (t0: number, t1: number) => flightPose(a, b, t1, 800).x - flightPose(a, b, t0, 800).x;
    expect(moved(0, 0.1)).toBeLessThan(moved(0.45, 0.55) / 10);
    expect(moved(0.9, 1)).toBeLessThan(moved(0.45, 0.55) / 10);
    // Always forwards.
    for (let t = 0; t < 1; t += 0.05) expect(moved(t, t + 0.05)).toBeGreaterThanOrEqual(0);
  });

  it('pulls back in the middle of a long flight, hardly at all on a short one, and takes longer the further it goes', () => {
    const mid = flightPose(a, b, 0.5, 800).zoom;
    expect(mid).toBeLessThan(Math.min(a.zoom, b.zoom) * 0.7);
    expect(mid).toBeGreaterThan(Math.min(a.zoom, b.zoom) * 0.4);          // gentle: never a dive to the whole map
    const near: Pose = { x: 60, y: 0, zoom: 2 };
    expect(flightPose(a, near, 0.5, 800).zoom).toBeGreaterThan(1.9);
    expect(flightSeconds(a, near, 800)).toBeCloseTo(TOUR.flight, 0);
    expect(flightSeconds(a, b, 800)).toBeGreaterThan(flightSeconds(a, near, 800));
    expect(flightSeconds(a, { x: 1e6, y: 0, zoom: 2 }, 800)).toBe(TOUR.maxFlight);
  });
});

describe('the tour', () => {
  const centre = (c: Camera) => ({ x: (c.x + c.viewportW / (2 * c.zoom)) / TILE_SIZE, y: (c.y + c.viewportH / (2 * c.zoom)) / TILE_SIZE });
  const spots = [spot('jam', 10, 10), spot('airport', 100, 60)];

  it('rests on a spot, then glides to the next and rests there; a stop freezes it at once', () => {
    const camera = new Camera(800, 800);
    const tour = new CameraTour(camera, () => spots, () => 0);
    tour.start(0);
    expect(tour.active).toBe(true);
    const first = centre(camera);
    expect([10.5, 100.5]).toContain(Number(first.x.toFixed(3)));
    const z0 = camera.zoom;
    tour.update(TOUR.dwell * 500);
    expect(centre(camera).x).toBeCloseTo(first.x);                 // resting: only a slow push in
    expect(camera.zoom).toBeGreaterThan(z0);
    expect(camera.zoom).toBeLessThan(z0 * (1 + TOUR.push));
    // Past the rest: under way to the other spot, never jumping.
    let last = centre(camera).x, t = TOUR.dwell * 1000;
    tour.update(t);
    for (let k = 0; k < 600; k++) {
      t += 16;
      tour.update(t);
      const x = centre(camera).x;
      expect(Math.abs(x - last)).toBeLessThan(2);                  // tiles per frame
      last = x;
    }
    const other = first.x < 50 ? 100.5 : 10.5;
    expect(centre(camera).x).toBeCloseTo(other, 1);
    // Stop mid-flight: the camera stays put.
    t += TOUR.dwell * 1000;
    tour.update(t); tour.update(t + 800);
    const held = { ...centre(camera), zoom: camera.zoom };
    tour.stop();
    expect(tour.active).toBe(false);
    tour.update(t + 3000);
    expect({ ...centre(camera), zoom: camera.zoom }).toEqual(held);
  });
});

describe('when the title is shown', () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

  it('on the first launch of each day, not again that day', () => {
    const s = store();
    const morning = new Date(2026, 10, 19, 8, 0), evening = new Date(2026, 10, 19, 23, 59), next = new Date(2026, 10, 20, 0, 1);
    expect(dayStamp(morning)).toBe('2026-11-19');
    expect(titleDue(s, morning)).toBe(true);
    markTitleSeen(s, morning);
    expect(titleDue(s, morning)).toBe(false);
    expect(titleDue(s, evening)).toBe(false);
    expect(titleDue(s, next)).toBe(true);
    // No storage, or storage that throws: it cannot tell, so it shows the title.
    expect(titleDue(null, morning)).toBe(true);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(titleDue(broken, morning)).toBe(true);
    expect(() => markTitleSeen(broken, morning)).not.toThrow();
  });

  it('?title=on forces it, ?title=off and test tooling skip it', () => {
    expect(wantTitle({ param: null, tooling: false, due: true })).toBe(true);
    expect(wantTitle({ param: null, tooling: false, due: false })).toBe(false);
    expect(wantTitle({ param: null, tooling: true, due: true })).toBe(false);
    expect(wantTitle({ param: 'off', tooling: false, due: true })).toBe(false);
    expect(wantTitle({ param: 'on', tooling: true, due: false })).toBe(true);
  });
});
