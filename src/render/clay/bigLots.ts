/**
 * Merged 2×2 lots (BIG_LOTS_DESIGN.md, sim/lots.ts): the building drawn once over the four tiles.
 *
 * Until the clay art exists these are code-drawn massing models in the clay
 * look, at the scale in docs/SCALE.md: 1 tile = 17 m, a 3 m floor = 0.12 tile
 * of screen height. The owner's picks (round 1): towers only on 2×2, at true
 * height, 26 floors at most and varied below that; some 2×2 buildings are low
 * (a shopping mall, a courtyard block, a factory).
 *
 * `planBigLot` is pure (tested in src/__tests__/bigLots.test.ts): zone and the
 * anchor's visualVariant → what stands there. `drawBigLot` paints it from a
 * baked canvas per look and tile size, like the other clay pictures.
 */
import { ZONE_R, ZONE_C, ZONE_I } from '../../sim/constants';
import { RebakeBudget } from '../RebakeBudget';
import { lotClaySprite, drawClaySprite } from './ClaySprites';

/** Screen height of one 3 m floor, in tiles (docs/SCALE.md). */
export const FLOOR_TILES = 0.12;
/** The tallest tower, in floors (owner, 2026-11-20: 26). */
export const MAX_FLOORS = 26;
/** The most a merged lot's building reaches above its back edge, in tiles (the tallest tower). */
export const MAX_LOT_RISE = MAX_FLOORS * 0.12 + 0.2;
/** With "Low buildings" on, nothing stands taller than this. */
export const LOW_VIEW_FLOORS = 3;

export type BigLotForm = 'tower' | 'slab' | 'courtyard' | 'mall' | 'works';

export interface BigLotPlan {
  form: BigLotForm;
  /** Main body: footprint in tiles from the lot's top-left corner (0–2), and floors. */
  x: number; y: number; w: number; d: number; floors: number;
  /** A low podium or wing in front of the body (towers, malls), or null. */
  podium: { x: number; y: number; w: number; d: number; floors: number } | null;
  palette: number;
  /** The clay sprite for it (public/sprites/clay/lots/<art>.png); the massing above shows until it loads. */
  art: string;
}

/**
 * The clay art (art/clay-set/raw-lots), with the floors each was drawn at.
 * Towers by zone, then the low buildings. Industry builds low works only.
 */
const ART: Record<number, { tall: readonly (readonly [string, number])[]; low: readonly (readonly [string, number])[] }> = {
  [ZONE_R]: { tall: [['r-tower-a', 26], ['r-tower-b', 20], ['r-tower-c', 15], ['r-tower-d', 11]], low: [['r-court-a', 5], ['r-slab-a', 7]] },
  [ZONE_C]: { tall: [['c-tower-a', 26], ['c-tower-b', 18], ['c-tower-c', 13], ['c-tower-d', 22], ['c-tower-e', 16], ['c-tower-f', 9], ['c-tower-g', 20]], low: [['c-mall-a', 2], ['c-mall-b', 3]] },
  [ZONE_I]: { tall: [], low: [['i-works-a', 3], ['i-works-b', 2], ['i-works-c', 4]] },
};

/** Share of merged lots that grow a tower, by zone. Industry builds low works. */
const TALL_SHARE: Record<number, number> = { [ZONE_R]: 0.6, [ZONE_C]: 0.6, [ZONE_I]: 0 };

