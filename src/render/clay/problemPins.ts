/**
 * Problem indicators: where crime is high or residents are sick (the city
 * needs police or a hospital there).
 *
 * Marking every affected lot swamps the city when zoomed out, so:
 *   zoomed out  one pin per troubled district, bigger the more lots it covers,
 *               with a count (`findProblemClusters`)
 *   zoomed in   a small badge on each seriously affected building
 * `findProblemClusters` is pure and tested; `drawProblemBadge` needs a canvas.
 */
import type { World } from '../../sim/World';
import { ZONE_NONE, ZONE_R } from '../../sim/constants';

export type ProblemKind = 'crime' | 'health';

/** A lot counts toward a district above these (the levels the old per-lot markers used). */
export const CRIME_MIN = 40;
export const SICKNESS_MIN = 80;
/** A building gets its own badge, when zoomed in, above these. */
export const CRIME_BADGE_MIN = 100;
export const SICKNESS_BADGE_MIN = 140;

export interface ProblemCluster {
  kind: ProblemKind;
  /** Centre of the district, in tiles (fractional). */
  x: number; y: number;
  /** How many lots it covers. */
  count: number;
}

/** True if the lot at `i` has a crime problem / sick residents worth showing above `min`. */
export function crimeProblem(world: World, i: number, min = CRIME_MIN): boolean {
  const L = world.layers;
  return L.crime[i] > min && L.zone[i] !== ZONE_NONE && L.devLevel[i] > 0;
}
export function healthProblem(world: World, i: number, min = SICKNESS_MIN): boolean {
  const L = world.layers;
  return L.sickness[i] > min && L.zone[i] === ZONE_R && L.devLevel[i] > 0 && L.abandoned[i] === 0;
}

/** Lots this far apart (in tiles, either axis) still belong to one district, so a road does not split it. */
const REACH = 2;
const CRIME = 1, HEALTH = 2;
let marks = new Uint8Array(0);
const stack: number[] = [];

/**
 * Groups affected lots into districts: one cluster per connected group, per
 * kind. Looks only at zoned tiles (`world.index`), so its cost follows the
 * size of the city, not the map; still, call it now and then, not every frame.
 */
export function findProblemClusters(world: World): ProblemCluster[] {
  const { width, height } = world.grid;
  if (marks.length !== width * height) marks = new Uint8Array(width * height);
  const index = world.index, zoned = index.zoned, zonedCount = index.zonedCount;
  let any = 0;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    const m = (crimeProblem(world, i) ? CRIME : 0) | (healthProblem(world, i) ? HEALTH : 0);
    marks[i] = m;
    any |= m;
  }
  const out: ProblemCluster[] = [];
  for (const bit of [CRIME, HEALTH]) {
    if (!(any & bit)) continue;
    for (let k = 0; k < zonedCount; k++) {
      const start = zoned[k];
      if (!(marks[start] & bit)) continue;
      // Flood from this lot, clearing the bit as lots are taken.
      marks[start] &= ~bit;
      stack.length = 0;
      stack.push(start);
      let count = 0, sumX = 0, sumY = 0;
      while (stack.length) {
        const i = stack.pop()!, x = i % width, y = (i - x) / width;
        count++; sumX += x; sumY += y;
        const y0 = Math.max(0, y - REACH), y1 = Math.min(height - 1, y + REACH);
        const x0 = Math.max(0, x - REACH), x1 = Math.min(width - 1, x + REACH);
        for (let ny = y0; ny <= y1; ny++) for (let j = ny * width + x0, end = ny * width + x1; j <= end; j++) {
          if (marks[j] & bit) { marks[j] &= ~bit; stack.push(j); }
        }
      }
      out.push({ kind: bit === CRIME ? 'crime' : 'health', x: sumX / count + 0.5, y: sumY / count + 0.5, count });
    }
  }
  // Every bit set above was cleared by a flood, so `marks` is all zero again.
  return out;
}

/** Pin radius in screen pixels for a district of `count` lots. */
export function pinRadius(count: number): number {
  return Math.min(26, 8 + Math.sqrt(count) * 1.7);
}

const COLOUR = { crime: '#d8453a', health: '#1fa894', death: '#6b6f78' } as const;

/**
 * A round clay badge centred on (x, y): a shield with "!" for crime, a cross
 * for health, a headstone for a recent death. `count` above 1 adds a number tab.
 */
export function drawProblemBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: ProblemKind | 'death', count = 1): void {
  const colour = COLOUR[kind];
  ctx.fillStyle = 'rgba(10,12,16,0.35)';
  ctx.beginPath(); ctx.arc(x + r * 0.08, y + r * 0.14, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4f0e6';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  if (kind === 'health') {
    const a = r * 0.16, l = r * 0.5;
    ctx.fillRect(x - a, y - l, a * 2, l * 2);
    ctx.fillRect(x - l, y - a, l * 2, a * 2);
  } else if (kind === 'crime') {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.42, y - r * 0.42); ctx.lineTo(x + r * 0.42, y - r * 0.42); ctx.lineTo(x + r * 0.42, y + r * 0.05);
    ctx.quadraticCurveTo(x + r * 0.35, y + r * 0.45, x, y + r * 0.58);
    ctx.quadraticCurveTo(x - r * 0.35, y + r * 0.45, x - r * 0.42, y + r * 0.05);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = colour;
    ctx.fillRect(x - r * 0.07, y - r * 0.26, r * 0.14, r * 0.36);
    ctx.beginPath(); ctx.arc(x, y + r * 0.28, r * 0.09, 0, Math.PI * 2); ctx.fill();
  } else {
    // Headstone: a rounded slab with a small cross cut into it.
    ctx.beginPath(); ctx.roundRect(x - r * 0.32, y - r * 0.48, r * 0.64, r * 0.96, [r * 0.32, r * 0.32, 0, 0]); ctx.fill();
    ctx.fillStyle = colour;
    ctx.fillRect(x - r * 0.05, y - r * 0.28, r * 0.1, r * 0.44);
    ctx.fillRect(x - r * 0.17, y - r * 0.16, r * 0.34, r * 0.1);
  }
  if (count > 1 && r > 9) {
    const text = String(count);
    ctx.font = `700 ${Math.round(r * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + r * 0.4, bx = x + r * 0.75, by = y - r * 0.75;
    ctx.fillStyle = '#1b1e24';
    ctx.beginPath(); ctx.roundRect(bx - w / 2, by - r * 0.42, w, r * 0.84, r * 0.42); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, bx, by + 1);
  }
}
