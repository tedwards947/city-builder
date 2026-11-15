# Sprite Guide

Buildings are drawn from **clay image sprites**. The older **code-drawn vector sprites** are the fallback while images load, and for anything that has no image.

## Clay image sprites

- Source art: `art/clay-set/raw/*.png` (1024px, solid magenta background), generated with the nanobanana MCP by editing from `art/clay-set/ref/anchor.png` so every sprite shares the same camera and square plot. Image calls are billed to the user: ask before generating.
- `node art/clay-set/cutout.mjs` cuts out the background and writes the review sprites (`art/clay-set/sprites`, 256px), the game sprites (`public/sprites/clay`, 128px) and `src/render/clay/claySpriteData.ts` (plot rectangle per sprite). Never edit those outputs by hand.
- Names: `{res,com,ind}-{1,2,3}`, an optional design letter (`-b`, `-c`, `-d`…; the game picks among a slot's designs by lot ID), plus optional `-green`, `-gritty`, `-communal`, `-wealthy`; civic buildings are `power, water, sewage, police, fire, school, hospital, park` (one look each, no vibe variants).
- `src/render/clay/ClaySprites.ts` loads them, picks the variant from the tile's local vibe (abandoned buildings always use gritty), and scales the plot to fill the tile. Buildings rise above their plot, so tiles are drawn top row first.
- Smoke, steam and flares are **not** in the images. They are drawn by code at the points listed in `EMITTERS` in `ClaySprites.ts` (256px sprite coordinates). Keep smoke out of new art and add an emitter instead.
- Review page: open `art/clay-set/index.html`.

### Lot dressing (landscaping)

Zone sprites are not drawn as painted: each lot shows one of `CLAY_DRESSING_COUNT` (6) dressed variants of its sprite, picked from spare bits of the lot ID (`visualVariant >> 3`).

- `lotGround.ts` reads a sprite's pixels once and finds its bare ground: a ground mask, the building's shadow, a grid of free cells, the front step, and where each plot edge is unobstructed. Nothing is shipped for this; new sprites just work.
- `lotDressing.ts` (no DOM, tested in `src/__tests__/lotDressing.test.ts`) turns that and a seed into a plan: a ground tone from `groundTones.ts`, flat ground things (lawn stripes, meadow, gravel, a hedge, wall or fence, parking, a small plaza) and standing props (trees, a few bushes or planters, parked cars). The rules that keep it calm are in the file header: every prop has a reason for its spot, at most one edge per lot and only as solid runs, one lot in five gets ground only, towers always get one or two features.
- `lotDressingDraw.ts` paints a plan in flat two-tone clay shapes. `ClaySprites.ts` bakes each variant into its own 128px canvas the first time a lot needs it (sprite with toned ground, ground things clipped to bare ground and darkened by the building's shadow, then props back to front), so drawing a tile is still one `drawImage`.
- Trees are the only image props: `public/sprites/clay/props/{tree,pine,tree-autumn,tree-blossom}.png`, cut from `art/clay-set/landscaping/raw` by `node art/clay-set/landscaping/build.mjs`. Variants baked before a tree has loaded are re-baked when it arrives.
- `-gritty` sprites (and so abandoned buildings) get only a ground tone. Civic buildings get nothing.
- To try changes outside the game, `art/clay-set/landscaping.html` (blend F) runs this same code: `node art/clay-set/landscaping/bundle.mjs && node art/clay-set/landscaping/build.mjs`, then open the page.

## Vector sprites (fallback)

## Core Interface
Entities must implement the `VectorEntity` interface found in `src/render/SpriteTypes.ts`.

```ts
export interface VectorEntity {
  readonly id: string;      // Unique ID (e.g., 'res-low-modern-01')
  readonly type: string;    // Mapping key: ZONE_{ID}_{LEVEL} or BUILDING_{ID}
  readonly tags: string[];  // Vibe tags: 'green', 'industrial', 'egalitarian', etc.
  draw(
    ctx: CanvasRenderingContext2D, 
    ts: number,             // Tile Size (pixels)
    t: number,              // Animation time (seconds)
    p: ColorPalette,        // Current city color palette
    vibe: VibeState         // Current city character
  ): void;
}
```

## Registry Loader
New entities must be registered in `src/render/registryLoader.ts`:
```ts
import { MyNewHouse } from './entities/res-low/MyNewHouse';
reg.register(MyNewHouse);
```

## Reviewing
Use the **Vector Sprite Sandbox** in-game by pressing **`Shift + S`**. It will display all registered sprites in an animated grid.
