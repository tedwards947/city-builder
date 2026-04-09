// Barrel import that registers all procedural fallback sprites
// Import for side-effects — these files register sprites in SPRITE_REGISTRY

import './terrain/TerrainSprites';
import './zones/ResidentialSprites';
import './zones/CommercialSprites';
import './zones/IndustrialSprites';
import './buildings/ServiceSprites';

// Re-export key types and singletons for convenience
export { SPRITE_REGISTRY } from './SpriteRegistry';
export { ASSET_MANAGER } from './AssetManager';
export { SpriteRenderer } from './SpriteRenderer';
export { loadSpritesFromManifest } from './manifest-loader';
export type { SpriteDefinition, DrawFn, SpriteFrame, AnimationConfig } from './SpriteDefinition';
export type { SpriteSheetManifest } from './AssetManager';
