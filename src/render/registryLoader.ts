import { SpriteRegistry } from './SpriteRegistry';
import { TestHouse } from './entities/TestHouse';
import { IndustrialHouse } from './entities/IndustrialHouse';
import * as CottageL1 from './entities/res-low/CottageL1';
import * as ModernBoxL1 from './entities/res-low/ModernBoxL1';
import * as AFrameCabinL1 from './entities/res-low/AFrameCabinL1';
import * as AdobeHomeL1 from './entities/res-low/AdobeHomeL1';
import * as SuburbanBlueL1 from './entities/res-low/SuburbanBlueL1';
import * as ZenPagodaL1 from './entities/res-low/ZenPagodaL1';
import * as GeodesicDomeL1 from './entities/res-low/GeodesicDomeL1';
import * as BrickManorL2 from './entities/res-low/BrickManorL2';
import * as SuburbanLargeL2 from './entities/res-low/SuburbanLargeL2';
import * as AdobeVillaL2 from './entities/res-low/AdobeVillaL2';
import * as ContemporaryGlassL2 from './entities/res-low/ContemporaryGlassL2';
import * as ModernBlackStackedL2 from './entities/res-low/ModernBlackStackedL2';
import * as ColonialEstateL2 from './entities/res-low/ColonialEstateL2';
import * as ModernWhiteEstateL2 from './entities/res-low/ModernWhiteEstateL2';
import * as SteelDuplexL2 from './entities/res-low/SteelDuplexL2';
import * as GeodesicComplexL2 from './entities/res-low/GeodesicComplexL2';
import * as BrickTownhomeL2 from './entities/res-low/BrickTownhomeL2';
import * as LuxuryCabinL2 from './entities/res-low/LuxuryCabinL2';
import * as AsianModernTowerL2 from './entities/res-low/AsianModernTowerL2';
import * as EcoDomeStackL2 from './entities/res-low/EcoDomeStackL2';
import * as MediterraneanMansionL2 from './entities/res-low/MediterraneanMansionL2';
import * as IndustrialLoftL2 from './entities/res-low/IndustrialLoftL2';
import * as ModernResearchTowerL3 from './entities/res-low/ModernResearchTowerL3';
import * as EcoRetreatL3 from './entities/res-low/EcoRetreatL3';
import * as IndustrialMegaLoftL3 from './entities/res-low/IndustrialMegaLoftL3';
import * as GlassMansardEstateL3 from './entities/res-low/GlassMansardEstateL3';
import * as CorporateGlassMonolithL3 from './entities/res-low/CorporateGlassMonolithL3';
import * as GrandAdobePalaceL3 from './entities/res-low/GrandAdobePalaceL3';
import * as GrandSuburbanEstateL3 from './entities/res-low/GrandSuburbanEstateL3';
import * as CommL1Batch1 from './entities/comm-low/CommercialL1Batch1';
import * as CommL1Batch2 from './entities/comm-low/CommercialL1Batch2';
import * as CommL1Batch3 from './entities/comm-low/CommercialL1Batch3';
import * as CommL1Batch4 from './entities/comm-low/CommercialL1Batch4';
import * as SawtoothMillL1 from './entities/ind-low/SawtoothMillL1';
import * as PeakedWorkshopL1 from './entities/ind-low/PeakedWorkshopL1';
import * as FlatTopFactoryL1 from './entities/ind-low/FlatTopFactoryL1';
import * as BasicWarehouseL1 from './entities/ind-low/BasicWarehouseL1';
import * as SmallChemicalPlantL1 from './entities/ind-low/SmallChemicalPlantL1';
import * as MultiTankDepotL1 from './entities/ind-low/MultiTankDepotL1';
import * as ArtDecoWorkshopL1 from './entities/ind-low/ArtDecoWorkshopL1';
import * as MiniFlareL1 from './entities/ind-low/MiniFlareL1';
import * as TechStartUpL1 from './entities/ind-low/TechStartUpL1';
import * as RuralSiloL1 from './entities/ind-low/RuralSiloL1';
import * as OldMillL1 from './entities/ind-low/OldMillL1';
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

  // Residential Level 1 (Individual assets)
  Object.values(CottageL1).forEach(entity => reg.register(entity as any));
  Object.values(ModernBoxL1).forEach(entity => reg.register(entity as any));
  Object.values(AFrameCabinL1).forEach(entity => reg.register(entity as any));
  Object.values(AdobeHomeL1).forEach(entity => reg.register(entity as any));
  Object.values(SuburbanBlueL1).forEach(entity => reg.register(entity as any));
  Object.values(ZenPagodaL1).forEach(entity => reg.register(entity as any));
  Object.values(GeodesicDomeL1).forEach(entity => reg.register(entity as any));

  // Residential Level 2 (Individual assets)
  Object.values(BrickManorL2).forEach(entity => reg.register(entity as any));
  Object.values(SuburbanLargeL2).forEach(entity => reg.register(entity as any));
  Object.values(AdobeVillaL2).forEach(entity => reg.register(entity as any));
  Object.values(ContemporaryGlassL2).forEach(entity => reg.register(entity as any));
  Object.values(ModernBlackStackedL2).forEach(entity => reg.register(entity as any));
  Object.values(ColonialEstateL2).forEach(entity => reg.register(entity as any));
  Object.values(ModernWhiteEstateL2).forEach(entity => reg.register(entity as any));
  Object.values(SteelDuplexL2).forEach(entity => reg.register(entity as any));
  Object.values(GeodesicComplexL2).forEach(entity => reg.register(entity as any));
  Object.values(BrickTownhomeL2).forEach(entity => reg.register(entity as any));
  Object.values(LuxuryCabinL2).forEach(entity => reg.register(entity as any));
  Object.values(AsianModernTowerL2).forEach(entity => reg.register(entity as any));
  Object.values(EcoDomeStackL2).forEach(entity => reg.register(entity as any));
  Object.values(MediterraneanMansionL2).forEach(entity => reg.register(entity as any));
  Object.values(IndustrialLoftL2).forEach(entity => reg.register(entity as any));

  // Residential Level 3 (Individual assets)
  Object.values(ModernResearchTowerL3).forEach(entity => reg.register(entity as any));
  Object.values(EcoRetreatL3).forEach(entity => reg.register(entity as any));
  Object.values(IndustrialMegaLoftL3).forEach(entity => reg.register(entity as any));
  Object.values(GlassMansardEstateL3).forEach(entity => reg.register(entity as any));
  Object.values(CorporateGlassMonolithL3).forEach(entity => reg.register(entity as any));
  Object.values(GrandAdobePalaceL3).forEach(entity => reg.register(entity as any));
  Object.values(GrandSuburbanEstateL3).forEach(entity => reg.register(entity as any));

  // Commercial Level 1 Batches
  Object.values(CommL1Batch1).forEach(entity => reg.register(entity as any));
  Object.values(CommL1Batch2).forEach(entity => reg.register(entity as any));
  Object.values(CommL1Batch3).forEach(entity => reg.register(entity as any));
  Object.values(CommL1Batch4).forEach(entity => reg.register(entity as any));

  // Industrial Level 1 (Individual assets)
  Object.values(SawtoothMillL1).forEach(entity => reg.register(entity as any));
  Object.values(PeakedWorkshopL1).forEach(entity => reg.register(entity as any));
  Object.values(FlatTopFactoryL1).forEach(entity => reg.register(entity as any));
  Object.values(BasicWarehouseL1).forEach(entity => reg.register(entity as any));
  Object.values(SmallChemicalPlantL1).forEach(entity => reg.register(entity as any));
  Object.values(MultiTankDepotL1).forEach(entity => reg.register(entity as any));
  Object.values(ArtDecoWorkshopL1).forEach(entity => reg.register(entity as any));
  Object.values(MiniFlareL1).forEach(entity => reg.register(entity as any));
  Object.values(TechStartUpL1).forEach(entity => reg.register(entity as any));
  Object.values(RuralSiloL1).forEach(entity => reg.register(entity as any));
  Object.values(OldMillL1).forEach(entity => reg.register(entity as any));

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
