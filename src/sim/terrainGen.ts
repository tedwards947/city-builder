// Map types for a new city (owner, 2026-11-19): River, Coastal, Lakes, Bay,
// and Random (one of those four, chosen by the seed). Each fills the terrain
// layer with water and sand, and the vegetation layer with forests in patches.
// Everything comes from seeded noise: the same size, seed, type and amounts
// always give the same map.
//
// The OLD generator (one north–south river and one round lake, trees
// scattered evenly) is still in World.ts and is what a World gets when no
// map type is passed ("classic"): the Balance Lab, the tests, the golden
// baseline, the showcase and the tutorial all still use it, unchanged. Only
// the New city dialog asks for these.
//
// Every map keeps a START AREA: the land around the middle of the map, where
// the camera opens. A candidate map is accepted only if that area is dry and
// the land it belongs to is a good share of the map (START below); otherwise
// the next candidate (the same seed, nudged) is tried, and the last resort is
// the same map with the start area filled in. So a city can always be begun.
//
// Pure functions over plain arrays: nothing here knows about World.

import { TERRAIN_GRASS, TERRAIN_WATER, TERRAIN_SAND, VEG_NONE } from './constants';
import { mulberry32 } from './rng';

export type MapKind = 'river' | 'coastal' | 'lakes' | 'bay';
export type MapType = 'classic' | MapKind | 'random';
export const MAP_KINDS: readonly MapKind[] = ['river', 'coastal', 'lakes', 'bay'];

type Amount = 'low' | 'medium' | 'high';

export const START = {
  /** Radius (tiles) of the disc at the middle of the map that must be land, and is kept free of trees. */
  radius: 7,
  /** The land joined to the start area must be at least this share of the whole map. */
  minLandShare: 0.3,
  /** Candidates tried before the start area is simply filled in. */
  tries: 8,
};

/** Every map keeps at least this share of its tiles as land. */
export const MIN_LAND = 0.45;

const WATER_SCALE: Record<Amount, number> = { low: 0.7, medium: 1, high: 1.35 };
/** Forest cover: tiles whose forest noise is above this are wooded. */
const FOREST_AT: Record<Amount, number> = { low: 0.62, medium: 0.56, high: 0.49 };

// ── Seeded noise ────────────────────────────────────────────────────────────

/** A number in [0, 1) from a seed and two integers. */
function hash(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1): one value per lattice point, blended between them. */
function noise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(seed, x0, y0), b = hash(seed, x0 + 1, y0);
  const c = hash(seed, x0, y0 + 1), d = hash(seed, x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Several octaves of noise, in [0, 1): big shapes with smaller ones on top. */
function fbm(seed: number, x: number, y: number, octaves = 4): number {
  let sum = 0, amp = 1, total = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise(seed + o * 1013, x * f, y * f) * amp;
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / total;
}

// ── The four kinds ──────────────────────────────────────────────────────────

/** Which kind a map of this type and seed is (Random picks by the seed). */
export function mapKindFor(type: MapType, seed: number): MapKind | null {
  if (type === 'classic') return null;
  if (type !== 'random') return type;
  return MAP_KINDS[Math.floor(mulberry32(seed ^ 0x51ab)() * MAP_KINDS.length)];
}

interface Ctx { w: number; h: number; size: number; seed: number; k: number; t: Uint8Array; rng: () => number }

/** A point on one edge of the map (0 top, 1 right, 2 bottom, 3 left), `at` of the way along it. */
function edgePoint(c: Ctx, edge: number, at: number): [number, number] {
  return edge === 0 ? [at * c.w, 0] : edge === 1 ? [c.w - 1, at * c.h] : edge === 2 ? [at * c.w, c.h - 1] : [0, at * c.h];
}

/** How far tile (x, y) is from an edge, in tiles. */
function fromEdge(c: Ctx, edge: number, x: number, y: number): number {
  return edge === 0 ? y : edge === 1 ? c.w - 1 - x : edge === 2 ? c.h - 1 - y : x;
}

function disc(c: Ctx, cx: number, cy: number, r: number): void {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(c.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(c.h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) c.t[y * c.w + x] = TERRAIN_WATER;
  }
}

/**
 * A winding channel from (ax, ay) to (bx, by): a straight line pushed
 * sideways by noise (not at its ends), its width swelling and narrowing.
 */
function channel(c: Ctx, ax: number, ay: number, bx: number, by: number, half: number, wander: number, salt: number): void {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  const steps = Math.ceil(len * 2);
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const off = (fbm(c.seed + salt, u * 5, 0.5, 3) - 0.5) * 2 * wander * Math.sin(Math.PI * u);
    const r = half * (0.55 + 0.95 * noise(c.seed + salt + 77, u * 9, 3.5));
    disc(c, ax + (bx - ax) * u + nx * off, ay + (by - ay) * u + ny * off, Math.max(0.8, r));
  }
}

