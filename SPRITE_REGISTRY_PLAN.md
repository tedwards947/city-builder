# Sprite Registry & Asset System — Implementation Plan (Revised)

## Goal

Replace the current inline, procedural sprite drawing with a **hybrid asset system** that:
- Loads real sprite sheets (PNG images) with rich metadata
- Supports vibe-based sprite selection (Suburb, Arts District, Downtown, etc.)
- Handles animated sprites (power plants, fires, traffic)
- Falls back to procedural Canvas drawing when assets are missing
- Enables future moddability and GenAI sprite generation

## Key Design Decisions

- **Sprite sheets** over individual images (more efficient, standard for games)
- **JSON manifest** for centralized metadata (tags, vibes, animation frames)
- **Animation support** for buildings and effects (power plants, fires, vehicles)
- **Procedural fallback** preserves current Canvas drawing when assets unavailable

---

## New Files

### `src/render/sprites/SpriteDefinition.ts`

Core type definitions:

```ts
import type { ColorPalette } from '../CharacterPalette';

// Procedural drawing function (fallback when image unavailable)
export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,    // screen x (already floored)
  y: number,    // screen y (already floored)
  ts: number,   // tile size in pixels
  palette: ColorPalette,
  variant: number,   // stable per-tile RNG (0–3)
) => void;

// Sprite sheet frame coordinates
export interface SpriteFrame {
  readonly sheetId: string;   // which sprite sheet image
  readonly x: number;         // source x in sheet
  readonly y: number;         // source y in sheet
  readonly w: number;         // source width
  readonly h: number;         // source height
  readonly anchorX?: number;  // render offset x (default: 0)
  readonly anchorY?: number;  // render offset y (default: 0)
}

// Animation configuration
export interface AnimationConfig {
  readonly frames: readonly SpriteFrame[];
  readonly frameDuration: number;  // milliseconds per frame
  readonly loop: boolean;          // true for power plants, false for one-shot effects
}

export interface SpriteDefinition {
  readonly id: string;

  // Tag bag — query by intersection. Conventions:
  //   zone:R | zone:C | zone:I
  //   dev:0 | dev:1 | dev:2 | dev:3
  //   building:powerPlant | building:waterTower | ...
  //   vibe:suburb | vibe:downtown | vibe:arts | vibe:industrial | vibe:any
  //   terrain:grass | terrain:water
  //   vegetation:tree
  //   state:abandoned | state:fire
  readonly tags: ReadonlySet<string>;

  // Higher weight = more likely to be selected when multiple sprites match.
  readonly weight: number;

  // Sprite data (image-based)
  readonly frame?: SpriteFrame;           // static sprite
  readonly animation?: AnimationConfig;   // animated sprite (mutually exclusive with frame)

  // Fallback (procedural drawing when image unavailable)
  readonly drawFallback?: DrawFn;
}
```

### `src/render/sprites/SpriteRegistry.ts`

The registry with sprite selection logic:

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
  // Prefers more specific matches (more tags = higher specificity).
  pick(required: ReadonlySet<string>, seed: number): SpriteDefinition | null {
    const candidates = this.query(required);
    if (candidates.length === 0) return null;

    // Sort by specificity (number of tags), then by weight
    const sorted = candidates.sort((a, b) => {
      const specificity = b.tags.size - a.tags.size;
      return specificity !== 0 ? specificity : b.weight - a.weight;
    });

    // Weighted random selection from sorted candidates
    const total = sorted.reduce((acc, s) => acc + s.weight, 0);
    let r = (seed % 1000) / 1000 * total;
    for (const s of sorted) {
      r -= s.weight;
      if (r <= 0) return s;
    }
    return sorted[sorted.length - 1];
  }
}