const hash = (v: number, k: number): number => {
  let h = Math.imul(v + 1, 2654435761) ^ Math.imul(k + 7, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** What stands on a merged lot of `zone` whose anchor has `variant`. */
export function planBigLot(zone: number, variant: number): BigLotPlan {
  const tall = hash(variant, 1) < (TALL_SHARE[zone] ?? 0);
  const palette = Math.floor(hash(variant, 2) * 3);
  const art = ART[zone] ?? ART[ZONE_R];
  if (tall) {
    const [name, floors] = art.tall[Math.floor(hash(variant, 3) * art.tall.length)];
    const w = 1.0 + hash(variant, 4) * 0.4, d = 0.8 + hash(variant, 5) * 0.3;
    return {
      form: 'tower', floors, palette, art: name,
      x: 1 - w / 2, y: 0.5, w, d,
      podium: zone === ZONE_C || hash(variant, 6) < 0.5 ? { x: 0.15, y: 1.25, w: 1.7, d: 0.5, floors: zone === ZONE_C ? 2 : 1 } : null,
    };
  }
  if (zone === ZONE_I) {
    const [name, floors] = art.low[Math.floor(hash(variant, 9) * art.low.length)];
    return { form: 'works', x: 0.15, y: 0.35, w: 1.7, d: 1.25, floors, podium: { x: 0.2, y: 1.6, w: 0.7, d: 0.25, floors: 1 }, palette, art: name };
  }
  if (zone === ZONE_C) {
    const [name, floors] = art.low[Math.floor(hash(variant, 9) * art.low.length)];
    return { form: 'mall', x: 0.12, y: 0.3, w: 1.76, d: 1.35, floors, podium: { x: 0.7, y: 1.65, w: 0.6, d: 0.15, floors: 1 }, palette, art: name };
  }
  // Homes: a perimeter block round a garden, or a long slab.
  return hash(variant, 7) < 0.6
    ? { form: 'courtyard', x: 0.15, y: 0.25, w: 1.7, d: 1.5, floors: 5, podium: null, palette, art: 'r-court-a' }
    : { form: 'slab', x: 0.15, y: 0.6, w: 1.7, d: 0.65, floors: 7, podium: null, palette, art: 'r-slab-a' };
}

/** How far the building rises above the lot's back edge, in tiles (for hover-to-hide and off-screen drawing). */
export function bigLotRise(plan: BigLotPlan, low: boolean): number {
  const floors = low ? Math.min(plan.floors, LOW_VIEW_FLOORS) : plan.floors;
  return Math.max(0, floors * FLOOR_TILES - plan.y);
}

// ── Drawing ─────────────────────────────────────────────────────────────────

interface Look { wall: string; dark: string; glass: string; roof: string; ground: string; lip: string }
const LOOKS: Record<number, Look[]> = {
  [ZONE_R]: [
    { wall: '#d8cfc0', dark: '#978e80', glass: '#4f7088', roof: '#b9b1a3', ground: '#6dbb58', lip: '#4f8f40' },
    { wall: '#c98f6c', dark: '#8d5d44', glass: '#4a6a80', roof: '#b4a596', ground: '#6dbb58', lip: '#4f8f40' },
    { wall: '#e5e1d6', dark: '#a39d90', glass: '#5b7f96', roof: '#c4bfb3', ground: '#6dbb58', lip: '#4f8f40' },
  ],
  [ZONE_C]: [
    { wall: '#bfc7cc', dark: '#7d878e', glass: '#3f6f8f', roof: '#a9b0b5', ground: '#cfcfd2', lip: '#9a9aa0' },
    { wall: '#d6cdb9', dark: '#958b77', glass: '#3b6680', roof: '#b8b0a0', ground: '#cfcfd2', lip: '#9a9aa0' },
    { wall: '#a9b4bb', dark: '#6b767d', glass: '#4b85a8', roof: '#98a2a8', ground: '#cfcfd2', lip: '#9a9aa0' },
  ],
  [ZONE_I]: [
    { wall: '#a9adb3', dark: '#6e7379', glass: '#5d7486', roof: '#8e949b', ground: '#c99a68', lip: '#9a6f45' },
    { wall: '#b98a6a', dark: '#7c5a44', glass: '#5d7486', roof: '#8f8a84', ground: '#c99a68', lip: '#9a6f45' },
    { wall: '#c2bfae', dark: '#83806f', glass: '#5d7486', roof: '#9d9a8b', ground: '#c99a68', lip: '#9a6f45' },
  ],
};

type Ctx = CanvasRenderingContext2D;
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number): void => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };

/** One box: shadow to the right, front face with floor bands and windows, roof. Units: pixels. */
function box(c: Ctx, X: number, Y: number, W: number, D: number, floors: number, T: number, L: Look, opt: { shopFront?: boolean; glassy?: boolean; sawtooth?: boolean; abandoned: boolean }): void {
  const fh = FLOOR_TILES * T, H = floors * fh;
  // Shadow on the ground, falling right (the clay sprites' light).
  const reach = Math.min(H * 0.55, 1.6 * T), lift = Math.min(H * 0.1, 0.3 * T);
  c.fillStyle = 'rgba(25,35,30,0.24)';
  c.beginPath(); c.moveTo(X + W, Y + D); c.lineTo(X + W + reach, Y + D - lift); c.lineTo(X + W + reach, Y - lift); c.lineTo(X + W, Y); c.closePath(); c.fill();
  // Front face.
  c.fillStyle = L.wall; c.fillRect(X, Y + D - H, W, H);
  const bays = Math.max(2, Math.round(W / (0.16 * T)));
  const bw = W / bays;
  for (let f = 0; f < floors; f++) {
    const fy = Y + D - (f + 1) * fh;
    if (f === 0 && opt.shopFront) {
      c.fillStyle = L.glass; c.fillRect(X + W * 0.04, fy + fh * 0.2, W * 0.92, fh * 0.7);
      c.fillStyle = L.dark; c.fillRect(X, fy, W, fh * 0.16);
      continue;
    }
    c.fillStyle = L.dark; c.fillRect(X, fy + fh * 0.9, W, Math.max(1, fh * 0.1));
    if (opt.glassy) { c.fillStyle = L.glass; c.fillRect(X + bw * 0.12, fy + fh * 0.18, W - bw * 0.24, fh * 0.6); continue; }
    c.fillStyle = L.glass;
    for (let b = 0; b < bays; b++) {
      if (opt.abandoned && ((b * 7 + f * 3) % 5 === 0)) continue;
      c.fillRect(X + b * bw + bw * 0.2, fy + fh * 0.24, bw * 0.6, fh * 0.48);
    }
  }
  // Roof: parapet, and on a works a sawtooth of north lights.
  c.fillStyle = L.roof; c.fillRect(X, Y - H, W, D);
  if (opt.sawtooth) {
    const teeth = Math.max(2, Math.round(D / (0.22 * T)));
    for (let k = 0; k < teeth; k++) {
      const ty = Y - H + (k + 0.15) * D / teeth;
      c.fillStyle = L.glass; c.fillRect(X + W * 0.04, ty, W * 0.92, D / teeth * 0.32);
      c.fillStyle = L.dark; c.fillRect(X + W * 0.04, ty + D / teeth * 0.32, W * 0.92, Math.max(1, D / teeth * 0.08));
    }
  } else {
    c.strokeStyle = L.wall; c.lineWidth = Math.max(1, T * 0.025);
    c.strokeRect(X + c.lineWidth / 2, Y - H + c.lineWidth / 2, W - c.lineWidth, D - c.lineWidth);
    c.fillStyle = L.dark; c.fillRect(X + W * 0.6, Y - H + D * 0.22, W * 0.2, D * 0.28);
  }
}

