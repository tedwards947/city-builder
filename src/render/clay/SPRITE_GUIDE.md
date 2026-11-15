# Sprite Guide

Buildings are drawn from **clay image sprites**. Until an image has loaded, the renderer's flat chunk-layer drawing (`_drawZoneBuilding` and the civic blocks in `CanvasRenderer._renderChunk`) shows instead. The old code-drawn vector sprites and the Shift+S sandbox were removed.

## Clay image sprites

- Source art: `art/clay-set/raw/*.png` (1024px, solid magenta background), generated with the nanobanana MCP by editing from `art/clay-set/ref/anchor.png` so every sprite shares the same camera and square plot. Image calls are billed to the user: ask before generating.
- `node art/clay-set/cutout.mjs` cuts out the background and writes the review sprites (`art/clay-set/sprites`, 256px), the game sprites (`public/sprites/clay`, 128px, 256-colour palette PNGs with alpha) and `src/render/clay/claySpriteData.ts` (plot rectangle per sprite). Never edit those outputs by hand.
- Names: `{res,com,ind}-{1,2,3}`, an optional design letter (`-b`, `-c`, `-d`…; the game picks among a slot's designs by lot ID), plus optional `-green`, `-gritty`, `-communal`, `-wealthy`; civic buildings are `power, water, sewage, police, fire, school, hospital, park` (one look each, no vibe variants).
- `src/render/clay/ClaySprites.ts` loads them, picks the variant from the tile's local vibe (abandoned buildings always use gritty), and scales the plot to fill the tile. Buildings rise above their plot, so tiles are drawn top row first.
- Smoke, steam and flares are **not** in the images. They are drawn by code at the points listed in `EMITTERS` in `ClaySprites.ts` (256px sprite coordinates). Keep smoke out of new art and add an emitter instead.
- Fire is code-drawn too: `drawClayFire` (flames, glow, smoke) while a lot burns and `drawClaySmolder` (soot and thin smoke, 20 s, render-only) after it goes out. Both, and the crime / sickness / death lot markers, are drawn after every sprite so the building in front cannot hide them.
- Review page: open `art/clay-set/index.html`.

### Lot dressing (landscaping)

Zone sprites are not drawn as painted: each lot shows one of `CLAY_DRESSING_COUNT` (6) dressed variants of its sprite, picked from spare bits of the lot ID (`visualVariant >> 3`).

- `lotGround.ts` reads a sprite's pixels once and finds its bare ground: a ground mask, the building's shadow, a grid of free cells, the front step, and where each plot edge is unobstructed. Nothing is shipped for this; new sprites just work.
- `lotDressing.ts` (no DOM, tested in `src/__tests__/lotDressing.test.ts`) turns that and a seed into a plan: a ground tone from `groundTones.ts`, flat ground things (lawn stripes, meadow, gravel, a hedge, wall or fence, parking, a small plaza) and standing props (trees, a few bushes or planters, parked cars). The rules that keep it calm are in the file header: every prop has a reason for its spot, at most one edge per lot and only as solid runs, one lot in five gets ground only, towers always get one or two features.
- `lotDressingDraw.ts` paints a plan in flat two-tone clay shapes. `ClaySprites.ts` bakes each variant into its own 128px canvas the first time a lot needs it (sprite with toned ground, ground things clipped to bare ground and darkened by the building's shadow, then props back to front), so drawing a tile is still one `drawImage`.
- Trees are the only image props: `public/sprites/clay/props/{tree,pine,tree-autumn,tree-blossom}.png`, cut from `art/clay-set/landscaping/raw` by `node art/clay-set/landscaping/build.mjs`. Variants baked before a tree has loaded are re-baked when it arrives.
- `-gritty` sprites (and so abandoned buildings) get only a ground tone. Civic buildings get nothing.
- To try changes outside the game, `art/clay-set/landscaping.html` (blend F) runs this same code: `node art/clay-set/landscaping/bundle.mjs && node art/clay-set/landscaping/build.mjs`, then open the page.

### Wild trees

Trees on unbuilt land are clay sprites too, from tile size 8px up (below that the chunk layer draws flat marks).

- Source: `art/clay-set/landscaping/raw/trees-*.png` (4 x 4 sheets on magenta, one species per row). `node art/clay-set/landscaping/trees.mjs` cuts them up, writes the review trees for `art/clay-set/trees.html`, and packs the kept ones (`GAME_TREES` in that script) into `public/sprites/clay/trees.png` + `src/render/clay/wildTreeData.ts`.
- `wildTrees.ts`: vegetation 1–6 maps to beech, larch, pine, spruce, poplar, cypress. A lone tile gets one tree, a forest edge two on a brick pattern, an interior four on an even grid, with a companion species mixed in now and then. Keep it tidy: even spacing, nearly one size, never mirrored (the owner rejected random scatter and mirrored trees as sloppy). `planWildTrees` is pure and tested (`src/__tests__/wildTrees.test.ts`); clumps are baked per species, variant, density and tile size, so a tile is one `drawImage`.
- `CanvasRenderer` draws them in the per-frame tile pass (rows top to bottom, so they overlap like buildings), over a darker forest floor (`_drawForestFloor`). Nothing here goes through the chunk cache.