// Singleton — the whole app uses one registry.
export const SPRITE_REGISTRY = new SpriteRegistry();
```

### `src/render/sprites/AssetManager.ts`

Handles sprite sheet loading and caching:

```ts
export interface SpriteSheetManifest {
  sheets: Record<string, {
    path: string;           // relative path to PNG
    tileSize: number;       // base tile size for this sheet
  }>;
  sprites: Record<string, {
    tags: string[];         // tag list
    weight?: number;        // default: 1
    frame?: {
      sheet: string;
      x: number;
      y: number;
      w: number;
      h: number;
      anchorX?: number;
      anchorY?: number;
    };
    animation?: {
      sheet: string;
      frames: Array<{ x: number; y: number; w: number; h: number }>;
      frameDuration: number;
      loop: boolean;
    };
  }>;
}

export class AssetManager {
  private _sheets = new Map<string, HTMLImageElement>();
  private _loadPromises = new Map<string, Promise<HTMLImageElement>>();
  private _manifest: SpriteSheetManifest | null = null;

  async loadManifest(path: string): Promise<void> {
    const response = await fetch(path);
    this._manifest = await response.json();
  }

  async loadSheet(sheetId: string): Promise<HTMLImageElement> {
    // Return cached sheet if already loaded
    if (this._sheets.has(sheetId)) {
      return this._sheets.get(sheetId)!;
    }

    // Return in-flight promise if already loading
    if (this._loadPromises.has(sheetId)) {
      return this._loadPromises.get(sheetId)!;
    }

    // Start loading
    if (!this._manifest) {
      throw new Error('Manifest not loaded');
    }

    const sheetInfo = this._manifest.sheets[sheetId];
    if (!sheetInfo) {
      throw new Error(`Sheet ${sheetId} not found in manifest`);
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this._sheets.set(sheetId, img);
        this._loadPromises.delete(sheetId);
        resolve(img);
      };
      img.onerror = () => {
        this._loadPromises.delete(sheetId);
        reject(new Error(`Failed to load sheet: ${sheetInfo.path}`));
      };
      img.src = sheetInfo.path;
    });

    this._loadPromises.set(sheetId, promise);
    return promise;
  }

  getSheet(sheetId: string): HTMLImageElement | null {
    return this._sheets.get(sheetId) ?? null;
  }

  getManifest(): SpriteSheetManifest | null {
    return this._manifest;
  }

  // Preload all sheets referenced in manifest
  async preloadAll(): Promise<void> {
    if (!this._manifest) {
      throw new Error('Manifest not loaded');
    }

    const sheetIds = Object.keys(this._manifest.sheets);
    await Promise.all(sheetIds.map(id => this.loadSheet(id)));
  }
}

// Singleton
export const ASSET_MANAGER = new AssetManager();
```

### `src/render/sprites/SpriteRenderer.ts`

Renders sprites (both static and animated):

```ts
import type { SpriteDefinition, SpriteFrame } from './SpriteDefinition';
import type { ColorPalette } from '../CharacterPalette';
import { ASSET_MANAGER } from './AssetManager';

export class SpriteRenderer {
  private _animationStates = new Map<string, number>(); // tileKey -> frame index

  drawSprite(
    ctx: CanvasRenderingContext2D,
    sprite: SpriteDefinition,
    x: number,
    y: number,
    ts: number,
    palette: ColorPalette,
    variant: number,
    tileKey: string,  // unique tile identifier for animation state
    now: number,      // current time in ms (for animation)
  ): void {
    // Try to draw from sprite sheet first
    if (sprite.animation) {
      this._drawAnimated(ctx, sprite, x, y, ts, tileKey, now);
      return;
    }

    if (sprite.frame) {
      this._drawStatic(ctx, sprite.frame, x, y, ts);
      return;
    }

    // Fall back to procedural drawing
    if (sprite.drawFallback) {
      sprite.drawFallback(ctx, x, y, ts, palette, variant);
      return;
    }

    // Last resort: draw a colored rectangle
    ctx.fillStyle = '#ff00ff'; // magenta for missing sprite
    ctx.fillRect(x, y, ts, ts);
  }