/** Paints `plan` with the lot's top-left corner at (0, `top`) of `c`. */
function paint(c: Ctx, zone: number, plan: BigLotPlan, T: number, top: number, low: boolean, abandoned: boolean): void {
  const L = (LOOKS[zone] ?? LOOKS[ZONE_R])[plan.palette % 3];
  const S = 2 * T, inset = 0.04 * T, lip = 0.05 * T;
  // The lot slab, like a clay sprite's plot.
  c.fillStyle = L.lip; rr(c, inset, top + inset + lip, S - 2 * inset, S - 2 * inset, 0.08 * T);
  c.fillStyle = L.ground; rr(c, inset, top + inset, S - 2 * inset, S - 2 * inset, 0.08 * T);
  const floors = (n: number) => (low ? Math.min(n, LOW_VIEW_FLOORS) : n);
  const px = (v: number) => v * T;
  const opt = { abandoned };
  if (plan.form === 'courtyard') {
    // A garden in the middle, then the back wing, side wings, front wing (back to front).
    const { x, y, w, d } = plan, wing = 0.4, f = floors(plan.floors);
    c.fillStyle = '#5fae4c'; rr(c, px(x + wing), top + px(y + wing), px(w - 2 * wing), px(d - 2 * wing), 0.04 * T);
    c.fillStyle = '#4f9a40'; rr(c, px(x + w / 2 - 0.12), top + px(y + d / 2 - 0.12), px(0.24), px(0.24), 0.12 * T);
    box(c, px(x), top + px(y), px(w), px(wing), f, T, L, opt);
    box(c, px(x), top + px(y + wing), px(wing), px(d - 2 * wing), f, T, L, opt);
    box(c, px(x + w - wing), top + px(y + wing), px(wing), px(d - 2 * wing), f, T, L, opt);
    box(c, px(x), top + px(y + d - wing), px(w), px(wing), f, T, L, opt);
    return;
  }
  const main = { glassy: zone === ZONE_C && plan.form === 'tower', sawtooth: plan.form === 'works', shopFront: plan.form === 'mall', abandoned };
  box(c, px(plan.x), top + px(plan.y), px(plan.w), px(plan.d), floors(plan.floors), T, L, main);
  if (plan.form === 'works') {
    // A chimney at the back corner (code smoke is not drawn on it yet).
    c.fillStyle = L.dark; const cw = 0.14 * T, ch = floors(6) * FLOOR_TILES * T;
    c.fillRect(px(plan.x + plan.w - 0.3), top + px(plan.y + 0.15) - ch, cw, ch);
    c.fillStyle = '#5a5e63'; c.fillRect(px(plan.x + plan.w - 0.3), top + px(plan.y + 0.15) - ch, cw, cw * 0.4);
  }
  if (plan.podium) {
    const p = plan.podium;
    box(c, px(p.x), top + px(p.y), px(p.w), px(p.d), floors(p.floors), T, L, { shopFront: zone !== ZONE_I, abandoned });
  }
  if (abandoned) { c.fillStyle = 'rgba(24,18,12,0.32)'; c.globalCompositeOperation = 'source-atop'; c.fillRect(0, 0, S, top + S + lip + inset); c.globalCompositeOperation = 'source-over'; }
}

interface Baked { canvas: HTMLCanvasElement; tile: number; top: number }
const baked = new Map<string, Baked>();
const rebake = new RebakeBudget(6);

/** Call once per frame before drawing merged lots. */
export function beginBigLotFrame(tile: number, now: number): void { rebake.begin(tile, now); }

function bake(zone: number, plan: BigLotPlan, T: number, low: boolean, abandoned: boolean): Baked {
  const rise = bigLotRise(plan, low) + 0.1;
  const top = Math.ceil(rise * T);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(2 * T + 1.7 * T); // room for the shadow
  canvas.height = top + Math.ceil(2.1 * T);
  const c = canvas.getContext('2d');
  if (c) paint(c, zone, plan, T, top, low, abandoned);
  return { canvas, tile: T, top };
}

/**
 * Draws the merged lot whose top-left corner is at (sx, sy) on screen, `T`
 * pixels a tile. `alpha` < 1 fades it (hover-to-hide); `low` caps its height.
 */
export function drawBigLot(ctx: Ctx, zone: number, variant: number, abandoned: boolean, sx: number, sy: number, T: number, alpha = 1, low = false): void {
  const plan = planBigLot(zone, variant);
  // The clay art, once loaded. With Low buildings on, a tower shows as its low massing instead.
  const clay = low && plan.form === 'tower' ? undefined : lotClaySprite(plan.art);
  if (clay) {
    if (alpha < 1) ctx.globalAlpha = alpha;
    drawClaySprite(ctx, clay, sx, sy, 2 * T);
    if (abandoned) { ctx.fillStyle = 'rgba(24,18,12,0.38)'; ctx.fillRect(sx, sy, 2 * T, 2 * T); }
    if (alpha < 1) ctx.globalAlpha = 1;
    return;
  }
  const key = `${zone}|${variant}|${low ? 1 : 0}|${abandoned ? 1 : 0}`;
  let b = baked.get(key);
  if (!b) { b = bake(zone, plan, T, low, abandoned); baked.set(key, b); if (baked.size > 400) baked.delete(baked.keys().next().value as string); }
  else if (b.tile !== T && rebake.allow(T)) { b = bake(zone, plan, T, low, abandoned); baked.set(key, b); }
  const k = T / b.tile;
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(b.canvas, Math.round(sx), Math.round(sy - b.top * k), b.canvas.width * k, b.canvas.height * k);
  if (alpha < 1) ctx.globalAlpha = 1;
}
