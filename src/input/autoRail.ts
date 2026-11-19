// Auto mode for the rail tool: click a start tile, click an end tile, and the
// track between them is laid in one go. This file is the pure part: which
// tiles the line takes, and what laying it would cost.
//
// Unlike the road tool's simple "L", the route is SEARCHED for, because track
// has traps a straight line walks into. The search finds the cheapest way
// from start to end, where a way costs the money for its new track (bridges
// cost more, as when laid by hand) PLUS these penalties, in tiles of track:
//
//   - joining existing track so that a tile becomes a 3-way junction, or
//     running right beside existing track (every tile of that would join it);
//   - much more for making a 4-way junction, which crossing a line does;
//   - a little for each new level crossing, and for each bend.
//
// So it goes round a line or a street where the detour is short, and through
// where it is not. Track already on the map may be used as part of the way:
// it costs no money, and a step along it counts like a step of new track, so
// the line does not wander off to ride an old one. Where it must get across a
// line, it joins it, follows it for a tile and leaves (two 3-way junctions)
// rather than cross it on one tile (a 4-way, which the game punishes far more).
// It keeps to the placement rules of laying by hand: open land or water, a
// straight street or avenue crossed at right angles; never a highway, a
// zone or a building. A station's platform is entered only from its ends.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { RAIL_GROUND, ROAD_NONE } from '../sim/constants';
import { railLinks, trackBlocker, trackBuildCost, trackSides } from '../sim/rail';
import type { TilePos } from './dragPath';
import { pcQuoteMany } from '../sim/politics';
import type { PcQuote } from '../sim/politics';

// Penalties, in tiles of plain ground track.
const JUNCTION3 = 12;     // a tile ends up with three links
const JUNCTION4 = 40;     // … or four
const CROSSING = 4;       // a new level crossing
const BEND = 0.5;
const REUSE = 1;          // a step along track that is already there: free in money, but no shortcut

// Directions 0–3 = N, E, S, W; the LINK_ bit of direction d is 1 << d.
const opposite = (d: number): number => (d + 2) & 3;
const bits = (m: number): number => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

const BLOCKED = 1, NEW = 2, EXISTING = 3;

/**
 * The tiles of the cheapest line from `start` to `end` (see the top of the
 * file), both ends included, in order; null if there is none (an end that
 * cannot take track, or no way through). Tiles that already have track are
 * part of the list. Reads the world, changes nothing.
 */
