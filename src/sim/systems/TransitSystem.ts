// TransitSystem — flow-based traffic over the road network.
//
// There are no individual trips or routes. One ITERATION does this for each
// MARKET (see TrafficData.MARKET_DEFS):
//
//     shopping: homes → commerce     jobs: homes → industry
//     goods:    commerce → industry  (shops fetch goods from industry)
//     exports:  industry → seaports  (only while a connected port takes them)
//     visitors: homes → buildings that draw visitors (only while one takes them)
//
//   Buildings can also take or send trips in any market (BALANCE.transit
//   .buildings, sim/buildingTraffic.ts): their access roads are extra doors
//   or extra sources.
//
//   1. MAP. A flood over the road network gives every road tile its travel
//      time to the nearest destination of the market and the way there.
//      Crossing a tile costs 1 / speedMult of its road class, more when the
//      tile is congested, so avenues and highways are "shorter" and jams push
//      traffic elsewhere. A "door" is a road tile next to a developed
//      destination zone; its capacity is its zones' levels × the market's
//      capacity per level.
//
//   2. FLOW. Each developed origin tile puts (devLevel × trips rate) onto its
//      best adjacent road. Road tiles are then swept from farthest to nearest,
//      each handing its traffic on to the neighbours nearer the destination:
//      most to the best one, less to each the more of a detour it is. Traffic
//      ends at the first door it reaches.
//
//   3. SPILL. A door that got more trips than it has room for passes the
//      excess to other doors within SPILL_RADIUS road tiles that still have
//      room, nearest first — so a street of shops fills up along its length
//      instead of everything stopping at the first one. What still does not
//      fit stays at the door, which then shows as over capacity: the district
//      needs more shops (or jobs, or industry).
//
// Nothing in 2 or 3 feeds back, so they cannot oscillate. The one feedback is
// congestion → travel time → routes; it is kept calm by the smooth split in 2
// and by averaging, per tile, any volume that keeps changing. Iterations
// repeat until nothing moves much: a few per pass, more on the first pass,
// after a road edit and from recompute().
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
// The maps and per-market volumes are published as `world.traffic` for the
// overlay, inspector and tuning panel.
//
// Runs every transit.flowInterval ticks while its inputs change or traffic is
// still settling, and at once when the road layer changes.

import { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_R } from '../constants';
import { BALANCE } from '../../data/balance';
import { ordinanceModifier } from '../ordinances';
import {
  type TrafficData, type TrafficField, type MarketKey,
  makeTrafficData, marketRate, marketCapacity, marketWeight, marketReach, NO_ZONE,
  bestAccessRoad, neighbourIndex, roadCapacity, trafficVolume, travelTime,
  hasDoorProviders, extraDoors, hasTripProviders, extraTrips,
} from '../TrafficData';
import '../seaport';   // registers the seaports' doors with the markets
import '../buildingTraffic';   // registers the doors and trips of BALANCE.transit.buildings

// Iteration control. Not balance: these only affect how fast traffic settles.
const ITERATIONS_FIRST_PASS = 24;   // first pass of a game, and recompute()
const ITERATIONS_AFTER_EDIT = 12;   // the player changed a road: settle it while they watch
const ITERATIONS_PER_PASS = 3;
const ITERATIONS_MAX = 18;          // since the inputs last changed; then stop regardless
const AVERAGE_WINDOW = 20;          // rounds a tile that keeps changing is averaged over
const STABLE_LOAD = 0.01;           // a tile whose volume / capacity moved less than this did not change
const SETTLED_LOAD = 0.02;          // largest change in volume / capacity that still counts as settled
const CONGESTION_CAP = 3;           // load ratio beyond which a tile gets no slower
const COST_EASE = 0.3;              // share of the way a tile's travel cost moves per round
// How strongly traffic prefers the shortest way: each tile of detour cuts a
// route's share by e^-ROUTE_SPREAD. Higher = closer to "everyone takes the
// single best route" (and jumpier); lower = traffic smeared over more routes.
const ROUTE_SPREAD = 1.5;
// How far (in road tiles) a full door's overflow looks for doors with room.
const SPILL_RADIUS = 12;

