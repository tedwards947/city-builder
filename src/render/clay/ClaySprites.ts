import { CLAY_SPRITE_DATA, type ClaySpriteMeta } from './claySpriteData';
import type { VibeState } from '../SpriteTypes';
import { GROUND_TONES, applyGroundTone } from './groundTones';
import { analyseLot, PLAN_SPACE, type LotGround, type LotZone } from './lotGround';
import { planLot, dressingSeed, TREE_NAMES, type TreeName } from './lotDressing';
import { drawDressingGround, drawDressingProps } from './lotDressingDraw';
import {
  ZONE_R, ZONE_C, ZONE_I,
  BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
  BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT,
} from '../../sim/constants';
import { RebakeBudget } from '../RebakeBudget';

/**
 * Clay-miniature image sprites (public/sprites/clay), made by art/clay-set/cutout.mjs.
 *
 * Every sprite shows a building on a square plot seen from a high three-quarter
 * angle. The plot maps onto one tile; the building may rise above it and
 * overlap the tile behind, so tiles must be drawn back (top) to front (bottom).
 *
 * Zone sprites are "dressed": each lot draws one of CLAY_DRESSING_COUNT
 * variants of its sprite with landscaping baked in (ground tone, lawn stripes,
 * a hedge, trees… see lotDressing.ts). A variant is painted once, the first
 * time a lot asks for it, into its own canvas; after that drawing a tile is
 * still a single drawImage of a pre-scaled copy.
 */

export type ClayVibe = '' | 'green' | 'gritty' | 'communal' | 'wealthy';

/** The plot is drawn a little shorter than it is wide (camera tilt). */
const PLOT_ASPECT = 0.905;
/** A vibe axis must lean at least this far (of -1..1) before a variant is used. */
const VIBE_THRESHOLD = 0.25;

const ZONE_PREFIX: Record<number, string> = { [ZONE_R]: 'res', [ZONE_C]: 'com', [ZONE_I]: 'ind' };
const BUILDING_ID: Record<number, string> = {
  [BUILDING_POWER_PLANT]: 'power',
  [BUILDING_WATER_TOWER]: 'water',
  [BUILDING_SEWAGE_PLANT]: 'sewage',
  [BUILDING_POLICE]: 'police',
  [BUILDING_FIRE]: 'fire',
  [BUILDING_SCHOOL]: 'school',
  [BUILDING_HOSPITAL]: 'hospital',
  [BUILDING_PARK]: 'park',
};

/** `wisp` is the small pale chimney smoke of a home or workshop. */
export type EmitterKind = 'smoke' | 'steam' | 'flare' | 'wisp';
interface Emitter { kind: EmitterKind; x: number; y: number }

/**
 * Where smoke, steam and flares come out, in 256px sprite coordinates (the
 * review sprites in art/clay-set/sprites). Vibe variants share their base
 * sprite's emitters unless they have an entry of their own.
 */
const EMITTERS: Record<string, Emitter[]> = {
  'ind-1-gritty': [{ kind: 'smoke', x: 159, y: 62 }],
  'ind-2': [{ kind: 'smoke', x: 118, y: 31 }, { kind: 'smoke', x: 148, y: 29 }],
  'ind-3': [{ kind: 'smoke', x: 112, y: 14 }, { kind: 'flare', x: 146, y: 13 }, { kind: 'smoke', x: 177, y: 14 }],
  'power': [{ kind: 'smoke', x: 77, y: 49 }, { kind: 'steam', x: 185, y: 66 }],
  'power-large': [{ kind: 'smoke', x: 59, y: 30 }, { kind: 'steam', x: 198, y: 50 }],
  'res-1-b': [{ kind: 'wisp', x: 155, y: 69 }],
  'res-2-b': [{ kind: 'wisp', x: 128, y: 56 }],
  'ind-1-d': [{ kind: 'wisp', x: 155, y: 58 }],
  'ind-2-b': [{ kind: 'smoke', x: 115, y: 23 }],
  'ind-2-c': [{ kind: 'smoke', x: 88, y: 26 }],
  'ind-3-b': [{ kind: 'flare', x: 197, y: 12 }],
  'ind-3-c': [{ kind: 'smoke', x: 130, y: 17 }, { kind: 'smoke', x: 175, y: 17 }],
  'ind-3-d': [{ kind: 'smoke', x: 187, y: 26 }],
};
const EMITTER_SPACE = 256;

