// TransitSystem — flow-based traffic over the road network.
//
// There are no individual trips or routes. One ITERATION does this for each
// MARKET (see TrafficData.MARKET_DEFS):
//
//     shopping: homes → commerce     jobs: homes → industry
//     goods:    commerce → industry  (shops fetch goods from industry)
//     exports:  industry → seaports  (only while a connected port takes them)
//     visitors: homes → buildings that draw visitors (only while one takes them)
//     leisure:  homes and tourists → attractions (only while one stands on a road)
//     event:    fans → the stadium (only on an event day)
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
//   3. PASS ON. A BUILDING's door (a school's jobs) is small. What arrives
//      there beyond its room drives on, from that door along the roads, to
//      the nearest zone door. So a building takes the trips it has room for
//      and the rest still reach the zones, on the road, as they would
//      without it.
//
//   4. SPILL. A door that got more trips than it has room for passes the
//      excess to other doors within SPILL_RADIUS road tiles that still have
//      room, nearest first — so a street of shops fills up along its length
//      instead of everything stopping at the first one. What still does not
//      fit stays at the door, which then shows as over capacity: the district
//      needs more shops (or jobs, or industry).
//
// Nothing in 2 to 4 feeds back, so they cannot oscillate. The one feedback is
// congestion → travel time → routes; it is kept calm by the smooth split in 2
// and by averaging, per tile, any volume that keeps changing. Iterations
// repeat until nothing moves much: a few per pass, more on the first pass,
// after a road edit and from recompute().
//
// Then: CONGESTION = volume / capacity of the road class, as a 0-255 byte,
// and ACCESSIBILITY per zone tile from travel time — homes look for the
// nearer of commerce or industry, commerce and industry look for homes.
// For homes only ZONES count: a building that takes shoppers or commuters (a
// school's staff, an airport) is a door for traffic but gives homes no
// accessibility. For commerce and industry a building that SENDS shoppers or
// job seekers (an airport's arrivals) counts like homes do.
// 255 = next door, falling linearly to 0 at BALANCE.transit.commuteMax.
// ZoneGrowthSystem uses it as a growth multiplier.
//
// Highways carry traffic but give no access: zones join the network only
// through streets and avenues (the same rule ZoneGrowthSystem uses).
//
// RAIL (RAIL_DESIGN.md). Every tile of track is a second NODE of the network,
// numbered tile + n, joined to the track tiles sim/rail.ts says it joins. A
// station is a portal: each of its access roads is tied to its platform, at
// BALANCE.rail.boardTime a crossing. The flood of a market whose trips are
// people (`rides`) may pass through portals, so a trip goes by train exactly
// when that is the faster way, and the sweep then puts it on the track
// instead of the roads. Freight markets never use a portal. Track has a
// capacity and slows when over it, as a road does; a 3-way or 4-way junction
// takes extra time and carries less; a level crossing slows the cars by how
// full the track is and the trains by how full the road is. Stations have no
// limit: the roads round them carry the riders. Riders boarding pay a fare.
// With no station that has a road, none of this runs.
//
// The maps and per-market volumes are published as `world.traffic` for the
// overlay, inspector and tuning panel.
//
// Runs every transit.flowInterval ticks while its inputs change or traffic is
// still settling, and at once when the road layer changes.

import { doorTile, levelWeight } from '../lots';
import { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_R, ZONE_C, ZONE_I, RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY, BUILDING_SUBWAY_STATION } from '../constants';
import { railLinks, rampOther, isLevelCrossing, LINK_N, LINK_E, LINK_S, LINK_W } from '../rail';
import { hasPlatforms, rampLevel, shapeRoles } from '../buildingShapes';
import { BALANCE } from '../../data/balance';
import { ordinanceModifier } from '../ordinances';
import {
  type TrafficData, type TrafficField, type MarketKey,
  makeTrafficData, makeTrafficField, marketRate, marketCapacity, marketWeight, marketReach, NO_ZONE,
  bestAccessRoad, neighbourIndex, roadCapacity, trafficVolume, travelTime,
  hasDoorProviders, extraDoors, hasTripProviders, extraTrips, NODES_PER_TILE, railSlot } from '../TrafficData';
import '../seaport';   // registers the seaports' doors with the markets
import '../buildingTraffic';   // registers the doors and trips of BALANCE.transit.buildings
import '../leisureTraffic';    // registers the attractions' doors and the tourists (LEISURE_DESIGN.md)
import '../eventDays';         // registers the stadium's event-day doors and fans

