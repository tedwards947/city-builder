// Beach life near a beach park (owner's idea, LEISURE_DESIGN.md Q7): clay
// umbrellas, towels and the odd sandcastle on the free sand and shore tiles
// around each park (sim/leisure.ts beachTilesNear), plus one lifeguard tower.
// They come and go: each spot has its own cycle, so umbrellas pop up and fold
// away over a minute or so. Painted props from art/clay-set/raw-leisure, cut by
// art/clay-set/port-sheet.mjs (… leisure) at 128 px a tile.

import type { World } from '../../sim/World';
import { BUILDING_BEACH_PARK } from '../../sim/constants';
import { beachTilesNear } from '../../sim/leisure';
import { LEISURE_SPRITES } from './leisureSpriteData';

const imgs: Record<string, HTMLImageElement> = {};
let started = false;
function load(): void {
  if (started || typeof Image === 'undefined') return;
  started = true;
  const base = import.meta.env.BASE_URL;
  for (const name of Object.keys(LEISURE_SPRITES)) {
    const img = new Image();
    img.src = `${base}sprites/clay/leisure/${name}.png`;
    imgs[name] = img;
  }
}
const ready = (name: string): HTMLImageElement | null => {
  const img = imgs[name];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
};

const UMBRELLAS = ['umbrella-red', 'umbrella-blue', 'umbrella-teal', 'umbrella-yellow'];
const TOWELS = ['towel-yellow', 'towel-blue', 'towel-coral'];
/** Props are drawn larger than life (a real umbrella is a tenth of a tile) so they read at a normal zoom. */
const SIZE = 1.45, LIFEGUARD_SIZE = 1.8;
/** Up to this many umbrellas a tile; each one after the first is there on about half the tiles. */
const SLOTS = 3;
/** Bit set on a tile's value when it holds the park's lifeguard tower. */
const LIFEGUARD = 1;

const hash = (i: number, salt: number): number => {
  let h = Math.imul(i ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/**
 * The beach tiles of every beach park in the world, for this frame: tile index →
 * flags. Empty (and allocation-free) while no beach park exists.
 */
const beach = new Map<number, number>();
export function beginBeachFrame(world: World): Map<number, number> {
  beach.clear();
  for (const b of world.buildings) {
    if (b.kind !== BUILDING_BEACH_PARK) continue;
    load();
    const tiles = beachTilesNear(world, b);
    tiles.forEach((i, k) => beach.set(i, (beach.get(i) ?? 0) | (k === tiles.length >> 1 ? LIFEGUARD : 0)));
  }
  return beach;
}

function draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, s: number, pop: number): void {
  const img = ready(name);
  if (!img) return;
  const m = LEISURE_SPRITES[name], k = s * pop;
  ctx.drawImage(img, x - m.footX * k, y - m.footY * k, m.w * k, m.h * k);
}

/** How far a spot is popped up (0 folded away … 1 open), on its own cycle of about a minute. */
function popAt(i: number, slot: number, t: number): number {
  const period = 45 + hash(i, 11 + slot) * 40, open = 0.8;
  const c = ((t / period + hash(i, 21 + slot)) % 1) / open;
  if (c >= 1) return 0;
  const edge = 0.5 / period / open;   // half a second to pop up or fold
  const e = Math.min(c / edge, (1 - c) / edge, 1);
  return e < 1 ? e * (1.15 - 0.15 * e) : 1;   // a small overshoot as it opens
}

/** Draws the props on one beach tile (screen corner sx, sy; `tile` pixels a tile; `now` in ms). */
export function drawBeachTile(ctx: CanvasRenderingContext2D, i: number, flags: number, sx: number, sy: number, tile: number, now: number): void {
  const s = tile / 128 * SIZE, t = now / 1000;
  if (flags & LIFEGUARD) { draw(ctx, 'lifeguard', sx + tile * 0.5, sy + tile * 0.7, tile / 128 * LIFEGUARD_SIZE, 1); return; }
  for (let slot = 0; slot < SLOTS; slot++) {
    if (slot > 0 && hash(i, 3 + slot * 17) < 0.5) continue;
    const pop = popAt(i, slot, t);
    if (pop <= 0) continue;
    // Each slot keeps to its own third of the tile, so two umbrellas never stand on each other.
    const x = sx + tile * (0.18 + 0.27 * slot + 0.1 * hash(i, 5 + slot * 7)), y = sy + tile * (0.4 + 0.45 * hash(i, 6 + slot * 7));
    const pick = hash(i, 9 + slot);
    if (pick < 0.08) { draw(ctx, 'sandcastle', x, y, s, pop); continue; }
    if (hash(i, 13 + slot) < 0.6) draw(ctx, TOWELS[Math.floor(hash(i, 15 + slot) * TOWELS.length)], x + tile * 0.12, y + tile * 0.09, s, Math.min(1, pop));
    // The canopy's shadow on the sand, down and to the right like the painted ones.
    ctx.fillStyle = 'rgba(96,72,30,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + tile * 0.07, y + tile * 0.015, tile * 0.18 * pop, tile * 0.075 * pop, 0, 0, Math.PI * 2);
    ctx.fill();
    draw(ctx, UMBRELLAS[Math.floor(pick * 1e3) % UMBRELLAS.length], x, y, s, pop);
  }
}