/** How a neighbourhood's vibe changes the smoke: [light, shade, size, puff count]. */
const SMOKE_LOOK: Record<ClayVibe, [string, string, number, number]> = {
  '':       ['#a4a8ae', '#84888f', 1.0, 5],
  green:    ['#e4e8ea', '#c9cfd3', 0.6, 3],
  gritty:   ['#5d5f65', '#3f4146', 1.35, 7],
  communal: ['#a4a8ae', '#84888f', 0.9, 4],
  wealthy:  ['#c3c7cb', '#a3a8ad', 0.7, 3],
};

export interface ClaySprite {
  readonly id: string;
  readonly vibe: ClayVibe;
  readonly meta: ClaySpriteMeta;
  readonly image: HTMLImageElement;
  readonly emitters: Emitter[] | undefined;
  /** Zone sprites can be dressed; civic buildings (null) are drawn as painted. */
  readonly zone: LotZone | null;
  readonly level: number;
  /** Original pixels and ground analysis, read the first time a dressed variant is needed. */
  pixels: ImageData | null;
  lot: LotGround | null;
  prepared: boolean;
  /** Per dressing variant: the baked source and a copy pre-scaled for the current tile size. Slot 0 starts as the plain image. */
  readonly slots: (DressSlot | undefined)[];
  /** Where the plot sits in the pre-scaled copies. */
}

interface DressSlot {
  source: CanvasImageSource | null;
  scaled: HTMLCanvasElement | null;
  scaledFor: number;
  /** Baked with the dressing (false: still the plain image). */
  dressed: boolean;
  /** Set when the plan has trees that had not loaded at bake time: the tree epoch it was baked at. */
  waitingForTrees: number;
  /** For a look (lights out): the source it was washed from, to redo it when that changes. */
  from?: CanvasImageSource | null;
}

/** How a lot without services looks: bit 1 = no power (dark, grey, as if the lights are out). */
export const LOOK_NO_POWER = 1;

/** How many dressing variants each zone sprite has. */
export const CLAY_DRESSING_COUNT = 6;

/** Tree cut-outs (public/sprites/clay/props), the only image props lot dressing uses. */
const trees: Partial<Record<TreeName, HTMLImageElement>> = {};
/** Bumped whenever another tree image arrives, so variants baked without it are redone. */
let treeEpoch = 1;

export interface ClayEffect {
  kind: EmitterKind;
  x: number;
  y: number;
  /** Screen pixels per 256px-sprite pixel. */
  u: number;
  seed: number;
  vibe: ClayVibe;
}

const sprites = new Map<string, ClaySprite>();
/**
 * Zone sprites grouped by `${zone}-${level}|${vibe}`. A group holds every design
 * for that slot: `res-1`, `res-1-b`, `res-1-c`… (and `res-1-b-green` etc.).
 */
const groups = new Map<string, ClaySprite[]>();
const ZONE_ID = /^((?:res|com|ind)-\d)(?:-[a-z])?(?:-(green|gritty|communal|wealthy))?$/;
let loadStarted = false;
let onLoaded: (() => void) | null = null;

/** Called whenever another sprite finishes loading (so the view can redraw). */
export function setClayLoadListener(fn: (() => void) | null): void { onLoaded = fn; }

