/**
 * Lot dressing: decides what landscaping one building lot gets (the "calm
 * blend" chosen from the mocks in art/clay-set/landscaping.html).
 *
 * `planLot` turns a lot's free-ground field (lotGround.ts) and a seed into a
 * plain-data plan: a ground tone, flat things on the ground (lawn stripes,
 * hedges, parking, shadows) and things that stand up (trees, bushes, cars).
 * lotDressingDraw.ts paints a plan. This module has no DOM and no randomness
 * beyond the seed, so the same lot always gets the same garden.
 *
 * House rules, from the owner's review of the mocks:
 *   - every prop has a reason for its spot (by the door, against the front
 *     wall, in a corner, in a row); nothing floats in open ground;
 *   - at most one edge per lot, and only as solid unbroken runs: an edge is
 *     drawn where its whole length is bare ground, or behind a building that
 *     hides one stretch of it, never as fragments;
 *   - the only image props are trees;
 *   - restraint: one lot in five gets ground only, and a lot that would get
 *     edge + trees + props usually drops one. Towers (level 3) always get one
 *     or two deliberate features so they never look bare.
 *
 * All coordinates are plan units (see lotGround.ts).
 */
import type { LotField } from './lotGround';

export type TreeName = 'tree' | 'pine' | 'tree-autumn' | 'tree-blossom';
/**
 * Garden trees at full size (docs/SCALE.md: a canopy of about 6 m; the plot
 * is about 202 plan units for 17 m). They were drawn at 3.4 m before.
 */
const TREE_SIZE = 1.75;
/** Drawn width, height/width, footprint radius, and where the trunk meets the ground (fraction of height). */
export const TREE_SPECS: Record<TreeName, { w: number; aspect: number; R: number; base: number }> = {
  'tree': { w: 40 * TREE_SIZE, aspect: 101 / 81, R: 7 * TREE_SIZE, base: 0.93 },
  'pine': { w: 34 * TREE_SIZE, aspect: 106 / 71, R: 7 * TREE_SIZE, base: 0.93 },
  'tree-autumn': { w: 36 * TREE_SIZE, aspect: 97 / 72, R: 6 * TREE_SIZE, base: 0.95 },
  'tree-blossom': { w: 40 * TREE_SIZE, aspect: 97 / 87, R: 7 * TREE_SIZE, base: 0.95 },
};
/** A parked car, 4.5 × 1.8 m, and the bay pitch, 2.5 m (plan units). */
const CAR_LEN = 53, CAR_WID = 21, BAY = 30;
export const TREE_NAMES = Object.keys(TREE_SPECS) as TreeName[];

/** Ground tones a plan can ask for (index into groundTones.GROUND_TONES; 0 is "as painted"). */
export const DRESSING_TONES = 5;

export type EdgeStyle = 'hedge' | 'wall' | 'verge' | 'brick' | 'chainlink' | 'hazard';
export type EdgeSide = 'back' | 'left' | 'right' | 'front';

export type GroundItem =
  | { k: 'stripes'; vertical: boolean }
  | { k: 'fill'; colour: string }
  | { k: 'dots'; palette: 'flowers' | 'gravel'; pts: number[] }        // x, y, r, colour index …
  | { k: 'patches'; colours: [string, string]; pts: number[] }          // x, y, r, which colour …
  | { k: 'tracks'; x: number; y: number; bend: number }
  | { k: 'slabs' }
  | { k: 'edge'; style: EdgeStyle; sides: EdgeSide[]; gap: [number, number] | null; tint: number }
  | { k: 'stones'; pts: number[] }                                      // x, y, w …
  | { k: 'shadow'; x: number; y: number; R: number; h: number }
  | { k: 'pit'; x: number; y: number }
  | { k: 'parking'; x: number; y: number; w: number; h: number; bays: number; nose?: boolean }
  | { k: 'court'; kind: 'lawn' | 'plaza'; x: number; y: number; w: number; h: number };

export type PropItem = { y: number } & (
  | { k: 'tree'; name: TreeName; x: number; w: number; h: number; R: number; base: number }
  | { k: 'bush'; x: number; R: number; tint: number }
  | { k: 'planter'; x: number; R: number; tint: number }
  | { k: 'bed'; x: number; w: number; h: number; dots: number[] }       // x, y, colour index …
  | { k: 'scrub'; blobs: number[] }                                     // x, y, r …
  | { k: 'car'; x: number; w: number; h: number; colour: number; flip: boolean }
);

