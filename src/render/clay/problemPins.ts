/**
 * Problem indicators: where crime is high, residents are sick, power or water
 * is missing, or the trip to shops, jobs or homes is too long (or impossible).
 *
 * Marking every affected lot swamps the city when zoomed out, so:
 *   zoomed out  one pin per troubled district, bigger the more lots it covers,
 *               with a count (`findProblemClusters`)
 *   zoomed in   a small badge on each seriously affected building (lots with
 *               no power or water get no badge: the building itself goes dark
 *               or dry, see ClaySprites)
 * `findProblemClusters` is pure and tested; `drawProblemBadge` needs a canvas.
 */
import type { World } from '../../sim/World';
import { ZONE_NONE, ZONE_R, BUILDING_NONE, ROAD_NONE, ROAD_HIGHWAY } from '../../sim/constants';

export type ProblemKind = 'crime' | 'health' | 'power' | 'water' | 'commute' | 'cutoff' | 'road';
export const PROBLEM_KINDS: readonly ProblemKind[] = ['crime', 'health', 'power', 'water', 'commute', 'cutoff', 'road'];
/** What a badge can show: a problem, or a recent death. */
export type BadgeKind = ProblemKind | 'death';

/** A lot counts toward a district above these (the levels the old per-lot markers used). */
export const CRIME_MIN = 40;
export const SICKNESS_MIN = 80;
/** A building gets its own badge, when zoomed in, above these. */
export const CRIME_BADGE_MIN = 100;
export const SICKNESS_BADGE_MIN = 140;

/**
 * A lot's commute is "long" when its accessibility (255 = next door, 0 = at
 * or past the commute limit) is at or below this: a trip of 60% of the limit
 * or more, the same point at which commuteRoute's tripGrade turns red.
 */
export const LONG_COMMUTE_ACCESS = 102;

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

/** A zoned lot in use (not abandoned) that power / water does not reach. Empty lots count: they cannot grow. */
export function powerProblem(world: World, i: number): boolean {
  const L = world.layers;
  return L.power[i] === 0 && L.zone[i] !== ZONE_NONE && L.building[i] === BUILDING_NONE && L.abandoned[i] === 0;
}
export function waterProblem(world: World, i: number): boolean {
  const L = world.layers;
  return L.water[i] === 0 && L.zone[i] !== ZONE_NONE && L.building[i] === BUILDING_NONE && L.abandoned[i] === 0;
}
/** A developed lot whose trip (homes: to shops or jobs; businesses: to homes) is near the limit. */
export function commuteProblem(world: World, i: number): boolean {
  const L = world.layers, a = L.accessibility[i];
  return a > 0 && a <= LONG_COMMUTE_ACCESS && world.traffic !== null && L.zone[i] !== ZONE_NONE && L.devLevel[i] > 0 && L.abandoned[i] === 0;
}
/** A developed lot with nothing in reach at all. Unknown (false) until the first traffic pass. */
export function cutOffProblem(world: World, i: number): boolean {
  const L = world.layers;
  return L.accessibility[i] === 0 && world.traffic !== null && L.zone[i] !== ZONE_NONE && L.devLevel[i] > 0 && L.abandoned[i] === 0;
}

/** A zoned lot in use with no street or avenue beside it (highways give no access): it cannot grow. */
export function roadProblem(world: World, i: number): boolean {
  const L = world.layers;
  if (L.zone[i] === ZONE_NONE || L.building[i] !== BUILDING_NONE || L.abandoned[i] !== 0) return false;
  const { width, height } = world.grid, road = L.roadClass, x = i % width;
  const ok = (j: number): boolean => road[j] !== ROAD_NONE && road[j] !== ROAD_HIGHWAY;
  return !((x > 0 && ok(i - 1)) || (x < width - 1 && ok(i + 1)) || (i >= width && ok(i - width)) || (i < width * (height - 1) && ok(i + width)));
}

const TESTS: readonly ((world: World, i: number) => boolean)[] = [crimeProblem, healthProblem, powerProblem, waterProblem, commuteProblem, cutOffProblem, roadProblem];
/** With no road, missing power or water and an impossible commute are symptoms: only the road is reported. */
const ROAD_BIT = 1 << 6, HIDDEN_BY_ROAD = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5);