/** Starts loading every sprite. Safe to call repeatedly; does nothing outside a browser. */
export function loadClaySprites(): void {
  if (loadStarted || typeof Image === 'undefined') return;
  loadStarted = true;
  const base = import.meta.env.BASE_URL;
  for (const name of TREE_NAMES) {
    const image = new Image();
    image.onload = () => { trees[name] = image; treeEpoch++; onLoaded?.(); };
    image.src = `${base}sprites/clay/props/${name}.png`;
  }
  for (const id of Object.keys(CLAY_SPRITE_DATA)) {
    const image = new Image();
    image.onload = () => {
      sprites.set(id, {
        id,
        vibe: (id.match(/-(green|gritty|communal|wealthy)$/)?.[1] ?? '') as ClayVibe,
        meta: CLAY_SPRITE_DATA[id],
        image,
        emitters: EMITTERS[id] ?? EMITTERS[id.replace(/-(green|gritty|communal|wealthy)$/, '')],
        zone: ZONE_ID.test(id) ? id.slice(0, 3) as LotZone : null,
        level: Number(id[4]) || 1,
        pixels: null, lot: null, prepared: false,
        slots: [{ source: image, scaled: null, scaledFor: -1, dressed: false, waitingForTrees: 0 }],
      });
      const z = ZONE_ID.exec(id);
      if (z) {
        const key = `${z[1]}|${z[2] ?? ''}`;
        const list = groups.get(key) ?? [];
        list.push(sprites.get(id)!);
        // Keep a stable order so a lot keeps its design however the images arrive.
        list.sort((a, b) => (a.id < b.id ? -1 : 1));
        groups.set(key, list);
      }
      onLoaded?.();
    };
    image.src = `${base}sprites/clay/${id}.png`;
  }
}

/** Which variant a tile's local vibe calls for: the axis that leans furthest wins. */
export function clayVibeFor(vibe: VibeState): ClayVibe {
  const g = vibe.green, e = vibe.egalitarian;
  if (Math.abs(g) < VIBE_THRESHOLD && Math.abs(e) < VIBE_THRESHOLD) return '';
  if (Math.abs(g) >= Math.abs(e)) return g > 0 ? 'green' : 'gritty';
  return e > 0 ? 'communal' : 'wealthy';
}

/**
 * The sprite for a tile (`lotId` picks among the designs for that slot), or undefined if there is none (empty zone, unknown
 * building) or it has not loaded yet; the chunk layer's flat drawing then
 * shows instead.
 */
export function pickClaySprite(zone: number, building: number, dev: number, vibe: VibeState, abandoned: boolean, lotId = 0): ClaySprite | undefined {
  if (sprites.size === 0) return undefined;
  if (building !== BUILDING_NONE) return sprites.get(BUILDING_ID[building]);
  const prefix = ZONE_PREFIX[zone];
  if (!prefix || dev < 1) return undefined;
  const base = `${prefix}-${Math.min(3, dev)}`;
  // An abandoned building always looks run down.
  const v = abandoned ? 'gritty' : clayVibeFor(vibe);
  const list = (v && groups.get(`${base}|${v}`)) || groups.get(`${base}|`);
  return list && list[lotId % list.length];
}

/** Sprites for buildings on several tiles: the plot covers the whole (square) footprint. */
const BIG_ID: Record<number, string> = {
  [BUILDING_LARGE_POWER_PLANT]: 'power-large',
  [BUILDING_LARGE_WATER_PLANT]: 'pump-large',
  [BUILDING_LARGE_SEWAGE_PLANT]: 'sewage-large',
};

/** The sprite for a building on several tiles, or undefined if it has none or it has not loaded. Draw it with `tile` = the footprint's side. */
export function bigClaySprite(kind: number): ClaySprite | undefined {
  const id = BIG_ID[kind];
  return id ? sprites.get(id) : undefined;
}

/**
 * Draws the sprite so its plot fills the tile whose top-left corner is (sx, sy)
 * and whose side is `tile` pixels. `variant` (any non-negative integer, e.g.
 * spare bits of the lot's id) picks which dressing the lot gets; `look` (LOOK_*
 * bits) shows it without power.
 */
