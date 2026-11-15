/**
 * Reads a clay zone sprite's pixels and works out where its bare ground is, so
 * lot dressing (lotDressing.ts) can be planned and drawn on it:
 *   - which pixels are ground, and how much the building's shadow darkens them;
 *   - a coarse grid of free cells that props may stand on;
 *   - the building's extent and front step ("door");
 *   - for each plot edge, where the strip just inside the rim is bare.
 * Pure pixel functions; no DOM.
 *
 * Everything in the returned `field` is in *plan units*: the sprite scaled so
 * it is PLAN_SPACE wide. Plans are then independent of the sprite's resolution.
 */
import { findGroundMask, sampleGroundColour } from './groundTones';

export const PLAN_SPACE = 256;
/** The plot is drawn a little shorter than it is wide (camera tilt). */
const PLOT_ASPECT = 0.905;

export type LotZone = 'res' | 'com' | 'ind';

export interface LotField {
  zone: LotZone;
  /** Development level 1-3. */
  level: number;
  /** Plot rectangle; `front` is the last row of ground above the plot's front lip. */
  left: number; right: number; top: number; front: number;
  /** Free-ground grid over the plot: 0 blocked, 1 lit ground, 2 ground in the building's shadow. */
  cols: number; rows: number; cell: number;
  grid: Uint8Array;
  /**
   * One character per grid step along each edge: '1' where the strip just
   * inside the rim is bare ground. An edge treatment may only run where it
   * will not be chopped into fragments.
   */
  rim: { back: string; front: string; left: string; right: string };
  /** The building's bounding box, in cells: [x0, y0, x1, y1]. */
  bld: [number, number, number, number];
  /** The widest run on the building's lowest row (front step or dock), in cells. */
  door: { a: number; b: number; y: number } | null;
}

export interface LotGround {
  /** Sprite size the per-pixel arrays below are for. */
  w: number; h: number;
  /** 1 where a pixel is ground (exact, for recolouring). */
  ground: Uint8Array;
  /** 0-255 coverage of cleaned-up ground with soft edges (for clipping things drawn on the ground). */
  alpha: Uint8Array;
  /** 0-255 strength of the building's shadow on the ground. */
  shade: Uint8Array;
  field: LotField;
}

const lum = (r: number, g: number, b: number): number => 0.3 * r + 0.59 * g + 0.11 * b;

/** 3x3 box blur. */
function blur3(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += src[yy * w + xx]; n++; }
    }
    out[y * w + x] = s / n;
  }
  return out;
}

/**
 * Analyses one sprite. `meta` is its plot rectangle in sprite pixels. Returns
 * null when no usable ground is found.
 */
