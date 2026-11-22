/**
 * Trains that keep running (owner): a small simulation in the renderer, not in the game. The track of
 * all three levels becomes one graph of directed edges: each run (clay/trainRuns.ts) both ways, the
 * ways across each junction the drawn track allows, and the ramps between levels. Trains drive round
 * it continuously, on the right-hand track: they pick a way at each junction, stop at stations, wait
 * at a dead end and come back, and go up and down ramps. They fade only going underground or coming
 * back up a subway ramp (and, when there is nowhere out of sight to do it, when one is added or taken
 * away).
 *
 * How many run follows the rail load (sim/TrafficData.ts railLoad), as the road cars do. Over capacity
 * trains bunch like cars in a jam: on track past its capacity they slow, the more overloaded the
 * slower, and the trains behind close up until they run nose to tail; a junction past capacity holds
 * each train a moment, so that is where the queue builds. There are no signals and nothing is shown
 * for them: a train simply waits for the way ahead to be clear.
 *
 * Trains from outside (owner: none ever came in or went out on track joined to a rail point): at each
 * joined rail point the track runs on off the map, along its stub (clay/connectionStubs.ts). Visitor
 * trains come in along it, run to the first station, stand at the platform, come back and run out
 * again, fading into the dark past the map's edge. How often follows the riders the point brings in
 * (sim/connectionTraffic.ts); the city's own trains never take that track.
 */
import type { World } from '../../sim/World';
import { railLinks, rampOther, LINK_E, LINK_S } from '../../sim/rail';
import { railLoad } from '../../sim/TrafficData';
import { RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY } from '../../sim/constants';
import { buildRuns, across, OPP, type Run } from './trainRuns';
import { connectionOn } from '../../sim/connections';
import { connectionTradeAt } from '../../sim/connectionTraffic';

export const CAR_LEN = 0.75, CAR_GAP = 0.05, CARS = 3;
/** Front to tail of a train, in tiles. */
export const TRAIN_LEN = CARS * CAR_LEN + (CARS - 1) * CAR_GAP;
/** Line speed (tiles a second), braking and pulling away (tiles a second²). */
export const SPEED = 2.4;
const BRAKE = SPEED * SPEED / (2 * 4), ACCEL = 0.9;
/** Seconds at a platform, and at a dead end before coming back. */
export const DWELL = 3;
const TURN = 2.5;
/** Nose-to-tail gap between trains in a queue, in tiles. */
const MIN_GAP = 0.25;
/** Seconds to fade in or out, where a train must appear or go in sight. */
const FADE = 0.8;
/** How far after a platform a train counts as pulling out, and how far before it as slowing in. */
const PULL_OUT = 4, SLOW_IN = 4;
/** Tiles a car takes to cross over to the other track. */
export const CROSS = 1.5;
/** Track off the map at a rail point, tile centre to end: long enough that a train is out of sight at its end. */
export const PORTAL = 6.5;
/** Seconds between visitor trains at a rail point: the first with no riders, the second at its full capacity. */
const VISIT_EVERY = [40, 15] as const;
/** At most this many visitor trains at once from one point. */
const VISIT_MAX = 3;
/** Outward step per map edge (EDGE_N, E, S, W). */
const OUTWARD: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export type TrainPhase = 'run' | 'in' | 'dwell' | 'out';

/** A directed piece of track: part of a run one way, a way across a junction, or a ramp. */
export interface Edge {
  id: number;
  P: [number, number][];
  D: number[];
  len: number;
  /** The level whose pass draws it: a ramp counts as ground. */
  level: number;
  /** A ramp between levels: the level of its far (high or deep) end; 0 for none. */
  ramp: number;
  /** Where a train's front halts for each platform along this edge. */
  stops: number[];
  /** Stretches through straight stations, where the tracks spread round the island (as Run.wide), along this edge. */
  wide: [number, number][];
  /** The edges a train can go on to from the end; empty at a dead end. */
  next: Edge[];
  /** The same track the other way. */
  rev: Edge;
  /** A way across a junction: that junction's tile (trains cross one at a time); -1 otherwise. */
  junction: number;
  /** Straight on (a weight for picking ways at a junction). */
  straight: boolean;
  /** Group of edges trains can reach from each other. */
  group: number;
  /** Rail load is read on this level (a ramp: ground). */
  loadLevel: number;
  /** The run this is part of (null for junctions and ramps). */
  run: Run | null;
  /** Track off the map at a rail point: 1 running out, -1 coming in, 0 neither. */
  portal: number;
  /** That rail point's tile (-1 for other track). */
  point: number;
  x0: number; y0: number; x1: number; y1: number;
}

