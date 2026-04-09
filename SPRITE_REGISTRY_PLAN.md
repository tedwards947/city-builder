# Sprite Registry & Metadata System — Implementation Plan

## Goal

Replace the current inline, procedural sprite drawing scattered across `_renderChunk` / `_drawZoneBuilding` / etc. with a **queryable registry** of tagged sprite definitions. The registry becomes the single source of truth for what gets drawn on each tile, enabling vibe-based sprite selection (Suburb, Arts District, Downtown, etc.) and future moddability.

## Non-Goals (out of scope for now)

- Actual image/sprite-sheet assets (stays procedural Canvas 2D for now)
- The vibe/neighborhood system itself (that's a sim concern; we just prepare the renderer hook)
- Moddable asset loading from external files

---

## New Files

### `src/render/sprites/SpriteDefinition.ts`

Core type definitions:

```ts
import type { ColorPalette } from '../CharacterPalette';

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,    // screen x (already floored)
  y: number,    // screen y (already floored)
  ts: number,   // tile size in pixels
  palette: ColorPalette,
  variant: number,   // stable per-tile RNG (0–3)
) => void;

export interface SpriteDefinition {
  readonly id: string;

  // Tag bag — query by intersection. Conventions:
  //   zone:R | zone:C | zone:I
  //   dev:0 | dev:1 | dev:2 | dev:3
  //   building:powerPlant | building:waterTower | ...
  //   vibe:suburb | vibe:downtown | vibe:arts | vibe:industrial | vibe:any
  //   terrain:grass | terrain:water
  //   vegetation:tree
  //   state:abandoned
  readonly tags: ReadonlySet<string>;

  // Higher weight = more likely to be selected when multiple sprites match.
  readonly weight: number;

  readonly draw: DrawFn;
}
```

### `src/render/sprites/SpriteRegistry.ts`

The registry itself:

```ts
import type { SpriteDefinition } from './SpriteDefinition';

export class SpriteRegistry {
  private _sprites: SpriteDefinition[] = [];

  register(sprite: SpriteDefinition): void {
    this._sprites.push(sprite);
  }

  // Returns all sprites whose tag set is a superset of `required`.
  query(required: ReadonlySet<string>): SpriteDefinition[] {
    return this._sprites.filter(s =>
      [...required].every(t => s.tags.has(t))
    );
  }

  // Pick one sprite by weighted random using a stable seed.
  pick(required: ReadonlySet<string>, seed: number): SpriteDefinition | null {
    const candidates = this.query(required);
    if (candidates.length === 0) return null;
    const total = candidates.reduce((acc, s) => acc + s.weight, 0);
    let r = (seed % 1000) / 1000 * total;
    for (const s of candidates) {
      r -= s.weight;
      if (r <= 0) return s;
    }
    return candidates[candidates.length - 1];
  }
}

// Singleton — the whole app uses one registry.
export const SPRITE_REGISTRY = new SpriteRegistry();
```

### `src/render/sprites/zones/ResidentialSprites.ts`

Registers R-zone sprites at dev levels 0–3, with vibe variants:

```ts
import { SPRITE_REGISTRY } from '../SpriteRegistry';
// ... register BUILDING_R_DEV0_ANY, BUILDING_R_DEV1_SUBURB, BUILDING_R_DEV2_DOWNTOWN, etc.
```

Similar files: `CommercialSprites.ts`, `IndustrialSprites.ts`

### `src/render/sprites/buildings/ServiceSprites.ts`

One file for power plant, water tower, sewage plant, police, fire, school, hospital, park.

### `src/render/sprites/terrain/TerrainSprites.ts`

Grass, water, sand, vegetation/tree species.

### `src/render/sprites/index.ts`

Barrel import that registers everything by side-effect:

```ts
import './terrain/TerrainSprites';
import './zones/ResidentialSprites';
import './zones/CommercialSprites';
import './zones/IndustrialSprites';
import './buildings/ServiceSprites';
```

---

## Modified Files

### `src/render/CanvasRenderer.ts`

- Import `SPRITE_REGISTRY` and `'../sprites/index'` (for side-effect registration)
- Replace the big inline drawing blocks in `_renderChunk` with a `_drawTile(...)` helper that:
  1. Builds a `required` tag set from tile state (zone, dev, building, vibe layer once it exists)
  2. Derives a stable `seed` from `tx + ty * world.grid.width` (no RNG call)
  3. Calls `SPRITE_REGISTRY.pick(required, seed)`
  4. Calls `sprite.draw(ctx, sxi, syi, ts, palette, variant)` if found; falls back to a plain color rect

The per-frame overlay pass (fire animation, vehicle dots, traffic/crime tint) stays as-is — it's already separated.

---

## Tag Query Examples (renderer → registry)

| Tile state | Tags passed to `pick()` |
|---|---|
| R zone, dev 2, no vibe | `{ 'zone:R', 'dev:2', 'vibe:any' }` |
| R zone, dev 2, suburb vibe | `{ 'zone:R', 'dev:2', 'vibe:suburb' }` |
| R zone, dev 2, abandoned | `{ 'zone:R', 'dev:2', 'state:abandoned' }` |
| Power plant | `{ 'building:powerPlant' }` |
| Grass terrain | `{ 'terrain:grass' }` |

Sprites registered with `vibe:any` act as fallbacks. Sprites registered with `vibe:suburb` win over `vibe:any` when the vibe layer says suburb (once that system exists). The `pick()` method just needs to sort by specificity if we want strict fallback; for now, weight is enough.

---

## Vibe Hook (future-proof, not implemented now)

`_renderChunk` will eventually read `world.layers.vibe[i]` (a `Uint8Array` added by a future VibeSystem). When that byte is non-zero, it maps to a vibe tag string:

```ts
const VIBE_TAGS: Record<number, string> = {
  0: 'vibe:any',
  1: 'vibe:suburb',
  2: 'vibe:downtown',
  3: 'vibe:arts',
  4: 'vibe:barDistrict',
  5: 'vibe:industrial',
  6: 'vibe:shantytown',
  7: 'vibe:techHub',
  8: 'vibe:rural',
};
```

The renderer adds the appropriate vibe tag to the required set, and the registry returns the most specific matching sprite. No renderer logic needs to change when new vibes or sprite variants are added — you just register more sprites.

---

## Implementation Steps (in order)

1. **`SpriteDefinition.ts`** — types only, no logic
2. **`SpriteRegistry.ts`** — registry + singleton
3. **`TerrainSprites.ts`** — grass, water, sand, tree variants (migrate from `_drawTree`)
4. **`ServiceSprites.ts`** — power plant, water tower, sewage, police, fire, school, hospital, park (migrate from `_renderChunk` blocks)
5. **`ResidentialSprites.ts` / `CommercialSprites.ts` / `IndustrialSprites.ts`** — migrate from `_drawZoneBuilding`; add a couple of `vibe:suburb` and `vibe:downtown` variants for R/C as a demo
6. **`src/render/sprites/index.ts`** — barrel import
7. **`CanvasRenderer.ts`** — wire up `_drawTile()` helper, remove migrated inline draw blocks
8. **Tests** — `src/__tests__/sprites.test.ts`: verify `query()` returns correct matches, `pick()` is stable for same seed, fallback to `null` when no match

---

## What This Unlocks

- **Vibe-based sprites**: add R `vibe:suburb` low-rise sprites and R `vibe:downtown` glass-tower sprites — no renderer logic changes needed
- **Moddability**: expose `SPRITE_REGISTRY.register()` in a future mod API
- **A/B sprite variants**: weight multiple sprites for the same tags; `pick()` handles selection
- **Decal overlays**: register sprites tagged `decal:mural` and draw them in a second pass over road/sidewalk tiles (arts district aura)

---

## Files to Create/Modify (summary)

| Action | File |
|---|---|
| Create | `src/render/sprites/SpriteDefinition.ts` |
| Create | `src/render/sprites/SpriteRegistry.ts` |
| Create | `src/render/sprites/terrain/TerrainSprites.ts` |
| Create | `src/render/sprites/zones/ResidentialSprites.ts` |
| Create | `src/render/sprites/zones/CommercialSprites.ts` |
| Create | `src/render/sprites/zones/IndustrialSprites.ts` |
| Create | `src/render/sprites/buildings/ServiceSprites.ts` |
| Create | `src/render/sprites/index.ts` |
| Modify | `src/render/CanvasRenderer.ts` |
| Create | `src/__tests__/sprites.test.ts` |
