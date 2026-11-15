/**
 * Ground tones: recolours a clay sprite's plot (lawn, paving or dirt) without
 * touching the building, so neighbouring lots do not all share one flat ground.
 * Pure pixel functions; no DOM.
 */

export interface PlotRect { left: number; right: number; bottom: number; top: number }

/** Per-channel multipliers [r, g, b]. The first tone of every set is "as painted". */
export type Tone = readonly [number, number, number];

export const GROUND_TONES: Record<'res' | 'com' | 'ind', readonly Tone[]> = {
  // lawn: as painted, lush, dry, cool, pale
  res: [[1, 1, 1], [0.88, 0.96, 0.84], [1.12, 1.04, 0.82], [0.92, 1.03, 1.04], [1.06, 1.05, 0.98]],
  // paving: as painted, warm, cool, darker, lighter
  com: [[1, 1, 1], [1.04, 1.01, 0.95], [0.94, 0.97, 1.02], [0.9, 0.9, 0.91], [1.04, 1.04, 1.04]],
  // dirt: as painted, darker, sandy, red clay, grey
  ind: [[1, 1, 1], [0.88, 0.87, 0.86], [1.07, 1.05, 0.97], [1.05, 0.93, 0.86], [0.93, 0.97, 1.0]],
};

/** How far a channel may sit from the ground colour (after matching brightness). */
const TOLERANCE = 20;
/** Shadowed ground is the same colour, darker; lit ground is a touch brighter. */
const MIN_BRIGHTNESS = 0.42;
const MAX_BRIGHTNESS = 1.22;

const median = (values: number[]): number => {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
};

/**
 * The plot's ground colour: the median of a band just inside the plot's left,
 * right and front edges (props in a corner cannot skew a median). Null when
 * the plot is too small or has too few opaque pixels to tell.
 */
export function sampleGroundColour(rgba: Uint8ClampedArray, w: number, h: number, plot: PlotRect): [number, number, number] | null {
  const x0 = Math.max(0, plot.left + 2), x1 = Math.min(w - 1, plot.right - 2);
  const y0 = Math.max(0, Math.ceil(plot.top) + 2), y1 = Math.min(h - 1, plot.bottom - 5); // skip the plot's front lip
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const sample = (x: number, y: number): void => {
    const i = (y * w + x) * 4;
    if (rgba[i + 3] < 250) return;
    rs.push(rgba[i]); gs.push(rgba[i + 1]); bs.push(rgba[i + 2]);
  };
  for (let d = 0; d < 3; d++) {
    for (let y = y0; y <= y1; y++) { sample(x0 + d, y); sample(x1 - d, y); }
    for (let x = x0; x <= x1; x++) sample(x, y1 - d);
  }
  if (rs.length < 20) return null;
  const colour: [number, number, number] = [median(rs), median(gs), median(bs)];
  return (colour[0] + colour[1] + colour[2]) / 3 < 1 ? null : colour;
}

/**
 * Marks the pixels that are plot ground (1) in an RGBA image.
 *
 * A pixel counts as ground if it is the ground colour (see sampleGroundColour)
 * at some brightness, so the building's shadow on the ground is
 * included, and if it connects to the plot's edge through other ground pixels,
 * so a wall that happens to be the same colour is left alone unless it touches.
 */
export function findGroundMask(rgba: Uint8ClampedArray, w: number, h: number, plot: PlotRect): Uint8Array {
  const mask = new Uint8Array(w * h);
  const x0 = Math.max(0, plot.left + 2), x1 = Math.min(w - 1, plot.right - 2);
  const y0 = Math.max(0, Math.ceil(plot.top) + 2), y1 = Math.min(h - 1, plot.bottom - 5); // skip the plot's front lip
  const colour = sampleGroundColour(rgba, w, h, plot);
  if (!colour) return mask;
  const [R, G, B] = colour;
  const L = (R + G + B) / 3;

  const matches = (i: number, tolerance = TOLERANCE): boolean => {
    const p = i * 4;
    if (rgba[p + 3] < 200) return false;
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    const k = (r + g + b) / 3 / L;
    if (k < MIN_BRIGHTNESS || k > MAX_BRIGHTNESS) return false;
    // Darker pixels get a proportionally tighter tolerance.
    const tol = tolerance * Math.max(0.6, k);
    return Math.abs(r - R * k) < tol && Math.abs(g - G * k) < tol && Math.abs(b - B * k) < tol;
  };

  // Flood from the plot's edge band inward. The flood may run right up to the
  // plot's rim (the samples above stay clear of it, the recolouring should not).
  const fx0 = Math.max(0, plot.left), fx1 = Math.min(w - 1, plot.right);
  const fy0 = Math.max(0, Math.floor(plot.top) - 1), fy1 = Math.min(h - 1, plot.bottom - 3);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < fx0 || x > fx1 || y < fy0 || y > fy1) return;
    const i = y * w + x;
    if (mask[i] || !matches(i)) return;
    mask[i] = 1;
    stack.push(i);
  };
  for (let y = y0; y <= y1; y++) { push(x0, y); push(x1, y); }
  for (let x = x0; x <= x1; x++) { push(x, y0); push(x, y1); }
  const flood = (): void => {
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
  };
  flood();
  // Ground enclosed by pipes or fences never reaches the edge. Where the ground
  // has a real colour (lawn, dirt; not grey paving, which walls share), a close
  // match anywhere on the plot is ground too.
  if (Math.max(R, G, B) - Math.min(R, G, B) > 30) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (!mask[i] && matches(i, TOLERANCE * 0.5)) { mask[i] = 1; stack.push(i); }
    }
    flood();
  }
  return mask;
}

/** Returns a copy of `rgba` with the masked pixels multiplied by `tone`. */
export function applyGroundTone(rgba: Uint8ClampedArray, mask: Uint8Array, tone: Tone): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = i * 4;
    out[p] = rgba[p] * tone[0];
    out[p + 1] = rgba[p + 1] * tone[1];
    out[p + 2] = rgba[p + 2] * tone[2];
  }
  return out;
}
