/**
 * Wild trees: the clay trees on unbuilt land. A tile that stands alone gets one
 * tree, a forest edge two on a brick pattern, a forest interior four on an even
 * grid, mostly of the tile's species with the odd companion species mixed in.
 *
 * Kept deliberately tidy (the owner found random scatter "sloppy"): even
 * spacing with only a little wobble, nearly one size, and never mirrored, so
 * every tree keeps the lean and lighting it was sculpted with.
 *
 * `planWildTrees` is pure (no DOM) and tested; the rest bakes a plan into a
 * small canvas per (species, variant, density, tile size), so drawing a tile
 * is one `drawImage`.
 */
import { WILD_TREE_RECTS, WILD_TREE_MAX_HEIGHT } from './wildTreeData';

/** Species by vegetation value (index = vegetation - 1). */
export const WILD_SPECIES = ['beech', 'larch', 'pine', 'spruce', 'poplar', 'cypress'] as const;
export type WildSpecies = typeof WILD_SPECIES[number];
/** The species that turns up now and then inside another's forest. */
const COMPANION: Record<WildSpecies, WildSpecies> = {
  beech: 'larch', larch: 'beech', pine: 'spruce', spruce: 'pine', poplar: 'cypress', cypress: 'poplar',
};
const COMPANION_SHARE = 0.22;
/** The tallest tree is this share of a tile high, by density (1 lone, 2 edge, 3 interior). */
const TREE_SIZE = [0, 0.9, 0.9, 0.75];
/** Trees per tile, by density. */
const TREE_COUNT = [0, 1, 2, 4];
/** Where each tree stands (trunk base, in tiles), by density. */
const TREE_SPOTS: readonly (readonly (readonly [number, number])[])[] = [
  [], [[0.5, 0.82]], [[0.25, 0.5], [0.75, 1.0]], [[0.25, 0.5], [0.75, 0.5], [0.25, 1.0], [0.75, 1.0]],
];
const WOBBLE_X = 0.08, WOBBLE_Y = 0.06, SIZE_VARIATION = 0.1;
/** Looks per species and density; a tile picks one from its position. */
export const WILD_VARIANTS = 8;

export interface WildTree {
  species: WildSpecies;
  /** Which of the species' shapes. */
  shape: number;
  /** Where the trunk meets the ground, in tiles from the tile's top-left corner. */
  x: number; y: number;
  /** Height of the tallest tree shape, in tiles; other shapes are in proportion. */
  size: number;
}

const hash = (a: number, b: number): number => {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * The trees on one tile, back to front. `vegetation` is the tile's species
 * (1–6), `density` is 1 for a lone tree, 2 for a forest edge, 3 for an interior.
 */
export function planWildTrees(vegetation: number, variant: number, density: number): WildTree[] {
  const main = WILD_SPECIES[vegetation - 1];
  if (!main) return [];
  const d = Math.max(1, Math.min(3, density | 0));
  const seed = vegetation * 64 + variant * 4 + d;
  const out: WildTree[] = [];
  for (let n = 0; n < TREE_COUNT[d]; n++) {
    const species = d > 1 && hash(seed, 20 + n) < COMPANION_SHARE ? COMPANION[main] : main;
    const shapes = WILD_TREE_RECTS[species]?.length ?? 0;
    if (!shapes) continue;
    const [x, y] = TREE_SPOTS[d][n];
    out.push({
      species,
      shape: Math.floor(hash(seed, 30 + n) * shapes),
      x: x + (hash(seed, 40 + n) - 0.5) * WOBBLE_X,
      y: y + (hash(seed, 50 + n) - 0.5) * WOBBLE_Y,
      size: TREE_SIZE[d] * (1 - SIZE_VARIATION / 2 + hash(seed, 60 + n) * SIZE_VARIATION),
    });
  }
  return out.sort((a, b) => a.y - b.y);
}

/** A tile's density (1 lone, 2 forest edge, 3 interior), from how many of its 8 neighbours also have trees. */
export function wildDensity(treeNeighbours: number): number {
  return treeNeighbours === 0 ? 1 : treeNeighbours < 4 ? 2 : 3;
}

/** A stable look for the tile at (tx, ty). */
export function wildVariant(tx: number, ty: number): number {
  return Math.floor(hash(tx + 1, ty + 1) * WILD_VARIANTS);
}

// ── Loading and drawing (browser only) ──────────────────────────────────────

let atlas: HTMLImageElement | null = null;
let loadStarted = false;

/** Starts loading the tree image. Safe to call repeatedly; does nothing outside a browser. */
export function loadWildTrees(onLoad?: () => void): void {
  if (loadStarted || typeof Image === 'undefined') return;
  loadStarted = true;
  const image = new Image();
  image.onload = () => { atlas = image; onLoad?.(); };
  image.src = `${import.meta.env.BASE_URL}sprites/clay/trees.png`;
}

export function wildTreesReady(): boolean { return atlas !== null; }

// A tree can lean out of its tile; the baked canvas has room on every side.
const PAD_X = 0.35, PAD_TOP = 0.75, PAD_BOTTOM = 0.15;
let bakedFor = 0;
const baked = new Map<number, HTMLCanvasElement>();

function bake(vegetation: number, variant: number, density: number, tile: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(tile * (1 + PAD_X * 2));
  canvas.height = Math.ceil(tile * (1 + PAD_TOP + PAD_BOTTOM));
  const c = canvas.getContext('2d');
  if (!c || !atlas) return canvas;
  const ox = tile * PAD_X, oy = tile * PAD_TOP;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  for (const t of planWildTrees(vegetation, variant, density)) {
    const [rx, ry, rw, rh] = WILD_TREE_RECTS[t.species][t.shape];
    const k = t.size * tile / WILD_TREE_MAX_HEIGHT;
    const w = rw * k, h = rh * k;
    const bx = ox + t.x * tile, by = oy + t.y * tile;
    c.fillStyle = 'rgba(20,40,20,0.28)';
    c.beginPath();
    c.ellipse(bx + w * 0.08, by - h * 0.03, w * 0.42, w * 0.17, 0, 0, Math.PI * 2);
    c.fill();
    c.drawImage(atlas, rx, ry, rw, rh, bx - w / 2, by - h, w, h);
  }
  return canvas;
}

/**
 * Draws the clump for a tree tile whose top-left corner is (sx, sy) and whose
 * side is `tile` pixels. Does nothing until the image has loaded.
 */
export function drawWildTrees(ctx: CanvasRenderingContext2D, vegetation: number, variant: number, density: number, sx: number, sy: number, tile: number): void {
  if (!atlas) return;
  if (bakedFor !== tile) { baked.clear(); bakedFor = tile; }
  const key = (vegetation * WILD_VARIANTS + variant) * 4 + density;
  let canvas = baked.get(key);
  if (!canvas) { canvas = bake(vegetation, variant, density, tile); baked.set(key, canvas); }
  ctx.drawImage(canvas, sx - Math.round(tile * PAD_X), sy - Math.round(tile * PAD_TOP));
}