export function drawClaySprite(ctx: CanvasRenderingContext2D, s: ClaySprite, sx: number, sy: number, tile: number, variant = 0, look = 0): void {
  const slot = look ? lookSlot(s, variant, look) : dressSlot(s, variant);
  const m = s.meta;
  const plotW = m.right - m.left + 1;
  const plotH = plotW * PLOT_ASPECT;
  const kx = tile / plotW;
  const ky = tile / plotH; // stretch slightly so the plot fills the square tile

  if (slot.scaledFor !== tile) {
    // A caller that does not use beginClayFrame (or draws at another size)
    // gets a crisp copy at once, as before. Inside a frame, wait until the
    // size has settled and there is budget left.
    if (rebake.allow(tile)) rescale(s, slot, tile);
  }

  if (slot.scaledFor === tile) {
    if (slot.scaled) ctx.drawImage(slot.scaled, sx - Math.round(m.left * kx), sy - Math.round((m.bottom + 1 - plotH) * ky));
    return;
  }
  // Mid-zoom (or over this frame's budget): stretch what we have to the new
  // size. One plain drawImage, slightly soft, replaced by a crisp copy once
  // the zoom stops.
  const image = slot.scaled ?? slot.source;
  if (!image) return;
  if (!ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, sx - m.left * kx, sy - (m.bottom + 1 - plotH) * ky, m.w * kx, m.h * ky);
}

// ── Zoom smoothing ────────────────────────────────────────────────────────────
// Every change of tile size used to re-bake a scaled copy of every visible
// sprite and dressing variant in that one frame — hundreds of small canvases
// per wheel step. Now the renderer calls beginClayFrame() once per frame;
// while the size is changing, sprites are drawn stretched, and crisp copies
// are baked a few per frame once it has held still for a moment.

/** Crisp copies are baked 32 per frame once the tile size has held still (see RebakeBudget.ts). */
const rebake = new RebakeBudget(32);

/**
 * Call once per frame before drawing sprites, with the tile size they will be
 * drawn at and the frame's time in ms.
 */
export function beginClayFrame(tile: number, now: number): void {
  rebake.begin(tile, now);
}

/** Reads the sprite's pixels and analyses its ground, once. Leaves `lot` null if that is not possible. */
function prepareLot(s: ClaySprite): void {
  s.prepared = true;
  if (!s.zone) return;
  try {
    const m = s.meta;
    const canvas = document.createElement('canvas');
    canvas.width = m.w; canvas.height = m.h;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    if (!c) return;
    c.drawImage(s.image, 0, 0);
    const pixels = c.getImageData(0, 0, m.w, m.h);
    s.lot = analyseLot(pixels.data, m.w, m.h, m, s.zone, s.level);
    if (s.lot) s.pixels = pixels;
  } catch {
    // Pixels unreadable (e.g. opened from disk): the sprite stays as painted.
    s.lot = null;
  }
}

/** The slot for a dressing variant, baking it the first time it is asked for. */
function dressSlot(s: ClaySprite, variant: number): DressSlot {
  const plain = s.slots[0]!;
  if (!s.zone) return plain;
  if (!s.prepared) prepareLot(s);
  if (!s.lot || !s.pixels) return plain;
  const v = variant % CLAY_DRESSING_COUNT;
  let slot = s.slots[v];
  if (slot && slot.dressed && !(slot.waitingForTrees && slot.waitingForTrees !== treeEpoch)) return slot;
  try {
    const baked = bakeDressing(s, s.lot, s.pixels, v);
    if (!baked) return slot ?? plain;
    if (!slot || !slot.dressed) slot = s.slots[v] = { source: null, scaled: null, scaledFor: -1, dressed: true, waitingForTrees: 0 };
    slot.source = baked.canvas;
    slot.scaledFor = -1; // re-scale from the new source
    slot.waitingForTrees = baked.missingTrees ? treeEpoch : 0;
    return slot;
  } catch {
    return slot ?? plain;
  }
}

/**
 * The slot for a dressing variant shown without power: the
 * dressed sprite with a colour wash, kept beside the normal slots.
 */