/** River: from one edge to another (across, or round a corner), winding, of varying width; half the time a tributary joins it. */
function river(c: Ctx): void {
  const from = Math.floor(c.rng() * 4);
  const to = (from + (c.rng() < 0.65 ? 2 : c.rng() < 0.5 ? 1 : 3)) % 4;
  const [ax, ay] = edgePoint(c, from, 0.2 + c.rng() * 0.6);
  const [bx, by] = edgePoint(c, to, 0.2 + c.rng() * 0.6);
  const half = Math.max(1.6, c.size * 0.014 * c.k);
  channel(c, ax, ay, bx, by, half, c.size * 0.16, 11);
  if (c.rng() < 0.5) {
    // A tributary: from a third edge to a point part-way down the main river's line.
    const others = [0, 1, 2, 3].filter((e) => e !== from && e !== to);
    const [tx, ty] = edgePoint(c, others[Math.floor(c.rng() * others.length)], 0.25 + c.rng() * 0.5);
    const u = 0.35 + c.rng() * 0.3;
    channel(c, tx, ty, ax + (bx - ax) * u, ay + (by - ay) * u, Math.max(1, half * 0.6), c.size * 0.09, 29);
  }
}

/** Sea along one edge, by how far it reaches inland at each point: a ragged line with headlands and coves. */
function sea(c: Ctx, edge: number, depth: number, rough: number, salt: number): void {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const reach = depth + (fbm(c.seed + salt, x / (c.size * 0.12), y / (c.size * 0.12)) - 0.5) * 2 * rough;
    if (fromEdge(c, edge, x, y) < reach) c.t[y * c.w + x] = TERRAIN_WATER;
  }
}

/** A patch of land (an island) with a wobbly outline, drawn over whatever is there. */
function island(c: Ctx, cx: number, cy: number, r: number): void {
  for (let y = Math.max(0, Math.floor(cy - r * 1.6)); y <= Math.min(c.h - 1, Math.ceil(cy + r * 1.6)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r * 1.6)); x <= Math.min(c.w - 1, Math.ceil(cx + r * 1.6)); x++) {
      const edge = r * (0.6 + 0.8 * fbm(c.seed + 301, x / (r * 0.9), y / (r * 0.9), 3));
      if (Math.hypot(x - cx, y - cy) < edge) c.t[y * c.w + x] = TERRAIN_GRASS;
    }
  }
}

/** Coastal: sea along one edge, sometimes round the corner onto the next, with a ragged shore and often an island offshore. */
function coastal(c: Ctx): void {
  const edge = Math.floor(c.rng() * 4);
  const depth = c.size * 0.2 * c.k, rough = c.size * 0.17;
  sea(c, edge, depth, rough, 41);
  if (c.rng() < 0.4) sea(c, (edge + (c.rng() < 0.5 ? 1 : 3)) % 4, depth * 0.8, rough, 59);
  if (c.rng() < 0.6) {
    const [ex, ey] = edgePoint(c, edge, 0.2 + c.rng() * 0.6);
    const inland = depth * 0.42;
    const cx = edge === 1 ? ex - inland : edge === 3 ? ex + inland : ex;
    const cy = edge === 0 ? ey + inland : edge === 2 ? ey - inland : ey;
    island(c, cx, cy, Math.max(3, c.size * 0.045));
  }
}

/** Lakes: several, of different sizes, with irregular shores; none over the start area. */
function lakes(c: Ctx): void {
  const count = 3 + Math.floor(c.rng() * 4);
  for (let n = 0; n < count; n++) {
    let cx = 0, cy = 0;
    for (let tries = 0; tries < 12; tries++) {
      cx = (0.08 + c.rng() * 0.84) * c.w;
      cy = (0.08 + c.rng() * 0.84) * c.h;
      if (Math.hypot(cx - c.w / 2, cy - c.h / 2) > c.size * 0.22) break;
    }
    const r = c.size * (0.045 + c.rng() * 0.06) * c.k;
    const stretch = 0.7 + c.rng() * 0.8;      // some are long, some round
    for (let y = Math.max(0, Math.floor(cy - r * 2)); y <= Math.min(c.h - 1, Math.ceil(cy + r * 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r * 2)); x <= Math.min(c.w - 1, Math.ceil(cx + r * 2)); x++) {
        const shore = r * (0.55 + 0.9 * fbm(c.seed + 500 + n * 31, x / (r * 0.8), y / (r * 0.8), 3));
        if (Math.hypot((x - cx) * stretch, (y - cy) / stretch) < shore) c.t[y * c.w + x] = TERRAIN_WATER;
      }
    }
  }
}

/** Bay: a narrow strip of sea along one edge with a deep, wide inlet cut into the land. */
function bay(c: Ctx): void {
  const edge = Math.floor(c.rng() * 4);
  sea(c, edge, c.size * 0.07 * c.k, c.size * 0.05, 71);
  const [mx, my] = edgePoint(c, edge, 0.3 + c.rng() * 0.4);
  const along = c.size * (0.2 + c.rng() * 0.08) * c.k, deep = c.size * (0.3 + c.rng() * 0.06) * Math.min(1.15, c.k);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const d = fromEdge(c, edge, x, y);
    const a = edge === 0 || edge === 2 ? x - mx : y - my;
    const wobble = 0.75 + 0.5 * fbm(c.seed + 83, x / (c.size * 0.13), y / (c.size * 0.13));
    if ((a / along) ** 2 + (d / deep) ** 2 < wobble) c.t[y * c.w + x] = TERRAIN_WATER;
  }
}

