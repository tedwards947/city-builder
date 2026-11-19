// Auto mode for the rail tools: click a start tile, click an end tile, and the
// track between them is laid in one go. This file is the pure part: which
// tiles the line takes, and what laying it would cost.
//
// Unlike the road tool's simple "L", the route is SEARCHED for, because track
// has traps a straight line walks into. The search finds the cheapest way
// from start to end on ONE level (ground, elevated or subway: the tool's),
// where a way costs the money for its new track (a ground bridge over water
// costs more, as when laid by hand) PLUS these penalties, in tiles of track:
//
//   - joining existing track so that a tile becomes a 3-way junction, or
//     running right beside existing track (every tile of that would join it).
//     Meeting the free END of a line, a platform or a ramp makes no junction
//     and costs nothing: the line runs straight into it;
//   - much more for making a 4-way junction, which crossing a line does;
//   - a little for each new level crossing (ground only), and for each bend.
//
// So it goes round a line or a street where the detour is short. Track
// already on the map may be used as part of the way: it costs no money, and a
// step along it counts like a step of new track, so the line does not wander
// off to ride an old one.
//
// GROUND track that must get across something it cannot get round BRIDGES it:
// a ramp up (2 tiles), elevated track over the obstacle, a ramp down (2
// tiles). That costs real money (two ramps and the elevated tiles) and no
// junction, and the junction penalty is set so that a bridge always beats
// joining the line and leaving it again. Only where there is no room for the
// ramps does it fall back to joining, following the line a tile and leaving
// (two 3-way junctions), never a 4-way on one tile if it can help it.
//
// It keeps to the placement rules of laying by hand (sim/rail.ts): ground on
// open land or water, crossing a straight street or avenue at right angles;
// elevated over anything but buildings and zones; subway under anything. A
// station's platform is entered only from its ends, a ramp only at its ends.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_NONE, BUILDING_RAMP_ELEVATED, RAIL_ELEVATED, RAIL_GROUND, RAIL_SURFACE, ROAD_NONE, ZONE_NONE } from '../sim/constants';
import { levelSides, railLinks, trackBlocker, trackBuildCost } from '../sim/rail';
import type { TilePos } from './dragPath';
import { pcQuoteMany } from '../sim/politics';
import type { PcQuote, PcQuoteAction } from '../sim/politics';

// Penalties, in tiles of the level's plain track.
const JUNCTION3 = 12;     // a tile ends up with three links (at least; see junctionCost)
const JUNCTION4 = 40;     // … or four
const CROSSING = 4;       // a new level crossing
const BEND = 0.5;
const REUSE = 1;          // a step along track that is already there: free in money, but no shortcut
// States the search may look at before it gives up. Enough for any line across a 256×256 map
// with detours; it bounds the time a hover over a place track cannot reach may take.
const SEARCH_LIMIT = 250_000;

// Directions 0–3 = N, E, S, W; the LINK_ bit of direction d is 1 << d.
const opposite = (d: number): number => (d + 2) & 3;
const bits = (m: number): number => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
/** The rotation of a ramp whose high end lies in direction `d` from its low end (rotation 0: high end east). */
const rampRot = (d: number): number => (d + 3) & 3;

const BLOCKED = 1, NEW = 2, EXISTING = 3;

/** One tile of an Auto line. */
export interface AutoRailStep extends TilePos {
  /** The level of the track on this tile (a RAIL_ bit). For a ramp tile, the level of that end. */
  level: number;
  /** Set on the two tiles of a ramp the line needs: its ground end ('low') or its elevated end ('high'). */
  ramp?: 'low' | 'high';
  /** On a ramp's 'low' tile: the rotation to place the ramp at (its anchor is this tile). */
  rot?: number;
}

/**
 * The tiles of the cheapest line of `level` track (ground by default) from
 * `start` to `end` (see the top of the file), both ends included, in order;
 * null if there is none (an end that cannot take track, or no way through).
 * Tiles that already have track are part of the list. A ground line may
 * include bridges: ramp tiles and elevated tiles. Reads the world, changes
 * nothing.
 */
