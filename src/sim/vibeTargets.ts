// Vibe targets (BALANCE.vibe.mode 'target'; owner 2026-11-23: character should last as long as the place does,
// not fade in game months). Each tile's target on the three vibe axes, from what stands around it now (a box of
// BALANCE.vibe.targetRadius tiles), as a byte around neutral 128:
//   green        trees and parks, less industry, as a share of the land around it
//   planned      road tiles that run straight or cross, and one zone dominating the developed lots around it
//   egalitarian  how even the land values of the homes around it are (1 − spread ÷ mean)
// A tile with almost no city around it (fewer than 3 developed lots, roads or buildings) targets neutral.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { ROAD_NONE, TERRAIN_WATER, ZONE_C, ZONE_I, ZONE_R } from './constants';
import { countsAsPark } from './leisure';

export interface VibeTargets { egalitarian: Uint8Array; green: Uint8Array; planned: Uint8Array }

const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));
const toByte = (x: number) => Math.max(0, Math.min(255, Math.round(128 + 100 * clamp1(x))));

/** Summed-area table of a per-tile value, (w+1)×(h+1). */
function sat(values: Float64Array, w: number, h: number): Float64Array {
  const s = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += values[y * w + x];
      s[(y + 1) * (w + 1) + x + 1] = s[y * (w + 1) + x + 1] + row;
    }
  }
  return s;
}

export function vibeTargets(world: World): VibeTargets {
  const { width: w, height: h } = world.grid, L = world.layers, n = w * h, R = BALANCE.vibe.targetRadius;
  const F = (fill: (i: number) => number) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = fill(i); return sat(a, w, h); };
  const isRoad = (i: number) => L.roadClass[i] !== ROAD_NONE;
  const dev = (i: number, z: number) => L.zone[i] === z && L.devLevel[i] > 0 && !L.abandoned[i];
  const land = F(i => (L.terrain[i] === TERRAIN_WATER ? 0 : 1));
  const city = F(i => (isRoad(i) || L.building[i] || (L.zone[i] && L.devLevel[i]) ? 1 : 0));
  const green = F(i => (L.vegetation[i] || (L.building[i] && countsAsPark(L.building[i])) ? 1 : 0));
  const ind = F(i => (dev(i, ZONE_I) ? 1 : 0));
  const roads = F(i => (isRoad(i) ? 1 : 0));
  const straight = F(i => {
    if (!isRoad(i)) return 0;
    const x = i % w, y = (i - x) / w;
    return (x > 0 && x < w - 1 && isRoad(i - 1) && isRoad(i + 1)) || (y > 0 && y < h - 1 && isRoad(i - w) && isRoad(i + w)) ? 1 : 0;
  });
  const rz = F(i => (dev(i, ZONE_R) ? 1 : 0)), cz = F(i => (dev(i, ZONE_C) ? 1 : 0)), iz = ind;
  const lv = F(i => (dev(i, ZONE_R) ? L.landValue[i] : 0)), lv2 = F(i => (dev(i, ZONE_R) ? L.landValue[i] ** 2 : 0));
  const box = (s: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    s[(y1 + 1) * (w + 1) + x1 + 1] - s[y0 * (w + 1) + x1 + 1] - s[(y1 + 1) * (w + 1) + x0] + s[y0 * (w + 1) + x0];
  const out: VibeTargets = { egalitarian: new Uint8Array(n).fill(128), green: new Uint8Array(n).fill(128), planned: new Uint8Array(n).fill(128) };
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(h - 1, y + R);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(w - 1, x + R), i = y * w + x;
      if (box(city, x0, y0, x1, y1) < 3) continue;
      const landN = Math.max(1, box(land, x0, y0, x1, y1));
      out.green[i] = toByte(((box(green, x0, y0, x1, y1) - 1.5 * box(ind, x0, y0, x1, y1)) / landN - 0.08) / 0.22);
      const rd = box(roads, x0, y0, x1, y1), r = box(rz, x0, y0, x1, y1), c = box(cz, x0, y0, x1, y1), z = box(iz, x0, y0, x1, y1), devN = r + c + z;
      // Centred on a typical city (about 93% of road tiles straight, 75% of lots in one zone), so either way is possible.
      const grid = rd >= 3 ? clamp1((box(straight, x0, y0, x1, y1) / rd - 0.93) / 0.07) : 0;
      const mix = devN >= 3 ? clamp1((Math.max(r, c, z) / devN - 0.75) / 0.25) : 0;
      out.planned[i] = toByte(0.5 * grid + 0.5 * mix);
      if (r >= 3) {
        const mean = box(lv, x0, y0, x1, y1) / r, sd = Math.sqrt(Math.max(0, box(lv2, x0, y0, x1, y1) / r - mean * mean));
        out.egalitarian[i] = toByte(((1 - sd / Math.max(1, mean)) - 0.8) / 0.15);
      }
    }
  }
  return out;
}