  private _drawStatic(
    ctx: CanvasRenderingContext2D,
    frame: SpriteFrame,
    x: number,
    y: number,
    ts: number,
  ): void {
    const sheet = ASSET_MANAGER.getSheet(frame.sheetId);
    if (!sheet) {
      // Sheet not loaded yet - will fall back to drawFallback in caller
      return;
    }

    const anchorX = frame.anchorX ?? 0;
    const anchorY = frame.anchorY ?? 0;

    ctx.drawImage(
      sheet,
      frame.x, frame.y, frame.w, frame.h,  // source
      x + anchorX, y + anchorY, ts, ts,    // destination
    );
  }

  private _drawAnimated(
    ctx: CanvasRenderingContext2D,
    sprite: SpriteDefinition,
    x: number,
    y: number,
    ts: number,
    tileKey: string,
    now: number,
  ): void {
    if (!sprite.animation) return;

    const { frames, frameDuration, loop } = sprite.animation;
    const totalDuration = frames.length * frameDuration;

    // Calculate current frame index
    let elapsed = now % totalDuration;
    if (!loop && now >= totalDuration) {
      elapsed = totalDuration - frameDuration; // stick on last frame
    }

    const frameIndex = Math.floor(elapsed / frameDuration);
    const frame = frames[frameIndex];

    this._drawStatic(ctx, frame, x, y, ts);
  }
}
```

### `src/render/sprites/manifest-loader.ts`

Loads manifest and populates registry:

```ts
import { SPRITE_REGISTRY } from './SpriteRegistry';
import { ASSET_MANAGER } from './AssetManager';
import type { SpriteDefinition, SpriteFrame, AnimationConfig } from './SpriteDefinition';

export async function loadSpritesFromManifest(manifestPath: string): Promise<void> {
  await ASSET_MANAGER.loadManifest(manifestPath);
  const manifest = ASSET_MANAGER.getManifest();
  if (!manifest) {
    throw new Error('Failed to load manifest');
  }

  // Register each sprite from manifest
  for (const [spriteId, spriteData] of Object.entries(manifest.sprites)) {
    const tags = new Set(spriteData.tags);
    const weight = spriteData.weight ?? 1;

    let frame: SpriteFrame | undefined;
    let animation: AnimationConfig | undefined;

    if (spriteData.frame) {
      frame = {
        sheetId: spriteData.frame.sheet,
        x: spriteData.frame.x,
        y: spriteData.frame.y,
        w: spriteData.frame.w,
        h: spriteData.frame.h,
        anchorX: spriteData.frame.anchorX,
        anchorY: spriteData.frame.anchorY,
      };
    }

    if (spriteData.animation) {
      animation = {
        frames: spriteData.animation.frames.map(f => ({
          sheetId: spriteData.animation!.sheet,
          x: f.x,
          y: f.y,
          w: f.w,
          h: f.h,
        })),
        frameDuration: spriteData.animation.frameDuration,
        loop: spriteData.animation.loop,
      };
    }

    const sprite: SpriteDefinition = {
      id: spriteId,
      tags,
      weight,
      frame,
      animation,
      // drawFallback will be registered separately from procedural sprite files
    };

    SPRITE_REGISTRY.register(sprite);
  }
}
```

### `src/render/sprites/zones/ResidentialSprites.ts`

Registers procedural fallbacks for R-zone sprites:

```ts
import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';

// Procedural drawing functions (fallbacks)
const drawRDev0: DrawFn = (ctx, x, y, ts, palette, variant) => {
  ctx.fillStyle = palette.residentialBase;
  ctx.fillRect(x, y, ts, ts);
  // ... existing procedural drawing code
};

const drawRDev1Suburb: DrawFn = (ctx, x, y, ts, palette, variant) => {
  // Draw single-family home
  // ... existing procedural drawing code
};

// Register fallbacks (will be used if sprite sheet fails to load)
SPRITE_REGISTRY.register({
  id: 'r_dev0_fallback',
  tags: new Set(['zone:R', 'dev:0', 'vibe:any']),
  weight: 1,
  drawFallback: drawRDev0,
});