export function autoRailPath(world: World, start: TilePos, end: TilePos): TilePos[] | null {
  const { width, height } = world.grid;
  if (!world.grid.inBounds(start.tx, start.ty) || !world.grid.inBounds(end.tx, end.ty)) return null;
  const n = width * height;
  const L = world.layers;
  const unit = BALANCE.rail.track[RAIL_GROUND]?.cost || 1;
  const delta = [-width, 1, width, -1];

  // Per tile, worked out when first met: what it is, what building on it costs, and for
  // existing track its links and the sides it accepts a link on; for a new level crossing
  // the directions the track may run in.
  const kind = new Uint8Array(n);
  const money = new Float64Array(n);
  const links = new Uint8Array(n);
  const open = new Uint8Array(n);
  const look = (i: number): number => {
    if (kind[i]) return kind[i];
    if (L.rail[i] & RAIL_GROUND) {
      links[i] = railLinks(world, i);
      open[i] = trackSides(world, i);
      return (kind[i] = EXISTING);
    }
    const tx = i % width, ty = (i - tx) / width;
    if (trackBlocker(world, tx, ty) !== null) return (kind[i] = BLOCKED);
    money[i] = trackBuildCost(world, tx, ty) ?? 0;
    open[i] = 15;
    if (L.roadClass[i] !== ROAD_NONE) {
      // Cross the road, never run along it. (trackBlocker has refused bends and junctions.)
      let roads = 0;
      for (let d = 0; d < 4; d++) { const j = step(i, d); if (j >= 0 && L.roadClass[j] !== ROAD_NONE) roads |= 1 << d; }
      open[i] = roads & 5 ? 10 : roads & 10 ? 5 : 15;
      money[i] += CROSSING * unit;
    }
    return (kind[i] = NEW);
  };
  const step = (i: number, d: number): number => {
    const x = i % width;
    if (d === 1 ? x === width - 1 : d === 3 ? x === 0 : d === 0 ? i < width : i >= n - width) return -1;
    return i + delta[d];
  };
  /** Existing track beside new tile `i` that would join it, other than towards `a` and `b`: each makes a junction. */
  const beside = (i: number, a: number, b: number): number => {
    let count = 0;
    for (let d = 0; d < 4; d++) {
      if (d === a || d === b || !(open[i] & (1 << d))) continue;
      const j = step(i, d);
      if (j >= 0 && look(j) === EXISTING && (open[j] & (1 << opposite(d)))) count++;
    }
    return count * JUNCTION3 * unit;
  };
  const junction = (count: number): number => (count >= 4 ? JUNCTION4 : count >= 3 ? JUNCTION3 : 0) * unit;

  const s0 = start.ty * width + start.tx, goal = end.ty * width + end.tx;
  if (look(s0) === BLOCKED || look(goal) === BLOCKED) return null;

  // A state is a tile and the direction it was entered in (slot 0: the start, entered from nowhere).
  const g = new Float64Array(n * 5).fill(Infinity);
  const parent = new Int32Array(n * 5).fill(-1);
  const gx = end.tx, gy = end.ty;
  const h = (i: number): number => (Math.abs(i % width - gx) + Math.abs(((i / width) | 0) - gy)) * REUSE * unit;
  const heapKey: number[] = [], heapId: number[] = [];
  const push = (id: number, key: number): void => {
    let k = heapKey.length;
    heapKey.push(key); heapId.push(id);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapKey[p] <= key) break;
      heapKey[k] = heapKey[p]; heapId[k] = heapId[p];
      k = p;
    }
    heapKey[k] = key; heapId[k] = id;
  };
  const pop = (): number => {
    const top = heapId[0];
    const key = heapKey.pop()!, id = heapId.pop()!;
    const size = heapKey.length;
    if (size > 0) {
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= size) break;
        if (c + 1 < size && heapKey[c + 1] < heapKey[c]) c++;
        if (heapKey[c] >= key) break;
        heapKey[k] = heapKey[c]; heapId[k] = heapId[c];
        k = c;
      }
      heapKey[k] = key; heapId[k] = id;
    }
    return top;
  };

  g[s0 * 5] = kind[s0] === NEW ? money[s0] : 0;
  push(s0 * 5, g[s0 * 5] + h(s0));
  let best = Infinity, bestState = -1;
  while (heapKey.length > 0) {
    if (heapKey[0] >= best) break;
    const state = pop();
    const i = (state / 5) | 0, din = state % 5 - 1, here = g[state];
    if (here + h(i) > best) continue;
    const isNew = kind[i] === NEW;
    if (i === goal) {
      // The line ends here: what joins the last tile from its other sides counts now.
      const total = here + (isNew ? beside(i, din < 0 ? -1 : opposite(din), -1) : 0);
      if (total < best) { best = total; bestState = state; }
      // (Going on from the goal and coming back is never cheaper, but a state entered
      // from another side may be: keep searching until the heap passes `best`.)
      continue;
    }
    // How this tile was entered: over a link that was already there, or a new one.
    const cameOnOld = !isNew && din >= 0 && (links[i] & (1 << opposite(din))) !== 0;
    for (let d = 0; d < 4; d++) {
      if (din >= 0 && d === opposite(din)) continue;
      if (!(open[i] & (1 << d))) {
        // Existing track may still be FOLLOWED out of a side it would take no new link on.
        if (isNew || !(links[i] & (1 << d))) continue;
      }
      // A new level crossing is crossed straight.
      if (isNew && L.roadClass[i] !== ROAD_NONE && din >= 0 && d !== din) continue;
      const j = step(i, d);
      if (j < 0) continue;
      const what = look(j);
      if (what === BLOCKED) continue;
      let cost = din >= 0 && d !== din ? BEND * unit : 0;
      const follows = !isNew && what === EXISTING && (links[i] & (1 << d)) !== 0;
      if (follows) {
        cost += REUSE * unit;
      } else {
        if (!(open[j] & (1 << opposite(d)))) continue;     // a platform's side, or along a crossing's road
        if (isNew) {
          cost += beside(i, din < 0 ? -1 : opposite(din), d);
        } else {
          // A new link out of existing track.
          cost += junction(bits(links[i]) + (din >= 0 && !cameOnOld ? 1 : 0) + 1);
        }
        if (what === EXISTING) cost += REUSE * unit + junction(bits(links[j]) + 1);
        else cost += money[j];
      }
      const next = j * 5 + d + 1;
      const total = here + cost;
      if (total < g[next]) {
        g[next] = total;
        parent[next] = state;
        push(next, total + h(j));
      }
    }
  }
  if (bestState < 0) return null;
  const out: TilePos[] = [];
  for (let s = bestState; s >= 0; s = parent[s]) {
    const i = (s / 5) | 0;
    out.push({ tx: i % width, ty: (i / width) | 0 });
  }
  return out.reverse();
}

export interface AutoRailPlan {
  /** Every tile of the line, in order; empty when there is no way. */
  tiles: TilePos[];
  /** Whether a way was found at all. */
  found: boolean;
  /** Money for the new track (tiles that already have track cost nothing). */
  cost: number;
  /** Tiles that will get new track. */
  buildCount: number;
  /** Whether the city has the money for it right now. */
  affordable: boolean;
  /** The political capital the new track would cost (homes near it object); `pc.affordable` false if the click would be refused for it. */
  pc: PcQuote;
}

/** What laying `tiles` (from `autoRailPath`, or null) would cost. Reads the world, changes nothing. */
export function planAutoRail(world: World, tiles: TilePos[] | null): AutoRailPlan {
  if (!tiles) return { tiles: [], found: false, cost: 0, buildCount: 0, affordable: false, pc: pcQuoteMany(world, []) };
  let cost = 0, buildCount = 0;
  for (const { tx, ty } of tiles) {
    const c = trackBuildCost(world, tx, ty);
    if (c !== null) { cost += c; buildCount++; }
  }
  const pc = pcQuoteMany(world, tiles.map(({ tx, ty }) => ({ type: 'track' as const, tx, ty, level: RAIL_GROUND })));
  return { tiles, found: true, cost, buildCount, affordable: world.budget.money >= cost, pc };
}

// The preview asks for the same line on every frame while the pointer rests: keep the last answer briefly.
let memo: { world: World; key: string; at: number; path: TilePos[] | null } | null = null;

/** `autoRailPath`, remembering the last answer for a quarter of a second (for the hover preview). */
export function autoRailPathCached(world: World, start: TilePos, end: TilePos, now: number): TilePos[] | null {
  const key = `${start.tx},${start.ty},${end.tx},${end.ty},${world.railVersion}`;
  if (memo && memo.world === world && memo.key === key && now - memo.at < 250) return memo.path;
  const path = autoRailPath(world, start, end);
  memo = { world, key, at: now, path };
  return path;
}