export interface DressingPlan {
  /** Ground tone index, 0..DRESSING_TONES-1. */
  tone: number;
  ground: GroundItem[];
  props: PropItem[];
  /** What was placed, for tests and debugging: 'edge:hedge', 'trees', 'flank', 'parking'… */
  tags: string[];
}

// ── Seeded helpers ───────────────────────────────────────────────────────────
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
const pick = <T>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
function wpick<T>(r: Rand, arr: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of arr) total += w;
  let x = r() * total;
  for (const [v, w] of arr) { x -= w; if (x < 0) return v; }
  return arr[0][0];
}

/** Stable seed for a sprite id and variant number. */
export function dressingSeed(id: string, variant: number): number {
  let h = 2166136261 ^ variant;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (Math.imul(h ^ (h >>> 15), 2246822519) ^ (variant * 40503)) >>> 0;
}

// ── Working state ────────────────────────────────────────────────────────────
interface Door { x: number; y: number; half: number; stepHalf: number }
interface Work {
  f: LotField; r: Rand;
  free: Uint8Array; corr: Uint8Array; clear: Float32Array;
  door: Door | null; nFree: number;
  taken: { x: number; y: number; R: number }[];
  ground: GroundItem[]; props: PropItem[]; tags: string[];
}

function prepare(f: LotField, r: Rand): Work {
  const { cols, rows, cell, grid } = f, n = cols * rows;
  const free = new Uint8Array(n), clear = new Float32Array(n), corr = new Uint8Array(n);
  for (let i = 0; i < n; i++) { free[i] = grid[i] ? 1 : 0; clear[i] = free[i] ? 99 : 0; }
  // Chamfer distance (in cells) to the nearest blocked cell or the plot's edge.
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : clear[y * cols + x]);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (free[i]) clear[i] = Math.min(clear[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4, at(x + 1, y - 1) + 1.4);
  }
  for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
    const i = y * cols + x;
    if (free[i]) clear[i] = Math.min(clear[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4, at(x - 1, y + 1) + 1.4);
  }
  // Door corridor: from the front step straight to the plot's front edge, kept clear of props.
  let door: Door | null = null;
  const d = f.door;
  if (d && d.b - d.a <= 18 && d.y < rows - 4) {
    const c = (d.a + d.b + 1) / 2, half = f.zone === 'res' ? 3 : Math.min(8, (d.b - d.a + 1) / 2 + 1);
    for (let y = d.y; y < rows; y++) for (let x = Math.max(0, Math.floor(c - half)); x < Math.min(cols, Math.ceil(c + half)); x++) corr[y * cols + x] = 1;
    door = { x: f.left + c * cell, y: f.top + (d.y + 1) * cell, half: half * cell, stepHalf: Math.max(half, (d.b - d.a + 1) / 2) * cell };
  }
  let nFree = 0;
  for (let i = 0; i < n; i++) if (free[i] && !corr[i]) nFree++;
  return { f, r, free, corr, clear, door, nFree, taken: [], ground: [], props: [], tags: [] };
}

/** Is this point on free ground (and off the door corridor)? */
function freeAt(w: Work, x: number, y: number): boolean {
  const { f } = w, cx = Math.floor((x - f.left) / f.cell), cy = Math.floor((y - f.top) / f.cell);
  if (cx < 0 || cy < 0 || cx >= f.cols || cy >= f.rows) return false;
  const i = cy * f.cols + cx;
  return !!w.free[i] && !w.corr[i];
}
/** Like freeAt for a canopy: anything above the plot is sky and fine; the door corridor does not matter. */
function skyAt(w: Work, x: number, y: number): boolean {
  const { f } = w, cx = Math.floor((x - f.left) / f.cell), cy = Math.floor((y - f.top) / f.cell);
  if (cx < 0 || cx >= f.cols || cy >= f.rows) return false;
  return cy < 0 || !!w.free[cy * f.cols + cx];
}
/** Is the whole rectangle (top-left x, y) free ground? */
function rectFree(w: Work, x: number, y: number, bw: number, bh: number): boolean {
  const step = w.f.cell / 2;
  for (let yy = y; yy <= y + bh; yy += step) for (let xx = x; xx <= x + bw; xx += step) if (!freeAt(w, xx, yy)) return false;
  return true;
}
const collides = (w: Work, x: number, y: number, R: number): boolean => w.taken.some((p) => Math.hypot(p.x - x, (p.y - y) * 1.25) < p.R + R);
const reserve = (w: Work, x: number, y: number, R: number): void => { w.taken.push({ x, y, R }); };
/** Does the rectangle (top-left x, y) keep clear of everything placed so far? */
const rectClear = (w: Work, x: number, y: number, bw: number, bh: number): boolean =>
  !w.taken.some((p) => p.x > x - p.R - 3 && p.x < x + bw + p.R + 3 && p.y > y - p.R - 3 && p.y < y + bh + p.R + 3);