export interface Train {
  id: number;
  edge: Edge;
  /** The front's distance along `edge`. */
  s: number;
  v: number;
  /** The edges behind the front edge that the train still covers, nearest first. */
  hist: Edge[];
  /** The edge it will take at the end of this one (null at a dead end). */
  ahead: Edge | null;
  /** Seconds left standing (a platform, a dead end, a busy junction). */
  wait: number;
  phase: TrainPhase;
  /** Standing at a dead end, to come back. */
  turning: boolean;
  /** Platforms already served on this edge: their stop positions up to here. */
  served: number;
  /** The junction it has already been held at, so it is held once per crossing. */
  heldAt: number;
  /** Distance run since it last left a platform (for 'out'). */
  sinceStop: number;
  /** Distance run in all. */
  odo: number;
  /** Coming back from a dead end it is on the other track: it crosses to its own, each car in turn over CROSS
   *  tiles from the odometer reading `crossAt` (NaN: not crossing), once clear of any station (`crossPending`). */
  crossAt: number;
  crossPending: boolean;
  /** Opacity for being added or taken away in sight (ramps fade on their own). */
  alpha: number;
  /** -1 fading out to be taken away, 1 fading in, 0 neither. */
  fading: number;
  livery: number;
  /** A train from outside: in from a rail point to the first station and back out. */
  visitor: boolean;
  /** A visitor on its way back out. */
  leaving: boolean;
  /** The edges a visitor still has to take, in order. */
  route: Edge[];
  /** A visitor's rail point tile. */
  point: number;
}

const mulberry = (seed: number): (() => number) => () => {
  seed = (seed + 0x6d2b79f5) | 0; let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function polyEdge(P: [number, number][]): { P: [number, number][]; D: number[]; len: number } {
  const Q: [number, number][] = [P[0]], D = [0];
  for (const p of P.slice(1)) { const q = Q[Q.length - 1], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < 1e-6) continue; Q.push(p); D.push(D[D.length - 1] + d); }
  if (Q.length === 1) { Q.push([Q[0][0], Q[0][1]]); D.push(0); }
  return { P: Q, D, len: D[D.length - 1] };
}
/** The part of a run's line from distance a to b. */
function slice(r: Run, a: number, b: number): [number, number][] {
  const out: [number, number][] = [pointAt(r.P, r.D, a)];
  for (let k = 0; k < r.P.length; k++) if (r.D[k] > a && r.D[k] < b) out.push(r.P[k]);
  out.push(pointAt(r.P, r.D, b));
  return out;
}
function pointAt(P: [number, number][], D: number[], s: number): [number, number] {
  let lo = 0, hi = D.length - 1; s = Math.max(0, Math.min(D[hi], s));
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] <= s) lo = m; else hi = m; }
  const f = (s - D[lo]) / (D[hi] - D[lo] || 1);
  return [P[lo][0] + (P[hi][0] - P[lo][0]) * f, P[lo][1] + (P[hi][1] - P[lo][1]) * f];
}
/** Point and unit direction at distance s along an edge. */
export function edgeAt(e: Edge, s: number): [number, number, number, number] {
  const { P, D } = e; let lo = 0, hi = D.length - 1; s = Math.max(0, Math.min(e.len, s));
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] <= s) lo = m; else hi = m; }
  const f = (s - D[lo]) / (D[hi] - D[lo] || 1), a = P[lo], b = P[hi];
  let dx = b[0] - a[0], dy = b[1] - a[1]; const m = Math.hypot(dx, dy);
  if (m > 1e-9) { dx /= m; dy /= m; } else { dx = 0; dy = 0; }
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, dx, dy];
}

const sideOf = (dx: number, dy: number): number => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? LINK_E : 8) : (dy > 0 ? LINK_S : 1);