export function analyseLot(
  rgba: Uint8ClampedArray, w: number, h: number,
  meta: { left: number; right: number; bottom: number }, zone: LotZone, level: number,
): LotGround | null {
  const plotW = meta.right - meta.left + 1;
  const topF = meta.bottom + 1 - plotW * PLOT_ASPECT, top = Math.round(topF);
  const plot = { left: meta.left, right: meta.right, bottom: meta.bottom, top: topF };
  const colour = sampleGroundColour(rgba, w, h, plot);
  if (!colour) return null;
  const ground = findGroundMask(rgba, w, h, plot);

  // The front lip is not ground: walk up from the bottom to the first row that mostly is.
  let front = meta.bottom;
  for (; front > top; front--) {
    let n = 0;
    for (let x = meta.left + 2; x <= meta.right - 2; x++) n += ground[front * w + x];
    if (n >= (plotW - 4) * 0.6) break;
  }
  if (front - top < 20) return null;

  // Majority filter: drops specks and fills pin-holes such as paving joints.
  const g = new Uint8Array(w * h);
  for (let y = top; y <= front; y++) for (let x = meta.left; x <= meta.right; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) n += ground[yy * w + xx];
    }
    if (n >= 6) g[y * w + x] = 1;
  }

  // Shadow strength: how much darker than lit ground each ground pixel is.
  const GL = lum(colour[0], colour[1], colour[2]);
  const dark = new Float32Array(w * h), gf = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!g[i]) continue;
    gf[i] = 1;
    dark[i] = Math.max(0, Math.min(1, 1 - lum(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]) / GL));
  }
  const gB = blur3(gf, w, h), dB = blur3(dark, w, h);
  const alpha = new Uint8Array(w * h), shade = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (g[i]) alpha[i] = Math.round(255 * Math.min(1, gB[i] * 1.4));
    const s = gB[i] > 0.05 ? dB[i] / gB[i] : 0;
    if (s > 0.035) shade[i] = Math.round(255 * Math.min(0.6, s));
  }

  // Grid. A cell is free when it and a 1px ring around it are all ground, which
  // keeps props clear of the building's outline.
  const S = PLAN_SPACE / w;
  const cp = Math.max(1, Math.round(4 / S)); // cell size in sprite pixels
  const cols = Math.floor(plotW / cp), rows = Math.floor((front - top + 1) / cp);
  const grid = new Uint8Array(cols * rows);
  const isG = (x: number, y: number): number => (x < meta.left || x > meta.right || y < top || y > front ? 0 : g[y * w + x]);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const px = meta.left + cx * cp, py = top + cy * cp;
    let ok = true, sh = 0;
    for (let dy = -1; dy <= cp && ok; dy++) for (let dx = -1; dx <= cp; dx++) {
      if (!isG(px + dx, py + dy)) { ok = false; break; }
      sh += dark[(py + dy) * w + px + dx];
    }
    grid[cy * cols + cx] = !ok ? 0 : sh / ((cp + 2) * (cp + 2)) > 0.1 ? 2 : 1;
  }

  // Rim strips.
  const x0 = meta.left + 1, x1 = meta.right, y0 = top + 1, y1 = front;
  const band = Math.max(2, Math.round(9 / S));
  const seg = (ax: number, ay: number, bx: number, by: number): string => {
    let n = 0, t = 0;
    for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) { t++; n += g[y * w + x]; }
    return t > 0 && n / t >= 0.9 ? '1' : '0';
  };
  const rim = { back: '', front: '', left: '', right: '' };
  for (let x = x0; x < x1; x += cp) {
    rim.back += seg(x, y0, Math.min(x + cp, x1), y0 + band);
    rim.front += seg(x, y1 - band, Math.min(x + cp, x1), y1);
  }
  for (let y = y0; y < y1; y += cp) {
    rim.left += seg(x0, y, x0 + band, Math.min(y + cp, y1));
    rim.right += seg(x1 - band, y, x1, Math.min(y + cp, y1));
  }

  // The building is the largest blocked blob (ignoring the plot's own rim and
  // painted lines). Its lowest row's widest run is the front step or dock.
  const blocked = (i: number): boolean => {
    const x = i % cols, y = (i - x) / cols;
    return grid[i] === 0 && x > 0 && x < cols - 1 && y > 0 && y < rows - 1;
  };
  const comp = new Int32Array(cols * rows);
  let nComp = 0, best = 0, bestN = 0;
  for (let s0 = 0; s0 < cols * rows; s0++) {
    if (!blocked(s0) || comp[s0]) continue;
    const stack = [s0];
    comp[s0] = ++nComp;
    let n = 0;
    while (stack.length) {
      const i = stack.pop()!, x = i % cols;
      n++;
      for (const j of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols]) {
        if (j >= 0 && j < cols * rows && blocked(j) && !comp[j]) { comp[j] = nComp; stack.push(j); }
      }
    }
    if (n > bestN) { bestN = n; best = nComp; }
  }
  let bx0 = cols, bx1 = -1, by0 = rows, by1 = -1;
  if (best) for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    if (comp[cy * cols + cx] !== best) continue;
    if (cx < bx0) bx0 = cx;
    if (cx > bx1) bx1 = cx;
    if (cy < by0) by0 = cy;
    if (cy > by1) by1 = cy;
  }
  let door: LotField['door'] = null;
  for (let cy = by1; cy >= by0 && !door; cy--) {
    let bestRun: { a: number; b: number } | null = null, run: { a: number; b: number } | null = null;
    for (let cx = 0; cx <= cols; cx++) {
      if (cx < cols && comp[cy * cols + cx] === best) {
        if (!run) run = { a: cx, b: cx };
        run.b = cx;
      } else if (run) {
        if (!bestRun || run.b - run.a > bestRun.b - bestRun.a) bestRun = run;
        run = null;
      }
    }
    if (bestRun && bestRun.b - bestRun.a >= 1) door = { a: bestRun.a, b: bestRun.b, y: cy };
  }

  return {
    w, h, ground, alpha, shade,
    field: {
      zone, level,
      left: meta.left * S, right: meta.right * S, top: top * S, front: front * S,
      cols, rows, cell: cp * S, grid, rim,
      bld: [bx0, by0, bx1, by1], door,
    },
  };
}