/** Reserves a rectangle (as a grid of circles, which is what later placements test against). */
function reserveRect(w: Work, x: number, y: number, bw: number, bh: number): void {
  for (let yy = y + 6; yy <= y + bh - 4; yy += 11) for (let xx = x + 6; xx <= x + bw - 4; xx += 11) reserve(w, xx, yy, 9);
}
const shadow = (w: Work, x: number, y: number, R: number, h: number): void => { w.ground.push({ k: 'shadow', x, y, R, h }); };

/** A random free spot of radius R, best of a few by `score` (corner-hugging by default). */
function place(w: Work, R: number, tallBox: [number, number] | null): { x: number; y: number } | null {
  const { f, r } = w;
  let best: { x: number; y: number; s: number } | null = null;
  for (let t = 0, found = 0; t < 90 && found < 10; t++) {
    const cx = Math.floor(r() * f.cols), cy = Math.floor(r() * f.rows), i = cy * f.cols + cx;
    if (!w.free[i] || w.corr[i] || w.clear[i] * f.cell < R + 1) continue;
    const x = f.left + cx * f.cell + f.cell / 2 + (r() - 0.5) * 3, y = f.top + cy * f.cell + f.cell / 2 + (r() - 0.5) * 3;
    if (collides(w, x, y, R * 0.9)) continue;
    if (tallBox && !canopyFits(w, x, y, tallBox[0], tallBox[1], R)) continue;
    const u = cx / f.cols, v = cy / f.rows;
    const s = -(Math.min(u, 1 - u) + Math.min(v, 1 - v)) * 2 + r() * 0.15;
    if (!best || s > best.s) best = { x, y, s };
    found++;
  }
  return best;
}
/** A tall prop must not cover the building: the box above its base has to be free ground or sky. */
function canopyFits(w: Work, x: number, y: number, bw: number, bh: number, R: number): boolean {
  for (let yy = y - bh; yy < y - R * 0.5; yy += w.f.cell) for (let xx = x - bw / 2; xx <= x + bw / 2; xx += w.f.cell) if (!skyAt(w, xx, yy)) return false;
  return true;
}

// ── Trees ────────────────────────────────────────────────────────────────────
function treeFits(w: Work, name: TreeName, x: number, y: number, scale: number, inFront = false): boolean {
  const s = TREE_SPECS[name], tw = s.w * scale, th = tw * s.aspect, R = s.R * scale;
  return freeAt(w, x, y) && freeAt(w, x - R * 0.7, y) && freeAt(w, x + R * 0.7, y) && freeAt(w, x, y + R * 0.5)
    && !collides(w, x, y, R) && (inFront || canopyFits(w, x, y, tw * 0.9, th * 0.9, R));
}
function addTree(w: Work, name: TreeName, x: number, y: number, scale: number, pit: boolean): void {
  const s = TREE_SPECS[name], tw = s.w * scale, th = tw * s.aspect, R = s.R * scale;
  if (pit) w.ground.push({ k: 'pit', x, y });
  shadow(w, x, y - R * 0.15, R * 1.25, 1.2);
  w.props.push({ k: 'tree', name, x, y, w: tw, h: th, R, base: s.base });
  reserve(w, x, y, R + 2);
}

// ── Edges ────────────────────────────────────────────────────────────────────
/**
 * Whole run bare? With `behind`, one stretch may be hidden by the building standing in front of
 * it, as long as each visible part is at least `minShow` steps long (a part that joins a side
 * run at the corner can be shorter than one standing alone).
 */
