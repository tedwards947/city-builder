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
