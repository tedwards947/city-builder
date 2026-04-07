// All costs, tax rates, maintenance costs, and balance constants.
// Will migrate to balance.json in Phase 4. No magic numbers in game code.

export const BALANCE = {
  costs: {
    road: 10,
    zoneR: 20,
    zoneC: 25,
    zoneI: 25,
    powerPlant: 2000,
    waterTower: 500,
    sewagePlant: 1500,
    bulldoze: 5,
    // Service buildings — keyed by BUILDING_* constant (4–8)
    service: { 4: 1200, 5: 800, 6: 1500, 7: 3000, 8: 300 } as Record<number, number>,
  },
  tax: {
    // Per developed level per sim tick.
    zoneR: 0.8,
    zoneC: 1.2,
    zoneI: 1.5,
  },
  maintenance: {
    road: 0.01,
    powerPlant: 5,
    waterTower: 2,
    sewagePlant: 3,
    // Service buildings — keyed by BUILDING_* constant (4–8)
    service: { 4: 3, 5: 2, 6: 4, 7: 6, 8: 0.5 } as Record<number, number>,
  },
  power: {
    plantOutput: 500,    // supply per plant
    perDevLevel: 2,      // demand per developed level
    propagationRange: 1, // tiles off road that receive power
  },
  water: {
    towerOutput: 300,    // supply per tower (zones it can serve)
    perDevLevel: 1,      // demand per developed level
    propagationRange: 1, // tiles off road that receive water
  },
  sewage: {
    plantOutput: 400,    // capacity per plant (dev-level units)
    perDevLevel: 2,      // demand per developed level (high-density zones produce more)
    propagationRange: 1, // tiles off road that receive sewage coverage
  },
  service: {
    // Coverage radius (manhattan distance) per building kind (4–8)
    coverageRange: { 4: 5, 5: 5, 6: 4, 7: 6, 8: 3 } as Record<number, number>,
  },
  landValue: {
    base: 80,             // starting value before modifiers (0–255 scale)
    serviceBonus: 35,     // if services[i] === 1
    powerBonus: 10,       // if power[i] === 1
    waterBonus: 10,       // if water[i] === 1
    pollutionPenalty: 0.35,  // multiplied by pollution byte value
    industryRadius: 2,    // tiles to scan for nearby I zones
    industryPenalty: 18,  // per adjacent developed I zone tile
    neighborBonus: 5,     // per adjacent developed non-I zone tile
    smoothing: 0.25,      // blend rate toward target per LandValueSystem tick
  },
  demand: {
    // Neutral (demand=1.0) ratio of (C+I) dev levels per R dev level
    jobsPerResident: 0.35,
    // Neutral ratio of R dev levels per C dev level
    residentsPerCommerce: 4,
    // Neutral ratio of (R+C) dev levels per I dev level
    workersPerIndustry: 6,
    min: 0.25,   // floor so a zone type never fully stalls
    max: 2.0,    // ceiling
  },
  pollution: {
    industryOutput: 30,  // added per industrial dev level per tick
    powerPlantOutput: 15,// added per power plant per tick
    decayRate: 0.90,     // fraction remaining after decay each tick (0-1)
    diffusionRate: 0.12, // fraction spreading to each of 4 neighbors per tick
    growthThreshold: 40, // 0-255: R/C zones above this can't grow
  },
  growth: {
    tickInterval: 4,
    probability: 0.08,
    maxLevel: 3,
    popPerLevel: { 1: 4, 2: 10, 3: 20 } as Record<number, number>,
  },
  transit: {
    flowInterval: 8,      // run every 8 ticks (slower than growth)
    rGenRate: 1.0,        // trip units per R devLevel (TripGenerator: residents leaving)
    cAttrRate: 1.0,       // trip units per C devLevel (TripAttractor: commerce destinations)
    iAttrRate: 1.5,       // trip units per I devLevel (TripAttractor: more workers per tile)
    spreadRadius: 4,      // road tiles within this manhattan distance receive load
    streetCapacity: 20,   // flow units at which congestion saturates (255)
  },
  ticksPerDay: 8,
  baseTickMs: 500,      // 2 ticks/sec at 1×
  startingMoney: 20000,
  startingPoliticalCapital: 100,
} as const;