export class TransitSystem {
  private _n = 0;
  private _data!: TrafficData;
  private _flow!: Float32Array;     // traffic being swept along one map
  private _raw!: Float32Array;      // one market's volumes this iteration, before averaging
  // Per market, per road tile: last iteration's raw volume, and for how many
  // rounds in a row it has been changing (see _merge).
  private _prev: Float32Array[] = [];
  private _unstable: Uint8Array[] = [];
  private _firstIteration = true;   // nothing to compare against yet
  private _room!: Float32Array;     // capacity left at each door
  private _cost!: Float32Array;     // travel cost per road tile this iteration
  // Per road class byte: travel cost per tile (1 / speedMult). Refreshed each pass.
  private readonly _classCost: number[] = [0, 1, 1, 1];
  // Binary min-heap for the floods (lazy deletion).
  private _heapKey!: Float32Array;
  private _heapId!: Int32Array;
  private _heapSize = 0;
  // Breadth-first search state for _spill.
  private _bfsQueue!: Int32Array;
  private _bfsFrom!: Int32Array;    // tile each visited tile was reached from
  private _bfsSeen!: Uint32Array;   // search number that last visited the tile
  private _bfsSteps!: Uint8Array;
  private _bfsRun = 0;
  // Hash of the roads and zones, of the roads alone, and the tuning values, at the last pass.
  private _lastInputHash = NaN;
  private _lastRoadHash = NaN;
  private _lastTuning = '';
  private _iter = 0;                // iterations since the inputs last changed
  // Tile lists set at the start of each pass. Everything after that loops
  // over these, so a pass costs in proportion to the built-up area, not to
  // the size of the map.
  private _roads!: Int32Array;      // road tiles (world.index's list)
  private _roadCount = 0;
  private _lots!: Int32Array;       // developed, non-abandoned zone tiles
  private _lotCount = 0;
  private _fresh = true;            // no pass has run yet
  private _tripsScale = 1;          // ordinance multiplier on trips, read once per pass
  // For each road tile, its four neighbours (W, E, N, S) that are also road
  // tiles, -1 where there is none: _nb[4 * tile + k]. Rebuilt when the road
  // layer changes, so the floods, sweeps and spills step along the network
  // without working out and checking each neighbour again.
  private _nb!: Int32Array;
  private _nbStale = true;
  // Per market: how many doors and how many sources of trips buildings added
  // on this pass, and whether the market is switched off and holding nothing
  // (a market no zone receives, with no building door or no trips: it is then
  // skipped altogether).
  private _extraDoorCount: number[] = [];
  private _extraTripCount: number[] = [];
  private _idle: boolean[] = [];

  update(world: World): void {
    if (world.tick % BALANCE.transit.flowInterval !== 0) return;
    this._run(world, ITERATIONS_PER_PASS, false);
  }

  /** Recompute now, whatever the tick, and iterate until settled (used by the tuning panel). */
  recompute(world: World): void {
    this._run(world, ITERATIONS_FIRST_PASS, true);
  }

  /**
   * Call every frame. If the road layer has changed since the last pass (the
   * player built, upgraded or bulldozed a road, or undid one), run a pass
   * straight away — also while paused — instead of waiting for the next
   * traffic tick. Cheap when nothing changed: one pass over the road list.
   */
  refreshIfRoadsChanged(world: World): void {
    if (this._n !== world.grid.width * world.grid.height) return; // no pass has run yet
    if (this._roadHash(world) === this._lastRoadHash) return;
    this._run(world, ITERATIONS_AFTER_EDIT, false);
  }

  /** Hash of where the roads are and what class each is. */
  private _roadHash(world: World): number {
    const roadClass = world.layers.roadClass;
    const { roads, roadCount } = world.index;
    let h = 0x811c9dc5 | 0;
    for (let k = 0; k < roadCount; k++) {
      const i = roads[k];
      h = Math.imul(h ^ i, 0x9e3779b1);
      h = Math.imul(h ^ roadClass[i], 0x85ebca6b);
      h ^= h >>> 15;
    }
    return h ^ roadCount;
  }