/** The lot's problems as bits, bit k for PROBLEM_KINDS[k]. */
export function lotProblemMask(world: World, i: number): number {
  let m = 0;
  for (let b = 0; b < TESTS.length; b++) if (TESTS[b](world, i)) m |= 1 << b;
  return m & ROAD_BIT ? m & ~HIDDEN_BY_ROAD : m;
}

/** Every problem the lot at `i` has, in PROBLEM_KINDS order. */
export function lotProblems(world: World, i: number): ProblemKind[] {
  const out: ProblemKind[] = [], m = lotProblemMask(world, i);
  for (let k = 0; k < TESTS.length; k++) if (m & (1 << k)) out.push(PROBLEM_KINDS[k]);
  return out;
}

/** Lots this far apart (in tiles, either axis) still belong to one district, so a road does not split it. */
const REACH = 2;
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
    const m = lotProblemMask(world, i);
    marks[i] = m;
    any |= m;
  }
  const out: ProblemCluster[] = [];
  for (let b = 0; b < TESTS.length; b++) {
    const bit = 1 << b;
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
      out.push({ kind: PROBLEM_KINDS[b], x: sumX / count + 0.5, y: sumY / count + 0.5, count });
    }
  }
  // Every bit set above was cleared by a flood, so `marks` is all zero again.
  return out;
}

/** Pin radius in screen pixels for a district of `count` lots. */
export function pinRadius(count: number): number {
  return Math.min(26, 8 + Math.sqrt(count) * 1.7);
}

export const PROBLEM_COLOUR: Record<BadgeKind, string> = {
  crime: '#d8453a', health: '#1fa894', power: '#d99a1c', water: '#3d8fe0', commute: '#8a63d2', cutoff: '#8a63d2', road: '#9a6b3f', death: '#6b6f78',
};
const BOLT: readonly (readonly [number, number])[] = [[0.05, -0.6], [-0.36, 0.1], [-0.04, 0.1], [-0.14, 0.6], [0.36, -0.12], [0.05, -0.12], [0.24, -0.6]];

/**
 * A round clay badge centred on (x, y): a shield with "!" for crime, a cross
 * for health, a bolt for no power, a drop for no water, a clock for a long
 * commute, a bar for cut off, a road for no road access, a headstone for a recent death. `count` above 1
 * adds a number tab.
 */
export function drawProblemBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: BadgeKind, count = 1): void {
  const colour = PROBLEM_COLOUR[kind];
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
  } else if (kind === 'power') {
    ctx.beginPath();
    for (let n = 0; n < BOLT.length; n++) {
      if (n) ctx.lineTo(x + BOLT[n][0] * r, y + BOLT[n][1] * r); else ctx.moveTo(x + BOLT[n][0] * r, y + BOLT[n][1] * r);
    }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'water') {
    ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.62); ctx.lineTo(x + r * 0.33, y + r * 0.06); ctx.lineTo(x - r * 0.33, y + r * 0.06); ctx.closePath(); ctx.fill();
  } else if (kind === 'commute') {
    ctx.beginPath(); ctx.arc(x, y, r * 0.54, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1.2, r * 0.13); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.34); ctx.lineTo(x, y); ctx.lineTo(x + r * 0.24, y + r * 0.14); ctx.stroke();
  } else if (kind === 'cutoff') {
    ctx.beginPath(); ctx.roundRect(x - r * 0.52, y - r * 0.15, r * 1.04, r * 0.3, r * 0.08); ctx.fill();
  } else if (kind === 'road') {
    // A road running away, with a dashed centre line.
    ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 0.55); ctx.lineTo(x + r * 0.2, y - r * 0.55); ctx.lineTo(x + r * 0.46, y + r * 0.55); ctx.lineTo(x - r * 0.46, y + r * 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = colour;
    ctx.fillRect(x - r * 0.05, y - r * 0.42, r * 0.1, r * 0.24);
    ctx.fillRect(x - r * 0.06, y - r * 0.02, r * 0.12, r * 0.3);
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