export function autoRailPath(world: World, start: TilePos, end: TilePos, level: number = RAIL_GROUND): AutoRailStep[] | null {
  const { width, height } = world.grid;
  if (!world.grid.inBounds(start.tx, start.ty) || !world.grid.inBounds(end.tx, end.ty)) return null;
  const n = width * height;
  const L = world.layers;
  const ground = level === RAIL_GROUND;
  const unit = BALANCE.rail.track[level]?.cost || 1;
  const delta = [-width, 1, width, -1];
  // What a bridge over one line costs: two ramps and a tile of elevated track.
  const rampCost = BALANCE.buildings[BUILDING_RAMP_ELEVATED]?.cost ?? 0;
  const overCost = BALANCE.rail.track[RAIL_ELEVATED]?.cost ?? 0;
  // Joining a line and leaving it again makes two 3-way junctions: that must cost more than the bridge.
  const j3 = ground ? Math.max(JUNCTION3 * unit, 0.6 * (2 * rampCost + overCost)) : JUNCTION3 * unit;
  const j4 = Math.max(JUNCTION4 * unit, 2.5 * j3);

  const step = (i: number, d: number): number => {
    const x = i % width;
    if (d === 1 ? x === width - 1 : d === 3 ? x === 0 : d === 0 ? i < width : i >= n - width) return -1;
    return i + delta[d];
  };

  // Per tile, worked out when first met: what it is, what building on it costs, and for
  // existing track its links and the sides it accepts a link on; for a new level crossing
  // the directions the track may run in.
  const kind = new Uint8Array(n);
  const money = new Float64Array(n);
  const links = new Uint8Array(n);
  const open = new Uint8Array(n);
  const look = (i: number): number => {
    if (kind[i]) return kind[i];
    if (L.rail[i] & level) {
      links[i] = railLinks(world, i, level);
      open[i] = levelSides(world, i, level);
      return (kind[i] = EXISTING);
    }
    const tx = i % width, ty = (i - tx) / width;
    if (trackBlocker(world, tx, ty, level) !== null) return (kind[i] = BLOCKED);
    money[i] = trackBuildCost(world, tx, ty, level) ?? 0;
    open[i] = 15;
    if (ground && L.roadClass[i] !== ROAD_NONE) {
      // Cross the road, never run along it. (trackBlocker has refused bends and junctions.)
      let roads = 0;
      for (let d = 0; d < 4; d++) { const j = step(i, d); if (j >= 0 && L.roadClass[j] !== ROAD_NONE) roads |= 1 << d; }
      open[i] = roads & 5 ? 10 : roads & 10 ? 5 : 15;
      money[i] += CROSSING * unit;
    }
    return (kind[i] = NEW);
  };
  const junction = (count: number): number => (count >= 4 ? j4 : count >= 3 ? j3 : 0);
  /**
   * Existing track beside new tile `i` that would join it, other than towards `a` and `b`
   * (the line's own two directions; -1 for none, at an end of the line). A join costs what
   * the junction it makes costs, on this tile or on the one joined. It costs NOTHING where it
   * makes none: the line ending beside the free end of a line, a platform or a ramp simply
   * carries on into it.
   */
  const beside = (i: number, a: number, b: number): number => {
    let count = 0, worst = 0;
    for (let d = 0; d < 4; d++) {
      if (d === a || d === b || !(open[i] & (1 << d))) continue;
      const j = step(i, d);
      if (j >= 0 && look(j) === EXISTING && (open[j] & (1 << opposite(d)))) {
        count++;
        worst = Math.max(worst, bits(links[j]) + 1);
      }
    }
    if (count === 0) return 0;
    const here = junction((a >= 0 ? 1 : 0) + (b >= 0 ? 1 : 0) + count);
    return count * Math.max(here, junction(worst));
  };
  // ── The bridge layer (ground lines only) ───────────────────────────────────
  // A tile the bridge's elevated track may pass over: nothing there to block elevated track,
  // and no elevated track on it or beside it (the bridge would join that).
  const over = new Uint8Array(n);         // 0 unknown, 1 yes, 2 no
  const canOver = (i: number): boolean => {
    if (over[i]) return over[i] === 1;
    const tx = i % width, ty = (i - tx) / width;
    let ok = trackBlocker(world, tx, ty, RAIL_ELEVATED) === null;
    for (let d = 0; ok && d < 4; d++) { const j = step(i, d); if (j >= 0 && (L.rail[j] & RAIL_ELEVATED)) ok = false; }
    over[i] = ok ? 1 : 2;
    return ok;
  };
  // A tile one end of a ramp may stand on: open land with nothing on it (no road, track, zone or building).
  const rampTile = (i: number): boolean =>
    L.building[i] === BUILDING_NONE && L.zone[i] === ZONE_NONE && L.roadClass[i] === ROAD_NONE && (L.rail[i] & RAIL_SURFACE) === 0
    && world.isBuildable(i % width, (i - i % width) / width);

  const s0 = start.ty * width + start.tx, goal = end.ty * width + end.tx;
  if (look(s0) === BLOCKED || look(goal) === BLOCKED) return null;

  // A state is a layer (0: the line's own level; 1: on a bridge), a tile, and the direction it
  // was entered in (slot 0: the start, entered from nowhere).
  const layers = ground ? 2 : 1;
  const g = new Float64Array(layers * n * 5).fill(Infinity);
  const parent = new Int32Array(layers * n * 5).fill(-1);
  // How a state was reached, when not by a plain step: 1 = up a ramp (two ramp tiles lie
  // before it), 2 = down a ramp.
  const via = new Uint8Array(layers * n * 5);
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
  const relax = (next: number, total: number, from: number, how: number, tile: number): void => {
    if (total < g[next]) {
      g[next] = total;
      parent[next] = from;
      via[next] = how;
      // Among ways that look equally good, try the one that has come furthest first: on open
      // land every staircase to the goal ties, and this walks one of them instead of them all.
      push(next, total + h(tile) - total * 1e-9);
    }
  };

  g[s0 * 5] = kind[s0] === NEW ? money[s0] : 0;
  push(s0 * 5, g[s0 * 5] + h(s0));
  let best = Infinity, bestState = -1;
  let budget = SEARCH_LIMIT;
  while (heapKey.length > 0) {
    // (Keys sit a hair under their true cost, by the tie-break in relax: allow for it, or
    // every way that ties with the best one found would still be looked at.)
    if (heapKey[0] >= best * (1 - 1e-9) - 1e-6) break;
    if (--budget < 0) break;               // too far or too tangled: give up (the click does nothing)
    const state = pop();
    const node = (state / 5) | 0, din = state % 5 - 1, here = g[state];
    const onBridge = node >= n, i = onBridge ? node - n : node;
    if (here + h(i) >= best) continue;

    if (onBridge) {
      // On the bridge: carry on over, or come down a ramp (straight on: high end, low end, then ground).
      for (let d = 0; d < 4; d++) {
        if (d === opposite(din)) continue;
        const j = step(i, d);
        if (j < 0) continue;
        const turn = d !== din ? BEND * unit : 0;
        if (canOver(j)) relax((n + j) * 5 + d + 1, here + turn + overCost, state, 0, j);
        if (d !== din) continue;                       // a ramp runs straight on from the track
        const low = step(j, d), m = low < 0 ? -1 : step(low, d);
        if (m < 0 || !rampTile(j) || !rampTile(low)) continue;
        const what = look(m);
        if (what === BLOCKED || !(open[m] & (1 << opposite(d)))) continue;
        const land = what === EXISTING ? REUSE * unit + junction(bits(links[m]) + 1) : money[m];
        relax(m * 5 + d + 1, here + rampCost + land, state, 2, m);
      }
      continue;
    }

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
      const crossingHere = ground && isNew && L.roadClass[i] !== ROAD_NONE;
      if (crossingHere && din >= 0 && d !== din) continue;
      const j = step(i, d);
      if (j < 0) continue;
      const bend = din >= 0 && d !== din ? BEND * unit : 0;

      // Up a ramp and onto a bridge: from new plain ground track, straight on (or from the
      // start): low end, high end, then the first tile of elevated track.
      if (ground && isNew && !crossingHere && (din < 0 || d === din)) {
        const high = step(j, d), m = high < 0 ? -1 : step(high, d);
        if (m >= 0 && rampTile(j) && rampTile(high) && canOver(m)) {
          relax((n + m) * 5 + d + 1, here + beside(i, din < 0 ? -1 : opposite(din), d) + rampCost + overCost, state, 1, m);
        }
      }

      const what = look(j);
      if (what === BLOCKED) continue;
      let cost = bend;
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
      relax(j * 5 + d + 1, here + cost, state, 0, j);
    }
  }
  if (bestState < 0) return null;

  // Walk back from the goal, putting in the two ramp tiles a ramp state stands for.
  const out: AutoRailStep[] = [];
  const at = (i: number, lvl: number, ramp?: 'low' | 'high', rot?: number): AutoRailStep => {
    const s: AutoRailStep = { tx: i % width, ty: (i / width) | 0, level: lvl };
    if (ramp) s.ramp = ramp;
    if (rot !== undefined) s.rot = rot;
    return s;
  };
  for (let s = bestState; s >= 0; s = parent[s]) {
    const node = (s / 5) | 0, d = s % 5 - 1;
    const onBridge = node >= n, i = onBridge ? node - n : node;
    out.push(at(i, onBridge ? RAIL_ELEVATED : level));
    if (via[s] === 1) {
      // Came up a ramp: travelling in d, the low end is two tiles back and the high end one.
      const high = i - delta[d], low = high - delta[d];
      out.push(at(high, RAIL_ELEVATED, 'high'));
      out.push(at(low, RAIL_GROUND, 'low', rampRot(d)));
    } else if (via[s] === 2) {
      // Came down a ramp: the low end is one tile back, the high end two; from the low end the high end is behind.
      const low = i - delta[d], high = low - delta[d];
      out.push(at(low, RAIL_GROUND, 'low', rampRot(opposite(d))));
      out.push(at(high, RAIL_ELEVATED, 'high'));
    }
  }
  return out.reverse();
}