  private _run(world: World, rounds: number, force: boolean): void {
    const { width, height } = world.grid;
    const n = width * height;

    if (this._n !== n) {
      this._n = n;
      this._data = makeTrafficData(n);
      this._flow = new Float32Array(n);
      this._raw = new Float32Array(n);
      this._room = new Float32Array(n);
      this._cost = new Float32Array(n);
      // Each road tile is pushed at most once per neighbour plus once as a source.
      this._heapKey = new Float32Array(n * 5 + 1);
      this._heapId = new Int32Array(n * 5 + 1);
      this._bfsQueue = new Int32Array(n);
      this._bfsFrom = new Int32Array(n);
      this._bfsSeen = new Uint32Array(n);
      this._bfsSteps = new Uint8Array(n);
      this._lots = new Int32Array(n);
      this._prev = this._data.markets.map(() => new Float32Array(n));
      this._unstable = this._data.markets.map(() => new Uint8Array(n));
      this._extraDoorCount = this._data.markets.map(() => 0);
      this._extraTripCount = this._data.markets.map(() => 0);
      this._idle = this._data.markets.map(() => false);
      this._firstIteration = true;
      this._lastInputHash = NaN;
      this._fresh = true;
      this._nb = new Int32Array(n * 4);
      this._nbStale = true;
    }

    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const abandoned = world.layers.abandoned;
    const T = BALANCE.transit;
    const data = this._data;

    // Has anything the pass reads changed? The hash takes in each tile's
    // position: a plain sum misses changes that cancel out (a road moved, one
    // zone growing as another shrinks).
    // Roads and zoned tiles come from the shared index; the list of
    // developed lots is built here while hashing them.
    const { roads, roadCount, zoned, zonedCount } = world.index;
    const lots = this._lots;
    let lotCount = 0;
    const roadHash = this._roadHash(world);
    let h = roadHash;
    for (let q = 0; q < zonedCount; q++) {
      const i = zoned[q];
      const live = dev[i] > 0 && abandoned[i] === 0;
      h = Math.imul(h ^ i, 0x9e3779b1);
      h = Math.imul(h ^ (zone[i] | (dev[i] << 8) | (live ? 1 << 24 : 0)), 0x85ebca6b);
      h ^= h >>> 15;
      if (live) lots[lotCount++] = i;
    }
    h ^= zonedCount;
    // Doors that buildings add to a market (a seaport) are an input too.
    if (hasDoorProviders()) {
      for (let k = 0; k < data.markets.length; k++) {
        this._extraDoorCount[k] = 0;
        extraDoors(world, data.markets[k].def.key, (ri, cap) => {
          if (cap > 0) this._extraDoorCount[k]++;
          h = Math.imul(h ^ (ri * 4 + k), 0x9e3779b1);
          h = Math.imul(h ^ Math.round(cap * 1000), 0x85ebca6b);
          h ^= h >>> 15;
        });
      }
    }
    // So are the trips buildings send (arrivals at an airport).
    if (hasTripProviders()) {
      for (let k = 0; k < data.markets.length; k++) {
        this._extraTripCount[k] = 0;
        extraTrips(world, data.markets[k].def.key, (ri, trips) => {
          if (!(trips > 0)) return;
          this._extraTripCount[k]++;
          h = Math.imul(h ^ (ri * 8 + k), 0x9e3779b1);
          h = Math.imul(h ^ Math.round(trips * 1000), 0x85ebca6b);
          h ^= h >>> 15;
        });
      }
    }
    this._roads = roads; this._roadCount = roadCount; this._lotCount = lotCount;
    let tuning = `${T.commuteMax},${T.congestionDelay},${T.freeFlow}`;
    for (const m of data.markets) tuning += `,${marketRate(m.def)},${marketCapacity(m.def)},${marketWeight(m.def)},${marketReach(m.def)}`;
    // Free Transit scales the trips put on the roads; a change means a new pass.
    this._tripsScale = ordinanceModifier(world, 'trafficTrips');
    tuning += `,${this._tripsScale}`;
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
      // Roads added or removed: wipe what the list-based loops below would
      // otherwise leave behind on tiles that are no longer roads.
      if (roadHash !== this._lastRoadHash) this._clearOffRoad(world);
      if (roadHash !== this._lastRoadHash || this._nbStale) this._linkRoads(world);
      this._lastRoadHash = roadHash;
      this._iter = 0;
      data.settled = false;
    }

    const budget = this._fresh ? ITERATIONS_FIRST_PASS : rounds;
    this._fresh = false;
    for (let k = 0; k < budget && !data.settled; k++) {
      const moved = this._iterate(world);
      this._iter++;
      if (!moved || this._iter >= ITERATIONS_MAX) data.settled = true;
    }

    // The way to homes is only needed for accessibility, so once per pass,
    // with the roads as slow as the final volumes make them.
    this._updateCosts(world);
    this._flood(world, ZONE_R, data.toR, 1);