SPRITE_REGISTRY.register({
  id: 'r_dev1_suburb_fallback',
  tags: new Set(['zone:R', 'dev:1', 'vibe:suburb']),
  weight: 1,
  drawFallback: drawRDev1Suburb,
});

// ... more variants
```

Similar files: `CommercialSprites.ts`, `IndustrialSprites.ts`

### `src/render/sprites/buildings/ServiceSprites.ts`

Procedural fallbacks for buildings (power plant, water tower, etc.):

```ts
import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';

const drawPowerPlant: DrawFn = (ctx, x, y, ts, palette, variant) => {
  // ... existing procedural drawing code
};

SPRITE_REGISTRY.register({
  id: 'powerplant_fallback',
  tags: new Set(['building:powerPlant']),
  weight: 1,
  drawFallback: drawPowerPlant,
});

// ... more buildings
```

### `src/render/sprites/terrain/TerrainSprites.ts`

Procedural fallbacks for terrain (grass, water, sand, trees):

```ts
import { SPRITE_REGISTRY } from '../SpriteRegistry';
import type { DrawFn } from '../SpriteDefinition';

const drawGrass: DrawFn = (ctx, x, y, ts, palette, variant) => {
  // ... existing procedural drawing code
};

SPRITE_REGISTRY.register({
  id: 'grass_fallback',
  tags: new Set(['terrain:grass']),
  weight: 1,
  drawFallback: drawGrass,
});

// ... water, sand, trees
```

### `src/render/sprites/index.ts`

Barrel import that registers all procedural fallbacks:

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

- Import `SPRITE_REGISTRY`, `ASSET_MANAGER`, `SpriteRenderer`, and `'../sprites/index'`
- Add `private _spriteRenderer = new SpriteRenderer()`
- Replace the big inline drawing blocks in `_renderChunk` with a `_drawTile(...)` helper:

```ts
private _drawTile(
  ctx: CanvasRenderingContext2D,
  world: World,
  i: number,
  tx: number,
  ty: number,
  sxi: number,
  syi: number,
  ts: number,
  palette: ColorPalette,
  now: number,
): void {
  // Build tag set from tile state
  const tags = new Set<string>();

  // Terrain
  const terrain = world.layers.terrain[i];
  if (terrain === 1) tags.add('terrain:water');
  else if (terrain === 2) tags.add('terrain:sand');
  else tags.add('terrain:grass');

  // Vegetation
  const veg = world.layers.vegetation[i];
  if (veg > 0) {
    tags.add('vegetation:tree');
    tags.add(`vegetation:species${veg}`);
  }

  // Zone
  const zone = world.layers.zone[i];
  if (zone === ZONE_R) tags.add('zone:R');
  else if (zone === ZONE_C) tags.add('zone:C');
  else if (zone === ZONE_I) tags.add('zone:I');

  // Dev level
  if (zone > 0) {
    const dev = world.layers.devLevel[i];
    tags.add(`dev:${dev}`);
  }

  // Building
  const building = world.layers.building[i];
  if (building === BUILDING_POWER_PLANT) tags.add('building:powerPlant');
  else if (building === BUILDING_WATER_TOWER) tags.add('building:waterTower');
  // ... etc

  // Vibe (future — when world.layers.vibe exists)
  // const vibe = world.layers.vibe?.[i] ?? 0;
  // tags.add(VIBE_TAGS[vibe] ?? 'vibe:any');
  tags.add('vibe:any'); // default for now

  // State modifiers
  if (world.layers.abandoned[i] > 0) tags.add('state:abandoned');
  if (world.layers.fire[i] > 0) tags.add('state:fire');

  // Pick sprite
  const seed = tx + ty * world.grid.width;
  const sprite = SPRITE_REGISTRY.pick(tags, seed);

  if (sprite) {
    const tileKey = `${tx},${ty}`;
    const variant = seed % 4;
    this._spriteRenderer.drawSprite(
      ctx, sprite, sxi, syi, ts, palette, variant, tileKey, now
    );
  } else {
    // No sprite found — draw debug color
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(sxi, syi, ts, ts);
  }
}
```

### `src/main.ts`

Initialize asset system before starting game:

```ts
import { loadSpritesFromManifest } from './render/sprites/manifest-loader';
import { ASSET_MANAGER } from './render/sprites/AssetManager';