function runOK(run: string, behind: boolean, minShow = 6): boolean {
  const t = run.slice(1, -1); // the end steps sit in the plot's rounded corners
  const a = t.indexOf('0');
  if (a < 0) return true;
  if (!behind) return false;
  const b = t.lastIndexOf('0');
  if (t.slice(a, b + 1).includes('1')) return false; // more than one hidden stretch would read as dashes
  const before = a, after = t.length - 1 - b;
  return (before === 0 || before >= minShow) && (after === 0 || after >= minShow) && before + after >= 10;
}

/** Homes and shops: a solid edge, or none. Returns true if one was added. */
function addSolidEdge(w: Work): boolean {
  const { f, r, door } = w, res = f.zone === 'res';
  const x0 = f.left + 2, gapH = 11;
  const B = runOK(f.rim.back, true), S = runOK(f.rim.left, false) && runOK(f.rim.right, false);
  const BS = S && runOK(f.rim.back, true, 3); // back joined to both sides
  // The front only ever with one gate at the door, and only on homes.
  let gate = false;
  if (res && door && door.x - gapH - x0 > 34 && f.right - 1 - (door.x + gapH) > 34) {
    gate = true;
    for (let i = 1; i < f.rim.front.length - 1; i++) {
      const sx = x0 + i * f.cell;
      if (f.rim.front[i] === '0' && !(sx + f.cell > door.x - gapH && sx < door.x + gapH)) { gate = false; break; }
    }
  }
  const opts: [EdgeSide[], number][] = [];
  if (BS) opts.push([['back', 'left', 'right'], 3]);
  if (BS && gate) opts.push([['back', 'left', 'right', 'front'], 3]);
  if (S && gate) opts.push([['left', 'right', 'front'], 1]);
  if (gate) opts.push([['front'], 2]);
  if (B) opts.push([['back'], 1]);
  if (!opts.length) return false;
  const sides = wpick(r, opts);
  const style: EdgeStyle = res ? wpick(r, [['hedge', 4], ['wall', 2]] as const) : wpick(r, [['verge', 3], ['brick', 2]] as const);
  const front = sides.includes('front');
  w.ground.push({ k: 'edge', style, sides, gap: front && door ? [door.x - gapH, door.x + gapH] : null, tint: Math.floor(r() * 2) });
  w.tags.push('edge:' + style);
  if (front && door) { // stepping stones through the gate
    const pts: number[] = [];
    for (let y = door.y + 3, k = 0; y < f.front - 3; y += 8, k++) pts.push(door.x + (k % 2 ? 2 : -2) + (r() - 0.5), y, 4.8 + r() * 0.8);
    if (pts.length) w.ground.push({ k: 'stones', pts });
  }
  return true;
}

/** Industry: fences and walls, with a driveway gap; the building may stand in front of them. */
function addYardEdge(w: Work): void {
  const { f, r, door } = w;
  const style = wpick(r, [['chainlink', 3], ['wall', 2], ['hazard', 1]] as const);
  const sides = wpick(r, [
    [['back', 'left', 'right', 'front'], 3], [['front'], 2], [['left', 'right', 'front'], 2], [['back', 'left', 'right'], 2],
  ] as [EdgeSide[], number][]);
  const c = door ? door.x : (f.left + f.right) / 2, half = Math.max(16, door ? door.half + 4 : 16);
  w.ground.push({ k: 'edge', style, sides, gap: sides.includes('front') ? [c - half, c + half] : null, tint: 2 });
  w.tags.push('edge:' + style);
}

// ── Small groups of code-drawn props, each in a spot with a reason ──────────
/** The y just below the building's wall at x, or null. */
function wallBelow(w: Work, x: number): number | null {
  const { f } = w, cx = Math.floor((x - f.left) / f.cell);
  if (cx < 1 || cx >= f.cols - 1) return null;
  for (let cy = Math.min(f.rows - 2, f.bld[3]); cy >= f.bld[1]; cy--) if (!f.grid[cy * f.cols + cx]) return f.top + (cy + 1) * f.cell;
  return null;
}