function lookSlot(s: ClaySprite, variant: number, look: number): DressSlot {
  const base = dressSlot(s, variant);
  if (!base.source) return base;
  const at = CLAY_DRESSING_COUNT * (look & 3) + (s.zone ? variant % CLAY_DRESSING_COUNT : 0);
  let slot = s.slots[at];
  if (slot && slot.from === base.source) return slot;
  const { w, h } = s.meta;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) return base;
  c.drawImage(base.source, 0, 0, w, h);
  const wash = (op: GlobalCompositeOperation, colour: string, alpha: number): void => {
    c.globalCompositeOperation = op; c.globalAlpha = alpha; c.fillStyle = colour; c.fillRect(0, 0, w, h);
  };
  if (look & LOOK_NO_POWER) { wash('saturation', '#808080', 0.8); wash('multiply', '#4a4f66', 0.8); }
  // The washes filled the whole canvas: cut it back to the sprite's shape.
  c.globalCompositeOperation = 'destination-in'; c.globalAlpha = 1;
  c.drawImage(base.source, 0, 0, w, h);
  if (!slot) slot = s.slots[at] = { source: null, scaled: null, scaledFor: -1, dressed: true, waitingForTrees: 0 };
  slot.source = canvas;
  slot.from = base.source;
  slot.scaledFor = -1;
  return slot;
}

/** Shared scratch canvases for baking (one variant is baked at a time). */
let scratch: { layer: HTMLCanvasElement; mask: HTMLCanvasElement; shade: HTMLCanvasElement } | null = null;

/**
 * Paints one dressing variant of a sprite at the sprite's own size: the sprite
 * with its ground toned, then the flat ground things (clipped to bare ground
 * and darkened by the building's shadow), then the standing props.
 */
function bakeDressing(s: ClaySprite, lot: LotGround, pixels: ImageData, v: number): { canvas: HTMLCanvasElement; missingTrees: boolean } | null {
  const { w, h } = s.meta;
  // Run-down (gritty) lots get no garden, only a ground tone.
  const plan = planLot(lot.field, dressingSeed(s.id, v), s.vibe === 'gritty');
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) return null;
  const tones = GROUND_TONES[lot.field.zone];
  const out = c.createImageData(w, h);
  out.data.set(applyGroundTone(pixels.data, lot.ground, tones[plan.tone % tones.length]));
  c.putImageData(out, 0, 0);
  let missingTrees = false;
  for (const p of plan.props) if (p.k === 'tree' && !trees[p.name]) missingTrees = true;
  if (!plan.ground.length && !plan.props.length) return { canvas, missingTrees };

  if (!scratch) scratch = { layer: document.createElement('canvas'), mask: document.createElement('canvas'), shade: document.createElement('canvas') };
  const { layer, mask, shade } = scratch;
  for (const k of [layer, mask, shade]) if (k.width !== w || k.height !== h) { k.width = w; k.height = h; }
  const lc = layer.getContext('2d'), mc = mask.getContext('2d'), sc = shade.getContext('2d');
  if (!lc || !mc || !sc) return { canvas, missingTrees };
  // The ground coverage and shadow strength as alpha images.
  const mi = mc.createImageData(w, h), si = sc.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { mi.data[i * 4 + 3] = lot.alpha[i]; si.data[i * 4 + 3] = lot.shade[i]; }
  mc.putImageData(mi, 0, 0);
  sc.putImageData(si, 0, 0);

  const k = w / PLAN_SPACE;
  const paint = (draw: (lc: CanvasRenderingContext2D) => void, clip: boolean): void => {
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, w, h);
    lc.setTransform(k, 0, 0, k, 0, 0);
    draw(lc);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    if (clip) { lc.globalCompositeOperation = 'destination-in'; lc.drawImage(mask, 0, 0); }
    lc.globalCompositeOperation = 'source-atop';
    lc.drawImage(shade, 0, 0);
    c.drawImage(layer, 0, 0);
  };
  if (plan.ground.length) paint((x) => drawDressingGround(x, lot.field, plan.ground), true);
  if (plan.props.length) paint((x) => drawDressingProps(x, plan.props, trees), false);
  return { canvas, missingTrees };
}

function rescale(s: ClaySprite, slot: DressSlot, tile: number): void {
  const m = s.meta;
  const plotW = m.right - m.left + 1;
  const plotH = plotW * PLOT_ASPECT;
  const kx = tile / plotW;
  const ky = tile / plotH; // stretch slightly so the plot fills the square tile
  const w = Math.max(1, Math.ceil(m.w * kx));
  const h = Math.max(1, Math.ceil(m.h * ky));
  const canvas = slot.scaled ?? document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  slot.scaledFor = tile;
  if (!c || !slot.source) { slot.scaled = null; return; }
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.clearRect(0, 0, w, h);
  c.drawImage(slot.source, 0, 0, m.w * kx, m.h * ky);
  slot.scaled = canvas;
}