/** The whole graph for a world's track, all levels. */
export function buildNet(world: World): Edge[] {
  const W = world.grid.width, edges: Edge[] = [];
  let nextId = 0;
  const make = (P: [number, number][], level: number, o: Partial<Edge> = {}): Edge => {
    const g = polyEdge(P);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of g.P) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    const e = { id: nextId++, ...g, level, ramp: 0, stops: [], wide: [], next: [], rev: null as unknown as Edge, junction: -1, straight: true, group: -1, loadLevel: level, run: null, portal: 0, point: -1, x0, y0, x1, y1, ...o } as Edge;
    edges.push(e); return e;
  };
  const pair = (a: Edge, b: Edge): void => { a.rev = b; b.rev = a; };
  // Where each run ends: tile → the arms there (the edge leaving the tile, the edge arriving, the side).
  type Arm = { out: Edge; inn: Edge; side: number };
  const ends = new Map<string, Arm[]>();
  const countOf = (m: number): number => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
  const linksAt = new Map<string, number>();
  const links = (level: number, t: number): number => { const k = level + ':' + t; let m = linksAt.get(k); if (m === undefined) { m = railLinks(world, t, level); linksAt.set(k, m); } return m; };
  for (const level of [RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY]) {
    for (const r of buildRuns(world, level)) {
      const t0 = r.tiles[0], t1 = r.tiles[r.tiles.length - 1];
      const loop = t0 === t1 && r.tiles.length > 1;
      const node0 = loop || countOf(links(level, t0)) >= 3, node1 = loop || countOf(links(level, t1)) >= 3;
      const a = node0 ? Math.min(0.5, r.len / 2) : 0, b = node1 ? Math.max(a, r.len - 0.5) : r.len;
      const P = slice(r, a, b);
      const fwd = make(P, level, { run: r }), back = make([...P].reverse(), level, { run: r });
      pair(fwd, back);
      const half = TRAIN_LEN / 2;
      if (r.stop !== null) {
        const sf = Math.min(fwd.len - 0.05, Math.max(0, r.stop - a + half)), sb = Math.min(back.len - 0.05, Math.max(0, (r.len - r.stop) - (r.len - b) + half));
        fwd.stops = [sf]; back.stops = [sb];
      }
      fwd.wide = r.wide.map(([p, q]) => [p - a, q - a]);
      back.wide = r.wide.map(([p, q]) => [b - q, b - p]);
      const add = (t: number, arm: Arm): void => { const k = level + ':' + t; const l = ends.get(k); if (l) l.push(arm); else ends.set(k, [arm]); };
      const s0 = sideOf(r.P[1][0] - r.P[0][0], r.P[1][1] - r.P[0][1]);
      const n = r.P.length, s1 = sideOf(r.P[n - 2][0] - r.P[n - 1][0], r.P[n - 2][1] - r.P[n - 1][1]);
      add(t0, { out: fwd, inn: back, side: s0 });
      add(t1, { out: back, inn: fwd, side: s1 });
    }
  }
  // Junctions (and the joining tile of a loop): a way across from each arm to each other arm the drawn track joins.
  const rampDone = new Set<string>();
  for (const [key, arms] of ends) {
    const [lv, ts] = key.split(':'), level = +lv, t = +ts, tx = t % W, ty = (t - tx) / W;
    const m = links(level, t), n = countOf(m);
    if (n >= 3 || (n === 2 && arms.length === 2)) {
      for (const a of arms) for (const b of arms) {
        if (a === b) continue;
        const straight = OPP[a.side] === b.side;
        if (!straight && n === 4) continue;   // a crossing has no curves
        const P: [number, number][] = []; across(tx, ty, a.side, b.side, P);
        const e = make(P, level, { junction: n >= 3 ? t : -1, straight });
        a.inn.next.push(e); e.next.push(b.out);
      }
      continue;
    }
    if (n !== 1 || arms.length !== 1) continue;
    // A joined rail point: the track runs on off the map, out and back.
    const pt = level === RAIL_GROUND && world.connections.length ? connectionOn(world, t) : null;
    if (pt && pt.kind === 'rail') {
      const [dx, dy] = OUTWARD[pt.edge], c: [number, number] = [tx + 0.5, ty + 0.5], far: [number, number] = [c[0] + dx * PORTAL, c[1] + dy * PORTAL];
      const out = make([c, far], level, { portal: 1, point: t }), inn = make([far, c], level, { portal: -1, point: t });
      pair(out, inn);
      arms[0].inn.next.push(out); inn.next.push(arms[0].out);
      continue;
    }
    // A ramp end: across the ramp to the run at its other end.
    const other = rampOther(world, t);
    if (!other) continue;
    const there = ends.get(other.level + ':' + other.tile);
    if (!there || there.length !== 1) continue;
    const pk = [key, other.level + ':' + other.tile].sort().join('|');
    if (rampDone.has(pk)) continue;
    rampDone.add(pk);
    const lowAtThis = level === RAIL_GROUND, low = lowAtThis ? arms[0] : there[0], high = lowAtThis ? there[0] : arms[0];
    const lt = lowAtThis ? t : other.tile, ht = lowAtThis ? other.tile : t, far = lowAtThis ? other.level : level;
    const c = (i: number): [number, number] => [i % W + 0.5, (i - (i % W)) / W + 0.5];
    const up = make([c(lt), c(ht)], RAIL_GROUND, { ramp: far, loadLevel: RAIL_GROUND }), down = make([c(ht), c(lt)], RAIL_GROUND, { ramp: far, loadLevel: RAIL_GROUND });
    pair(up, down);
    low.inn.next.push(up); up.next.push(high.out);
    high.inn.next.push(down); down.next.push(low.out);
  }
  // Ways across a junction pair up too (a→b with b→a).
  const byEnds = new Map<string, Edge>();
  for (const e of edges) if (!e.rev) byEnds.set(`${e.P[0][0].toFixed(3)},${e.P[0][1].toFixed(3)}>${e.P[e.P.length - 1][0].toFixed(3)},${e.P[e.P.length - 1][1].toFixed(3)}:${e.level}`, e);
  for (const e of edges) if (!e.rev) {
    const r = byEnds.get(`${e.P[e.P.length - 1][0].toFixed(3)},${e.P[e.P.length - 1][1].toFixed(3)}>${e.P[0][0].toFixed(3)},${e.P[0][1].toFixed(3)}:${e.level}`);
    if (r) pair(e, r); else e.rev = e;
  }
  // Groups: edges joined either way.
  let g = 0;
  for (const e of edges) {
    if (e.group >= 0) continue;
    const stack = [e]; e.group = g;
    while (stack.length) { const x = stack.pop()!; for (const y of [...x.next, x.rev]) if (y.group < 0) { y.group = g; stack.push(y); } }
    g++;
  }
  return edges;
}