function addFlank(w: Work, kind: 'bush' | 'planter'): boolean {
  const d = w.door;
  if (!d) return false;
  const R = kind === 'bush' ? 7.5 : 6.5, spots: [number, number][] = [];
  for (const sgn of [-1, 1]) {
    const x = d.x + sgn * (d.stepHalf + R + 2 + w.f.cell), wy = wallBelow(w, x); // a cell clear of the step
    if (wy == null) return false;
    if (!rectFree(w, x - R * 0.8, wy + 1, R * 1.6, R * 1.4)) return false;
    spots.push([x, wy + R * 0.9 + 2]);
  }
  const tint = Math.floor(w.r() * 3);
  for (const [x, y] of spots) {
    shadow(w, x, y, R, kind === 'bush' ? 0.4 : 0.6);
    w.props.push({ k: kind, x, y, R, tint });
    reserve(w, x, y, R + 2);
  }
  w.tags.push('flank');
  return true;
}

function addBed(w: Work): boolean {
  const { r, door: d, f } = w;
  if (!d || f.level !== 1) return false;
  const bw = 30 + Math.floor(r() * 2) * 8, bh = 12;
  for (const sgn of r() < 0.5 ? [-1, 1] : [1, -1]) {
    const x = d.x + sgn * (d.stepHalf + 5 + bw / 2);
    const ws = [wallBelow(w, x - bw / 2 + 7), wallBelow(w, x), wallBelow(w, x + bw / 2 - 7)];
    if (ws[0] == null || ws[1] == null || ws[2] == null) continue;
    const lo = Math.max(ws[0], ws[1], ws[2]);
    if (lo - Math.min(ws[0], ws[1], ws[2]) > f.cell) continue;
    const y = lo + 2 + bh / 2;
    if (!rectFree(w, x - bw / 2, y - bh / 2, bw, bh)) continue;
    const dots: number[] = [];
    for (let i = 0; i < Math.round(bw * bh / 22); i++) dots.push(x - bw / 2 + 2 + r() * (bw - 4), y - bh / 2 + 1.5 + r() * (bh - 3.5), Math.floor(r() * 5));
    w.props.push({ k: 'bed', x, y: y + bh / 2, w: bw, h: bh, dots });
    reserve(w, x, y, bw / 2);
    w.tags.push('bed');
    return true;
  }
  return false;
}

function addCorner(w: Work, inset: number, scrub: boolean): boolean {
  const { f, r } = w, m = inset + 12;
  const cs: [number, number, number, number][] = [
    [f.left + m, f.top + m, 1, 1], [f.right - m, f.top + m, -1, 1], [f.left + m, f.front - m, 1, -1], [f.right - m, f.front - m, -1, -1],
  ];
  for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; }
  for (const [x, y, sx, sy] of cs) {
    if (!rectFree(w, x + sx * 8 - 20, y + sy * 5 - 15, 40, 30) || collides(w, x, y, 14)) continue;
    if (scrub) {
      const blobs: number[] = [];
      for (let i = 0; i < 5; i++) blobs.push(x + sx * 4 + (r() - 0.5) * 21, y + 3 - r() * 6, 12 * (0.3 + r() * 0.25));
      shadow(w, x + sx * 4, y + 2, 7, 0.2);
      w.props.push({ k: 'scrub', y: y + 3, blobs });
      reserve(w, x, y, 14);
    } else {
      const tint = Math.floor(r() * 3);
      const bushes: [number, number, number][] = [[x, y, 9], [x + sx * 13, y + sy * 3 + 2, 6.5]];
      if (r() < 0.5) bushes.push([x + sx * 4, y + sy * 9 + (sy > 0 ? 2 : -1), 6]);
      for (const [bx, by, R] of bushes) {
        shadow(w, bx, by, R, 0.4);
        w.props.push({ k: 'bush', x: bx, y: by, R, tint });
        reserve(w, bx, by, R + 2);
      }
    }
    w.tags.push(scrub ? 'scrub' : 'corner');
    return true;
  }
  return false;
}

