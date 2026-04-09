# Vector Sprite Generation Guide

This guide explains how to create and register new procedural graphics for City Builder.

Do not use nanobanana mcp for image generation. These will not be in png or jpg or image files.

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
