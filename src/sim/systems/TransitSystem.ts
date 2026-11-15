// TransitSystem — flow-based traffic over the road network.
//
// There are no individual trips or routes. Instead, per pass:
//
//   1. TRAVEL-TIME MAPS. For each destination type (commerce, industry,
//      homes) one flood over the road network gives every road tile its travel
//      time to the nearest developed zone of that type. Crossing a tile costs
//      1 / speedMult of its road class, so avenues and highways are "shorter".
//
//   2. FLOWS. Three flows are sent downhill along those maps:
//        homes → commerce, homes → industry, industry → commerce
//      Each developed origin tile puts (devLevel × trips rate) onto its best
//      adjacent road; road tiles are then swept from farthest to nearest, each
//      handing its traffic to the neighbour it was reached from. One sweep per
//      map yields the volume on every road tile, through-traffic included.
//
//   3. CONGESTION = volume / capacity of the road class, as a 0-255 byte.
//
//   4. ACCESSIBILITY per zone tile, from travel time: homes look for the
//      nearer of commerce or industry, commerce and industry look for homes.
//      255 = next door, falling linearly to 0 at BALANCE.transit.commuteMax.
//      ZoneGrowthSystem uses it as a growth multiplier.
//
// Highways carry traffic but give no access: zones join the network only
// through streets and avenues (the same rule ZoneGrowthSystem uses).
//
// Everyone heads for the NEAREST destination and congestion does not yet feed
// back into travel time — destination capacity and damped feedback are the
// next step (see TODO.md, GAME ENGINE).
//
// Runs every transit.flowInterval ticks, and only when its inputs changed.