// ── Tower features ───────────────────────────────────────────────────────────
/** A neat row of same-species trees down one side, or a pair in the front or back corners. */
function addTreeRow(w: Work): boolean {
  const { f, r } = w, H = f.front - f.top;
  const name = pick(r, f.zone === 'res' ? ['tree', 'tree', 'pine', 'tree-blossom', 'tree-autumn'] as const : ['tree', 'tree', 'tree-blossom'] as const);
  const scale = 0.88;
  const xL = f.left + 34, xR = f.right - 34;
  const col = (x: number, n: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) out.push([x, f.top + H * (n === 3 ? 0.3 + 0.3 * i : 0.45 + 0.42 * i)]);
    return out;
  };
  const W = f.right - f.left, yB = f.top + 32;
  const lines: [number, number][][] = [
    col(xL, 3), col(xR, 3), col(xL, 2), col(xR, 2),
    [[xL, yB], [xR, yB]],
    // along the back, where a tower leaves lawn behind or beside it
    [[f.left + W * 0.2, yB], [f.left + W * 0.5, yB], [f.left + W * 0.8, yB]],
    [[f.left + W * 0.58, yB], [f.left + W * 0.82, yB]], [[f.left + W * 0.18, yB], [f.left + W * 0.42, yB]],
  ];
  let ok = lines.filter((line) => line.every(([x, y]) => treeFits(w, name, x, y, scale)));
  // Last resort: a pair in the front corners, standing in front of the tower's lower floors.
  const fp: [number, number][] = [[xL, f.front - 16], [xR, f.front - 16]];
  if (!ok.length && fp.every(([x, y]) => treeFits(w, name, x, y, scale, true))) ok = [fp];
  if (!ok.length) return false;
  // Prefer the longer rows, unless a tree already stands in a courtyard (three trees at most).
  const have = w.props.filter((p) => p.k === 'tree').length;
  if (have) ok = ok.filter((l) => l.length + have <= 3);
  if (!ok.length) return false;
  const long = ok.filter((l) => l.length === 3);
  for (const [x, y] of pick(r, long.length ? long : ok)) addTree(w, name, x, y, scale, f.zone === 'com');
  w.tags.push('row');
  return true;
}

/** Candidate top-left corners for a w x h box hugging the left or right side, nearest the street first. */
function sideBox(w: Work, bw: number, bh: number): [number, number] | null {
  const { f, r } = w;
  const xs = r() < 0.5 ? [f.left + 13, f.right - 13 - bw] : [f.right - 13 - bw, f.left + 13];
  for (const x of xs) for (let y = f.front - 5 - bh; y > f.top + 12; y -= f.cell) {
    if (rectFree(w, x - 2, y - 2, bw + 4, bh + 4) && rectClear(w, x, y, bw, bh)) return [x, y];
  }
  return null;
}

/**
 * Residential towers: a small car park with painted bays and a car or two.
 * Side by side across the lot when there is room; otherwise nose-in, a
 * narrow strip beside the tower (full-size cars are 2½ tower widths long).
 */
function addParking(w: Work): boolean {
  const { r } = w;
  for (const [bays, nose] of [[3, false], [2, false], [2, true], [1, true]] as const) {
    const bw = nose ? bays * BAY + 4 : CAR_LEN + 12, bh = nose ? CAR_LEN + 12 : bays * BAY + 4, at = sideBox(w, bw, bh);
    if (!at) continue;
    const [x, y] = at;
    w.ground.push({ k: 'parking', x, y, w: bw, h: bh, bays, nose });
    const used = new Set<number>();
    for (let n = 1 + Math.floor(r() * 2); n > 0; n--) {
      const b = Math.floor(r() * bays);
      if (used.has(b)) continue;
      used.add(b);
      const colour = Math.floor(r() * 5), flip = r() < 0.5;
      if (nose) w.props.push({ k: 'car', x: x + 2 + b * BAY + BAY / 2, y: y + bh - 6, w: CAR_WID, h: CAR_LEN, colour, flip });
      else w.props.push({ k: 'car', x: x + bw / 2, y: y + 2 + b * BAY + (BAY + CAR_WID) / 2, w: CAR_LEN, h: CAR_WID, colour, flip });
    }
    reserveRect(w, x, y, bw, bh);
    w.tags.push('parking');
    return true;
  }
  return false;
}

