import { SpriteRegistry } from './SpriteRegistry';
import { TestHouse } from './entities/TestHouse';
import { IndustrialHouse } from './entities/IndustrialHouse';

/**
 * Initializes the sprite registry with all available entities.
 */
export function initSpriteRegistry(): void {
  const reg = SpriteRegistry.instance;
  
  // Register all entities here
  reg.register(TestHouse);
  reg.register(IndustrialHouse);
}