    // ── Congestion ────────────────────────────────────────────────────────────
    const congestion = world.layers.congestion;
    let totalCong = 0;
    congestion.fill(0);
    for (let k = 0; k < roadCount; k++) {
      const i = roads[k];
      const c = Math.min(255, Math.round(trafficVolume(data, i) / roadCapacity(roadClass[i]) * 255));
      congestion[i] = c;
      totalCong += c;
    }
    world.stats.avgCongestion = roadCount > 0 ? Math.round(totalCong / roadCount) : 0;

    // ── Accessibility ─────────────────────────────────────────────────────────
    // What each zone type needs within reach. Homes: the nearer of commerce
    // (shopping) or industry (jobs). Commerce and industry: homes.
    // (TODO.md: let commerce also need industry, via the goods market's map.)
    const accessibility = world.layers.accessibility;
    const toShops = data.shopping.field, toJobs = data.jobs.field, toHomes = data.toR;
    const commuteMax = T.commuteMax;

    accessibility.fill(0);
    for (let q = 0; q < zonedCount; q++) {
      const zi = zoned[q];
      const zoneType = zone[zi];

      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(zi, k, width, height);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
        const t = zoneType === ZONE_R
          ? Math.min(travelTime(toShops, ri), travelTime(toJobs, ri))
          : travelTime(toHomes, ri);
        if (t < best) best = t;
      }

