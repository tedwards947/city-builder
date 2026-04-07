// TransitSystem — road traffic flow model.
//
// Each developed zone tile is classified as either a TripGenerator or a
// TripAttractor based on its zone type:
//
//   TripGenerator (R zones): residents generate trips outward — heading to
//     work, shops, or services. Load weight = devLevel × rGenRate.
//
//   TripAttractor (C / I zones): commercial and industrial zones attract
//     trips inward — employees, shoppers, deliveries.
//     Load weight = devLevel × cAttrRate (C) or iAttrRate (I).
//
// Both ends of every trip add load to nearby roads. A road tile located
// between an R neighbourhood and a C/I district therefore accumulates load
// from both sides — making it busier than a road deep inside a single-use
// area. This reproduces the real-world pattern where mixed-use corridors
// carry the most traffic.
//
// The spreading uses a linear-decay radial kernel (not graph routing).
// Each zone tile distributes its trip load to every road tile within
// transit.spreadRadius manhattan tiles, weighted by (1 − dist/radius).
//
// Congestion = accumulated flow / streetCapacity, normalised to 0–255 and
// stored in world.layers.congestion.  Values > 128 are "moderate"; 255
// means gridlock. Road tiles with no nearby zone activity stay at 0.
//
// Runs every transit.flowInterval ticks (slower cadence than zone growth).

import { World } from '../World';
import { ROAD_NONE, ZONE_NONE, ZONE_R, ZONE_C } from '../constants';
import { BALANCE } from '../../data/balance';

// Pre-build a capacity lookup (index = road class byte, value = flow capacity).
// Rebuilt lazily once — road classes are constant at runtime.
const CLASS_CAPACITY: number[] = (() => {
  const arr: number[] = [0, 0, 0, 0]; // index 0 unused (ROAD_NONE)
  for (const [k, v] of Object.entries(BALANCE.roadClasses)) {
    arr[Number(k)] = v.capacity;
  }
  return arr;
})();

export class TransitSystem {
  private _flow: Float32Array | null = null;

  update(world: World): void {
    if (world.tick % BALANCE.transit.flowInterval !== 0) return;

    const { width, height } = world.grid;
    const n = width * height;

    if (!this._flow || this._flow.length !== n) {
      this._flow = new Float32Array(n);
    }

    const flow = this._flow;
    flow.fill(0);

    const roadClass = world.layers.roadClass;
    const zone      = world.layers.zone;
    const dev       = world.layers.devLevel;
    const T         = BALANCE.transit;
    const r         = T.spreadRadius;
    const rPlus1    = r + 1;

    // ── Trip generation / attraction spreading ────────────────────────────────
    for (let zy = 0; zy < height; zy++) {
      for (let zx = 0; zx < width; zx++) {
        const zi = zy * width + zx;
        if (zone[zi] === ZONE_NONE || dev[zi] === 0) continue;

        // TripGenerator (R) or TripAttractor (C / I).
        const load = zone[zi] === ZONE_R ? dev[zi] * T.rGenRate
                   : zone[zi] === ZONE_C ? dev[zi] * T.cAttrRate
                   : /* ZONE_I */          dev[zi] * T.iAttrRate;

        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist > r) continue;  // stay within the manhattan diamond, not the full square
            const nx = zx + dx, ny = zy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = ny * width + nx;
            if (roadClass[ni] === ROAD_NONE) continue;
            flow[ni] += load * (1 - dist / rPlus1);
          }
        }
      }
    }

    // ── Write congestion layer (normalise by per-class capacity) ──────────────
    const congestion = world.layers.congestion;
    let total = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      if (roadClass[i] === ROAD_NONE) {
        congestion[i] = 0;
      } else {
        const cap = CLASS_CAPACITY[roadClass[i]] || T.streetCapacity;
        const c = Math.min(255, Math.round(flow[i] / cap * 255));
        congestion[i] = c;
        total += c;
        count++;
      }
    }

    world.stats.avgCongestion = count > 0 ? Math.round(total / count) : 0;
  }
}
