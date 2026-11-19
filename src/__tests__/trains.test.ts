import { describe, it, expect } from 'vitest';
import { buildRuns, trainsInView, TrainNet } from '../render/clay/trains';
import { edgeAt, SPEED, TRAIN_LEN } from '../render/clay/trainNet';
import { BUILDING_STATION, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY } from '../sim/constants';
import type { World } from '../sim/World';
import { landWorld } from './pcTestWorld';

describe('train runs', () => {
  it('cuts track into runs at junctions and dead ends, through bends and stations', () => {
    const w = landWorld(40);
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
    const w = landWorld(40);
    for (let x = 2; x <= 20; x++) if (x < 8 || x > 10) expect(w.layTrack(x, 10)).toBe(true);
    expect(w.placeBuilding(8, 10, BUILDING_STATION, 0)).toBe(true);   // platform on row 10, x 8–10
    const runs = buildRuns(w);
    expect(runs.length).toBe(1);
    expect(runs[0].stop).toBeCloseTo(7, 0);   // the platform's middle, 7 tiles from the west end's centre
  });
});

/** A straight line along row 10 from x 2 to 30, with a station in the middle. */
function stationLine(): World {
  const w = landWorld(40); w.budget.money = 1_000_000;
  for (let x = 2; x <= 30; x++) if (x < 14 || x > 16) expect(w.layTrack(x, 10)).toBe(true);
  expect(w.placeBuilding(14, 10, BUILDING_STATION, 0)).toBe(true);
  return w;
}
/** A ring of track: the edge of a square from (5, 5) to (25, 25). */
function ring(): World {
  const w = landWorld(40); w.budget.money = 1_000_000;
  for (let k = 5; k <= 25; k++) { w.layTrack(k, 5); w.layTrack(k, 25); w.layTrack(5, k); w.layTrack(25, k); }
  return w;
}
/** Ground track from x 4 to 9 on row 10, a ramp at x 10–11 to `level`, and that level's track from x 12 to 20. */
function rampLine(kind: number, level: number): World {
  const w = landWorld(40); w.budget.money = 1_000_000;
  for (let x = 4; x <= 9; x++) expect(w.layTrack(x, 10)).toBe(true);
  for (let x = 12; x <= 20; x++) expect(w.layTrack(x, 10, level)).toBe(true);
  expect(w.placeBuilding(10, 10, kind, 0)).toBe(true);
  return w;
}
/** A net whose every tile carries this rail load. */
class LoadedNet extends TrainNet {
  private readonly load: number;
  constructor(world: World, load: number) { super(world); this.load = load; }
  protected override tileLoad(): number { return this.load; }
}
const front = (n: TrainNet, k = 0): [number, number] => { const t = n.trains[k]; const [x, y] = edgeAt(t.edge, t.s); return [x, y]; };