/** Commercial towers: a kerbed lawn square with a tree, or a little plaza with a fountain. */
function addCourt(w: Work): boolean {
  const { r } = w;
  // (a lot never has more than three trees: with a row already planted, make it the plaza)
  const kind = r() < 0.5 && !w.props.some((p) => p.k === 'tree') ? 'lawn' : 'plaza';
  const bw = kind === 'lawn' ? 42 : 40, bh = kind === 'lawn' ? 34 : 36, at = sideBox(w, bw, bh);
  if (!at) return false;
  const [x, y] = at;
  w.ground.push({ k: 'court', kind, x, y, w: bw, h: bh });
  if (kind === 'lawn') { // with a tree standing in it
    const name = pick(r, ['tree', 'tree-blossom'] as const), tx = x + bw / 2, ty = y + bh * 0.62;
    if (treeFits(w, name, tx, ty, 0.85)) addTree(w, name, tx, ty, 0.85, false);
  }
  reserveRect(w, x, y, bw, bh);
  w.tags.push('court');
  return true;
}

// ── Ground character ─────────────────────────────────────────────────────────
function addGround(w: Work): number {
  const { f, r } = w, W = f.right + 1 - f.left, H = f.front + 1 - f.top;
  const spots = (n: number, r0: number, r1: number, kinds: number): number[] => {
    const a: number[] = [];
    for (let i = 0; i < n; i++) a.push(f.left + r() * W, f.top + r() * H, r0 + r() * (r1 - r0), Math.floor(r() * kinds));
    return a;
  };
  const tone = Math.floor(r() * DRESSING_TONES);
  if (f.zone === 'res') {
    const kind = wpick(r, [['stripes', 3], ['meadow', 2], ['clover', 2], ['tone', 5]] as const);
    if (kind === 'stripes') w.ground.push({ k: 'stripes', vertical: r() < 0.5 });
    if (kind === 'meadow') w.ground.push({ k: 'dots', palette: 'flowers', pts: spots(110, 0.9, 1.5, 4) });
    if (kind === 'clover') w.ground.push({ k: 'patches', colours: ['rgba(25,100,45,0.3)', 'rgba(170,215,110,0.3)'], pts: spots(9, 9, 20, 2) });
    return kind === 'tone' ? tone : tone % 2; // patterns sit on the painted or the lush lawn
  }
  if (f.zone === 'com') return tone;
  const kind = wpick(r, [['tracks', 2], ['gravel', 2], ['concrete', 1.5], ['tone', 4.5]] as const);
  if (kind === 'tracks') {
    const d = w.door;
    w.ground.push({ k: 'tracks', x: d ? d.x : (f.left + f.right) / 2, y: d ? d.y : f.top + H * 0.6, bend: (r() < 0.5 ? -1 : 1) * (20 + r() * 30) });
    w.ground.push({ k: 'patches', colours: ['rgba(110,70,40,0.2)', 'rgba(110,70,40,0.2)'], pts: spots(5, 6, 14, 2) });
  }
  if (kind === 'gravel') { w.ground.push({ k: 'fill', colour: 'rgba(150,150,150,0.26)' }); w.ground.push({ k: 'dots', palette: 'gravel', pts: spots(170, 0.8, 1.5, 2) }); }
  if (kind === 'concrete') w.ground.push({ k: 'slabs' });
  return kind === 'tone' ? tone : 0;
}

// ── The plan ─────────────────────────────────────────────────────────────────
function planTower(w: Work): void {
  const { r, f } = w;
  const yard = f.zone === 'res' ? addParking : addCourt;
  const feats: (() => boolean)[] = [() => addTreeRow(w), () => yard(w), () => addSolidEdge(w)];
  for (let i = feats.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [feats[i], feats[j]] = [feats[j], feats[i]]; }
  const want = r() < 0.6 ? 2 : 1;
  let got = 0;
  for (const feat of feats) if (got < want && feat()) got++;
  if (got) return;
  // Nothing fitted: one tree wherever there is room, else planters by the entrance.
  const name = pick(r, ['tree', 'tree-blossom'] as const), s = TREE_SPECS[name];
  const p = place(w, s.R * 0.85, [s.w * 0.8, s.w * s.aspect * 0.8]);
  if (p) { addTree(w, name, p.x, p.y, 0.85, f.zone === 'com'); w.tags.push('trees'); } else addFlank(w, 'planter');
}

