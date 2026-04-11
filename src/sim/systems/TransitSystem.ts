// TransitSystem — road-network-aware traffic flow model.
//
// DESIGN: Normalized BFS spreading + cross-zone gravity flow.
//
// Each developed zone tile BFS-es outward through the road network (road↔road
// adjacency only) up to BALANCE.transit.accessRadius hops. It deposits its
// devLevel as load across every road tile it reaches, weighted by distance and
// normalized so that the total deposit sums to exactly devLevel regardless of
// how many roads are reachable. This normalization is the key to the "parallel
// road relief" property: when a second road is added, the same zone's total
// contribution is now split across more road tiles, reducing the load on the
// original artery.
//
// Road congestion = cross-zone gravity flow:
//   flow = rLoad × (cLoad + iLoad) + iLoad × cLoad
// A road tile that can reach both an R district and a C/I district carries
// the cross-traffic between them and therefore becomes congested; a dead-end
// cul-de-sac serving only residential sees no R×C product and stays empty.
//
// Accessibility layer:
//   For each zone tile, reads the complementary load values from its adjacent
//   road tile(s) and stores a 0-255 score. R tiles: reachable C+I. C tiles:
//   reachable R+I. I tiles: reachable R+C. Used by ZoneGrowthSystem to apply
//   a growth multiplier — zones with no road path to their complementary types
//   develop slower.
//
// Runs every transit.flowInterval ticks (slower cadence than zone growth).

import { World } from '../World';
import { ROAD_NONE, ZONE_NONE, ZONE_R, ZONE_C } from '../constants';
import { BALANCE } from '../../data/balance';

// Capacity lookup indexed by road class byte (built once, constant at runtime).
const CLASS_CAPACITY: number[] = (() => {
  const arr: number[] = [0, 0, 0, 0];
  for (const [k, v] of Object.entries(BALANCE.roadClasses)) {
    arr[Number(k)] = v.capacity;
  }
  return arr;
})();

export class TransitSystem {
  private _rLoad: Float32Array | null = null;
  private _cLoad: Float32Array | null = null;
  private _iLoad: Float32Array | null = null;
  // Generation-based visited array: avoids O(n) fill between BFS runs.
  private _visitedGen: Uint32Array | null = null;
  private _queue: Int32Array | null = null;
  private _qdepth: Uint8Array | null = null;
  private _gen = 0;
  // Layer checksums — if zone+dev+roadClass haven't changed since the last
  // full BFS pass, skip re-computation entirely.
  private _lastZoneDevSum = -1;
  private _lastRoadSum = -1;