describe('a train', () => {
  it('keeps running: stops at the platform, waits at each dead end and comes back, never fading or jumping', () => {
    const net = new TrainNet(stationLine());
    net.populate();
    expect(net.trains.length).toBe(1);   // an empty line with a station still has its train
    const id = net.trains[0].id;
    let last = front(net), dwelt = 0, turned = 0, wasTurning = false;
    const xs: number[] = [];
    for (let t = 0; t < 120; t += 0.1) {
      net.step(0.1);
      expect(net.trains.length).toBe(1);
      const tr = net.trains[0];
      expect(tr.id).toBe(id); expect(tr.alpha).toBe(1);
      const p = front(net);
      if (!tr.turning && !wasTurning) expect(Math.hypot(p[0] - last[0], p[1] - last[1])).toBeLessThan(SPEED * 0.1 + 0.05);
      if (tr.phase === 'dwell') dwelt += 0.1;
      if (tr.turning && !wasTurning) turned++;
      wasTurning = tr.turning; last = p; xs.push(p[0]);
      expect(p[1]).toBeCloseTo(10.5, 0);
    }
    expect(dwelt).toBeGreaterThan(2.5);
    expect(turned).toBeGreaterThanOrEqual(2);
    expect(Math.min(...xs)).toBeLessThan(5); expect(Math.max(...xs)).toBeGreaterThan(28);
  });

  it('comes back from a terminus platform without running on to the buffer, crossing over clear of the station', () => {
    const w = landWorld(40); w.budget.money = 1_000_000;
    for (let x = 2; x <= 24; x++) if (x < 3 || x > 5) expect(w.layTrack(x, 10)).toBe(true);
    expect(w.placeBuilding(3, 10, BUILDING_STATION, 0)).toBe(true);   // platform x 3–5, the buffer at x 2
    const net = new TrainNet(w);
    net.populate();
    let minX = Infinity, dwelt = 0, crossedInStation = false;
    for (let t = 0; t < 90; t += 0.1) {
      net.step(0.1);
      const tr = net.trains[0], [x] = front(net);
      minX = Math.min(minX, x);
      if (tr.phase === 'dwell') dwelt += 0.1;
      if (!tr.crossPending && !Number.isNaN(tr.crossAt) && x < 5.5) crossedInStation = true;
    }
    expect(dwelt).toBeGreaterThan(2.5);
    expect(minX).toBeGreaterThan(2.9);
    expect(crossedInStation).toBe(false);
  });

  it('runs at line speed with room between trains on a line under capacity', () => {
    const net = new LoadedNet(ring(), 0.6);
    net.populate();
    for (let t = 0; t < 40; t += 0.1) net.step(0.1);
    expect(net.trains.length).toBeGreaterThanOrEqual(4);
    const v = net.trains.reduce((p, t) => p + t.v, 0) / net.trains.length;
    expect(v).toBeGreaterThan(SPEED * 0.8);
  });

  it('bunches up nose to tail, crawling, on a line past capacity', () => {
    const net = new LoadedNet(ring(), 3);
    net.populate();
    for (let t = 0; t < 60; t += 0.1) net.step(0.1);
    const n = net.trains.length;
    expect(n).toBeGreaterThan(10);
    const v = net.trains.reduce((p, t) => p + t.v, 0) / n;
    expect(v).toBeLessThan(SPEED * 0.3);
    // Most trains have a neighbour not much more than a train's length away, front to front.
    const fronts = net.trains.map((_, k) => front(net, k));
    const gaps = fronts.map((p, k) => Math.min(...fronts.filter((_, j) => j !== k).map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))));
    gaps.sort((a, b) => a - b);
    expect(gaps[Math.floor(n / 2)]).toBeLessThan(TRAIN_LEN + 1.2);
  });

  it('goes up a ramp onto the elevated track and back without fading', () => {
    const net = new LoadedNet(rampLine(BUILDING_RAMP_ELEVATED, RAIL_ELEVATED), 0.8);
    net.populate();
    expect(net.trains.length).toBeGreaterThan(0);
    const levels = new Set<number>();
    for (let t = 0; t < 60; t += 0.1) { net.step(0.1); for (const tr of net.trains) { levels.add(tr.edge.ramp ? -1 : tr.edge.level); expect(tr.alpha).toBe(1); } }
    expect(levels.has(RAIL_GROUND)).toBe(true); expect(levels.has(-1)).toBe(true); expect(levels.has(RAIL_ELEVATED)).toBe(true);
  });

  it('fades only going down a subway ramp, and shows underground instead', () => {
    const w = rampLine(BUILDING_RAMP_SUBWAY, RAIL_SUBWAY);
    expect(w.placeBuilding(6, 10, BUILDING_STATION, 0) || w.placeBuilding(5, 10, BUILDING_STATION, 0)).toBe(true);   // a station, so the line has a train
    let fadedDown = false, faded = false, under = false;
    for (let t = 0; t < 120_000; t += 100) {
      for (const v of trainsInView(w, t, 0, 0, 39, 39, RAIL_GROUND)) { if (v.x < 10) expect(v.a).toBe(1); else if (v.a < 0.6) fadedDown = true; }
      for (const v of trainsInView(w, t, 0, 0, 39, 39, RAIL_SUBWAY)) { if (v.x > 12.5) { under = true; expect(v.a).toBe(1); } else if (v.a < 0.6) faded = true; }
    }
    expect(fadedDown).toBe(true); expect(under).toBe(true); expect(faded).toBe(true);
  });
});

describe('trains for the sound', () => {
  it('lists a train in view with a stable id as it slows in, stops and pulls out', () => {
    const w = stationLine();
    const seen: string[] = [];
    let key = '';
    for (let t = 0; t < 120_000; t += 100) {
      const v = trainsInView(w, t, 0, 0, 39, 39);
      expect(v.length).toBeLessThanOrEqual(1);
      if (!v.length) continue;
      if (!key) key = v[0].key;
      expect(v[0].key).toBe(key);
      if (seen[seen.length - 1] !== v[0].phase) seen.push(v[0].phase);
    }
    expect(seen.join(' ')).toContain('in dwell out');
  });
});