import { World } from '../World';
import { ROAD_NONE, ROAD_STREET, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../constants';
import { BALANCE } from '../../data/balance';

// Per road class byte: capacity, and travel cost per tile (1 / speedMult).
const CLASS_CAPACITY: number[] = [0, 0, 0, 0];
const CLASS_COST: number[] = [0, 1, 1, 1];
for (const [k, v] of Object.entries(BALANCE.roadClasses)) {
  CLASS_CAPACITY[Number(k)] = v.capacity;
  CLASS_COST[Number(k)] = 1 / v.speedMult;
}

/** One travel-time map: time to the nearest source, and the way there. */
interface Field {
  dist: Float32Array;    // travel time per road tile; Infinity = unreachable
  parent: Int32Array;    // next tile toward the destination; -1 at a destination
  order: Int32Array;     // road tiles in order of increasing dist
  count: number;         // number of valid entries in `order`
}

function makeField(n: number): Field {
  return { dist: new Float32Array(n), parent: new Int32Array(n), order: new Int32Array(n), count: 0 };
}

export class TransitSystem {
  private _n = 0;
  private _toC!: Field;
  private _toI!: Field;
  private _toR!: Field;
  private _flow!: Float32Array;     // traffic being swept along one map
  private _volume!: Float32Array;   // total traffic per road tile
  // Binary min-heap for the floods (lazy deletion).
  private _heapKey!: Float32Array;
  private _heapId!: Int32Array;
  private _heapSize = 0;
  // Hash of the inputs at the last full pass; NaN = never computed.
  private _lastInputHash = NaN;

  update(world: World): void {
    if (world.tick % BALANCE.transit.flowInterval !== 0) return;

    const { width, height } = world.grid;
    const n = width * height;

    if (this._n !== n) {
      this._n = n;
      this._toC = makeField(n);
      this._toI = makeField(n);
      this._toR = makeField(n);
      this._flow = new Float32Array(n);
      this._volume = new Float32Array(n);
      // Each road tile is pushed at most once per neighbour plus once as a source.
      this._heapKey = new Float32Array(n * 5 + 1);
      this._heapId = new Int32Array(n * 5 + 1);
      this._lastInputHash = NaN;
    }

    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;

    // Skip the pass when nothing it reads has changed. The hash is
    // position-dependent: a plain sum misses changes that cancel out
    // (a road moved, one zone growing as another shrinks).
    {
      let h = 0x811c9dc5 | 0;
      for (let i = 0; i < n; i++) {
        const v = zone[i] | (dev[i] << 8) | (roadClass[i] << 16) | (abandoned[i] !== 0 ? 1 << 24 : 0);
        h = Math.imul(h ^ v, 0x9e3779b1);
        h ^= h >>> 15;
      }
      if (h === this._lastInputHash) return;
      this._lastInputHash = h;
    }

    const T = BALANCE.transit;

    // ── 1. Travel-time maps ───────────────────────────────────────────────────
    this._flood(world, ZONE_C, this._toC);
    this._flood(world, ZONE_I, this._toI);
    this._flood(world, ZONE_R, this._toR);

    // ── 2. Flows ──────────────────────────────────────────────────────────────
    const volume = this._volume;
    volume.fill(0);
    this._sendFlow(world, this._toC, T.tripsRtoC, 0, T.tripsItoC);
    this._sendFlow(world, this._toI, T.tripsRtoI, 0, 0);

    // ── 3. Congestion ─────────────────────────────────────────────────────────
    const congestion = world.layers.congestion;
    let totalCong = 0, roadCount = 0;
    for (let i = 0; i < n; i++) {
      const rc = roadClass[i];
      if (rc === ROAD_NONE) { congestion[i] = 0; continue; }
      const cap = CLASS_CAPACITY[rc] || CLASS_CAPACITY[ROAD_STREET];
      const c = Math.min(255, Math.round(volume[i] / cap * 255));
      congestion[i] = c;
      totalCong += c;
      roadCount++;
    }
    world.stats.avgCongestion = roadCount > 0 ? Math.round(totalCong / roadCount) : 0;

    // ── 4. Accessibility ──────────────────────────────────────────────────────
    const accessibility = world.layers.accessibility;
    const distC = this._toC.dist, distI = this._toI.dist, distR = this._toR.dist;
    const commuteMax = T.commuteMax;

    for (let zy = 0; zy < height; zy++) {
      for (let zx = 0; zx < width; zx++) {
        const zi = zy * width + zx;
        const zoneType = zone[zi];
        if (zoneType === ZONE_NONE) { accessibility[zi] = 0; continue; }

        let best = Infinity;
        for (let k = 0; k < 4; k++) {
          const ri = k === 0 ? (zx > 0 ? zi - 1 : -1)
                   : k === 1 ? (zx < width - 1 ? zi + 1 : -1)
                   : k === 2 ? (zy > 0 ? zi - width : -1)
                   :           (zy < height - 1 ? zi + width : -1);
          if (ri < 0) continue;
          const rc = roadClass[ri];
          if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
          const t = zoneType === ZONE_R ? Math.min(distC[ri], distI[ri]) : distR[ri];
          if (t < best) best = t;
        }

        accessibility[zi] = best < commuteMax ? Math.round(255 * (1 - best / commuteMax)) : 0;
      }
    }
  }

  /**
   * Fill `field` with the travel time from every road tile to the nearest
   * developed, non-abandoned zone tile of `zoneType` (Dijkstra from all of
   * them at once). A zone is entered from an adjacent street or avenue.
   */
  private _flood(world: World, zoneType: number, field: Field): void {
    const { width, height } = world.grid;
    const n = width * height;
    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const { dist, parent, order } = field;

    dist.fill(Infinity);
    this._heapSize = 0;

    for (let i = 0; i < n; i++) {
      if (zone[i] !== zoneType || dev[i] === 0 || abandoned[i] !== 0) continue;
      const x = i % width, y = (i - x) / width;
      for (let k = 0; k < 4; k++) {
        const ri = k === 0 ? (x > 0 ? i - 1 : -1)
                 : k === 1 ? (x < width - 1 ? i + 1 : -1)
                 : k === 2 ? (y > 0 ? i - width : -1)
                 :           (y < height - 1 ? i + width : -1);
        if (ri < 0 || dist[ri] === 0) continue;
        const rc = roadClass[ri];
        if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
        dist[ri] = 0;
        parent[ri] = -1;
        this._push(ri, 0);
      }
    }

    let count = 0;
    while (this._heapSize > 0) {
      const key = this._heapKey[0];
      const cur = this._pop();
      if (key > dist[cur]) continue; // stale heap entry
      order[count++] = cur;

      const cx = cur % width, cy = (cur - cx) / width;
      const curCost = CLASS_COST[roadClass[cur]];
      for (let k = 0; k < 4; k++) {
        const ni = k === 0 ? (cx > 0 ? cur - 1 : -1)
                 : k === 1 ? (cx < width - 1 ? cur + 1 : -1)
                 : k === 2 ? (cy > 0 ? cur - width : -1)
                 :           (cy < height - 1 ? cur + width : -1);
        if (ni < 0) continue;
        const rc = roadClass[ni];
        if (rc === ROAD_NONE) continue;
        // Half of each tile is crossed when stepping from one to the next.
        const nd = Math.fround(key + (curCost + CLASS_COST[rc]) * 0.5);
        if (nd < dist[ni]) {
          dist[ni] = nd;
          parent[ni] = cur;
          this._push(ni, nd);
        }
      }
    }
    field.count = count;
  }

  /**
   * Put each origin zone's trips on its best adjacent road, then sweep the
   * map from farthest to nearest so every road tile accumulates the traffic
   * passing through it. Adds the result to `_volume`.
   */
  private _sendFlow(world: World, field: Field, rRate: number, cRate: number, iRate: number): void {
    const { width, height } = world.grid;
    const n = width * height;
    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const { dist, parent, order, count } = field;
    const flow = this._flow;
    const volume = this._volume;
    if (count === 0) return; // no destination of this type anywhere

    flow.fill(0);
    for (let i = 0; i < n; i++) {
      const zoneType = zone[i];
      if (zoneType === ZONE_NONE || dev[i] === 0 || abandoned[i] !== 0) continue;
      const rate = zoneType === ZONE_R ? rRate : zoneType === ZONE_C ? cRate : zoneType === ZONE_I ? iRate : 0;
      if (rate === 0) continue;

      const x = i % width, y = (i - x) / width;
      let bestRoad = -1, bestDist = Infinity;
      for (let k = 0; k < 4; k++) {
        const ri = k === 0 ? (x > 0 ? i - 1 : -1)
                 : k === 1 ? (x < width - 1 ? i + 1 : -1)
                 : k === 2 ? (y > 0 ? i - width : -1)
                 :           (y < height - 1 ? i + width : -1);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
        if (dist[ri] < bestDist) { bestDist = dist[ri]; bestRoad = ri; }
      }
      if (bestRoad >= 0) flow[bestRoad] += dev[i] * rate;
    }

    // Farthest first: a tile's parent is always nearer, so it is handled later.
    for (let k = count - 1; k >= 0; k--) {
      const ri = order[k];
      const f = flow[ri];
      if (f === 0) continue;
      volume[ri] += f;
      const p = parent[ri];
      if (p >= 0) flow[p] += f;
    }
  }

  private _push(id: number, key: number): void {
    const keys = this._heapKey, ids = this._heapId;
    let i = this._heapSize++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      keys[i] = keys[p]; ids[i] = ids[p];
      i = p;
    }
    keys[i] = key; ids[i] = id;
  }

  private _pop(): number {
    const keys = this._heapKey, ids = this._heapId;
    const top = ids[0];
    const size = --this._heapSize;
    if (size > 0) {
      const key = keys[size], id = ids[size];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= size) break;
        if (c + 1 < size && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        keys[i] = keys[c]; ids[i] = ids[c];
        i = c;
      }
      keys[i] = key; ids[i] = id;
    }
    return top;
  }
}