      accessibility[zi] = best < commuteMax ? Math.round(255 * (1 - best / commuteMax)) : 0;
    }

    data.version++;
    world.traffic = data;
  }

  /**
   * The road layer changed. The loops in a pass only visit current road
   * tiles, so anything stored on a tile that has stopped being a road has to
   * be wiped here. The one whole-map loop in the system besides the input scan.
   */
  private _clearOffRoad(world: World): void {
    const n = this._n;
    const roadClass = world.layers.roadClass;
    const data = this._data;
    for (const field of [data.toR, ...data.markets.map(m => m.field)]) {
      field.dist.fill(Infinity);
      field.doorCap.fill(0);
      field.doorLoad.fill(0);
    }
    this._flow.fill(0);
    this._raw.fill(0);
    const cost = this._cost;
    const markets = data.markets;
    for (let i = 0; i < n; i++) {
      if (roadClass[i] !== ROAD_NONE) continue;
      cost[i] = 0;
      for (let k = 0; k < markets.length; k++) {
        markets[k].volume[i] = 0;
        this._prev[k][i] = 0;
        this._unstable[k][i] = 0;
      }
    }
  }

  /** Record, for every road tile, which of its four neighbours are road tiles. */
  private _linkRoads(world: World): void {
    const { width, height } = world.grid;
    const roadClass = world.layers.roadClass;
    const nb = this._nb;
    const roads = this._roads, roadCount = this._roadCount;
    nb.fill(-1);
    for (let q = 0; q < roadCount; q++) {
      const i = roads[q];
      for (let k = 0; k < 4; k++) {
        const ni = neighbourIndex(i, k, width, height);
        if (ni >= 0 && roadClass[ni] !== ROAD_NONE) nb[i * 4 + k] = ni;
      }
    }
    this._nbStale = false;
  }

  /** Travel cost per road tile from the current volumes: slower when loaded past free flow. */
  private _updateCosts(world: World): void {
    const T = BALANCE.transit;
    const roadClass = world.layers.roadClass;
    const data = this._data;
    const cost = this._cost;
    const classCost = this._classCost;
    const roads = this._roads, roadCount = this._roadCount;
    for (let k = 0; k < roadCount; k++) {
      const i = roads[k];
      const rc = roadClass[i];
      const ratio = trafficVolume(data, i) / roadCapacity(rc);
      const over = Math.min(ratio, CONGESTION_CAP) - T.freeFlow;
      const target = classCost[rc] * (over > 0 ? 1 + T.congestionDelay * over : 1);
      // Ease toward the new cost rather than jumping to it, so a road that
      // just filled up sheds traffic gradually instead of all at once.
      // (0 = a tile that had no cost yet.)
      cost[i] = cost[i] === 0 || this._firstIteration ? target : cost[i] + (target - cost[i]) * COST_EASE;
    }
  }

  /** One round of map → flow → spill for every market. Returns whether anything moved noticeably. */
  private _iterate(world: World): boolean {
    this._updateCosts(world);

    let moved = 0;
    const markets = this._data.markets;
    for (let k = 0; k < markets.length; k++) {
      const m = markets[k];
      const { def, field } = m;
      // Road units per trip: a building's trips are scaled like a zone's.
      const scale = marketWeight(def) * this._tripsScale;
      const rate = marketRate(def) * scale;
      if (def.dest === NO_ZONE && (this._extraDoorCount[k] === 0 || (rate === 0 && this._extraTripCount[k] === 0))) {
        // Nowhere to go, or nothing to send: the market holds nothing and costs nothing.
        if (!this._idle[k]) { this._emptyMarket(k); this._idle[k] = true; }
        continue;
      }
      this._idle[k] = false;
      this._flood(world, def.dest, field, marketCapacity(def), def.key);
      const demand = this._inject(world, field, def.origin, rate, this._flow, marketReach(def), this._extraTripCount[k] > 0 ? def.key : undefined, scale);
      this._openDoors(field, demand);
      this._sweep(world, field, this._flow);
      this._spill(world, field);
      moved = Math.max(moved, this._merge(world, m.volume, this._prev[k], this._unstable[k]));
    }

    this._firstIteration = false;
    return moved > SETTLED_LOAD;
  }

  /** Wipe a market that has stopped running: no doors, no routes, no traffic. */
  private _emptyMarket(k: number): void {
    const { field, volume } = this._data.markets[k];
    const prev = this._prev[k], unstable = this._unstable[k];
    const roads = this._roads, roadCount = this._roadCount;
    for (let q = 0; q < roadCount; q++) {
      const i = roads[q];
      volume[i] = 0; prev[i] = 0; unstable[i] = 0;
      field.dist[i] = Infinity; field.doorCap[i] = 0; field.doorLoad[i] = 0;
    }
    field.count = 0;
    field.demandRatio = 0;
    field.demand = 0;
    field.stranded = 0;
  }

  /**
   * Fill `field` with the travel time from every road tile to the nearest
   * developed, non-abandoned zone tile of `zoneType`, and the way there
   * (Dijkstra from all doors at once). A zone is entered from an adjacent
   * street or avenue; its capacity is shared between its doors. For a market
   * (`market` given), buildings registered as destinations add their doors too.
   */
  private _flood(world: World, zoneType: number, field: TrafficField, capPerLevel: number, market?: MarketKey): void {
    const { width, height } = world.grid;
    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const cost = this._cost;
    const { dist, parent, order, doorCap } = field;
    const nb = this._nb;
    const roads = this._roads, roadCount = this._roadCount;
    const lots = this._lots, lotCount = this._lotCount;

    for (let k = 0; k < roadCount; k++) { const ri = roads[k]; dist[ri] = Infinity; doorCap[ri] = 0; }
    this._heapSize = 0;

    for (let q = 0; q < lotCount; q++) {
      const i = lots[q];
      if (zone[i] !== zoneType) continue;
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

    if (market !== undefined && hasDoorProviders()) {
      extraDoors(world, market, (ri, cap) => {
        if (!(cap > 0) || ri < 0 || ri >= roadClass.length) return;
        const rc = roadClass[ri];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) doorCap[ri] += cap;
      });
    }

    for (let k = 0; k < roadCount; k++) {
      const ri = roads[k];
      if (doorCap[ri] === 0) continue;
      dist[ri] = 0;
      parent[ri] = -1;
      this._push(ri, 0);
    }

    let count = 0;
    while (this._heapSize > 0) {
      const key = this._heapKey[0];
      const cur = this._pop();
      if (key > dist[cur]) continue; // stale heap entry
      order[count++] = cur;

      const curCost = cost[cur];
      for (let k = cur * 4, end = k + 4; k < end; k++) {
        const ni = nb[k];
        if (ni < 0) continue;
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

  /**
   * Put each origin zone's trips on its best adjacent road. Returns the total.
   * An origin further than `reach` from the nearest door sends nothing. With
   * `market` given, the trips buildings send in it are added too, each times
   * `scale`, straight onto the road tiles they start from.
   */
  private _inject(world: World, field: TrafficField, originZone: number, rate: number, flow: Float32Array, reach = Infinity, market?: MarketKey, scale = 1): number {
    const zone = world.layers.zone;
    const dev  = world.layers.devLevel;
    const roadClass = world.layers.roadClass;
    const roads = this._roads, roadCount = this._roadCount;
    const lots = this._lots, lotCount = this._lotCount;
    for (let k = 0; k < roadCount; k++) flow[roads[k]] = 0;
    field.stranded = 0;
    // No destination of this type anywhere: every trip wanted is stranded.
    const nowhere = field.count === 0;
    let total = 0, stranded = 0;
    if (rate !== 0) {
      for (let q = 0; q < lotCount; q++) {
        const i = lots[q];
        if (zone[i] !== originZone) continue;
        const trips = dev[i] * rate;
        if (nowhere) { stranded += trips; continue; }
        const road = bestAccessRoad(world, i, field);
        if (road < 0 || !(field.dist[road] < Infinity) || field.dist[road] > reach) { stranded += trips; continue; }
        flow[road] += trips;
        total += trips;
      }
    }
    if (market !== undefined) {
      extraTrips(world, market, (ri, n) => {
        if (!(n > 0) || ri < 0 || ri >= roadClass.length) return;
        const rc = roadClass[ri];
        if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) return;
        const trips = n * scale;
        if (nowhere || !(field.dist[ri] < Infinity) || field.dist[ri] > reach) { stranded += trips; return; }
        flow[ri] += trips;
        total += trips;
      });
    }
    field.stranded = stranded;
    return total;
  }

  /**
   * Set each door's room for this iteration. When there are more trips than
   * capacity in total, every door's room is scaled up by the same factor, so
   * "over capacity" then means a door got more than its SHARE.
   */
  private _openDoors(field: TrafficField, demand: number): void {
    const { doorCap, doorLoad, order, count } = field;
    const room = this._room;
    let totalCap = 0;
    for (let k = 0; k < count; k++) totalCap += doorCap[order[k]];
    field.demandRatio = totalCap > 0 ? demand / totalCap : 0;
    field.demand = demand;
    const scale = Math.max(1, field.demandRatio);
    for (let k = 0; k < count; k++) {
      const ri = order[k];
      room[ri] = doorCap[ri] * scale;
      doorLoad[ri] = 0;
    }
  }

  /**
   * Sweep `flow` along the map from farthest to nearest, so every road tile
   * accumulates the traffic passing through it (into `_raw`). Traffic ends
   * at the first door it reaches.
   */
  private _sweep(_world: World, field: TrafficField, flow: Float32Array): void {
    const nb = this._nb;
    const { dist, parent, order, count, doorLoad } = field;
    const room = this._room;
    const raw = this._raw;
    const cost = this._cost;
    const roads = this._roads, roadCount = this._roadCount;
    for (let k = 0; k < roadCount; k++) raw[roads[k]] = 0;

    // Farthest first: every tile a stream is handed to is nearer, so it is
    // handled later.
    for (let k = count - 1; k >= 0; k--) {
      const ri = order[k];
      const f = flow[ri];
      if (f === 0) continue;
      raw[ri] = f;
      if (parent[ri] < 0) {
        // A door: the stream ends here. (It may get more than it has room
        // for; _spill deals with that.)
        doorLoad[ri] += f;
        room[ri] -= f;
        continue;
      }

      // Hand the stream on to every neighbour that is nearer the destination,
      // not just the best one: most to the best, less to each the more of a
      // detour it is. Near-equal routes then share traffic, and a small
      // change in cost shifts a little traffic instead of flipping all of it.
      const here = dist[ri], hereCost = cost[ri];
      let n0 = -1, n1 = -1, n2 = -1, n3 = -1;
      let w0 = 0, w1 = 0, w2 = 0, w3 = 0;
      for (let d = 0; d < 4; d++) {
        const ni = nb[ri * 4 + d];
        if (ni < 0 || !(dist[ni] < here)) continue;
        // How much longer the trip is via this neighbour than via the best one.
        const detour = dist[ni] + (hereCost + cost[ni]) * 0.5 - here;
        const wgt = detour <= 0 ? 1 : Math.exp(-ROUTE_SPREAD * detour);
        if (d === 0) { n0 = ni; w0 = wgt; } else if (d === 1) { n1 = ni; w1 = wgt; }
        else if (d === 2) { n2 = ni; w2 = wgt; } else { n3 = ni; w3 = wgt; }
      }
      const total = w0 + w1 + w2 + w3;
      if (total <= 0) { flow[parent[ri]] += f; continue; }
      const share = f / total;
      if (n0 >= 0) flow[n0] += share * w0;
      if (n1 >= 0) flow[n1] += share * w1;
      if (n2 >= 0) flow[n2] += share * w2;
      if (n3 >= 0) flow[n3] += share * w3;
    }
  }

  /**
   * Pass each over-full door's excess to doors with room within SPILL_RADIUS
   * road tiles, nearest first, adding the traffic to the roads in between.
   * Doors are handled in a fixed order and nothing here depends on earlier
   * iterations, so the result is the same every time for the same inputs.
   */
  private _spill(_world: World, field: TrafficField): void {
    const nb = this._nb;
    const { order, count, parent, doorLoad } = field;
    const room = this._room;
    const raw = this._raw;
    const queue = this._bfsQueue, from = this._bfsFrom, seen = this._bfsSeen, steps = this._bfsSteps;

    for (let k = 0; k < count; k++) {
      const door = order[k];
      if (parent[door] >= 0) break;          // doors come first in `order` (travel time 0)
      let excess = -room[door];
      if (excess <= 1e-6) continue;

      // Breadth-first over road tiles from the door.
      const run = ++this._bfsRun;
      let head = 0, tail = 0;
      seen[door] = run; steps[door] = 0; from[door] = -1;
      queue[tail++] = door;
      while (head < tail && excess > 1e-6) {
        const cur = queue[head++];
        if (cur !== door && room[cur] > 0 && parent[cur] < 0) {
          // A door with room: send it what fits, along the way we came.
          const take = excess < room[cur] ? excess : room[cur];
          room[cur] -= take;
          doorLoad[cur] += take;
          doorLoad[door] -= take;
          room[door] += take;
          excess -= take;
          for (let t = cur; t !== door; t = from[t]) raw[t] += take;
        }
        if (steps[cur] >= SPILL_RADIUS) continue;
        for (let d = 0; d < 4; d++) {
          const ni = nb[cur * 4 + d];
          if (ni < 0 || seen[ni] === run) continue;
          seen[ni] = run; steps[ni] = steps[cur] + 1; from[ni] = cur;
          queue[tail++] = ni;
        }
      }
    }
  }

  /**
   * Merge this iteration's volumes (`_raw`) into `out`, tile by tile. A tile
   * whose volume is the same as on the previous iteration takes the new
   * value as it is, so a change (a new road, a grown zone) shows at once and
   * nothing else is disturbed. A tile whose volume keeps changing — routes
   * trading traffic as they jam — is averaged over its recent iterations
   * instead, so it shows the split rather than flickering. Returns the
   * largest change in volume / capacity.
   */
  private _merge(world: World, out: Float32Array, prev: Float32Array, unstable: Uint8Array): number {
    const roadClass = world.layers.roadClass;
    const raw = this._raw;
    const first = this._firstIteration;
    const roads = this._roads, roadCount = this._roadCount;

    let moved = 0;
    for (let k = 0; k < roadCount; k++) {
      const i = roads[k];
      const r = raw[i], o = out[i], before = prev[i];
      if (r === 0 && o === 0 && before === 0) continue;
      prev[i] = r;
      const cap = roadCapacity(roadClass[i]);
      let next: number;
      if (first) {
        next = r;
        unstable[i] = 0;
      } else if (Math.abs(r - before) <= cap * STABLE_LOAD) {
        // Unchanged since last round. A tile that changed once (an edit)
        // takes the new value now; one that has been swinging for a while
        // has to hold still for as long before it is trusted again.
        if (unstable[i] <= 1) {
          next = r;
          unstable[i] = 0;
        } else {
          unstable[i]--;
          next = o + (r - o) / (unstable[i] + 1);
        }
      } else {
        const rounds = unstable[i] < AVERAGE_WINDOW ? unstable[i] + 1 : AVERAGE_WINDOW;
        unstable[i] = rounds;
        next = o + (r - o) / (rounds + 1);
      }
      out[i] = next;
      // A tile that has been averaging for a full window has reached its
      // split; its remaining wobble does not count as "still settling".
      if (unstable[i] >= AVERAGE_WINDOW) continue;
      // One that is partway to a new value does, however small the step:
      // stopping now would leave it stranded halfway.
      if (unstable[i] > 0) { moved = 1; continue; }
      const rel = Math.abs(next - o) / cap;
      if (rel > moved) moved = rel;
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