const DRAW: Record<MapKind, (c: Ctx) => void> = { river, coastal, lakes, bay };

// ── Checks ──────────────────────────────────────────────────────────────────

/** The tiles of the start area: a disc at the middle of the map. */
function startTiles(w: number, h: number): number[] {
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2), r = Math.min(START.radius, Math.floor(Math.min(w, h) / 4));
  const out: number[] = [];
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (x >= 0 && y >= 0 && x < w && y < h && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) out.push(y * w + x);
  }
  return out;
}

/** How many land tiles can be walked to from the middle of the map without crossing water (0 if the middle is water). */
export function landFromStart(terrain: Uint8Array, w: number, h: number): number {
  const start = Math.floor(h / 2) * w + Math.floor(w / 2);
  if (terrain[start] === TERRAIN_WATER) return 0;
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let n = 0;
  const visit = (i: number): void => { if (!seen[i] && terrain[i] !== TERRAIN_WATER) { seen[i] = 1; queue[n++] = i; } };
  visit(start);
  for (let q = 0; q < n; q++) {
    const i = queue[q], x = i % w;
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (i >= w) visit(i - w);
    if (i < w * (h - 1)) visit(i + w);
  }
  return n;
}

function landShare(terrain: Uint8Array): number {
  let land = 0;
  for (let i = 0; i < terrain.length; i++) if (terrain[i] !== TERRAIN_WATER) land++;
  return land / terrain.length;
}

function acceptable(terrain: Uint8Array, w: number, h: number): boolean {
  for (const i of startTiles(w, h)) if (terrain[i] === TERRAIN_WATER) return false;
  return landShare(terrain) >= MIN_LAND && landFromStart(terrain, w, h) >= START.minLandShare * w * h;
}

/** Land beside water becomes sand, as on the classic maps. */
function addSand(t: Uint8Array, w: number, h: number): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (t[i] !== TERRAIN_GRASS) continue;
    let wet = false;
    for (let dy = -1; dy <= 1 && !wet; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && t[ny * w + nx] === TERRAIN_WATER) { wet = true; break; }
    }
    if (wet) t[i] = TERRAIN_SAND;
  }
}

// ── Entry points ────────────────────────────────────────────────────────────

/**
 * Fill `terrain` (width × height) with a map of the given kind. Returns the
 * kind drawn. The same arguments always give the same map.
 */
export function generateTerrain(terrain: Uint8Array, width: number, height: number, seed: number, kind: MapKind, water: Amount = 'medium'): void {
  const size = Math.min(width, height);
  for (let attempt = 0; attempt <= START.tries; attempt++) {
    const s = (seed + Math.imul(attempt, 0x9e3779b1)) | 0;
    terrain.fill(TERRAIN_GRASS);
    DRAW[kind]({ w: width, h: height, size, seed: s, k: WATER_SCALE[water], t: terrain, rng: mulberry32(s ^ 0x7e44a1) });
    if (acceptable(terrain, width, height)) break;
    if (attempt === START.tries) {
      // Nothing passed (a very wet setting on a small map): keep this one, with the start area filled in.
      for (const i of startTiles(width, height)) terrain[i] = TERRAIN_GRASS;
    }
  }
  addSand(terrain, width, height);
}

/**
 * Forests in patches: where a slow noise is high the land is wooded, each
 * wood mostly of one kind of tree, thinning at its edge; elsewhere a tree
 * here and there. No trees on water or sand, nor on the start area.
 */
export function generateForests(vegetation: Uint8Array, terrain: Uint8Array, width: number, height: number, seed: number, amount: Amount = 'low'): void {
  const size = Math.min(width, height);
  const rng = mulberry32(seed ^ 0xf0e57);
  const at = FOREST_AT[amount];
  const patch = Math.max(10, size * 0.11);          // woods are about this many tiles across
  const start = new Set(startTiles(width, height));
  vegetation.fill(VEG_NONE);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const roll = rng(), pick = rng();               // drawn for every tile, so the rolls do not depend on the terrain
    if (terrain[i] !== TERRAIN_GRASS || start.has(i)) continue;
    const wood = fbm(seed ^ 0x1eaf, x / patch, y / patch, 3);
    // Deep in a wood nearly every tile has a tree; at its edge, fewer.
    const chance = wood > at ? Math.min(0.9, 0.35 + (wood - at) * 9) : 0.004;
    if (roll >= chance) continue;
    // Each wood has its own main species (a slower noise), with a few others mixed in.
    const main = 1 + Math.floor(noise(seed ^ 0x5ec1e5, x / (patch * 1.7), y / (patch * 1.7)) * 6);
    vegetation[i] = pick < 0.75 ? Math.min(6, main) : 1 + Math.floor((pick - 0.75) * 4 * 6);
  }
}