export interface View { x0: number; y0: number; x1: number; y1: number }

/** The trains on one world's track and the clock that drives them. */
export class TrainNet {
  readonly edges: Edge[];
  trains: Train[] = [];
  /** The last view drawn, to add and take away trains out of sight. */
  view: View | null = null;
  private rand: () => number;
  private nextTrain = 1;
  private spawnClock = 0;
  /** Seconds to each rail point's next visitor train, by its incoming edge's id. */
  private visitClock = new Map<number, number>();
  private surplusFor = new Map<number, number>();
  private readonly world: World;

  constructor(world: World, seed = 1) {
    this.world = world;
    this.edges = buildNet(world);
    this.rand = mulberry(seed);
  }

  /** Rail load on a tile and level: volume over capacity, past 1 when overloaded (0 without traffic data). */
  protected tileLoad(i: number, level: number): number {
    const d = this.world.traffic; return d ? railLoad(d, i, level) : 0;
  }
  private loadAt(e: Edge, s: number): number {
    const [x, y] = edgeAt(e, s), W = this.world.grid.width;
    return this.tileLoad(Math.floor(y) * W + Math.floor(x), e.loadLevel);
  }

  /** How many trains each group should have now. */
  private targets(): Map<number, number> {
    const out = new Map<number, number>(), station = new Set<number>();
    for (const e of this.edges) {
      if (!e.run || e.id > e.rev.id) continue;   // each run once
      if (e.stops.length) station.add(e.group);
      let load = 0;
      for (const i of e.run.tiles) load = Math.max(load, this.tileLoad(i, e.level));
      // One train every 10 tiles each way when the line is full; more, toward nose to tail, past full.
      const dens = load <= 0 ? 0 : 0.2 * Math.min(1, load) + 0.25 * Math.max(0, Math.min(2, load - 1));
      out.set(e.group, (out.get(e.group) ?? 0) + e.len * dens);
    }
    for (const gid of station) out.set(gid, Math.max(1, out.get(gid) ?? 0));
    // Never more than the track can hold with room to move.
    const room = new Map<number, number>();
    for (const e of this.edges) if (e.run) room.set(e.group, (room.get(e.group) ?? 0) + e.len);
    for (const [gid, n] of out) out.set(gid, Math.min(Math.round(n), Math.floor((room.get(gid) ?? 0) / (TRAIN_LEN + 1.2))));
    return out;
  }

  private inView(x: number, y: number): boolean {
    const v = this.view; return !!v && x >= v.x0 - 1 && x <= v.x1 + 2 && y >= v.y0 - 1 && y <= v.y1 + 2;
  }

