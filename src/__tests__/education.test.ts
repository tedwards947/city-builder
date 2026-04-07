import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { EducationSystem } from '../sim/systems/EducationSystem';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { CrimeSystem } from '../sim/systems/CrimeSystem';
import {
  ZONE_R, ZONE_C, ZONE_I,
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT, BUILDING_SCHOOL,
  ROAD_STREET
} from '../sim/constants';
import { BALANCE } from '../data/balance';

describe('EducationSystem', () => {
  let world: World;
  let serviceSystem: ServiceSystem;
  let educationSystem: EducationSystem;

  beforeEach(() => {
    world = new World(20, 20);
    serviceSystem = new ServiceSystem();
    educationSystem = new EducationSystem();
  });

  it('increases education level when a school is nearby', () => {
    // Set up a residential zone with road and power/water (not strictly needed for EducationSystem but good for realism)
    world.setZone(5, 5, ZONE_R);
    world.setRoad(5, 6, ROAD_STREET);
    world.placeBuilding(4, 6, BUILDING_SCHOOL);

    // Run ServiceSystem to update school coverage
    serviceSystem.update(world);
    expect(world.layers.school[world.grid.idx(5, 5)]).toBe(1);

    // Run EducationSystem multiple times
    const initialEdu = world.layers.education[world.grid.idx(5, 5)];
    expect(initialEdu).toBe(0);

    educationSystem.update(world);
    const eduAfter1 = world.layers.education[world.grid.idx(5, 5)];
    expect(eduAfter1).toBeGreaterThan(initialEdu);

    for (let i = 0; i < 10; i++) educationSystem.update(world);
    const eduAfter10 = world.layers.education[world.grid.idx(5, 5)];
    expect(eduAfter10).toBeGreaterThan(eduAfter1);
  });

  it('decays education level when no school is nearby', () => {
    world.setZone(5, 5, ZONE_R);
    world.layers.education[world.grid.idx(5, 5)] = 100;

    // No school coverage
    serviceSystem.update(world);
    expect(world.layers.school[world.grid.idx(5, 5)]).toBe(0);

    educationSystem.update(world);
    expect(world.layers.education[world.grid.idx(5, 5)]).toBeLessThan(100);
  });

  it('limits growth of residential zones based on education', () => {
    const growthSystem = new ZoneGrowthSystem();
    
    // Setup tile at level 2
    const idx = world.grid.idx(5, 5);
    world.setZone(5, 5, ZONE_R);
    world.layers.devLevel[idx] = 2;
    world.layers.power[idx] = 1;
    world.layers.water[idx] = 1;
    world.layers.sewage[idx] = 1;
    world.layers.services[idx] = 1;
    world.setRoad(5, 6, ROAD_STREET);
    world.stats.powerSupply = 1000;
    world.stats.powerDemand = 10;
    world.stats.waterSupply = 1000;
    world.stats.waterDemand = 10;
    world.stats.sewageSupply = 1000;
    world.stats.sewageDemand = 10;
    
    // Education is 0, below threshold (100)
    world.layers.education[idx] = 0;
    
    // Mock RNG to always succeed growth check
    world.rng = () => 0; 
    
    growthSystem.update(world);
    expect(world.layers.devLevel[idx]).toBe(2); // Should NOT grow to 3
    
    // Set education above threshold
    world.layers.education[idx] = 150;
    
    // Aligh tick for growth (BALANCE.growth.tickInterval is 4)
    world.tick = 4;
    growthSystem.update(world);
    expect(world.layers.devLevel[idx]).toBe(3); // Should grow to 3
  });

  it('increases tax income from educated residential zones', () => {
    const economySystem = new EconomySystem();
    
    world.setZone(5, 5, ZONE_R);
    world.layers.devLevel[world.grid.idx(5, 5)] = 1;
    
    // Neutral land value
    world.layers.landValue[world.grid.idx(5, 5)] = 128;
    
    // Case 1: 0 education
    world.layers.education[world.grid.idx(5, 5)] = 0;
    economySystem.update(world);
    const incomeLow = world.budget.income;
    
    // Case 2: Max education
    world.layers.education[world.grid.idx(5, 5)] = 255;
    economySystem.update(world);
    const incomeHigh = world.budget.income;
    
    expect(incomeHigh).toBeGreaterThan(incomeLow);
    expect(incomeHigh).toBeCloseTo(incomeLow * BALANCE.education.taxMultiplier);
  });

  it('reduces crime in educated residential zones', () => {
    const crimeSystem = new CrimeSystem();
    
    world.setZone(5, 5, ZONE_R);
    world.layers.devLevel[world.grid.idx(5, 5)] = 1;
    
    // Case 1: 0 education
    world.layers.education[world.grid.idx(5, 5)] = 0;
    for(let i=0; i<50; i++) crimeSystem.update(world); // Converge to target
    const crimeHigh = world.layers.crime[world.grid.idx(5, 5)];
    
    // Case 2: Max education
    world.layers.education[world.grid.idx(5, 5)] = 255;
    for(let i=0; i<50; i++) crimeSystem.update(world); // Converge to target
    const crimeLow = world.layers.crime[world.grid.idx(5, 5)];
    
    expect(crimeLow).toBeLessThan(crimeHigh);
    // Education reduction is 0.4 (60% reduction)
    expect(crimeLow).toBeLessThan(crimeHigh * 0.5); 
  });
});
