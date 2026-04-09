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