  /** The stretches of each edge that trains cover now: edge id → [from, to, train id][]. */
  private occupancy(): Map<number, [number, number, number][]> {
    const occ = new Map<number, [number, number, number][]>();
    const put = (e: Edge, a: number, b: number, id: number): void => { const l = occ.get(e.id); if (l) l.push([a, b, id]); else occ.set(e.id, [[a, b, id]]); };
    for (const t of this.trains) {
      let left = TRAIN_LEN, e = t.edge, s = t.s, k = 0;
      for (;;) {
        put(e, Math.max(0, s - left), s, t.id);
        left -= s; if (left <= 0) break;
        const p = t.hist[k++]; if (!p) break;
        e = p; s = p.len;
      }
    }
    return occ;
  }

  private free(occ: Map<number, [number, number, number][]>, e: Edge, a: number, b: number, except = -1): boolean {
    for (const [p, q, id] of occ.get(e.id) ?? []) if (id !== except && q > a - MIN_GAP && p < b + MIN_GAP) return false;
    return true;
  }

  private junctionBusy(occ: Map<number, [number, number, number][]>, j: number, except: number): boolean {
    for (const e of this.junctionEdges(j)) for (const [, , id] of occ.get(e.id) ?? []) if (id !== except) return true;
    return false;
  }
  private jcache = new Map<number, Edge[]>();
  private junctionEdges(j: number): Edge[] {
    let l = this.jcache.get(j);
    if (!l) { l = this.edges.filter(e => e.junction === j); this.jcache.set(j, l); }
    return l;
  }

  private pick(e: Edge, t?: Train): Edge | null {
    if (t?.visitor) return t.route.shift() ?? null;
    const next = e.next.filter(n => n.portal === 0);
    if (!next.length) return null;
    if (next.length === 1) return next[0];
    const w = next.map(n => n.straight ? 3 : 1), sum = w.reduce((p, q) => p + q, 0);
    let r = this.rand() * sum;
    for (let k = 0; k < w.length; k++) { r -= w[k]; if (r <= 0) return next[k]; }
    return next[next.length - 1];
  }

  private spawn(group: number, occ: Map<number, [number, number, number][]>, anywhere: boolean): boolean {
    const runs = this.edges.filter(e => e.group === group && e.run && e.len >= TRAIN_LEN + 0.5);
    if (!runs.length) return false;
    const total = runs.reduce((p, e) => p + e.len, 0);
    let fallback: { e: Edge; s: number } | null = null;
    for (let tries = 0; tries < 12; tries++) {
      let r = this.rand() * total, e = runs[0];
      for (const x of runs) { r -= x.len; if (r <= 0) { e = x; break; } }
      const s = TRAIN_LEN + this.rand() * (e.len - TRAIN_LEN);
      if (!this.free(occ, e, s - TRAIN_LEN - 1, s + 1) || !this.free(occ, e.rev, e.len - s - 1, e.len - s + TRAIN_LEN + 1)) continue;
      const [x, y] = edgeAt(e, s - TRAIN_LEN / 2);
      if (anywhere || !this.inView(x, y)) { this.add(e, s, anywhere ? 1 : 1, 0); return true; }
      if (!fallback) fallback = { e, s };
    }
    if (fallback) { this.add(fallback.e, fallback.s, 0, 1); return true; }
    return false;
  }

  private add(e: Edge, s: number, alpha: number, fading: number): void {
    // A stop already behind the front counts as served.
    const t: Train = { id: this.nextTrain++, edge: e, s, v: SPEED * 0.6, hist: [], ahead: null, wait: 0, phase: 'run', turning: false, served: s, heldAt: -1, sinceStop: 99, odo: 0, crossAt: NaN, crossPending: false, alpha, fading, livery: Math.floor(this.rand() * 1000), visitor: false, leaving: false, route: [], point: -1 };
    t.ahead = this.pick(e);
    this.trains.push(t);
  }