// Iteration control. Not balance: these only affect how fast traffic settles.
const ITERATIONS_FIRST_PASS = 24;   // first pass of a game, and recompute()
const ITERATIONS_AFTER_EDIT = 12;   // the player changed a road: settle it while they watch
const ITERATIONS_PER_PASS = 3;
const ITERATIONS_MAX = 18;          // since the inputs last changed; then stop regardless
const AVERAGE_WINDOW = 20;          // rounds a tile that keeps changing is averaged over
const STABLE_LOAD = 0.01;           // a tile whose volume / capacity moved less than this did not change
const SETTLED_LOAD = 0.02;          // largest change in volume / capacity that still counts as settled
const RAIL_LEVELS = [RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY] as const;   // the level of node slots 1, 2, 3
const CONGESTION_CAP = 3;           // load ratio beyond which a tile gets no slower
const COST_EASE = 0.3;              // share of the way a tile's travel cost moves per round
const RAIL_COST_SETTLED = 0.01;     // a track or crossing cost this close to its target has arrived
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
  private _wasOpen: boolean[] = [];  // per market: whether buildings gave it doors on the last pass (see MarketDef.occasional)
  private _bldCap!: Float32Array;   // the part of each door's capacity that buildings added, this market
  private _doorStart!: Float32Array; // the handicap of each building door, this market (see DoorProvider)
  private _onward!: Float32Array;   // trips leaving full building doors for the zones (see _passOn)
  private _zoneRoute: TrafficField | null = null;   // the way to this market's zone doors only
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
  // The way to the nearest shops and jobs counting zones only, for
  // accessibility. Made and filled only while buildings add doors to the
  // shopping or jobs market; otherwise the market's own map is the same thing.
  private _zoneShops: TrafficField | null = null;
  private _zoneJobs: TrafficField | null = null;
  // The way to the nearest customers (for shops) and workers (for industry):
  // homes plus buildings that send shoppers / job seekers. Made and filled
  // only while a building sends such trips; otherwise it is the way to homes.
  private _customers: TrafficField | null = null;
  private _workers: TrafficField | null = null;
  private _idle: boolean[] = [];
  // ── Rail ──
  // Track nodes (tile + n), and every node the list-based loops must visit:
  // the roads, then the track nodes (the road list itself while there is no track).
  private _railNodes = new Int32Array(0);
  private _railCount = 0;
  private _railEver = false;        // track nodes have held values that may need wiping
  private _allNodes = new Int32Array(0);
  private _nodes!: Int32Array;
  private _nodeCount = 0;
  // Per track node, indexed node − n (so by plain tile index for ground track):
  private _railKind!: Uint8Array;   // how many track tiles of its level it joins (3, 4 = a junction)
  private _railCap!: Float32Array;  // its capacity (the published data.rail.capacity)
  private _railExtra!: Float32Array; // time a level crossing adds to it this iteration (ground track only)
  private _railJam!: Float32Array;   // the jam time that is part of its cost now
  private _railRamp!: Uint8Array;    // 1 = the high or deep end of a ramp: passing it takes rail.rampTime longer
  private _crossings: number[] = []; // tiles that are level crossings
  private _crossSaved: number[] = [];
  // Portals: station access road ↔ platform node, both ways, as linked lists per node.
  private _xHead!: Int32Array;      // first portal out of each node, -1 = none
  private _xNext: number[] = [];
  private _xTo: number[] = [];
  private _xStation: number[] = []; // index into data.rail.stations
  private _xCount = 0;
  private _useRail = false;         // the flood and sweep under way may pass through portals
  private _boardTime = 0;
  private _railEasing = false;      // a track or crossing cost is still on its way to its new value
  private _curWeight = 1;           // road taken up per trip of the market being swept
  private _stBoard = new Float32Array(0);   // riders boarding per station, this iteration
  private readonly _candTo = new Int32Array(16);
  private readonly _candW = new Float32Array(16);
  private readonly _candSt = new Int32Array(16);

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
    // Track, and the stations (a station cleared or brought back changes no track).
    if (world.railVersion !== 0) {
      h = Math.imul(h ^ world.railVersion, 0x9e3779b1);
      const width = world.grid.width;
      for (const b of world.buildings) {
        if (!hasPlatforms(b.kind) && b.kind !== BUILDING_SUBWAY_STATION && rampLevel(b.kind) === 0) continue;
        h = Math.imul(h ^ (b.ty * width + b.tx), 0x9e3779b1);
        h = Math.imul(h ^ (b.kind * 4 + ((b.rot ?? 0) & 3)), 0x85ebca6b);
        h ^= h >>> 15;
      }
    }
    return h ^ roadCount;
  }

  private _run(world: World, rounds: number, force: boolean): void {
    const { width, height } = world.grid;
    const n = width * height;

    if (this._n !== n) {
      this._n = n;
      this._data = makeTrafficData(n);
      // Four nodes per tile (its road and its track on each rail level) for everything a flood or sweep touches.
      const nn = NODES_PER_TILE * n;
      this._flow = new Float32Array(nn);
      this._raw = new Float32Array(nn);
      this._room = new Float32Array(nn);
      this._bldCap = new Float32Array(n);
      this._doorStart = new Float32Array(n);
      this._onward = new Float32Array(nn);
      this._zoneRoute = null;
      this._cost = new Float32Array(nn);
      // Each node is pushed at most once per neighbour plus once as a source (portals: see _linkRail).
      this._heapKey = new Float32Array(nn * 5 + 1);
      this._heapId = new Int32Array(nn * 5 + 1);
      this._railKind = new Uint8Array(nn - n);
      this._railCap = this._data.rail.capacity;
      this._railExtra = new Float32Array(nn - n);
      this._railJam = new Float32Array(nn - n);
      this._railRamp = new Uint8Array(nn - n);
      this._xHead = new Int32Array(nn).fill(-1);
      this._xNext.length = 0; this._xTo.length = 0; this._xStation.length = 0; this._xCount = 0;
      this._crossings.length = 0;
      this._railCount = 0;
      this._railEver = false;
      this._bfsQueue = new Int32Array(n);
      this._bfsFrom = new Int32Array(n);
      this._bfsSeen = new Uint32Array(n);
      this._bfsSteps = new Uint8Array(n);
      this._lots = new Int32Array(n);
      this._prev = this._data.markets.map(() => new Float32Array(nn));
      this._unstable = this._data.markets.map(() => new Uint8Array(nn));
      this._extraDoorCount = this._data.markets.map(() => 0);
      this._extraTripCount = this._data.markets.map(() => 0);
      this._wasOpen = this._data.markets.map(() => false);
      this._idle = this._data.markets.map(() => false);
      this._firstIteration = true;
      this._lastInputHash = NaN;
      this._fresh = true;
      this._nb = new Int32Array(nn * 4);
      this._nbStale = true;
      this._zoneShops = null;
      this._zoneJobs = null;
      this._customers = null;
      this._workers = null;
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
        extraDoors(world, data.markets[k].def.key, (ri, cap, handicap = 0) => {
          if (cap > 0) this._extraDoorCount[k]++;
          h = Math.imul(h ^ (ri * 4 + k), 0x9e3779b1);
          h = Math.imul(h ^ Math.round(cap * 1000), 0x85ebca6b);
          if (handicap > 0) h = Math.imul(h ^ Math.round(handicap * 1000), 0x9e3779b1);
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
    if (this._railCount === 0) { this._nodes = roads; this._nodeCount = roadCount; }
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
    const RL = BALANCE.rail;
    tuning += `,${RL.speedMult},${RL.capacity},${RL.congestionDelay},${RL.jam.from},${RL.jam.delay},${RL.jam.power},${RL.rampTime},${RL.boardTime},${RL.junction3.delay},${RL.junction3.capacityMult},${RL.junction4.delay},${RL.junction4.capacityMult},${RL.crossing.carDelay},${RL.crossing.trainDelay}`;
    const changed = force || world.traffic !== data || h !== this._lastInputHash || tuning !== this._lastTuning;
    if (!changed && data.settled) return;
    if (changed) {
      this._lastInputHash = h;
      this._lastTuning = tuning;
      // Roads added or removed: wipe what the list-based loops below would
      // otherwise leave behind on tiles that are no longer roads.
      if (roadHash !== this._lastRoadHash) this._clearOffRoad(world);
      if (roadHash !== this._lastRoadHash || this._nbStale) { this._linkRoads(world); this._linkRail(world); }
      this._lastRoadHash = roadHash;
      this._iter = 0;
      data.settled = false;
    }

    // An occasional market (an event day) started or stopped: a whole crowd joined or left the
    // roads at once, so settle as after a road edit instead of over the coming days.
    for (let k = 0; k < data.markets.length; k++) {
      const open = this._extraDoorCount[k] > 0;
      if (open !== this._wasOpen[k]) {
        this._wasOpen[k] = open;
        if (data.markets[k].def.occasional && rounds < ITERATIONS_AFTER_EDIT) rounds = ITERATIONS_AFTER_EDIT;
      }
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
    this._useRail = this._xCount > 0;   // people look for homes, shops and jobs by train too
    this._flood(world, ZONE_R, data.toR, 1);
    // Likewise the way to shops and jobs without the doors buildings add (see Accessibility).
    const shopsK = data.markets.indexOf(data.shopping), jobsK = data.markets.indexOf(data.jobs);
    let toShops = data.shopping.field, toJobs = data.jobs.field;
    if (this._extraDoorCount[shopsK] > 0) {
      toShops = this._zoneShops ??= makeTrafficField(NODES_PER_TILE * n);
      this._flood(world, ZONE_C, toShops, 1);
    }
    if (this._extraDoorCount[jobsK] > 0) {
      toJobs = this._zoneJobs ??= makeTrafficField(NODES_PER_TILE * n);
      this._flood(world, ZONE_I, toJobs, 1);
    }
    // And the way to customers and workers: homes, plus buildings that send shoppers or job seekers.
    let toCustomers = data.toR, toWorkers = data.toR;
    if (this._extraTripCount[shopsK] > 0) {
      toCustomers = this._customers ??= makeTrafficField(NODES_PER_TILE * n);
      this._flood(world, ZONE_R, toCustomers, 1, undefined, 'shopping');
    }
    if (this._extraTripCount[jobsK] > 0) {
      toWorkers = this._workers ??= makeTrafficField(NODES_PER_TILE * n);
      this._flood(world, ZONE_R, toWorkers, 1, undefined, 'jobs');
    }
    data.toShops = toShops; data.toJobs = toJobs; data.toCustomers = toCustomers; data.toWorkers = toWorkers;

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
    // (shopping) or industry (jobs), zones only: doors that buildings add to
    // a market do not count. Commerce: customers, which are homes or a
    // building that sends shoppers. Industry: workers, homes or a building
    // that sends job seekers.
    // (TODO.md: let commerce also need industry, via the goods market's map.)
    const accessibility = world.layers.accessibility;
    const commuteMax = T.commuteMax;

    accessibility.fill(0);
    const lotLayer = world.layers.lot;
    for (let q = 0; q < zonedCount; q++) {
      const zi = zoned[q];
      const zoneType = zone[zi];

      // A tile of a merged 2×2 lot with no road of its own is reached through its building's (sim/lots.ts).
      const door = lotLayer[zi] !== 0 ? doorTile(world, zi) : zi;
      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(door, k, width, height);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
        const t = zoneType === ZONE_R
          ? Math.min(travelTime(toShops, ri), travelTime(toJobs, ri))
          : travelTime(zoneType === ZONE_C ? toCustomers : toWorkers, ri);
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
    // The same for track nodes whose track has gone.
    if (this._railEver) {
      const rail = world.layers.rail;
      for (let slot = 1; slot < NODES_PER_TILE; slot++) {
        const level = RAIL_LEVELS[slot - 1], base = slot * n;
        for (let i = 0; i < n; i++) {
          if (rail[i] & level) continue;
          const node = base + i;
          cost[node] = 0;
          for (let k = 0; k < markets.length; k++) {
            markets[k].volume[node] = 0;
            this._prev[k][node] = 0;
            this._unstable[k][node] = 0;
          }
        }
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

  /**
   * Rail: list the track nodes, join them as sim/rail.ts says, note the level
   * crossings, and tie each station's access roads to its platform (the
   * portal a rider boards and leaves through). Call after _linkRoads, which
   * empties the neighbour table.
   */
  private _linkRail(world: World): void {
    const n = this._n;
    const width = world.grid.width;
    const rail = world.layers.rail;
    const nb = this._nb, kind = this._railKind, cap = this._railCap;
    const data = this._data;
    if (this._xCount > 0 || this._railCount > 0) { this._xHead.fill(-1); kind.fill(0); cap.fill(0); this._railExtra.fill(0); this._railRamp.fill(0); }
    this._xNext.length = 0; this._xTo.length = 0; this._xStation.length = 0; this._xCount = 0;
    this._crossings.length = 0;
    data.rail.stations = [];
    data.rail.boardings = 0;
    this._stBoard = new Float32Array(0);

    let count = 0;
    if (world.railVersion !== 0) {
      if (this._railNodes.length < 3 * n) this._railNodes = new Int32Array(3 * n);
      const nodes = this._railNodes;
      for (let slot = 1; slot < NODES_PER_TILE; slot++) {
        const level = RAIL_LEVELS[slot - 1], base = slot * n;
        for (let i = 0; i < n; i++) {
          if (!(rail[i] & level)) continue;
          const node = base + i, r = node - n;
          nodes[count++] = node;
          const links = railLinks(world, i, level);
          let c = 0;
          // The neighbour table's order: W, E, N, S. Track joins track of its own level.
          if (links & LINK_W) { nb[node * 4] = node - 1; c++; }
          if (links & LINK_E) { nb[node * 4 + 1] = node + 1; c++; }
          if (links & LINK_N) { nb[node * 4 + 2] = node - width; c++; }
          if (links & LINK_S) { nb[node * 4 + 3] = node + width; c++; }
          kind[r] = c;
          cap[r] = BALANCE.rail.capacity;   // refined each iteration (_updateRailCosts)
          if (level === RAIL_GROUND && isLevelCrossing(world, i)) this._crossings.push(i);
        }
      }
      // A ramp joins the ground track at its low end to the elevated or subway track at its
      // other end: the two tiles are neighbours, so the join takes the neighbour slot that
      // points from one to the other (free, since each end joins its own level only outward).
      for (const b of world.buildings) {
        const level = rampLevel(b.kind);
        if (level === 0) continue;
        const low = b.ty * width + b.tx;
        const other = rampOther(world, low);
        if (!other || !(rail[low] & RAIL_GROUND) || !(rail[other.tile] & level)) continue;
        const a = n + low, z = railSlot(level) * n + other.tile;
        const step = other.tile - low;
        const slot = step === -1 ? 0 : step === 1 ? 1 : step === -width ? 2 : 3;
        nb[a * 4 + slot] = z;
        nb[z * 4 + (slot ^ 1)] = a;
        this._railRamp[z - n] = 1;
      }
    }
    this._railCount = count;
    if (count === 0) { this._nodes = this._roads; this._nodeCount = this._roadCount; return; }
    this._railEver = true;

    const total = this._roadCount + count;
    if (this._allNodes.length < total) this._allNodes = new Int32Array(Math.max(total, this._allNodes.length * 2));
    this._allNodes.set(this._roads.subarray(0, this._roadCount));
    this._allNodes.set(this._railNodes.subarray(0, count), this._roadCount);
    this._nodes = this._allNodes; this._nodeCount = total;

    for (const b of world.buildings) {
      // Riders get on and off at one track node: the middle platform tile of a train station
      // (the rest of the platform is track like any other), the tunnel under a subway station's entrance.
      let at = -1;
      if (hasPlatforms(b.kind)) {
        const tiles = world.buildingTilesAt(b.tx, b.ty), roles = shapeRoles(b.kind);
        const platform = tiles.filter((_, k) => roles[k] === 'platform');
        if (platform.length > 0) at = n + platform[platform.length >> 1];
      } else if (b.kind === BUILDING_SUBWAY_STATION) {
        const entrance = b.ty * width + b.tx;
        if (rail[entrance] & RAIL_SUBWAY) at = railSlot(RAIL_SUBWAY) * n + entrance;
      } else continue;
      const roads = world.buildingAccessRoads(b.tx, b.ty);
      const station = data.rail.stations.length;
      data.rail.stations.push({ anchor: b.ty * width + b.tx, roads, boardings: 0 });
      if (at < 0) continue;
      for (const r of roads) { this._addPortal(r, at, station); this._addPortal(at, r, station); }
    }
    this._stBoard = new Float32Array(data.rail.stations.length);
    const heapRoom = NODES_PER_TILE * n * 5 + 1 + this._xCount;
    if (this._heapKey.length < heapRoom) { this._heapKey = new Float32Array(heapRoom); this._heapId = new Int32Array(heapRoom); }
  }

  private _addPortal(from: number, to: number, station: number): void {
    const e = this._xCount++;
    this._xTo[e] = to;
    this._xStation[e] = station;
    this._xNext[e] = this._xHead[from];
    this._xHead[from] = e;
  }

  /** Travel cost per road tile from the current volumes: slower when loaded past free flow. */
  private _updateCosts(world: World): void {
    const T = BALANCE.transit;
    const roadClass = world.layers.roadClass;
    const data = this._data;
    const cost = this._cost;
    const classCost = this._classCost;
    const roads = this._roads, roadCount = this._roadCount;
    // A level crossing's road tile is costed again below, from what it cost before this loop.
    const crossings = this._crossings, saved = this._crossSaved;
    for (let q = 0; q < crossings.length; q++) saved[q] = cost[crossings[q]];
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
    this._railEasing = false;
    if (this._railCount > 0) this._updateRailCosts(world);
  }

  /**
   * Travel cost per track tile: 1 / rail speed, more when loaded past free
   * flow, much more when jammed (past BALANCE.rail.jam.from of capacity),
   * plus the delay of a junction (which also carries less). At a level
   * crossing (BALANCE.rail.crossing) the cars wait carDelay × rail load ×
   * road load (each counted up to 1): the gates are down in proportion to the
   * trains, and only a busy road queues behind them. The trains wait
   * trainDelay × road load.
   */
  private _updateRailCosts(world: World): void {
    const n = this._n;
    const RL = BALANCE.rail, T = BALANCE.transit;
    const roadClass = world.layers.roadClass;
    const data = this._data, cost = this._cost;
    const kind = this._railKind, cap = this._railCap, extra = this._railExtra;
    const first = this._firstIteration;
    const base = 1 / (RL.speedMult > 0 ? RL.speedMult : 1);
    this._boardTime = RL.boardTime > 0 ? RL.boardTime : 0;

    const crossings = this._crossings, saved = this._crossSaved;
    const carWait = RL.crossing.carDelay > 0 ? RL.crossing.carDelay : 0;
    const trainWait = RL.crossing.trainDelay > 0 ? RL.crossing.trainDelay : 0;
    let easing = false;
    for (let q = 0; q < crossings.length; q++) {
      const i = crossings[q], rc = roadClass[i];
      const roadRatio = trafficVolume(data, i) / roadCapacity(rc);
      const railRatio = cap[i] > 0 ? trafficVolume(data, n + i) / cap[i] : 0;
      extra[i] = trainWait * Math.min(1, roadRatio);
      const over = Math.min(roadRatio, CONGESTION_CAP) - T.freeFlow;
      const target = this._classCost[rc] * (over > 0 ? 1 + T.congestionDelay * over : 1) + carWait * Math.min(1, railRatio) * Math.min(1, roadRatio);
      const was = saved[q];
      cost[i] = was === 0 || first ? target : was + (target - was) * COST_EASE;
      if (Math.abs(target - cost[i]) > RAIL_COST_SETTLED) easing = true;
    }

    const jam = RL.jam as { from: number; delay: number; power: number };
    const jamFrom = jam.from > 0 ? jam.from : 0, jamDelay = jam.delay, jamPower = jam.power > 0 ? jam.power : 1;
    const jamWas = this._railJam;
    const ramp = this._railRamp, rampTime = RL.rampTime > 0 ? RL.rampTime : 0;
    const nodes = this._railNodes;
    for (let q = 0; q < this._railCount; q++) {
      const node = nodes[q], i = node - n, c = kind[i];
      let time = base, room: number = RL.capacity;
      if (ramp[i]) time += rampTime;
      if (c === 3) { time += RL.junction3.delay; room *= RL.junction3.capacityMult; }
      else if (c >= 4) { time += RL.junction4.delay; room *= RL.junction4.capacityMult; }
      if (!(room > 0)) room = 1;
      cap[i] = room;
      const load = Math.min(trafficVolume(data, node) / room, CONGESTION_CAP);
      const over = load - T.freeFlow;
      const jammed = load - jamFrom;
      const target = time * (over > 0 ? 1 + RL.congestionDelay * over : 1) + extra[i];
      // The jam is NOT eased. It is steep, and a steep cost that lags behind the volume makes
      // riders swing between two lines in slow waves that never settle; applied at once, they
      // swap every round or two, which the volume averaging (_merge) turns into a steady split.
      const was = cost[node] - jamWas[i];
      const eased = cost[node] === 0 || first ? target : was + (target - was) * COST_EASE;
      const jamNow = jammed > 0 && jamDelay > 0 ? jamDelay * (jamPower === 1 ? jammed : Math.pow(jammed, jamPower)) : 0;
      jamWas[i] = jamNow;
      cost[node] = eased + jamNow;
      if (Math.abs(target - eased) > RAIL_COST_SETTLED) easing = true;
    }
    // A junction built on a quiet line, or a crossing whose other side filled up, changes a
    // cost with no change in volume: the pass must go on until the cost has arrived.
    this._railEasing = easing;
  }

  /** One round of map → flow → spill for every market. Returns whether anything moved noticeably. */
  private _iterate(world: World): boolean {
    this._updateCosts(world);

    let moved = 0;
    const markets = this._data.markets;
    const stBoard = this._stBoard;
    if (stBoard.length > 0) stBoard.fill(0);
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
      // People take a train when it is faster; freight never does.
      this._useRail = def.rides === true && this._xCount > 0;
      this._curWeight = marketWeight(def);
      this._flood(world, def.dest, field, marketCapacity(def), def.key);
      const demand = this._inject(world, field, def.origin, rate, this._flow, marketReach(def), this._extraTripCount[k] > 0 ? def.key : undefined, scale);
      this._openDoors(field, demand);
      this._sweep(field, this._flow, field.doorLoad, true);
      if (def.dest !== NO_ZONE && this._extraDoorCount[k] > 0) this._passOn(world, def.dest, marketCapacity(def), field);
      this._spill(world, field);
      moved = Math.max(moved, this._merge(world, m.volume, this._prev[k], this._unstable[k]));
    }

    if (stBoard.length > 0) {
      const stations = this._data.rail.stations;
      let total = 0;
      for (let q = 0; q < stations.length; q++) { stations[q].boardings = stBoard[q]; total += stBoard[q]; }
      this._data.rail.boardings = total;
    }

    this._firstIteration = false;
    return moved > SETTLED_LOAD || this._railEasing;
  }

  /** Wipe a market that has stopped running: no doors, no routes, no traffic. */
  private _emptyMarket(k: number): void {
    const { field, volume } = this._data.markets[k];
    const prev = this._prev[k], unstable = this._unstable[k];
    const roads = this._nodes, roadCount = this._nodeCount;
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
   * With `sendersOf` given, the roads from which buildings send that market's
   * trips are destinations as well (for the way to customers and workers).
   */
  private _flood(world: World, zoneType: number, field: TrafficField, capPerLevel: number, market?: MarketKey, sendersOf?: MarketKey): void {
    const { width, height } = world.grid;
    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const cost = this._cost;
    const { dist, parent, order, doorCap } = field;
    const nb = this._nb;
    const roads = this._roads, roadCount = this._roadCount;
    const lots = this._lots, lotCount = this._lotCount;

    const nodes = this._nodes, nodeCount = this._nodeCount;
    for (let k = 0; k < nodeCount; k++) { const ri = nodes[k]; dist[ri] = Infinity; doorCap[ri] = 0; }
    this._heapSize = 0;
    const useRail = this._useRail;
    const xHead = this._xHead, xNext = this._xNext, xTo = this._xTo, boardTime = this._boardTime;

    for (let q = 0; q < lotCount; q++) {
      const i = lots[q];
      if (zone[i] !== zoneType) continue;
      // A tile of a merged 2×2 lot with no road of its own takes its trips in through its building's (sim/lots.ts).
      const door = world.layers.lot[i] !== 0 ? doorTile(world, i) : i;
      let doors = 0;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(door, k, width, height);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) doors++;
      }
      if (doors === 0) continue;
      const share = levelWeight(dev[i]) * capPerLevel / doors;
      for (let k = 0; k < 4; k++) {
        const ri = neighbourIndex(door, k, width, height);
        if (ri < 0) continue;
        const rc = roadClass[ri];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) doorCap[ri] += share;
      }
    }

    // Building doors may start at more than 0 (a handicap: see DoorProvider). Zone doors never do.
    let handicapped = false;
    const doorStart = this._doorStart;
    if (market !== undefined && hasDoorProviders()) {
      const bldCap = this._bldCap;
      for (let k = 0; k < roadCount; k++) bldCap[roads[k]] = 0;
      extraDoors(world, market, (ri, cap, handicap = 0) => {
        if (!(cap > 0) || ri < 0 || ri >= roadClass.length) return;
        const rc = roadClass[ri];
        if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) return;
        if (handicap > 0 && !handicapped) {
          // The first handicap of this flood: every door so far starts at 0.
          handicapped = true;
          for (let k = 0; k < roadCount; k++) doorStart[roads[k]] = 0;
          doorStart[ri] = doorCap[ri] > 0 ? 0 : handicap;
        } else if (handicapped) {
          const h = handicap > 0 ? handicap : 0;
          doorStart[ri] = doorCap[ri] > 0 ? Math.min(doorStart[ri], h) : h;
        }
        doorCap[ri] += cap; bldCap[ri] += cap;
      });
    }
    field.handicapped = handicapped;

    if (sendersOf !== undefined) {
      extraTrips(world, sendersOf, (ri, trips) => {
        if (!(trips > 0) || ri < 0 || ri >= roadClass.length) return;
        const rc = roadClass[ri];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) doorCap[ri] += trips;
      });
    }

    for (let k = 0; k < roadCount; k++) {
      const ri = roads[k];
      if (doorCap[ri] === 0) continue;
      const start = handicapped ? doorStart[ri] : 0;
      dist[ri] = start;
      parent[ri] = -1;
      this._push(ri, start);
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
      // A station's portal: from an access road onto the platform, or off it.
      if (useRail) {
        for (let e = xHead[cur]; e >= 0; e = xNext[e]) {
          const ni = xTo[e];
          const nd = Math.fround(key + boardTime + (curCost + cost[ni]) * 0.5);
          if (nd < dist[ni]) {
            dist[ni] = nd;
            parent[ni] = cur;
            this._push(ni, nd);
          }
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
    const lots = this._lots, lotCount = this._lotCount;
    const nodes = this._nodes, nodeCount = this._nodeCount;
    for (let k = 0; k < nodeCount; k++) flow[nodes[k]] = 0;
    field.stranded = 0;
    // No destination of this type anywhere: every trip wanted is stranded.
    const nowhere = field.count === 0;
    let total = 0, stranded = 0;
    if (rate !== 0) {
      for (let q = 0; q < lotCount; q++) {
        const i = lots[q];
        if (zone[i] !== originZone) continue;
        const trips = levelWeight(dev[i]) * rate;
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
   * Sweep `flow` along the map `route` from farthest to nearest, so every
   * road tile accumulates the traffic passing through it (into `_raw`, which
   * is emptied first if `reset`). Traffic ends at the first door of `route`
   * it reaches, and is counted there in `doorLoad`.
   */
  private _sweep(route: TrafficField, flow: Float32Array, doorLoad: Float32Array, reset: boolean): void {
    const nb = this._nb;
    const { dist, parent, order, count } = route;
    const room = this._room;
    const raw = this._raw;
    const cost = this._cost;
    const roads = this._nodes, roadCount = this._nodeCount;
    if (reset) for (let k = 0; k < roadCount; k++) raw[roads[k]] = 0;
    const useRail = this._useRail, xHead = this._xHead;

    // Farthest first: every tile a stream is handed to is nearer, so it is
    // handled later.
    for (let k = count - 1; k >= 0; k--) {
      const ri = order[k];
      const f = flow[ri];
      if (f === 0) continue;
      raw[ri] += f;
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
      // A node with a portal (a station's access road, or its platform) has more ways on than four.
      if (useRail && xHead[ri] >= 0) { this._handOnAtPortal(route, flow, ri, f); continue; }

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
   * _sweep's handing on, for a node that has portals: the same split by
   * detour, over its neighbours and its portals alike. What goes from a road
   * onto a platform is counted as boarding at that station.
   */
  private _handOnAtPortal(route: TrafficField, flow: Float32Array, ri: number, f: number): void {
    const n = this._n;
    const nb = this._nb, cost = this._cost;
    const { dist, parent } = route;
    const xNext = this._xNext, xTo = this._xTo, xStation = this._xStation;
    const to = this._candTo, wt = this._candW, st = this._candSt;
    const here = dist[ri], hereCost = cost[ri], boardTime = this._boardTime;
    let cnt = 0, total = 0;
    for (let d = 0; d < 4; d++) {
      const ni = nb[ri * 4 + d];
      if (ni < 0 || !(dist[ni] < here)) continue;
      const detour = dist[ni] + (hereCost + cost[ni]) * 0.5 - here;
      const w = detour <= 0 ? 1 : Math.exp(-ROUTE_SPREAD * detour);
      to[cnt] = ni; wt[cnt] = w; st[cnt] = -1; cnt++; total += w;
    }
    let parentStation = -1;
    for (let e = this._xHead[ri]; e >= 0; e = xNext[e]) {
      const ni = xTo[e];
      if (ni === parent[ri]) parentStation = xStation[e];
      if (cnt >= to.length || !(dist[ni] < here)) continue;
      const detour = dist[ni] + boardTime + (hereCost + cost[ni]) * 0.5 - here;
      const w = detour <= 0 ? 1 : Math.exp(-ROUTE_SPREAD * detour);
      to[cnt] = ni; wt[cnt] = w; st[cnt] = xStation[e]; cnt++; total += w;
    }
    const boarding = ri < n;   // from a road, a portal leads onto a platform
    const perTrip = 1 / this._curWeight;
    if (total <= 0) {
      flow[parent[ri]] += f;
      if (boarding && parentStation >= 0) this._stBoard[parentStation] += f * perTrip;
      return;
    }
    const share = f / total;
    for (let k = 0; k < cnt; k++) {
      const amount = share * wt[k];
      flow[to[k]] += amount;
      if (boarding && st[k] >= 0) this._stBoard[st[k]] += amount * perTrip;
    }
  }

  /**
   * What arrived at a building's door beyond its room drives on to the zones:
   * from that door, along the way to the nearest zone door of `zoneType`,
   * adding to the roads in between. Without this a small building door near
   * homes would swallow every trip of its neighbourhood (the spill only looks
   * SPILL_RADIUS tiles for room) and the trips would never be on the road. A
   * door shared by a building and a zone keeps its excess, like any zone door,
   * and so does every door when no zone door can be reached.
   */
  private _passOn(world: World, zoneType: number, capPerLevel: number, field: TrafficField): void {
    const { order, count, parent, doorLoad } = field;
    const room = this._room, bldCap = this._bldCap, raw = this._raw;
    let any = false;
    for (let k = 0; k < count; k++) {
      const door = order[k];
      if (parent[door] >= 0) break;          // doors come first in `order` (travel time 0)
      if (bldCap[door] > 0 && -room[door] > 1e-6) { any = true; break; }
    }
    if (!any) return;

    const route = this._zoneRoute ??= makeTrafficField(NODES_PER_TILE * this._n);
    this._flood(world, zoneType, route, capPerLevel);
    if (route.count === 0) return;
    const onward = this._onward;
    const roads = this._nodes, roadCount = this._nodeCount;
    for (let k = 0; k < roadCount; k++) onward[roads[k]] = 0;
    for (let k = 0; k < count; k++) {
      const door = order[k];
      if (parent[door] >= 0) break;
      const excess = -room[door];
      if (!(bldCap[door] > 0) || !(excess > 1e-6)) continue;
      if (!(route.dist[door] < Infinity) || route.parent[door] < 0) continue;   // no zone door to go on to, or this is one
      onward[door] = excess;
      doorLoad[door] -= excess;
      room[door] = 0;
      // The sweep below counts these trips on this tile again as they leave: they are the same vehicles.
      raw[door] = raw[door] > excess ? raw[door] - excess : 0;
    }
    this._sweep(route, onward, doorLoad, false);
  }

  /**
   * Pass each over-full door's excess to doors with room within SPILL_RADIUS
   * road tiles, nearest first, adding the traffic to the roads in between.
   * Doors are handled in a fixed order and nothing here depends on earlier
   * iterations, so the result is the same every time for the same inputs.
   */
  private _spill(_world: World, field: TrafficField): void {
    const nb = this._nb;
    const { order, count, parent, doorLoad, doorCap, handicapped } = field;
    const room = this._room;
    const raw = this._raw;
    const queue = this._bfsQueue, from = this._bfsFrom, seen = this._bfsSeen, steps = this._bfsSteps;

    for (let k = 0; k < count; k++) {
      const door = order[k];
      if (parent[door] >= 0) { if (handicapped) continue; break; }   // doors come first in `order` (travel time 0) unless some have a handicap
      let excess = -room[door];
      if (excess <= 1e-6) continue;

      // Breadth-first over road tiles from the door.
      const run = ++this._bfsRun;
      let head = 0, tail = 0;
      seen[door] = run; steps[door] = 0; from[door] = -1;
      queue[tail++] = door;
      while (head < tail && excess > 1e-6) {
        const cur = queue[head++];
        if (cur !== door && room[cur] > 0 && (parent[cur] < 0 || (handicapped && doorCap[cur] > 0))) {
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
    const roads = this._nodes, roadCount = this._nodeCount;
    const n = this._n, railCap = this._railCap;

    let moved = 0;
    for (let k = 0; k < roadCount; k++) {
      const i = roads[k];
      const r = raw[i], o = out[i], before = prev[i];
      if (r === 0 && o === 0 && before === 0) continue;
      prev[i] = r;
      const cap = i < n ? roadCapacity(roadClass[i]) : (railCap[i - n] || 1);
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
