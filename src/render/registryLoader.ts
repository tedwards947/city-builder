import { SpriteRegistry } from './SpriteRegistry';
import { TestHouse } from './entities/TestHouse';
import { IndustrialHouse } from './entities/IndustrialHouse';
import * as ResL1Good from './entities/res-low/ResidentialL1Good';
import * as ResL2Good from './entities/res-low/ResidentialL2Good';
import * as ResL3Good from './entities/res-low/ResidentialL3Good';

/**
 * Initializes the sprite registry with all available entities.
 */
export function initSpriteRegistry(): void {
  const reg = SpriteRegistry.instance;
  
  // Register all entities here
  reg.register(TestHouse);
  reg.register(IndustrialHouse);

  // Residential Level 1 (Good ones)
  Object.values(ResL1Good).forEach(entity => reg.register(entity as any));

  // Residential Level 2 (Good ones)
  Object.values(ResL2Good).forEach(entity => reg.register(entity as any));

  // Residential Level 3 (Good ones)
  Object.values(ResL3Good).forEach(entity => reg.register(entity as any));
}
