// TransitSystem — flow-based traffic over the road network.
//
// There are no individual trips or routes. One ITERATION does this:
//
//   1. TRAVEL-TIME MAPS. For each destination type (commerce, industry,
//      homes) one flood over the road network gives every road tile its cost
//      to a destination of that type and the way there. Crossing a tile costs
//      1 / speedMult of its road class, more when the tile is congested, so
//      avenues and highways are "shorter" and jams push traffic elsewhere.
//      A "door" is a road tile next to a developed destination zone.
//
//   2. FLOWS. Three flows are sent downhill along those maps:
//        homes → commerce, homes → industry, industry → commerce
//      Each developed origin tile puts (devLevel × trips rate) onto its best
//      adjacent road; road tiles are then swept from farthest to nearest, each
//      handing its traffic to the neighbour it was reached from. Every door a
//      stream passes takes trips up to its capacity (its zones' levels ×
//      shopCapacity / jobCapacity); the rest drives on. Whatever is left ends
//      at the last door of the route.
//
//   3. PRICES. A door where more trips ended than it can take gets a higher
//      "price" (extra cost of ending a route there), so on the next iteration
//      routes end further on, at doors with room. This is what stops one shop
//      absorbing a whole city.
//
// Iterations repeat until nothing moves much: several per pass, more on the
// first pass and from recompute(). Volumes are averaged over iterations, so
// where two routes keep trading places the traffic shows as split.
//
// Then: CONGESTION = volume / capacity of the road class, as a 0-255 byte,
// and ACCESSIBILITY per zone tile from travel time — homes look for the
// nearer of commerce or industry, commerce and industry look for homes.
// 255 = next door, falling linearly to 0 at BALANCE.transit.commuteMax.
// ZoneGrowthSystem uses it as a growth multiplier.
//
// Highways carry traffic but give no access: zones join the network only
// through streets and avenues (the same rule ZoneGrowthSystem uses).
//
// The maps and per-flow volumes are published as `world.traffic` for the
// overlay, inspector and tuning panel.
//
// Runs every transit.flowInterval ticks, while its inputs change or the
// assignment is still settling.

import { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../constants';
import { BALANCE } from '../../data/balance';
import {
  type TrafficData, type TrafficField,
  makeTrafficField, bestAccessRoad, neighbourIndex, roadCapacity,
} from '../TrafficData';

// Iteration control. Not balance: these only affect how fast traffic settles.
const ITERATIONS_FIRST_PASS = 24;   // first pass of a game, and recompute()
const ITERATIONS_PER_PASS = 3;
const ITERATIONS_MAX = 60;          // since the inputs last changed; then stop regardless
const SETTLED_LOAD = 0.004;         // largest change in volume / capacity (about 1 congestion byte)
const SETTLED_PRICE = 0.02;         // largest change in a door price, in tiles
const PRICE_GAIN = 3;               // tiles of price per 100% a door is over its share
const PRICE_MAX_STEP = 6;           // largest price change per iteration, in tiles
const PRICE_TOLERANCE = 0.1;        // doors within ±10% of their share are left alone
const PRICE_DECAY = 0.15;           // prices fall this much slower than they rise
const CONGESTION_CAP = 3;           // load ratio beyond which a tile gets no slower

export class TransitSystem {
  private _n = 0;
  private _data!: TrafficData;
  private _flowA!: Float32Array;    // traffic being swept along one map (first flow)
  private _flowB!: Float32Array;    // second flow on the same map
  private _raw!: Float32Array;      // one flow's volumes this iteration, before averaging
  private _room!: Float32Array;     // capacity left at each door during a sweep
  private _cost!: Float32Array;     // travel cost per road tile this iteration
  // Per road class byte: travel cost per tile (1 / speedMult). Refreshed each pass.
  private readonly _classCost: number[] = [0, 1, 1, 1];
  // Binary min-heap for the floods (lazy deletion).
  private _heapKey!: Float32Array;
  private _heapId!: Int32Array;
  private _heapSize = 0;
  // Hash of the layers, and the tuning values, at the last pass.
  private _lastInputHash = NaN;
  private _lastTuning = '';
  private _iter = 0;                // iterations since the inputs last changed
  private _fresh = true;            // no pass has run yet

  update(world: World): void {
    if (world.tick % BALANCE.transit.flowInterval !== 0) return;
    this._run(world, false);
  }

  /** Recompute now, whatever the tick, and iterate until settled (used by the tuning panel). */
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
        settled: false,
      };
      this._flowA = new Float32Array(n);
      this._flowB = new Float32Array(n);
      this._raw = new Float32Array(n);
      this._room = new Float32Array(n);
      this._cost = new Float32Array(n);
      // Each road tile is pushed at most once per neighbour plus once as a source.
      this._heapKey = new Float32Array(n * 5 + 1);
      this._heapId = new Int32Array(n * 5 + 1);
      this._lastInputHash = NaN;
      this._fresh = true;
    }

    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const T = BALANCE.transit;
    const data = this._data;

    // Has anything the pass reads changed? The hash is position-dependent: a
    // plain sum misses changes that cancel out (a road moved, one zone growing
    // as another shrinks).
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < n; i++) {
      const v = zone[i] | (dev[i] << 8) | (roadClass[i] << 16) | (abandoned[i] !== 0 ? 1 << 24 : 0);
      h = Math.imul(h ^ v, 0x9e3779b1);
      h ^= h >>> 15;
    }
    let tuning = `${T.tripsRtoC},${T.tripsRtoI},${T.tripsItoC},${T.commuteMax},${T.shopCapacity},${T.jobCapacity},${T.congestionDelay},${T.freeFlow}`;
    for (const k of [1, 2, 3]) {
      const rc = BALANCE.roadClasses[k];
      tuning += `,${rc.capacity},${rc.speedMult}`;
      this._classCost[k] = 1 / rc.speedMult;
    }
    const changed = force || world.traffic !== data || h !== this._lastInputHash || tuning !== this._lastTuning;
    if (!changed && data.settled) return;
    if (changed) {
      this._lastInputHash = h;
      this._lastTuning = tuning;
      this._iter = 0;
      data.settled = false;
    }

    const budget = this._fresh || force ? ITERATIONS_FIRST_PASS : ITERATIONS_PER_PASS;
    this._fresh = false;
    for (let k = 0; k < budget && !data.settled; k++) {
      const moved = this._iterate(world);
      this._iter++;
      if (!moved || this._iter >= ITERATIONS_MAX) data.settled = true;
    }

    // The way to homes is only needed for accessibility, so once per pass,
    // with the roads as slow as the final volumes make them.
    this._updateCosts(world);
    this._flood(world, ZONE_R, data.toR, 1, false);

    // ── Congestion ────────────────────────────────────────────────────────────
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

    // ── Accessibility ─────────────────────────────────────────────────────────
    const accessibility = world.layers.accessibility;
    const { toC, toI, toR } = data;
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
        let t: number;
        if (zoneType === ZONE_R) {
          const tc = toC.dist[ri] < Infinity ? toC.near[ri] : Infinity;
          const ti = toI.dist[ri] < Infinity ? toI.near[ri] : Infinity;
          t = Math.min(tc, ti);
        } else {
          t = toR.dist[ri] < Infinity ? toR.near[ri] : Infinity;
        }
        if (t < best) best = t;
      }

      accessibility[zi] = best < commuteMax ? Math.round(255 * (1 - best / commuteMax)) : 0;
    }

    data.version++;
    world.traffic = data;
  }

  /** Travel cost per road tile from the current volumes: slower when loaded past free flow. */
  private _updateCosts(world: World): void {
    const n = this._n;
    const T = BALANCE.transit;
    const roadClass = world.layers.roadClass;
    const { volRC, volRI, volIC } = this._data;
    const cost = this._cost;
    const classCost = this._classCost;
    for (let i = 0; i < n; i++) {
      const rc = roadClass[i];
      if (rc === ROAD_NONE) continue;
      const ratio = (volRC[i] + volRI[i] + volIC[i]) / roadCapacity(rc);
      const over = Math.min(ratio, CONGESTION_CAP) - T.freeFlow;
      cost[i] = classCost[rc] * (over > 0 ? 1 + T.congestionDelay * over : 1);
    }
  }

  /** One round of maps → flows → prices. Returns whether anything moved noticeably. */
  private _iterate(world: World): boolean {
    const T = BALANCE.transit;
    const { volRC, volRI, volIC, toC, toI } = this._data;
    // Weight of this iteration in the running average: 1, then falling.
    const damp = 1 / (1 + this._iter * 0.5);

    this._updateCosts(world);

    this._flood(world, ZONE_C, toC, T.shopCapacity, true);
    this._flood(world, ZONE_I, toI, T.jobCapacity, true);

    let moved = 0;

    // Commerce takes two flows, which share its doors' capacity.
    const demandRC = this._inject(world, toC, ZONE_R, T.tripsRtoC, this._flowA);
    const demandIC = this._inject(world, toC, ZONE_I, T.tripsItoC, this._flowB);
    this._openDoors(toC, demandRC + demandIC);
    moved = Math.max(moved, this._sweep(world, toC, this._flowA, volRC, damp));
    moved = Math.max(moved, this._sweep(world, toC, this._flowB, volIC, damp));

    const demandRI = this._inject(world, toI, ZONE_R, T.tripsRtoI, this._flowA);
    this._openDoors(toI, demandRI);
    moved = Math.max(moved, this._sweep(world, toI, this._flowA, volRI, damp));

    const step = Math.max(0.5, damp);
    const priceMoved = Math.max(this._updatePrices(toC, step), this._updatePrices(toI, step));

    return moved > SETTLED_LOAD || priceMoved > SETTLED_PRICE;
  }

  /**
   * Fill `field` with the cost from every road tile to a developed,
   * non-abandoned zone tile of `zoneType`, and the way there (Dijkstra from
   * all doors at once, each starting at its price). A zone is entered from an
   * adjacent street or avenue; its capacity is shared between its doors.
   */
  private _flood(world: World, zoneType: number, field: TrafficField, capPerLevel: number, priced: boolean): void {
    const { width, height } = world.grid;
    const n = width * height;
    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const cost = this._cost;
    const { dist, parent, order, near, doorCap, price } = field;

    dist.fill(Infinity);
    doorCap.fill(0);
    this._heapSize = 0;

    for (let i = 0; i < n; i++) {
      if (zone[i] !== zoneType || dev[i] === 0 || abandoned[i] !== 0) continue;
      let doors = 0;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(i, k, width, height);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) doors++;
      }
      if (doors === 0) continue;
      const share = dev[i] * capPerLevel / doors;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(i, k, width, height);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) doorCap[ri] += share;
      }
    }

    for (let ri = 0; ri < n; ri++) {
      if (doorCap[ri] === 0) { price[ri] = 0; continue; }
      const p = priced ? price[ri] : 0;
      dist[ri] = p;
      parent[ri] = -1;
      this._push(ri, p);
    }

    let count = 0;
    while (this._heapSize > 0) {
      const key = this._heapKey[0];
      const cur = this._pop();
      if (key > dist[cur]) continue; // stale heap entry
      order[count++] = cur;
      // Travel time to the first door on the way: 0 at any door, even one the
      // route drives past.
      const p = parent[cur];
      near[cur] = doorCap[cur] > 0 || p < 0 ? 0 : near[p] + (cost[cur] + cost[p]) * 0.5;

      const curCost = cost[cur];
      for (let k = 0; k < 4; k++) {
        const ni = neighbourIndex(cur, k, width, height);
        if (ni < 0) continue;
        if (roadClass[ni] === ROAD_NONE) continue;
        // Half of each tile is crossed when stepping from one to the next.
        const nd = Math.fround(key + (curCost + cost[ni]) * 0.5);
        if (nd < dist[ni]) {
          dist[ni] = nd;
          parent[ni] = cur;
          this._push(ni, nd);
        }
      }
    }
    field.count = count;
  }

  /** Put each origin zone's trips on its best adjacent road. Returns the total. */
  private _inject(world: World, field: TrafficField, originZone: number, rate: number, flow: Float32Array): number {
    const n = this._n;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    flow.fill(0);
    if (field.count === 0 || rate === 0) return 0; // no destination of this type anywhere
    let total = 0;
    for (let i = 0; i < n; i++) {
      if (zone[i] !== originZone || dev[i] === 0 || abandoned[i] !== 0) continue;
      const road = bestAccessRoad(world, i, field);
      if (road < 0 || !(field.dist[road] < Infinity)) continue;
      const trips = dev[i] * rate;
      flow[road] += trips;
      total += trips;
    }
    return total;
  }

  /**
   * Set each door's room for this iteration. When there are more trips than
   * capacity in total, every door's room is scaled up by the same factor, so
   * prices only react to a door taking more than its SHARE.
   */
  private _openDoors(field: TrafficField, demand: number): void {
    const { doorCap, doorLoad, order, count } = field;
    const room = this._room;
    let totalCap = 0;
    for (let k = 0; k < count; k++) totalCap += doorCap[order[k]];
    field.demandRatio = totalCap > 0 ? demand / totalCap : 0;
    const scale = Math.max(1, field.demandRatio);
    for (let k = 0; k < count; k++) {
      const ri = order[k];
      room[ri] = doorCap[ri] * scale;
      doorLoad[ri] = 0;
    }
  }

  /**
   * Sweep `flow` along the map from farthest to nearest, so every road tile
   * accumulates the traffic passing through it. Doors on the way take trips
   * while they have room; the last door of a route takes whatever is left.
   * Blends the result into `out` and returns the largest change in
   * volume / capacity.
   */
  private _sweep(world: World, field: TrafficField, flow: Float32Array, out: Float32Array, damp: number): number {
    const n = this._n;
    const roadClass = world.layers.roadClass;
    const { parent, order, count, doorCap, doorLoad } = field;
    const room = this._room;
    const raw = this._raw;
    raw.fill(0);

    // Farthest first: a tile's parent is always nearer, so it is handled later.
    for (let k = count - 1; k >= 0; k--) {
      const ri = order[k];
      let f = flow[ri];
      if (f === 0) continue;
      raw[ri] = f;
      const p = parent[ri];
      if (p < 0) {
        doorLoad[ri] += f;
        room[ri] -= f;
      } else {
        if (doorCap[ri] > 0 && room[ri] > 0) {
          const taken = f < room[ri] ? f : room[ri];
          doorLoad[ri] += taken;
          room[ri] -= taken;
          f -= taken;
        }
        if (f > 0) flow[p] += f;
      }
    }

    let moved = 0;
    for (let i = 0; i < n; i++) {
      const d = raw[i] - out[i];
      if (d === 0) continue;
      const rc = roadClass[i];
      if (rc === ROAD_NONE) { out[i] = 0; continue; }
      const stepd = d * damp;
      out[i] = damp === 1 ? raw[i] : out[i] + stepd;
      const rel = Math.abs(stepd) / roadCapacity(rc);
      if (rel > moved) moved = rel;
    }
    return moved;
  }

  /**
   * Raise the price of doors where more trips ended than they had room for,
   * lower it where there is room to spare. Returns the largest change.
   */
  private _updatePrices(field: TrafficField, step: number): number {
    const { doorCap, doorLoad, price, order, parent, count } = field;
    const scale = Math.max(1, field.demandRatio);
    const priceMax = BALANCE.transit.commuteMax * 2;
    // How much the door at the END of each tile's route is being raised.
    // Order is nearest first, so a tile's parent is always filled in before it.
    const endRise = this._room;
    let moved = 0;
    for (let k = 0; k < count; k++) {
      const ri = order[k];
      const p = parent[ri];
      const cap = doorCap[ri];
      if (cap === 0) { endRise[ri] = p < 0 ? 0 : endRise[p]; continue; }
      const over = doorLoad[ri] / (cap * scale);
      let d = 0;
      if (p < 0) {
        // The last door of a route: everything left over ended here.
        if (over > 1 + PRICE_TOLERANCE) d = Math.min(PRICE_GAIN * (over - 1), PRICE_MAX_STEP) * step;
        endRise[ri] = d;
      } else {
        // A door the route drives past. If it is full and the route's last
        // door is overflowing, rise with it: the whole queue of full doors
        // moves up together, so next time the route ends one door further on.
        endRise[ri] = endRise[p];
        if (over >= 1 - PRICE_TOLERANCE) d = endRise[p];
      }
      // Doors with room to spare drift back down, slowly, so that the queue
      // built above is not undone while it is still forming.
      if (d === 0 && over < 1 - PRICE_TOLERANCE && price[ri] > 0) {
        d = -PRICE_DECAY * Math.min(PRICE_GAIN * (1 - over), PRICE_MAX_STEP) * step;
      }
      if (d === 0) continue;
      const next = Math.min(priceMax, Math.max(0, price[ri] + d));
      const change = Math.abs(next - price[ri]);
      price[ri] = next;
      if (change > moved) moved = change;
    }
    return moved;
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