export interface AutoRailPlan {
  /** Every tile of the line, in order; empty when there is no way. */
  tiles: AutoRailStep[];
  /** Whether a way was found at all. */
  found: boolean;
  /** Money for the new track and any ramps (tiles that already have track cost nothing). */
  cost: number;
  /** Tiles that will get new track (ramp tiles not counted). */
  buildCount: number;
  /** Ramps the line needs (two for each bridge). */
  ramps: number;
  /** Whether the city has the money for it right now. */
  affordable: boolean;
  /** The political capital the new track would cost (homes near it object); `pc.affordable` false if the click would be refused for it. */
  pc: PcQuote;
}

/** What laying `tiles` (from `autoRailPath`, or null) would cost. Reads the world, changes nothing. */
export function planAutoRail(world: World, tiles: AutoRailStep[] | null): AutoRailPlan {
  if (!tiles) return { tiles: [], found: false, cost: 0, buildCount: 0, ramps: 0, affordable: false, pc: pcQuoteMany(world, []) };
  let cost = 0, buildCount = 0, ramps = 0;
  const actions: PcQuoteAction[] = [];
  for (const { tx, ty, level, ramp } of tiles) {
    if (ramp === 'low') { ramps++; cost += BALANCE.buildings[BUILDING_RAMP_ELEVATED]?.cost ?? 0; }
    if (ramp) continue;
    const c = trackBuildCost(world, tx, ty, level);
    if (c !== null) { cost += c; buildCount++; actions.push({ type: 'track', tx, ty, level }); }
  }
  return { tiles, found: true, cost, buildCount, ramps, affordable: world.budget.money >= cost, pc: pcQuoteMany(world, actions) };
}

// The preview asks for the same line on every frame while the pointer rests: keep the last answer briefly.
let memo: { world: World; key: string; at: number; path: AutoRailStep[] | null } | null = null;

/** `autoRailPath`, remembering the last answer for a quarter of a second (for the hover preview). */
export function autoRailPathCached(world: World, start: TilePos, end: TilePos, now: number, level: number = RAIL_GROUND): AutoRailStep[] | null {
  const key = `${start.tx},${start.ty},${end.tx},${end.ty},${level},${world.railVersion}`;
  if (memo && memo.world === world && memo.key === key && now - memo.at < 250) return memo.path;
  const path = autoRailPath(world, start, end, level);
  memo = { world, key, at: now, path };
  return path;
}