async function init() {
  // Load sprite manifest and sheets
  await loadSpritesFromManifest('/assets/sprites/manifest.json');
  await ASSET_MANAGER.preloadAll();

  // ... existing initialization code (world, scheduler, renderer)
}

init();
```

---

## Asset Directory Structure

```
city-builder/
  public/
    assets/
      sprites/
        manifest.json          # metadata for all sprites
        residential.png        # sprite sheet for R zones
        commercial.png         # sprite sheet for C zones
        industrial.png         # sprite sheet for I zones
        buildings.png          # sprite sheet for service buildings
        terrain.png            # sprite sheet for terrain/vegetation
        effects.png            # sprite sheet for animated effects
```

---

## Example Manifest (`public/assets/sprites/manifest.json`)

```json
{
  "sheets": {
    "residential": {
      "path": "/assets/sprites/residential.png",
      "tileSize": 32
    },
    "buildings": {
      "path": "/assets/sprites/buildings.png",
      "tileSize": 32
    },
    "effects": {
      "path": "/assets/sprites/effects.png",
      "tileSize": 32
    }
  },
  "sprites": {
    "r_dev1_suburb": {
      "tags": ["zone:R", "dev:1", "vibe:suburb"],
      "weight": 10,
      "frame": {
        "sheet": "residential",
        "x": 0,
        "y": 0,
        "w": 32,
        "h": 32
      }
    },
    "r_dev2_downtown": {
      "tags": ["zone:R", "dev:2", "vibe:downtown"],
      "weight": 10,
      "frame": {
        "sheet": "residential",
        "x": 32,
        "y": 0,
        "w": 32,
        "h": 32
      }
    },
    "powerplant_animated": {
      "tags": ["building:powerPlant"],
      "weight": 10,
      "animation": {
        "sheet": "buildings",
        "frames": [
          { "x": 0, "y": 0, "w": 32, "h": 32 },
          { "x": 32, "y": 0, "w": 32, "h": 32 },
          { "x": 64, "y": 0, "w": 32, "h": 32 }
        ],
        "frameDuration": 200,
        "loop": true
      }
    },
    "fire_effect": {
      "tags": ["state:fire"],
      "weight": 10,
      "animation": {
        "sheet": "effects",
        "frames": [
          { "x": 0, "y": 0, "w": 32, "h": 32 },
          { "x": 32, "y": 0, "w": 32, "h": 32 },
          { "x": 64, "y": 0, "w": 32, "h": 32 },
          { "x": 96, "y": 0, "w": 32, "h": 32 }
        ],
        "frameDuration": 100,
        "loop": true
      }
    }
  }
}
```

---

## Tag Query Examples (renderer → registry)

| Tile state | Tags passed to `pick()` | Matching sprites |
|---|---|---|
| R zone, dev 2, no vibe | `{ 'zone:R', 'dev:2', 'vibe:any' }` | `r_dev2_fallback` (procedural) |
| R zone, dev 2, suburb vibe | `{ 'zone:R', 'dev:2', 'vibe:suburb' }` | `r_dev2_suburb` (image) or fallback |
| R zone, dev 2, abandoned | `{ 'zone:R', 'dev:2', 'state:abandoned', 'vibe:any' }` | `r_dev2_abandoned` (image) or fallback |
| Power plant | `{ 'building:powerPlant' }` | `powerplant_animated` (animation) or fallback |
| Grass terrain | `{ 'terrain:grass' }` | `grass_01`, `grass_02` (variants) or fallback |

Sprites with more specific tags (e.g., `vibe:suburb`) will be preferred over generic ones (`vibe:any`). The registry sorts by tag count (specificity) before applying weight-based random selection.

---

## Vibe Hook (future-proof, ready when VibeSystem lands)

When `world.layers.vibe` is added, `_drawTile` will read it and map to vibe tags:

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

const vibeTag = VIBE_TAGS[world.layers.vibe[i]] ?? 'vibe:any';
tags.add(vibeTag);
```

