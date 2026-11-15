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
//      flow yields the volume on every road tile, through-traffic included.
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
// The maps and per-flow volumes of the last pass are published as
// `world.traffic` for the overlay, inspector and tuning panel.
//
// Runs every transit.flowInterval ticks, and only when its inputs changed.

import { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../constants';
import { BALANCE } from '../../data/balance';
import {
  type TrafficData, type TrafficField,
  makeTrafficField, bestAccessRoad, neighbourIndex, roadCapacity,
} from '../TrafficData';

export class TransitSystem {
  private _n = 0;
  private _data!: TrafficData;
  private _flow!: Float32Array;     // traffic being swept along one map
  // Per road class byte: travel cost per tile (1 / speedMult). Refreshed each pass.
  private readonly _classCost: number[] = [0, 1, 1, 1];
  // Binary min-heap for the floods (lazy deletion).
  private _heapKey!: Float32Array;
  private _heapId!: Int32Array;
  private _heapSize = 0;
  // Hash of the layers, and the tuning values, at the last full pass.
  private _lastInputHash = NaN;
  private _lastTuning = '';

  update(world: World): void {
    if (world.tick % BALANCE.transit.flowInterval !== 0) return;
    this._run(world, false);
  }

  /** Recompute now, whatever the tick (used by the tuning panel). */
  recompute(world: World): void {
    this._run(world, true);
  }

  private _run(world: World, force: boolean): void {
    const { width, height } = world.grid;
    const n = width * height;

    if (this._n !== n) {
      this._n = n;
      this._data = {
        version: 0,
        toC: makeTrafficField(n), toI: makeTrafficField(n), toR: makeTrafficField(n),
        volRC: new Float32Array(n), volRI: new Float32Array(n), volIC: new Float32Array(n),
      };
      this._flow = new Float32Array(n);
      // Each road tile is pushed at most once per neighbour plus once as a source.
      this._heapKey = new Float32Array(n * 5 + 1);
      this._heapId = new Int32Array(n * 5 + 1);
      this._lastInputHash = NaN;
    }

    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const T = BALANCE.transit;

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
      let tuning = `${T.tripsRtoC},${T.tripsRtoI},${T.tripsItoC},${T.commuteMax}`;
      for (const k of [1, 2, 3]) {
        const rc = BALANCE.roadClasses[k];
        tuning += `,${rc.capacity},${rc.speedMult}`;
        this._classCost[k] = 1 / rc.speedMult;
      }
      if (!force && world.traffic === this._data && h === this._lastInputHash && tuning === this._lastTuning) return;
      this._lastInputHash = h;
      this._lastTuning = tuning;
    }

    const data = this._data;

    // ── 1. Travel-time maps ───────────────────────────────────────────────────
    this._flood(world, ZONE_C, data.toC);
    this._flood(world, ZONE_I, data.toI);
    this._flood(world, ZONE_R, data.toR);

    // ── 2. Flows ──────────────────────────────────────────────────────────────
    this._sendFlow(world, data.toC, ZONE_R, T.tripsRtoC, data.volRC);
    this._sendFlow(world, data.toI, ZONE_R, T.tripsRtoI, data.volRI);
    this._sendFlow(world, data.toC, ZONE_I, T.tripsItoC, data.volIC);

    // ── 3. Congestion ─────────────────────────────────────────────────────────
    const congestion = world.layers.congestion;
    const { volRC, volRI, volIC } = data;
    let totalCong = 0, roadCount = 0;
    for (let i = 0; i < n; i++) {
      const rc = roadClass[i];
      if (rc === ROAD_NONE) { congestion[i] = 0; continue; }
      const volume = volRC[i] + volRI[i] + volIC[i];
      const c = Math.min(255, Math.round(volume / roadCapacity(rc) * 255));
      congestion[i] = c;
      totalCong += c;
      roadCount++;
    }
    world.stats.avgCongestion = roadCount > 0 ? Math.round(totalCong / roadCount) : 0;

    // ── 4. Accessibility ──────────────────────────────────────────────────────
    const accessibility = world.layers.accessibility;
    const distC = data.toC.dist, distI = data.toI.dist, distR = data.toR.dist;
    const commuteMax = T.commuteMax;

    for (let zi = 0; zi < n; zi++) {
      const zoneType = zone[zi];
      if (zoneType === ZONE_NONE) { accessibility[zi] = 0; continue; }

      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(zi, k, width, height);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
        const t = zoneType === ZONE_R ? Math.min(distC[ri], distI[ri]) : distR[ri];
        if (t < best) best = t;
      }

      accessibility[zi] = best < commuteMax ? Math.round(255 * (1 - best / commuteMax)) : 0;
    }

    data.version++;
    world.traffic = data;
  }

  /**
   * Fill `field` with the travel time from every road tile to the nearest
   * developed, non-abandoned zone tile of `zoneType` (Dijkstra from all of
   * them at once). A zone is entered from an adjacent street or avenue.
   */
  private _flood(world: World, zoneType: number, field: TrafficField): void {
    const { width, height } = world.grid;
    const n = width * height;
    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const classCost = this._classCost;
    const { dist, parent, order } = field;

    dist.fill(Infinity);
    this._heapSize = 0;

    for (let i = 0; i < n; i++) {
      if (zone[i] !== zoneType || dev[i] === 0 || abandoned[i] !== 0) continue;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(i, k, width, height);
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

      const curCost = classCost[roadClass[cur]];
      for (let k = 0; k < 4; k++) {
        const ni = neighbourIndex(cur, k, width, height);
        if (ni < 0) continue;
        const rc = roadClass[ni];
        if (rc === ROAD_NONE) continue;
        // Half of each tile is crossed when stepping from one to the next.
        const nd = Math.fround(key + (curCost + classCost[rc]) * 0.5);
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
   * passing through it. Writes the result to `out`.
   */
  private _sendFlow(world: World, field: TrafficField, originZone: number, rate: number, out: Float32Array): void {
    const n = this._n;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const { parent, order, count } = field;
    const flow = this._flow;

    out.fill(0);
    if (count === 0 || rate === 0) return; // no destination of this type anywhere

    flow.fill(0);
    for (let i = 0; i < n; i++) {
      if (zone[i] !== originZone || dev[i] === 0 || abandoned[i] !== 0) continue;
      const road = bestAccessRoad(world, i, field);
      if (road >= 0) flow[road] += dev[i] * rate;
    }

    // Farthest first: a tile's parent is always nearer, so it is handled later.
    for (let k = count - 1; k >= 0; k--) {
      const ri = order[k];
      const f = flow[ri];
      if (f === 0) continue;
      out[ri] = f;
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