/** Adds the sprite's smoke/steam/flare emitters, positioned on screen, to `out`. */
export function collectClayEffects(s: ClaySprite, sx: number, sy: number, tile: number, tileIndex: number, out: ClayEffect[], puffScale = 1): void {
  if (!s.emitters) return;
  const m = s.meta;
  const plotW = m.right - m.left + 1;
  const toSprite = m.w / EMITTER_SPACE;
  const kx = tile / plotW;
  const ky = tile / (plotW * PLOT_ASPECT);
  const top = m.bottom + 1 - plotW * PLOT_ASPECT;
  for (let k = 0; k < s.emitters.length; k++) {
    const e = s.emitters[k];
    out.push({
      kind: e.kind,
      x: sx + (e.x * toSprite - m.left) * kx,
      y: sy + (e.y * toSprite - top) * ky,
      u: kx * toSprite * puffScale,
      seed: hash(tileIndex, k + 1),
      vibe: s.vibe,
    });
  }
}

/** Draws collected effects. `t` is seconds; it is stepped to 10 fps for a stop-motion feel. */
export function drawClayEffects(ctx: CanvasRenderingContext2D, effects: ClayEffect[], t: number): void {
  const ts = Math.floor(t * 10) / 10;
  for (const fx of effects) {
    if (fx.kind === 'flare') drawFlare(ctx, fx.x, fx.y, fx.u, ts, fx.seed);
    else if (fx.kind === 'steam') drawPlume(ctx, fx.x, fx.y, fx.u, ts, fx.seed, '#ffffff', '#dfe5ea', 1.5, 5, 60, 5.5);
    else if (fx.kind === 'wisp') drawPlume(ctx, fx.x, fx.y, fx.u, ts, fx.seed, '#eef0f2', '#d2d7dc', 0.5, 3, 42, 3.6);
    else {
      const [light, shade, size, count] = SMOKE_LOOK[fx.vibe];
      drawPlume(ctx, fx.x, fx.y, fx.u, ts, fx.seed, light, shade, size, count, 70, 4.5);
    }
  }
}

function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** One clay puff: a flat blob with a darker underside, like a pressed ball of clay. */
function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, light: string, shade: string): void {
  if (r <= 0.3) return;
  ctx.fillStyle = shade;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.arc(x - r * 0.12, y - r * 0.16, r * 0.82, 0, Math.PI * 2); ctx.fill();
}

/**
 * Puffs are a pure function of time, so there is no particle state to keep:
 * each puff loops from the emitter upward, growing and then shrinking away.
 */
function drawPlume(
  ctx: CanvasRenderingContext2D, ox: number, oy: number, u: number, t: number, seed: number,
  light: string, shade: string, size: number, count: number, rise: number, life: number,
): void {
  for (let i = 0; i < count; i++) {
    const cycle = t / life + i / count + seed;
    const lap = Math.floor(cycle);
    const phase = cycle - lap;
    const sway = (hash(Math.floor(seed * 1000) + i, lap) - 0.5) * 2;
    const x = ox + (phase * phase * 14 + sway * 5 * phase) * u;
    const y = oy - phase * rise * u;
    const grow = 0.55 + phase * 1.1;
    const fade = 1 - Math.pow(phase, 3);
    puff(ctx, x, y, 7 * size * grow * fade * u, light, shade);
  }
}

/** A flame that changes shape every step, plus a thin dark plume above it. */
function drawFlare(ctx: CanvasRenderingContext2D, ox: number, oy: number, u: number, t: number, seed: number): void {
  const step = Math.floor(t * 12);
  const f = 0.75 + hash(Math.floor(seed * 7700), step) * 0.5;
  const lean = (hash(Math.floor(seed * 9100), step) - 0.5) * 5 * u;
  const h = 26 * f * u, w = 8 * u;
  const flame = (scale: number, colour: string): void => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(ox - w * scale, oy);
    ctx.quadraticCurveTo(ox - w * scale * 1.2, oy - h * scale * 0.55, ox + lean * scale, oy - h * scale);
    ctx.quadraticCurveTo(ox + w * scale * 1.2, oy - h * scale * 0.55, ox + w * scale, oy);
    ctx.closePath(); ctx.fill();
  };
  flame(1, '#f2762e'); flame(0.68, '#f9b233'); flame(0.36, '#fff0a8');
  drawPlume(ctx, ox + lean, oy - h, u, t, seed, '#5d5f65', '#3f4146', 0.55, 4, 44, 2.6);
}