No other renderer logic needs to change — just add vibe-specific sprites to the manifest and they'll be selected automatically.

---

## Implementation Steps (in order)

1. **`SpriteDefinition.ts`** — types for frames, animations, fallbacks
2. **`AssetManager.ts`** — sprite sheet loading, caching, manifest parsing
3. **`SpriteRegistry.ts`** — registry with specificity-aware `pick()`
4. **`SpriteRenderer.ts`** — rendering logic for static/animated sprites with fallback
5. **`manifest-loader.ts`** — populate registry from JSON manifest
6. **`TerrainSprites.ts`** — procedural fallback registrations (migrate from existing code)
7. **`ServiceSprites.ts`** — procedural fallback registrations
8. **`ResidentialSprites.ts` / `CommercialSprites.ts` / `IndustrialSprites.ts`** — procedural fallbacks
9. **`src/render/sprites/index.ts`** — barrel import
10. **`CanvasRenderer.ts`** — wire up `_drawTile()`, remove old inline draw blocks
11. **`main.ts`** — initialize asset manager before game starts
12. **Create placeholder manifest** — `public/assets/sprites/manifest.json` with a few test sprites
13. **Tests** — `src/__tests__/sprites.test.ts`:
    - Verify `query()` returns correct matches
    - Verify `pick()` prefers more specific sprites
    - Verify `pick()` is stable for same seed
    - Verify fallback when sprite sheet missing
    - Verify animation frame selection

---

## What This Unlocks

- **Real sprite assets**: Load PNG sprite sheets instead of procedural drawing
- **GenAI workflow**: Generate sprite sheets, update manifest JSON, reload
- **Vibe-based visuals**: Different sprites for suburb vs downtown automatically selected
- **Animation**: Power plants smoke, fires burn, traffic flows
- **Moddability**: Users can drop in new sprite sheets + update manifest
- **Resilience**: Procedural drawing fallback ensures game never breaks due to missing assets
- **Performance**: Sprite sheet rendering is faster than complex Canvas path operations
- **Variants**: Multiple sprites can match same tags (e.g., 3 different tree sprites), randomly selected per tile

---

## Future Extensions (out of scope for now)

- **Decal overlays**: Register sprites tagged `decal:mural` and draw in second pass (arts district)
- **Lighting/tint overlays**: Apply vibe-specific color filters to sprite sheets
- **Multi-tile buildings**: Sprites that span 2×2 or 3×3 tiles
- **Seasonal variants**: Swap sprite sheets for winter/summer
- **User mod API**: Expose `SPRITE_REGISTRY.register()` and asset loading for custom content
- **Sprite atlas packer**: Auto-generate sprite sheets from individual images
- **WebP/AVIF support**: Use modern image formats for smaller file sizes

---

## Files to Create/Modify (summary)

| Action | File |
|---|---|
| Create | `src/render/sprites/SpriteDefinition.ts` |
| Create | `src/render/sprites/SpriteRegistry.ts` |
| Create | `src/render/sprites/AssetManager.ts` |
| Create | `src/render/sprites/SpriteRenderer.ts` |
| Create | `src/render/sprites/manifest-loader.ts` |
| Create | `src/render/sprites/terrain/TerrainSprites.ts` |
| Create | `src/render/sprites/zones/ResidentialSprites.ts` |
| Create | `src/render/sprites/zones/CommercialSprites.ts` |
| Create | `src/render/sprites/zones/IndustrialSprites.ts` |
| Create | `src/render/sprites/buildings/ServiceSprites.ts` |
| Create | `src/render/sprites/index.ts` |
| Modify | `src/render/CanvasRenderer.ts` |
| Modify | `src/main.ts` |
| Create | `public/assets/sprites/manifest.json` |
| Create | `src/__tests__/sprites.test.ts` |
