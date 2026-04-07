// All costs, tax rates, maintenance costs, and balance constants.
// No magic numbers in game code.

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
    decayRate: 0.94,     // fraction remaining after decay each tick (0-1)
    diffusionRate: 0.15, // fraction spreading to each of 4 neighbors per tick
    growthThreshold: 20, // 0-255: R/C zones above this can't grow
    // Vegetation pollution reduction — fraction of the current decay rate.
    // e.g. if decayRate is 0.94 and vegDecayMult is 0.9, the effective decay on that tile is 0.846.
    vegDecayMult: 0.95,       // single tree / sparse
    vegDecayMultForest: 0.88,  // dense forest (species 1-6 are currently all treated same, but could differentiate)
  },
  growth: {
    tickInterval: 4,
    probability: 0.08,
    maxLevel: 3,
    popPerLevel: { 1: 4, 2: 10, 3: 20 } as Record<number, number>,
  },
  // Per road-class data — keyed by ROAD_STREET/AVENUE/HIGHWAY (1/2/3).
  // upgrade cost = roadClasses[target].cost − roadClasses[current].cost
  roadClasses: {
    1: { cost: 10,  maintenance: 0.01, capacity: 20,  speedMult: 1.0 }, // Street
    2: { cost: 50,  maintenance: 0.04, capacity: 80,  speedMult: 1.4 }, // Avenue
    3: { cost: 150, maintenance: 0.12, capacity: 200, speedMult: 2.0 }, // Highway
  } as Record<number, { cost: number; maintenance: number; capacity: number; speedMult: number }>,
  transit: {
    flowInterval: 8,      // run every 8 ticks (slower than growth)
    // Legacy radial-spread params kept for backward compat (no longer used by TransitSystem).
    rGenRate: 1.0,
    cAttrRate: 1.0,
    iAttrRate: 1.5,
    spreadRadius: 4,
    streetCapacity: 20,
    congestionGrowthPenalty: 0.75, // max growth probability reduction at full congestion (congestion=255)
    // ── Road-network pathing ─────────────────────────────────────────────────
    // BFS radius (road hops) for zone-to-road load spreading.
    // Higher = zones spread traffic to more distant roads; raises cost per tick.
    accessRadius: 8,
    // Scales raw road-tile complementary load → 0-255 accessibility byte.
    // Tune upward if accessibility is always near 0; downward if always near 255.
    accessNormFactor: 60,
    // Growth multiplier floor for zone tiles with zero accessibility.
    // 0.3 = isolated zones grow at 30% normal rate, so the map isn't dead at game
    // start but poor connectivity is a meaningful drag on development.
    accessFloor: 0.3,
  },
  agents: {
    maxVehicles:   80,   // hard cap — sim is correct with zero
    spawnInterval: 0.4,  // seconds between spawn attempts
    baseSpeed:     1.8,  // tiles per second at zero congestion
    minTtl:        12,   // seconds
    maxTtl:        28,   // seconds
  },
  vegetation: {
    // Probability per grass/sand tile for a "seed" tree (starts a cluster)
    seedProbability: 0.012,
    // Probability per grass/sand tile for a sparse random tree
    sparseProbability: 0.02,
    // Probability to grow from an existing tree to a neighbor
    clusterGrowProbability: 0.45,
    // Multiplier for all probabilities if adjacent to water (lower = fewer trees)
    shorelinePenalty: 0.01,
  },
  // ── City Character ───────────────────────────────────────────────────────────
  // Each axis ranges from −axisMax to +axisMax.
  // Positive values lean toward: egalitarian / green / planned.
  // Negative values lean toward: laissez-faire / industrial / organic.
  // Add new nudge keys by adding entries here + handling them in CityCharacterSystem.
  character: {
    axisMax: 100,
    // Per-tick decay toward neutral — very slow so character accumulates and persists.
    // At axisMax with this rate: ~6000 ticks (~750 game-days) to fully decay.
    decayRate: 0.015,
    nudges: {
      egalitarian: {
        serviceBuilt:          3.0,  // placing police/fire/school/hospital
        parkBuilt:             1.0,  // parks are mildly egalitarian
        populationDisplaced:  -0.5,  // per resident displaced (bulldoze/repaint)
        industrialZone:       -1.0,  // per I zone painted
        residentialZone:       0.3,  // per R zone painted
      },
      green: {
        parkBuilt:             5.0,
        industrialZone:       -3.0,  // per I zone painted
        powerPlantBuilt:      -2.0,
        residentialZone:       0.2,
        commercialZone:        0.1,
      },
      planned: {
        roadBuilt:             0.15, // roads = deliberate infrastructure
        serviceBuilt:          0.5,
        populationDisplaced:  -0.3,  // displacement = unplanned demolition
        residentialZone:       0.05,
      },
    },
  },

  // ── Abandonment ──────────────────────────────────────────────────────────────
  // Zones lose conditions long enough → distress accumulates → abandonment.
  // Abandoned tiles generate no income and cannot grow.
  // Conditions are checked every distressInterval ticks.
  // More contributors (crime, fire) can be added to AbandonmentSystem later.
  abandonment: {
    distressInterval: 4,    // ticks between distress checks (aligned with growth interval)
    abandonThreshold: 12,   // distress checks without conditions before abandonment (~6 game-days)
  },

  ticksPerDay: 8,
  baseTickMs: 500,      // 2 ticks/sec at 1×
  startingMoney: 20000,
  startingPoliticalCapital: 100,

  // ── Political Capital ────────────────────────────────────────────────────────
  // PC regenerates each tick based on citizen satisfaction.
  // Disruptive player actions drain it. The cap is enforced by PoliticsSystem.
  politicalCapital: {
    max: 100,
    // Passive regen per tick regardless of satisfaction.
    baseRegen: 0.1,
    // Additional regen per tick at 100% satisfaction (scales linearly).
    // Total regen range: 0.1 (miserable city) → 0.4 (happy city).
    satisfactionRegenBonus: 0.3,
    // Named satisfaction factors with weights (must sum to 1.0).
    // Keys are matched by name to SatisfactionFactor.name in PoliticsSystem.
    // Add new factors here + implement compute() in PoliticsSystem.defaultFactors().
    satisfactionWeights: {
      servicesCoverage: 0.50, // fraction of developed R zones with service coverage
      powerCoverage:    0.25, // fraction of developed zones with power
      waterCoverage:    0.25, // fraction of developed zones with water
    } as Record<string, number>,
    // Costs for disruptive actions — applied at execute() time, same as money costs.
    // Gating: if budget.politicalCapital < cost, the action is blocked.
    disruptionCosts: {
      bulldozePerPop: 3.5, // per displaced resident (level-3 R zone = 20 pop → 70 PC)
    },
  },
} as const;