  update(world: World): void {
    if (world.tick % BALANCE.transit.flowInterval !== 0) return;

    const { width, height } = world.grid;
    const n = width * height;

    if (!this._rLoad || this._rLoad.length !== n) {
      this._rLoad      = new Float32Array(n);
      this._cLoad      = new Float32Array(n);
      this._iLoad      = new Float32Array(n);
      this._visitedGen = new Uint32Array(n);
      this._queue      = new Int32Array(n);
      this._qdepth     = new Uint8Array(n);
      this._gen        = 0;
      this._lastZoneDevSum = -1;
      this._lastRoadSum    = -1;
    }

    // Skip the expensive BFS passes when roads and zones are unchanged.
    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    {
      let zdSum = 0, rdSum = 0;
      for (let i = 0; i < n; i++) {
        zdSum += zone[i] * 4 + dev[i];
        rdSum += roadClass[i];
      }
      if (zdSum === this._lastZoneDevSum && rdSum === this._lastRoadSum) return;
      this._lastZoneDevSum = zdSum;
      this._lastRoadSum    = rdSum;
    }

    const rLoad      = this._rLoad!;
    const cLoad      = this._cLoad!;
    const iLoad      = this._iLoad!;
    const visitedGen = this._visitedGen!;
    const queue      = this._queue!;
    const qdepth     = this._qdepth!;

    rLoad.fill(0);
    cLoad.fill(0);
    iLoad.fill(0);

    const R         = BALANCE.transit.accessRadius;
    const Rp1       = R + 1;

    // ── Pass 1: BFS spread zone load through road network (normalized) ────────
    //
    // For each developed zone tile, BFS outward through connected road tiles.
    // Load deposited to road tile at depth d:
    //   devLevel × rate × (1 − d/Rp1) / totalWeight
    // where `rate` is rGenRate / cAttrRate / iAttrRate from BALANCE.
    // Normalization by totalWeight ensures total deposit = devLevel × rate,
    // so adding more roads splits the same demand rather than adding to it.

    const T = BALANCE.transit;

    for (let zy = 0; zy < height; zy++) {
      for (let zx = 0; zx < width; zx++) {
        const zi = zy * width + zx;
        if (zone[zi] === ZONE_NONE || dev[zi] === 0) continue;

        const zoneType = zone[zi];
        const devLevel = dev[zi];
        const rate     = zoneType === ZONE_R ? T.rGenRate
                       : zoneType === ZONE_C ? T.cAttrRate
                       :                       T.iAttrRate;
        const gen      = ++this._gen;

        let head = 0, tail = 0, totalWeight = 0;

        // Seed: all cardinal road tiles adjacent to this zone tile (depth 0).
        const s0 = zx > 0        ? zi - 1      : -1;
        const s1 = zx < width-1  ? zi + 1      : -1;
        const s2 = zy > 0        ? zi - width  : -1;
        const s3 = zy < height-1 ? zi + width  : -1;

        for (const s of [s0, s1, s2, s3]) {
          if (s < 0 || roadClass[s] === ROAD_NONE || visitedGen[s] === gen) continue;
          visitedGen[s] = gen;
          queue[tail]   = s;
          qdepth[tail]  = 0;
          tail++;
          totalWeight  += 1; // weight at depth 0 = 1 - 0/Rp1 = 1
        }

        if (tail === 0) continue; // zone has no adjacent road → contributes nothing

        // BFS expansion
        let limit = 0;
        while (head < tail && limit++ < 1000000) {
          const cur = queue[head];
          const d   = qdepth[head];
          head++;

          if (d >= R) continue; // don't expand beyond accessRadius

          const cx  = cur % width;
          const cy  = (cur - cx) / width;
          const nd  = d + 1;
          const nw  = 1 - nd / Rp1;

          const nb0 = cx > 0        ? cur - 1      : -1;
          const nb1 = cx < width-1  ? cur + 1      : -1;
          const nb2 = cy > 0        ? cur - width  : -1;
          const nb3 = cy < height-1 ? cur + width  : -1;

          for (const nb of [nb0, nb1, nb2, nb3]) {
            if (nb < 0 || roadClass[nb] === ROAD_NONE || visitedGen[nb] === gen) continue;
            visitedGen[nb] = gen;
            queue[tail]    = nb;
            qdepth[tail]   = nd;
            tail++;
            totalWeight   += nw;
          }
        }

        if (totalWeight === 0) continue;

        // Deposit normalized load to every visited road tile.
        for (let q = 0; q < tail; q++) {
          const ri   = queue[q];
          const d    = qdepth[q];
          const load = devLevel * rate * (1 - d / Rp1) / totalWeight;
          if (zoneType === ZONE_R)      rLoad[ri] += load;
          else if (zoneType === ZONE_C) cLoad[ri] += load;
          else                          iLoad[ri] += load;
        }
      }
    }

    // ── Pass 2: flow → congestion ─────────────────────────────────────────────
    //
    // flow = baseline + cross-zone product
    //   baseline  = rLoad + cLoad + iLoad       (any zone activity creates traffic)
    //   cross     = rLoad×(cLoad+iLoad) + iLoad×cLoad  (extra load where zones intermix)
    //
    // The cross term is what makes arterials connecting R↔C/I districts busier
    // than stub roads serving a single zone type. The baseline term means a pure
    // residential area still has light local traffic (residents making short trips).

    const congestion = world.layers.congestion;
    let totalCong = 0, roadCount = 0;

    for (let i = 0; i < n; i++) {
      if (roadClass[i] === ROAD_NONE) {
        congestion[i] = 0;
        continue;
      }
      const rl = rLoad[i], cl = cLoad[i], il = iLoad[i];
      const flow = (rl + cl + il) + rl * (cl + il) + il * cl;
      const cap  = CLASS_CAPACITY[roadClass[i]] || BALANCE.transit.streetCapacity;
      const c    = Math.min(255, Math.round(flow / cap * 255));
      congestion[i] = c;
      totalCong += c;
      roadCount++;
    }

    world.stats.avgCongestion = roadCount > 0 ? Math.round(totalCong / roadCount) : 0;

    // ── Pass 3: accessibility per zone tile ───────────────────────────────────
    //
    // Reads the complementary load already accumulated on adjacent road tiles.
    // This is a single O(n) scan — no extra BFS needed because the road tiles
    // already encode "how much complementary zone is reachable from here."

    const accessibility = world.layers.accessibility;
    const norm = BALANCE.transit.accessNormFactor;

    for (let zy = 0; zy < height; zy++) {
      for (let zx = 0; zx < width; zx++) {
        const zi = zy * width + zx;
        if (zone[zi] === ZONE_NONE) { accessibility[zi] = 0; continue; }

        const zoneType = zone[zi];
        let best = 0;

        const d0 = zx > 0        ? zi - 1      : -1;
        const d1 = zx < width-1  ? zi + 1      : -1;
        const d2 = zy > 0        ? zi - width  : -1;
        const d3 = zy < height-1 ? zi + width  : -1;

        for (const d of [d0, d1, d2, d3]) {
          if (d < 0 || roadClass[d] === ROAD_NONE) continue;
          const comp = zoneType === ZONE_R ? cLoad[d] + iLoad[d]
                     : zoneType === ZONE_C ? rLoad[d] + iLoad[d]
                     :                       rLoad[d] + cLoad[d];
          if (comp > best) best = comp;
        }

        accessibility[zi] = Math.min(255, Math.round(best * norm));
      }
    }
  }
}
