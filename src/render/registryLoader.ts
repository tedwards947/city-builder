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
import * as PharmaCompany from './entities/ind-low/PharmaCompany';
import * as SemiconductorFab from './entities/ind-low/SemiconductorFab';
import * as GrainElevator from './entities/ind-low/GrainElevator';
import * as TextileMill from './entities/ind-low/TextileMill';
import * as ArtDecoL3 from './entities/ind-high/ArtDecoL3';
import * as RefineryL3 from './entities/ind-high/RefineryL3';
import * as MegaBrickL3 from './entities/ind-high/MegaBrickL3';
import * as SteelDepotL3 from './entities/ind-high/SteelDepotL3';
import * as GrandSawtoothL3 from './entities/ind-high/GrandSawtoothL3';
import * as LogisticsHubL3 from './entities/ind-high/LogisticsHubL3';
import * as PharmaCampusL3 from './entities/ind-high/PharmaCampusL3';
import * as MegaFabL3 from './entities/ind-high/MegaFabL3';
import * as TerminalElevatorL3 from './entities/ind-high/TerminalElevatorL3';
import * as TextileComplexL3 from './entities/ind-high/TextileComplexL3';

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

  // Industrial Level 2 (Good ones)
  Object.values(ArtDecoFactory).forEach(entity => reg.register(entity as any));
  Object.values(OilRefinery).forEach(entity => reg.register(entity as any));
  Object.values(OldBrickFactory).forEach(entity => reg.register(entity as any));
  Object.values(SteelShed).forEach(entity => reg.register(entity as any));
  Object.values(BrickSawtoothFactory).forEach(entity => reg.register(entity as any));
  Object.values(GenericWarehouse).forEach(entity => reg.register(entity as any));
  Object.values(PharmaCompany).forEach(entity => reg.register(entity as any));
  Object.values(SemiconductorFab).forEach(entity => reg.register(entity as any));
  Object.values(GrainElevator).forEach(entity => reg.register(entity as any));
  Object.values(TextileMill).forEach(entity => reg.register(entity as any));

  // Industrial Level 3 (Grand versions)
  Object.values(ArtDecoL3).forEach(entity => reg.register(entity as any));
  Object.values(RefineryL3).forEach(entity => reg.register(entity as any));
  Object.values(MegaBrickL3).forEach(entity => reg.register(entity as any));
  Object.values(SteelDepotL3).forEach(entity => reg.register(entity as any));
  Object.values(GrandSawtoothL3).forEach(entity => reg.register(entity as any));
  Object.values(LogisticsHubL3).forEach(entity => reg.register(entity as any));
  Object.values(PharmaCampusL3).forEach(entity => reg.register(entity as any));
  Object.values(MegaFabL3).forEach(entity => reg.register(entity as any));
  Object.values(TerminalElevatorL3).forEach(entity => reg.register(entity as any));
  Object.values(TextileComplexL3).forEach(entity => reg.register(entity as any));
}