  /** Advances the trains by dt seconds. */
  step(dt: number): void {
    // Add and take away trains toward each group's number, one at a time.
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.spawnClock = 1.2;
      const want = this.targets(), have = new Map<number, Train[]>();
      for (const t of this.trains) { if (t.visitor) continue; const l = have.get(t.edge.group); if (l) l.push(t); else have.set(t.edge.group, [t]); }
      const occ = this.occupancy();
      for (const [gid, n] of want) {
        const list = (have.get(gid) ?? []).filter(t => t.fading >= 0);
        if (list.length < n) this.spawn(gid, occ, false);
        else if (list.length > n) {
          // Out of sight, at once; in sight, only after a while, fading.
          const out = list.find(t => { const [x, y] = edgeAt(t.edge, t.s); return !this.inView(x, y); });
          if (out) { this.trains = this.trains.filter(t => t !== out); this.surplusFor.delete(gid); }
          else { const since = (this.surplusFor.get(gid) ?? 0) + 1.2; this.surplusFor.set(gid, since); if (since > 20) { list[0].fading = -1; this.surplusFor.delete(gid); } }
        } else this.surplusFor.delete(gid);
      }
      for (const [gid, list] of have) if (!want.has(gid)) for (const t of list) { const [x, y] = edgeAt(t.edge, t.s); if (!this.inView(x, y)) this.trains = this.trains.filter(q => q !== t); else t.fading = -1; }
    }
    for (const t of this.trains) {
      if (t.fading) { t.alpha += t.fading * dt / FADE; if (t.alpha >= 1) { t.alpha = 1; t.fading = 0; } }
    }
    this.trains = this.trains.filter(t => t.alpha > 0 || t.fading >= 0);
    this.visitors(dt);
    const occ = this.occupancy();
    for (const t of this.trains) this.move(t, dt, occ);
    // Visitors gone off the map's edge: out of sight by the end of the track there.
    this.trains = this.trains.filter(t => !(t.visitor && t.edge.portal === 1 && t.s >= t.edge.len - 0.1));
  }

  /** Riders a rail point brings in, as a share of what it can bring (0–1). */
  protected pointBusy(point: number): number {
    const c = connectionTradeAt(this.world, point);
    if (!c || !c.visitorsCapacity) return 0;
    return Math.max(0, Math.min(1, (c.visitorsIn + c.dayTrippers) / c.visitorsCapacity));
  }

  /** Sends visitor trains in at each joined rail point that has a station to run to, as often as its riders call for. */
  private visitors(dt: number): void {
    for (const e of this.edges) {
      if (e.portal !== -1) continue;
      let left = this.visitClock.get(e.id);
      if (left === undefined) left = 3 + this.rand() * 7;   // the first soon after the point is joined
      left -= dt;
      if (left <= 0) {
        const route = this.routeTo(e, (x) => x.stops.length > 0);
        const here = this.trains.filter(t => t.visitor && t.point === e.point).length;
        const occ = this.occupancy();
        if (route && here < VISIT_MAX && this.free(occ, e, 0, TRAIN_LEN + 1) && this.free(occ, e.rev, e.len - TRAIN_LEN - 1, e.len)) {
          this.add(e, TRAIN_LEN, 1, 0);
          const t = this.trains[this.trains.length - 1];
          t.visitor = true; t.point = e.point; t.route = route; t.ahead = t.route.shift() ?? null; t.v = SPEED;
          const f = this.pointBusy(e.point);
          left = VISIT_EVERY[0] + (VISIT_EVERY[1] - VISIT_EVERY[0]) * f;
        } else left = 2;
      }
      this.visitClock.set(e.id, left);
    }
  }

  /** The edges from `from` (not counted) to the nearest edge that is `goal`, the fewest edges first; null if none. Off-map track only as the goal. */
  private routeTo(from: Edge, goal: (e: Edge) => boolean): Edge[] | null {
    const prev = new Map<Edge, Edge>([[from, from]]), queue = [from];
    for (let k = 0; k < queue.length; k++) {
      const e = queue[k];
      for (const n of e.next) {
        if (prev.has(n)) continue;
        prev.set(n, e);
        if (goal(n)) { const out: Edge[] = []; for (let x = n; x !== from; x = prev.get(x)!) out.push(x); return out.reverse(); }
        if (n.portal === 0) queue.push(n);
      }
    }
    return null;
  }

  /** Fills a new net with its trains at once (on loading a city), wherever there is room. */
  populate(): void {
    const want = this.targets();
    for (const [gid, n] of want) for (let k = 0; k < n; k++) { if (!this.spawn(gid, this.occupancy(), true)) break; }
    this.spawnClock = 1.2;
  }

  private move(t: Train, dt: number, occ: Map<number, [number, number, number][]>): void {
    if (t.wait > 0) {
      t.wait -= dt;
      if (t.wait > 0) return;
      if (t.turning) { if (!this.turnBack(t, occ)) { t.wait = 0.5; return; } }
      if (t.phase === 'dwell' && t.visitor && !t.leaving) {
        // A visitor has reached its station: back the way it came, out to its point.
        if (!this.turnBack(t, occ)) { t.wait = 0.5; return; }
        this.homeward(t);
      }
      if (t.phase === 'dwell') {
        // A terminus: come back from the platform rather than run on to the buffer and back.
        if (!t.ahead && t.edge.len - t.s < TRAIN_LEN + 1.2) {
          if (!this.turnBack(t, occ)) { t.wait = 0.5; return; }
          t.served = t.s + TRAIN_LEN + 1;
        }
        t.phase = 'out'; t.sinceStop = 0;
      }
    }
    const e = t.edge;
    // How far it may go: the train ahead, the end of the line, a junction it must wait for.
    let limit = Infinity;
    for (const [p, , id] of occ.get(e.id) ?? []) if (id !== t.id && p > t.s - 1e-6) limit = Math.min(limit, p - t.s - MIN_GAP);
    const toEnd = e.len - t.s;
    let holdAtEnd = false;
    if (limit === Infinity) {
      const n = t.ahead;
      if (!n) { limit = toEnd - 0.05; holdAtEnd = true; }
      else {
        let blocked = false;
        if (n.junction >= 0) {
          const exit = n.next[0];
          blocked = this.junctionBusy(occ, n.junction, t.id) || !this.free(occ, exit, 0, TRAIN_LEN + 0.3, t.id) || !this.free(occ, n, 0, n.len, t.id);
          // A junction past capacity holds each train a moment at its edge: the queue builds before it.
          if (!blocked && t.heldAt !== n.junction) {
            const jl = this.loadAt(n, n.len / 2);
            if (jl > 1) {
              if (toEnd < 0.03) { t.heldAt = n.junction; t.wait = Math.min(6, 2.5 * (jl - 1)); t.v = 0; t.phase = 'run'; return; }
              blocked = true;
            }
          }
        }
        if (blocked) limit = toEnd - 0.02;
        else {
          let near = Infinity;
          for (const [p, , id] of occ.get(n.id) ?? []) if (id !== t.id) near = Math.min(near, p);
          limit = near === Infinity ? Infinity : toEnd + near - MIN_GAP;
        }
      }
    }
    // A platform ahead, on this edge or just past its end.
    let stopAt = Infinity;
    for (const st of e.stops) if (st > t.served + 1e-6) { stopAt = Math.min(stopAt, st - t.s); }
    if (stopAt === Infinity && t.ahead) for (const st of t.ahead.stops) { stopAt = Math.min(stopAt, toEnd + st); break; }
    // Speed: the line speed, slower over track past capacity, and able to stop in time for all of the above.
    const load = this.loadAt(e, t.s);
    const jam = load <= 1 ? 1 : Math.max(0.1, 1 / (1 + 2.5 * (load - 1)));
    let vmax = SPEED * jam;
    const room = Math.min(limit, stopAt);
    if (room < Infinity) vmax = Math.min(vmax, Math.sqrt(2 * BRAKE * Math.max(0, room)));
    t.v = Math.min(vmax, t.v + ACCEL * dt);
    let ds = Math.max(0, Math.min(t.v * dt, Math.max(0, room)));
    if (stopAt < SLOW_IN && stopAt < limit + 0.5) t.phase = 'in';
    else if (t.phase !== 'dwell') t.phase = t.sinceStop < PULL_OUT ? 'out' : 'run';
    // Arrived at a platform?
    if (stopAt !== Infinity && stopAt - ds < 0.02 && stopAt <= limit + 0.02 && stopAt < toEnd + 1e-6) {
      ds = Math.max(0, stopAt); t.s += ds; t.odo += ds; t.served = t.s; t.v = 0; t.wait = DWELL; t.phase = 'dwell';
      this.crossing(t);
      return;
    }
    t.s += ds; t.sinceStop += ds; t.odo += ds;
    // On to the next edge.
    while (t.s >= e.len - 1e-9 && t.ahead && t.edge === e) {
      const n = t.ahead, over = t.s - e.len;
      if (n.junction >= 0 && (this.junctionBusy(occ, n.junction, t.id) || !this.free(occ, n.next[0], 0, TRAIN_LEN + 0.3, t.id))) { t.s = e.len; t.v = 0; break; }
      t.hist.unshift(e); t.edge = n; t.s = over; t.served = -1; t.ahead = this.pick(n, t);
      if (n.junction < 0) t.heldAt = -1;
      this.trimHist(t);
      // A platform right at the start of the new edge.
      if (n.stops.some(st => st <= t.s)) { t.s = Math.min(t.s, n.stops[0]); t.served = t.s; t.v = 0; t.wait = DWELL; t.phase = 'dwell'; }
    }
    this.crossing(t);
    // A dead end: stand, then come back.
    if (holdAtEnd && !t.ahead && t.edge.len - t.s <= 0.06 && t.wait <= 0) { t.v = 0; t.wait = TURN; t.turning = true; }
  }

  /** Starts the cross-over back to its own track once the front is clear of stations, and ends it when done. */
  private crossing(t: Train): void {
    if (t.crossPending && !t.edge.wide.some(([a, b]) => t.s > a && t.s < b)) { t.crossPending = false; t.crossAt = t.odo; }
    if (!Number.isNaN(t.crossAt) && t.odo - t.crossAt > TRAIN_LEN + CROSS) t.crossAt = NaN;
  }

  private trimHist(t: Train): void {
    let left = TRAIN_LEN - t.s, k = 0;
    while (left > 0 && k < t.hist.length) { left -= t.hist[k].len; k++; }
    t.hist.length = k;
  }

  /** Comes back from a dead end on the other track: its tail becomes its front. False if that track is not clear yet. */
  private turnBack(t: Train, occ: Map<number, [number, number, number][]>): boolean {
    // The edges it covers, front first, with the stretch on each.
    const parts: { e: Edge; a: number; b: number }[] = [];
    let left = TRAIN_LEN, e = t.edge, s = t.s, k = 0;
    for (;;) { const a = Math.max(0, s - left); parts.push({ e, a, b: s }); left -= s; if (left <= 0) break; const p = t.hist[k++]; if (!p) break; e = p; s = p.len; }
    for (const p of parts) if (!this.free(occ, p.e.rev, p.e.len - p.b, p.e.len - p.a, t.id)) return false;
    const last = parts[parts.length - 1];
    t.edge = last.e.rev; t.s = last.e.len - last.a;
    // hist runs nearest first: just behind the new front is the edge the tail's was behind.
    t.hist = parts.slice(0, -1).map(p => p.e.rev).reverse();
    t.turning = false; t.served = t.s; t.heldAt = -1; t.ahead = this.pick(t.edge, t); t.crossPending = true; t.crossAt = NaN; t.v = 0; t.sinceStop = 99;
    return true;
  }

  /** Sets a visitor on its way back out to its point (or, with no way there, makes it one of the city's own). */
  private homeward(t: Train): void {
    t.leaving = true;
    const route = t.edge.portal === 1 ? [] : this.routeTo(t.edge, (x) => x.portal === 1 && x.point === t.point);
    if (route) { t.route = route; t.ahead = t.route.shift() ?? null; }
    else { t.visitor = false; t.route = []; t.ahead = this.pick(t.edge); }
  }

  /** Takes a train over from an older net (the track changed), with its front at distance s along e. */
  adopt(old: Train, e: Edge, s: number): void {
    const t: Train = { ...old, edge: e, s, hist: [], ahead: null, wait: 0, turning: false, served: s, heldAt: -1, phase: old.phase === 'dwell' ? 'out' : old.phase, route: [] };
    // The body behind: back along the edges that lead here.
    let cur = e, left = TRAIN_LEN - s;
    while (left > 0) {
      const prev = this.edges.find(p => p.next.includes(cur));
      if (!prev || t.hist.includes(prev)) break;
      t.hist.push(prev); left -= prev.len; cur = prev;
    }
    if (t.visitor) {
      // Its route was on the old track: work it out again on this one.
      const route = t.leaving ? null : (e.stops.some(st => st > s) ? [] : this.routeTo(e, (x) => x.stops.length > 0));
      if (route) { t.route = route; t.ahead = t.route.shift() ?? null; } else this.homeward(t);
    } else t.ahead = this.pick(e);
    this.nextTrain = Math.max(this.nextTrain, old.id + 1);
    this.trains.push(t);
  }

  /** Where the point `back` tiles behind a train's front is: edge and distance along it. */
  static locate(t: Train, back: number): { e: Edge; s: number } {
    let e = t.edge, s = t.s - back, k = 0;
    while (s < 0) { const p = t.hist[k++]; if (!p) return { e, s: 0 }; e = p; s += p.len; }
    return { e, s };
  }
}