function planRegular(w: Work): void {
  const { r, f } = w, res = f.zone === 'res', com = f.zone === 'com';
  if (r() < 0.2) return; // ground only
  let wantEdge = r() < (res ? 0.45 : com ? 0.3 : 0.8), wantTrees = r() < (res ? 0.75 : com ? 0.3 : 0.12), wantProps = r() < (res ? 0.6 : com ? 0.5 : 0.2);
  if (wantEdge && wantTrees && wantProps && r() < 0.6) {
    const k = Math.floor(r() * 3);
    if (k === 0) wantEdge = false; else if (k === 1) wantTrees = false; else wantProps = false;
  }
  let inset = 0;
  if (wantEdge && !res && !com) addYardEdge(w);
  else if (wantEdge && addSolidEdge(w)) inset = 9;

  if (wantProps) {
    const order = res ? pick(r, [['bed', 'flank', 'corner'], ['flank', 'bed', 'corner'], ['corner', 'flank', 'bed']] as const) : com ? ['planters'] as const : ['scrub'] as const;
    for (const kind of order) {
      if (kind === 'flank' ? addFlank(w, 'bush') : kind === 'planters' ? addFlank(w, 'planter') : kind === 'bed' ? addBed(w) : addCorner(w, inset, kind === 'scrub')) break;
    }
  }

  if (wantTrees) {
    const n = res ? (w.nFree < 420 ? 0 : w.nFree < 800 ? 1 : 1 + Math.floor(r() * 2.6)) : w.nFree < 500 ? 0 : 1;
    const kinds: readonly TreeName[] = res ? ['tree', 'tree', 'pine', 'tree-blossom', 'tree-autumn'] : com ? ['tree', 'tree-blossom'] : ['pine', 'tree'];
    const kind = pick(r, kinds), mixed = r() < 0.25;
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const name = mixed ? pick(r, kinds) : kind, s = TREE_SPECS[name];
      const scale = (res ? 0.92 : 0.82) + r() * 0.16;
      const p = place(w, s.R * scale + inset * 0.6, [s.w * scale * 0.9, s.w * s.aspect * scale * 0.9]);
      if (!p) continue;
      addTree(w, name, p.x, p.y, scale, com);
      placed++;
    }
    if (placed) w.tags.push('trees');
  }

  // A lot that was meant to get something but where nothing fitted (terraces, big shops)
  // still gets a back edge when one can run cleanly behind the building.
  // First choice: a pair of street trees in the front corners.
  if (!w.tags.length && (wantEdge || wantTrees || wantProps) && (res || com)) {
    const name = pick(r, ['tree', 'tree', 'tree-blossom'] as const);
    const spots: [number, number][] = [[f.left + 21, f.front - 14], [f.right - 21, f.front - 14]];
    if (r() < 0.6 && spots.every(([x, y]) => treeFits(w, name, x, y, 0.8, true))) {
      for (const [x, y] of spots) addTree(w, name, x, y, 0.8, com);
      w.tags.push('trees');
    }
  }
  if (!w.tags.length && (wantEdge || wantTrees || wantProps) && res && r() < 0.6 && runOK(f.rim.back, true)) {
    w.ground.push({ k: 'edge', style: 'hedge', sides: ['back'], gap: null, tint: Math.floor(r() * 2) });
    w.tags.push('edge:hedge');
  }
}

/**
 * The dressing for one lot. `muted` (run-down lots) gives a ground tone and
 * nothing else.
 */
export function planLot(field: LotField, seed: number, muted = false): DressingPlan {
  const r = rng(seed);
  r(); r();
  if (muted) return { tone: Math.floor(r() * DRESSING_TONES), ground: [], props: [], tags: [] };
  const w = prepare(field, r);
  const tone = addGround(w);
  if (field.level >= 3 && field.zone !== 'ind') planTower(w); else planRegular(w);
  w.props.sort((a, b) => a.y - b.y);
  // Ground things paint in layers: surface patterns, then edges, then paved features, then shadows.
  const rank = (k: GroundItem['k']): number => (k === 'shadow' ? 3 : k === 'edge' ? 1 : k === 'parking' || k === 'court' || k === 'pit' || k === 'stones' ? 2 : 0);
  const ground = w.ground.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it.k) - rank(b.it.k) || a.i - b.i).map((e) => e.it);
  return { tone, ground, props: w.props, tags: w.tags };
}