/** One clay flame: three nested tongues, base centred on (ox, oy). */
function flameTongue(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, lean: number): void {
  const layer = (scale: number, colour: string): void => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(ox - w * scale, oy);
    ctx.quadraticCurveTo(ox - w * scale * 1.25, oy - h * scale * 0.55, ox + lean * scale, oy - h * scale);
    ctx.quadraticCurveTo(ox + w * scale * 1.25, oy - h * scale * 0.55, ox + w * scale, oy);
    ctx.closePath(); ctx.fill();
  };
  layer(1, '#e8542a'); layer(0.68, '#f9a633'); layer(0.36, '#fff0a8');
}

/**
 * A building on fire: a warm glow on the plot, a handful of clay flames that
 * re-pose every step, and dark smoke above. (x, y) is the tile's top-left
 * corner, `strength` 0..1 is how fiercely it burns. Time-pure, like the smoke.
 */
export function drawClayFire(ctx: CanvasRenderingContext2D, x: number, y: number, tile: number, t: number, seed: number, strength: number): void {
  const ts = Math.floor(t * 10) / 10;
  const step = Math.floor(ts * 8);
  const s = Math.floor(seed * 9973);
  const power = 0.55 + 0.45 * Math.min(1, Math.max(0, strength));

  ctx.fillStyle = `rgba(255,110,30,${(0.16 + 0.1 * hash(s, step)).toFixed(3)})`;
  ctx.fillRect(x, y, tile, tile);

  // Fewer flames on small tiles; fixed spots per lot, drawn back to front.
  const count = tile >= 40 ? 5 : tile >= 20 ? 3 : 2;
  for (let k = 0; k < count; k++) {
    const fx = x + tile * (0.18 + 0.64 * ((k + 0.5) / count) + (hash(s + k, 7) - 0.5) * 0.12);
    const fy = y + tile * (0.5 + 0.42 * (k % 2 ? 0.25 : 0.85) + (hash(s + k, 11) - 0.5) * 0.1);
    const flick = 0.7 + 0.6 * hash(s + k * 31, step);
    const h = tile * 0.46 * power * flick;
    const lean = (hash(s + k * 17, step) - 0.5) * tile * 0.14;
    flameTongue(ctx, fx, Math.min(fy, y + tile - 1), tile * 0.1 * power, h, lean);
  }
  if (tile >= 12) drawPlume(ctx, x + tile * 0.5, y + tile * 0.25, tile / 200, ts, seed, '#55565c', '#38393e', 1.5, 6, 85, 3.2);
}

/**
 * A lot that has just burned: soot over the plot and thin smoke, fading out
 * as `fade` goes from 1 to 0.
 */
export function drawClaySmolder(ctx: CanvasRenderingContext2D, x: number, y: number, tile: number, t: number, seed: number, fade: number): void {
  const f = Math.min(1, Math.max(0, fade));
  if (f <= 0) return;
  ctx.fillStyle = `rgba(22,14,10,${(0.5 * f).toFixed(3)})`;
  ctx.fillRect(x, y, tile, tile);
  if (tile >= 12 && f > 0.15) {
    const ts = Math.floor(t * 10) / 10;
    const size = 0.5 + 0.6 * f;
    drawPlume(ctx, x + tile * 0.38, y + tile * 0.45, tile / 200, ts, seed, '#77787e', '#55565c', size, 3, 60, 4.2);
    drawPlume(ctx, x + tile * 0.66, y + tile * 0.6, tile / 200, ts, seed + 0.37, '#77787e', '#55565c', size * 0.8, 3, 50, 5);
  }
}
