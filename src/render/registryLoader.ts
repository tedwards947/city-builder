import { SpriteRegistry } from './SpriteRegistry';
import { TestHouse } from './entities/TestHouse';
import { IndustrialHouse } from './entities/IndustrialHouse';
import * as ResL1Good from './entities/res-low/ResidentialL1Good';
import * as ResL2Good from './entities/res-low/ResidentialL2Good';
import * as ResL3Good from './entities/res-low/ResidentialL3Good';
import * as CommL1Batch1 from './entities/comm-low/CommercialL1Batch1';
import * as CommL1Batch2 from './entities/comm-low/CommercialL1Batch2';
import * as CommL1Batch3 from './entities/comm-low/CommercialL1Batch3';
import * as CommL1Batch4 from './entities/comm-low/CommercialL1Batch4';
import * as IndL1Good from './entities/ind-low/IndustrialL1Good';
import * as ArtDecoFactory from './entities/ind-low/ArtDecoFactory';
import * as OilRefinery from './entities/ind-low/OilRefinery';
import * as OldBrickFactory from './entities/ind-low/OldBrickFactory';
import * as SteelShed from './entities/ind-low/SteelShed';
import * as BrickSawtoothFactory from './entities/ind-low/BrickSawtoothFactory';
import * as GenericWarehouse from './entities/ind-low/GenericWarehouse';

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

  // Commercial Level 1 Batches
  Object.values(CommL1Batch1).forEach(entity => reg.register(entity as any));
  Object.values(CommL1Batch2).forEach(entity => reg.register(entity as any));
  Object.values(CommL1Batch3).forEach(entity => reg.register(entity as any));
  Object.values(CommL1Batch4).forEach(entity => reg.register(entity as any));

  // Industrial Level 1 (Good ones)
  Object.values(IndL1Good).forEach(entity => reg.register(entity as any));

  // Industrial Level 2 (Art Deco)
  Object.values(ArtDecoFactory).forEach(entity => reg.register(entity as any));

  // Industrial Level 2 (Oil Refinery)
  Object.values(OilRefinery).forEach(entity => reg.register(entity as any));

  // Industrial Level 2 (Old Brick)
  Object.values(OldBrickFactory).forEach(entity => reg.register(entity as any));

  // Industrial Level 2 (Steel Shed)
  Object.values(SteelShed).forEach(entity => reg.register(entity as any));

  // Industrial Level 2 (Brick Sawtooth)
  Object.values(BrickSawtoothFactory).forEach(entity => reg.register(entity as any));

  // Industrial Level 2 (Generic Warehouse)
  Object.values(GenericWarehouse).forEach(entity => reg.register(entity as any));
}
