// All costs, tax rates, maintenance costs, and balance constants.
// No magic numbers in game code.

export const BALANCE = {
  costs: {
    road: 10,
    bridgeMultiplier: 3,
    // Zoning is free in money (owner's decision after the PC play-test): the
    // cost of zoning is political, not financial. Set a price here and it is
    // charged per tile again.
    zoneR: 0,
    zoneC: 0,
    zoneI: 0,
    bulldoze: 5,
  },
  // Placement cost and per-tick maintenance for every BUILDING_* kind.
  // Keyed by the numeric constant (1=power plant, 2=water tower, …, 8=park).
  buildings: {
    1: { cost: 2000, maintenance: 15  }, // BUILDING_POWER_PLANT
    2: { cost: 500,  maintenance: 6   }, // BUILDING_WATER_TOWER
    3: { cost: 1500, maintenance: 10  }, // BUILDING_SEWAGE_PLANT
    4: { cost: 1200, maintenance: 12  }, // BUILDING_POLICE
    5: { cost: 800,  maintenance: 10  }, // BUILDING_FIRE
    6: { cost: 1500, maintenance: 15  }, // BUILDING_SCHOOL
    7: { cost: 3000, maintenance: 25  }, // BUILDING_HOSPITAL
    8: { cost: 300,  maintenance: 4   }, // BUILDING_PARK
    // Large utilities. PLACEHOLDERS until the balance lab sets them: more
    // output per $ than the small ones (3×3: about 12× the output for 8× the
    // cost and upkeep; 2×2: about 5× for 3.5×). Outputs are under power /
    // water / sewage below.
    9:  { cost: 16000, maintenance: 120 }, // BUILDING_LARGE_POWER_PLANT (3×3)
    10: { cost: 1750,  maintenance: 21  }, // BUILDING_LARGE_WATER_PLANT (2×2)
    11: { cost: 5250,  maintenance: 35  }, // BUILDING_LARGE_SEWAGE_PLANT (2×2)
    // The seaport (a 4×3 yard plus a row of docks over open water). Placeholder
    // numbers until the lab tunes it: dear to build and dear to run.
    12: { cost: 200000, maintenance: 30 }, // BUILDING_SEAPORT
  } as Record<number, { cost: number; maintenance: number }>,
  tax: {
    // Per developed level per sim tick.
    zoneR: 0.65,
    zoneC: 1.0,
    zoneI: 1.25,
    // Industry does not care about desirability: its tax uses this fixed
    // multiplier instead of landValue/128. (Industrial tiles pollute themselves
    // down to ~0 land value, which made them pay almost no tax.)
    industryLandValueMult: 0.6,
    // Homes and shops pay land-value-scaled tax: floor + (1 − floor) × lv/128.
    // 0 = plain lv/128. A floor stops homes on cheap land paying almost nothing.
    // 0.25 since the owner's economy decision of 2026-11-17 (the "Tight" preset).
    landValueFloor: 0.25,
    // The city's tax level (sim/tax.ts): one percentage the player sets, in
    // world.budget.taxLevel. Tax income is multiplied by level ÷ neutral, and
    // satisfaction gains satisfactionPerPoint for every point below neutral
    // (loses it for every point above). Growth demand in every zone is
    // multiplied by (neutral ÷ level) ^ demandStrength: 1 = the same rule as
    // the per-zone rates, 0 = no effect. At neutral nothing changes.
    level: { min: 0, max: 20, neutral: 10, step: 1, satisfactionPerPoint: 0.01, demandStrength: 1 },
  },
  maintenance: {
    road: 0.04,
    // Multiplies the upkeep of service buildings (police, fire, school, hospital, park),
    // so the per-building figures in `buildings` are before this. 0.75 since the
    // owner's economy decision of 2026-11-17 (the "Tight" preset); it was 1.
    serviceMult: 0.75,
  },
  power: {
    plantOutput: 350,    // supply per plant
    largePlantOutput: 4200, // supply per large (3×3) plant. Placeholder: 12 small plants.
    perDevLevel: 2,      // demand per developed level
    propagationRange: 1, // tiles off road that receive power
  },
  water: {
    towerOutput: 250,    // supply per tower (zones it can serve)
    largePlantOutput: 1250, // supply per large (2×2) plant. Placeholder: 5 towers.
    perDevLevel: 1,      // demand per developed level
    propagationRange: 1, // tiles off road that receive water
  },
  sewage: {
    plantOutput: 300,    // capacity per plant (dev-level units)
    largePlantOutput: 1500, // capacity per large (2×2) plant. Placeholder: 5 small plants.
    perDevLevel: 2,      // demand per developed level (high-density zones produce more)
    propagationRange: 1, // tiles off road that receive sewage coverage
  },
  service: {
    // Reach in road steps along streets and avenues, per building kind
    // (4 police, 5 fire, 6 school, 7 hospital, 8 park). Police, fire and
    // parks are served by reach alone. Schools and hospitals reach far and
    // are limited by capacity instead (owner's services numbers, 2026-11-17;
    // they were 8 and 8). A hospital keeps a real reach so it cannot be
    // hidden away in an industrial district.
    coverageRange: { 4: 15, 5: 15, 6: 20, 7: 30, 8: 6 } as Record<number, number>,
    // Residents one building can serve, by building kind (6 school, 7
    // hospital): a home is covered only if a building in reach has room for
    // it (sim/serviceCapacity.ts). 0 or missing = no limit, reach alone
    // decides. So schools and hospitals scale with population: you add one
    // when the existing ones are full, not when the city sprawls.
    capacity: { 6: 4000, 7: 8000 } as Record<number, number>,
  },
  crime: {
    // Base crime added per tick per developed level.
    baseRateR: 0.7,
    baseRateC: 1.4,
    baseRateI: 0.5,
    // Crime reduction multiplier if police[i] === 1.
    policeEffectiveness: 0.15, // 85% reduction
    // Smoothing factor (blend rate toward target per tick).
    smoothing: 0.1,
    // Crime level (0-255) above which R/C zones can't grow.
    growthThreshold: 100,
    // Crime level (0-255) above which a tile slowly accumulates distress.
    // Sits above unpoliced commercial L2 (~112) so that level is stable.
    distressThreshold: 130,
    // Crime level (0-255) at which a tile is in severe distress and abandons fast.
    // Unpoliced commercial L3 peaks at ~168, so L3 commerce needs police.
    abandonThreshold: 150,
    // City-wide average crime (0-255) above which a crimeSpike alert fires.
    alertThreshold: 60,
    // Minimum ticks between repeated crimeSpike alerts.
    alertCooldownTicks: 40,
  },
  fire: {
    // Probability of fire starting per tick per developed level.
    baseProbability: 0.00015,
    // Risk factors
    riskR: 0.8,
    riskC: 1.0,
    riskI: 1.5,
    // Risk added per pollution level (0-255).
    pollutionRiskMult: 0.15,
    // Fire reduction multiplier if fireStation[i] === 1.
    fireStationEffectiveness: 0.05, // 95% reduction in fire risk/spread
    // Smoothing factor for fire risk.
    riskSmoothing: 0.1,
    // Fire spread probability to adjacent tiles per tick if burning.
    spreadProbability: 0.04,
    // Fire burn duration in ticks.
    burnDuration: 20,
    // Fire risk (0-255) above which abandonment might trigger. Only heavily
    // polluted L3 industry without a fire station gets this high (max ~128).
    abandonThreshold: 110,
    // Dev levels a building loses when a fire burns out on a tile with no fire
    // station coverage. Covered tiles are put out before they take damage.
    damageLevels: 1,
    // Minimum ticks between fireReport events (the grouped "fires with no
    // fire station in reach" alert). 40 ticks = 5 game days.
    reportCooldownTicks: 40,
  },
  education: {
    // Education gain per tick if school[i] === 1.
    baseRate: 2.0,
    // Education decay per tick if school[i] === 0.
    decayRate: 1.0,
    // Tax bonus multiplier for fully educated zones (education=255).
    // scales linearly from 1.0 (education=0) to 1.5 (education=255).
    taxMultiplier: 1.5,
    // Crime reduction multiplier for fully educated zones.
    // scales linearly from 1.0 (no effect) to 0.4 (60% reduction).
    crimeReduction: 0.4,
    // Education level (0-255) above which R zones can grow to level 3.
    growthThreshold: 100,
  },
  healthcare: {
    // Probability per tick of sickness increasing by 1 (no hospital coverage).
    // Expected 0→255 in ~850 ticks ≈ 106 game-days; actual path varies per zone.
    sicknessProbability: 0.3,
    // Probability per tick of sickness decreasing by 1 (hospital coverage).
    // Expected 255→0 in ~425 ticks ≈ 53 game-days.
    recoveryProbability: 0.6,
    // Tax income multiplier at maximum sickness (sickness=255).
    // Scales linearly: 1.0 at sickness=0 → taxPenalty at sickness=255.
    taxPenalty: 0.3,
    // Sickness level above which R zones cannot grow.
    growthThreshold: 180,
    // Probability of a death event per R zone per tick at maximum sickness (sickness=255).
    // At sickness=0, death chance is effectively 0.
    // Scales linearly: 0.000001 + (sickness/255) * deathChanceMax
    // Example: at sickness=255, ~1 death per ~330 ticks (~41 game-days) per zone.
    baseDeathChance: 0.000001,
    deathChanceMax: 0.003,
    // How long the "recent death" visual indicator persists (ticks, decrements by 1/tick).
    // 80 ticks = 10 game-days.
    deathVisualDuration: 80,
    // City-wide average sickness (0-255) above which a healthcareCrisis alert fires.
    crisisThreshold: 100,
    // Minimum ticks between repeated healthcareCrisis alerts.
    crisisCooldownTicks: 40,
  },
  landValue: {
    base: 60,             // starting value before modifiers (0–255 scale)
    serviceBonus: 35,     // if services[i] === 1
    powerBonus: 10,       // if power[i] === 1
    waterBonus: 10,       // if water[i] === 1
    pollutionPenalty: 0.85,  // multiplied by pollution byte value
    congestionPenalty: 0.35, // multiplied by max nearby congestion byte value
    industryRadius: 2,    // tiles to scan for nearby I zones
    industryPenalty: 24,  // per adjacent developed I zone tile
    neighborBonus: 8,     // per adjacent developed non-I zone tile
    abandonedPenalty: 20, // per adjacent abandoned tile
    smoothing: 0.25,      // blend rate toward target per LandValueSystem tick
  },
  demand: {
    // Neutral (demand=1.0) ratio of (C+I) dev levels per R dev level
    jobsPerResident: 0.50,
    // Neutral ratio of R dev levels per C dev level
    residentsPerCommerce: 4,
    // Neutral ratio of (R+C) dev levels per I dev level
    workersPerIndustry: 6,
    min: 0.25,   // floor so a zone type never fully stalls
    max: 2.0,    // ceiling
  },
  pollution: {
    industryOutput: 40,  // added per industrial dev level per tick
    powerPlantOutput: 30,// added per power plant per tick
    // Added per tick on EACH tile of a large (3×3) power plant. Placeholder.
    // Pollution does not add up in a straight line (nine tiles side by side
    // keep each other topped up), so this is well under powerPlantOutput: at
    // 12 a large plant holds about 8× a small one's pollution for 12× the
    // power, and homes and shops touching it cannot grow. At 30 it would be
    // about 30× and blight a ring three tiles deep.
    largePowerPlantOutput: 12,
    // Added per tick on each tile of a seaport's yard (not its docks).
    // SWITCHED OFF at 0 until the lab sets it.
    seaportOutput: 0,
    decayRate: 0.97,     // fraction remaining after decay each tick (0-1)
    diffusionRate: 0.20, // fraction spreading to each of 4 neighbors per tick
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
    1: { cost: 10,  maintenance: 0.04, capacity: 20,  speedMult: 1.0 }, // Street
    2: { cost: 50,  maintenance: 0.12, capacity: 80,  speedMult: 1.4 }, // Avenue
    3: { cost: 150, maintenance: 0.35, capacity: 200, speedMult: 2.0 }, // Highway
  } as Record<number, { cost: number; maintenance: number; capacity: number; speedMult: number }>,
  transit: {
    flowInterval: 8,      // run every 8 ticks (slower than growth)
    // Trips put on the road per developed level of the ORIGIN zone tile.
    // A road tile is full (congestion 255) when the trips passing through it
    // reach its class capacity (street 20, avenue 80, highway 200).
    tripsRtoC: 0.33,      // homes → commerce
    tripsRtoI: 0.34,      // homes → industry
    tripsCtoI: 0.38,      // commerce → industry: shops fetching goods, per COMMERCE level
    // Trips a destination can take per developed level. Trips go to the
    // nearest destination; when it is full the overflow goes on to others with
    // room close by, and what still does not fit shows as over capacity.
    shopCapacity: 2,      // per commerce level
    jobCapacity: 2,       // per industry level
    // Goods trips each industry level can supply. At 0.55 a city zoned in
    // balance has no shortage; one with three times as many shops as
    // industry runs short (see goods below).
    goodsCapacity: 0.55,
    // A road tile gets slower once its load passes `freeFlow` × capacity:
    // travel time × (1 + congestionDelay × (load − freeFlow)), so a full road
    // (load 1.0) takes 1.5× as long. Traffic then prefers emptier routes.
    freeFlow: 0.5,
    congestionDelay: 1,
    // Travel time, in street tiles, at which accessibility reaches 0. A tile of
    // avenue or highway counts as 1 / speedMult street tiles.
    commuteMax: 48,
    congestionGrowthPenalty: 0.75, // max growth probability reduction at full congestion (congestion=255)
    // Growth multiplier floor for developed zone tiles with zero accessibility:
    // cut-off zones still creep along, but connectivity is a real drag.
    accessFloor: 0.05,
  },
  // ── Seaport trade (sim/seaport.ts) ───────────────────────────────────────────
  // Numbers from the Balance Lab's trade suite (preset "proposed"). The
  // city-wide industry boost and the truck weight are still at no effect.
  port: {
    // Export trips each developed industry level sends to a port within
    // reach. 0 = industry exports nothing.
    exportTripsPerLevel: 0.1,
    // The furthest industry may be from a port and still export: travel time
    // in street tiles, like transit.commuteMax.
    reach: 48,
    // Export trips one port can take per tick. 0 = ports take no exports.
    exportCapacity: 15,
    // Money per export trip the port has room for, per tick.
    exportIncomePerTrip: 8,
    // Goods trips one port can supply to shops per tick (an extra source in
    // the goods market, beside industry). 0 = ports import nothing.
    importCapacity: 200,
    // Industrial growth demand is multiplied by this, city-wide, while a
    // port is connected by road. 1 = no effect.
    industrialDemandMult: 1,
    // Road each export trip takes up: a truck counts as this many cars, so
    // the roads to a busy port fill up.
    truckWeight: 1,
    // Trade trips (exports plus imports) that make one ship call. Only the
    // ships graphics draws depend on it: the more trade, the more ships.
    tripsPerShip: 40,
  },
  // ── Shops need goods (sim/goods.ts) ──────────────────────────────────────────
  // When shops want more goods trips than industry and ports can supply, the
  // city-wide shortage (0–1) cuts shops' tax income and commercial demand by
  // shortage × these. The demand penalty is still off (the lab has no
  // target for it).
  goods: {
    shortageIncomePenalty: 0.25,
    shortageDemandPenalty: 0,
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

  // ── Localized vibes (VibeSystem) ─────────────────────────────────────────────
  // Vibe layers are bytes: 128 = neutral, 0 / 255 = the two extremes of an axis.
  vibe: {
    // Diffusion + decay run every simInterval ticks.
    simInterval: 4,
    // Byte units a tile moves per nudge point. The character.nudges values above
    // are in points: e.g. parkBuilt green 5.0 → +60 (capped), industrialZone
    // green −3.0 → −60 (capped), residentialZone egalitarian 0.3 → +8.
    nudgeByteScale: 25,
    // Cap on a single nudge so one action never saturates a tile.
    nudgeMaxBytes: 60,
    // Chance per sim step that a non-neutral tile steps 1 toward 128.
    // Integer steps gated by a roll — a fractional decay is lost to byte rounding.
    // 0.25 → a fully saturated, isolated region fades in ~2000 ticks (~250 game-days).
    decayProbability: 0.25,
  },

  // ── Abandonment ──────────────────────────────────────────────────────────────
  // Zones lose conditions long enough → distress accumulates → abandonment.
  // Abandoned tiles generate no income and cannot grow.
  // Conditions are checked every distressInterval ticks.
  // More contributors (crime, fire) can be added to AbandonmentSystem later.
  abandonment: {
    distressInterval: 4,    // ticks between distress checks (aligned with growth interval)
    abandonThreshold: 20,   // distress checks without conditions before abandonment (~10 game-days)
  },

  // ── Budget alerts ────────────────────────────────────────────────────────────
  // Money below zero blocks everything that costs money except bulldozing
  // (demolition is how a broke city cuts its upkeep).
  budget: {
    // Warn when, at the current net loss, the treasury runs dry within this many game-days.
    lowFundsWarningDays: 30,
    // Minimum ticks between repeated low-funds warnings.
    warningCooldownTicks: 240,
    // Debt as a failure condition (sim/debt.ts). Money may fall to minus the
    // debt limit: this many game days of the city's current expenses, and
    // never less than debtLimitMin. Warnings go out at half the limit and at
    // the limit.
    debtLimitDays: 30,
    debtLimitMin: 2000,
    // Past the limit for this many game days in a row: game over. Getting
    // back within the limit resets the count. The owner's number is 30.
    // 0 switches the countdown off (the limit then only warns). On since the
    // game-over screen exists (ui/DebtUi.ts).
    debtGraceDays: 30,
    // PC lost per game day while money is below zero, times cap ÷ max like
    // regeneration. SWITCHED OFF at 0 until the Political Capital numbers pass.
    debtPcDrainPerDay: 0,
  },

  ticksPerDay: 8,
  baseTickMs: 500,      // 2 ticks/sec at 1×
  startingMoney: 20000,
  startingPoliticalCapital: 100,

  // ── Political Capital ────────────────────────────────────────────────────────
  // PC regenerates each tick based on citizen satisfaction.
  // Disruptive player actions drain it. The cap is enforced by PoliticsSystem.
  politicalCapital: {
    // The cap at no population. Passive regeneration and the blight-clearing
    // reward stop at the cap; other one-off rewards may go over it.
    max: 100,
    // Extra cap per resident, so a bigger city can hold more (0.01 = +1 per
    // 100 people). SWITCHED OFF at 0 until the Political Capital numbers pass.
    capPerResident: 0,
    // PC banked above the cap fades: once per game day, this share of the
    // excess is lost (0.02 = 2% a day, half gone in about 35 days). It never
    // takes PC below the cap. SWITCHED OFF at 0 until the numbers pass.
    overCapFadePerDay: 0,
    // Passive change per tick:
    //   (baseRegen + (satisfaction − neutralSatisfaction) × satisfactionRegenBonus)
    //     × (cap ÷ max)
    // The last factor makes a bigger city (a bigger cap) fill or drain
    // proportionally faster, so empty-to-full takes the same time at any size.
    // A positive result stops at the cap; a negative one drains PC, down to 0.
    // With the numbers below it runs from 0.1 (miserable city) to 0.4 (happy city).
    baseRegen: 0.1,
    satisfactionRegenBonus: 0.3,
    // The satisfaction (0–1) at which the satisfaction part is zero: above it
    // the city earns, below it the city loses. SWITCHED OFF at 0 (with a
    // positive baseRegen nothing ever drains) until the Political Capital
    // numbers pass; the plan is a neutral point around 0.6 and baseRegen 0.
    neutralSatisfaction: 0,
    // Named satisfaction factors with weights (must sum to 1.0).
    // Keys are matched by name to SatisfactionFactor.name in PoliticsSystem.
    // Add new factors here + implement compute() in PoliticsSystem.defaultFactors().
    satisfactionWeights: {
      servicesCoverage: 0.40, // fraction of developed R zones with service coverage
      powerCoverage:    0.20, // fraction of developed zones with power
      waterCoverage:    0.20, // fraction of developed zones with water
      crime:            0.20, // (1 - average crime level)
    } as Record<string, number>,
    // Costs for disruptive actions — applied at execute() time, same as money costs.
    // Gating: if budget.politicalCapital < cost, the action is blocked.
    disruptionCosts: {
      // Per displaced resident (level-3 R zone = 20 pop → 70 PC), times
      // cap ÷ max: a bigger city (a bigger cap) pays proportionally more, so
      // a tower is the same share of the cap at any size. No change while
      // capPerResident is 0.
      bulldozePerPop: 3.5,
      abandonedBuildingReward: 2.5, // per abandoned building level cleared (clearing blight is popular)
    },
    // Unpopular things put near homes cost PC for each resident within reach,
    // less the further away they live. Homes built later next to one do not count.
    // SWITCHED OFF: every rate is 0 until the Political Capital numbers pass.
    nuisance: {
      // Fall-off bands by manhattan distance, nearest first: a home within
      // `within` tiles objects at `weight`. The last band is the radius. The
      // preview rings are drawn from these, so they always match the cost.
      bands: [
        { within: 2, weight: 1 },
        { within: 4, weight: 0.6 },
        { within: 6, weight: 0.3 },
      ] as { within: number; weight: number }[],
      // PC per resident at weight 1, for each industrial tile zoned.
      industrialPerResident: 0,
      // PC per resident at weight 1, by building kind (1 = power plant, 3 =
      // sewage plant, 9 = large power plant, 11 = large sewage plant, 12 =
      // seaport). A large building is felt from its nearest tile (a seaport
      // from its yard, not its docks).
      buildingPerResident: { 1: 0, 3: 0, 9: 0, 11: 0, 12: 0 } as Record<number, number>,
    },
    // One-off PC rewards the first time the city's population reaches each
    // threshold, e.g. { population: 1000, reward: 20 }. They may go over the
    // cap. Each pays once per city, however the population moves afterwards.
    // SWITCHED OFF: the list is empty until the Political Capital numbers pass.
    milestones: [] as { population: number; reward: number }[],
    // Ordinances (src/sim/ordinances.ts): a lump of PC to enact, a daily PC
    // (and for some, money) upkeep, and multipliers the sim systems read
    // through ordinanceModifier(). 1 = no effect. SWITCHED OFF: every cost
    // is 0 and every multiplier 1 until the numbers are play-tested.
    // "Established" (Heritage Protection's establishedLandValue and
    // establishedDemolitionCost) is not defined yet: which tiles count is an
    // open design question for the owner and the PM. Until it is decided,
    // nothing reads those two names.
    // Heritage Protection: a tile counts as "established" once it has stayed
    // developed for this many game years (engine wires it). 0 = off.
    establishedYears: 0,
    // Resident requests (src/sim/requests.ts, RequestSystem). SWITCHED OFF:
    // spawnEveryDays is 0, so none ever opens; days, rewards and penalties
    // are set in the balance play-test.
    requests: {
      spawnEveryDays: 0,  // a new request every this many game days while under maxOpen (0 = never)
      maxOpen: 3,
      cellSize: 12,       // neighbourhoods are cells of this many tiles square…
      minHomes: 6,        // …with at least this many developed homes
      randomness: 0.3,    // 0 = always the neediest; 1 = need counts for little
      // Per kind: a neighbourhood asks only when its need is above askAt (so
      // a well-served city goes quiet), and the request is met once the need
      // is down to metAt. Need is 0–1, see requests.ts.
      kinds: {
        park: { days: 0, reward: 0, penalty: 0, askAt: 0.5, metAt: 0.25 },
        police: { days: 0, reward: 0, penalty: 0, askAt: 0.5, metAt: 0.25 },
        fire: { days: 0, reward: 0, penalty: 0, askAt: 0.5, metAt: 0.25 },
        school: { days: 0, reward: 0, penalty: 0, askAt: 0.5, metAt: 0.25 },
        hospital: { days: 0, reward: 0, penalty: 0, askAt: 0.5, metAt: 0.25 },
        utilities: { days: 0, reward: 0, penalty: 0, askAt: 0.5, metAt: 0 },
        trafficJam: { days: 0, reward: 0, penalty: 0, askAt: 0.1, metAt: 0.05 },
        blight: { days: 0, reward: 0, penalty: 0, askAt: 0.1, metAt: 0 },
      } as Record<string, { days: number; reward: number; penalty: number; askAt: number; metAt: number }>,
    },
    // Off until the ordinance numbers are play-tested: the toolbar tile and
    // panel stay hidden while this is false (ordinancesEnabled()).
    ordinancesEnabled: false,
    ordinances: {
      neighbourhoodWatch: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { crime: 1 } }, // Crime −15%; PC upkeep only
      curfew: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { crime: 1, commercialIncome: 1 } }, // Crime −30%; shop income −10%
      cleanAirAct: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { industrialPollution: 1, industrialGrowth: 1 } }, // Industrial pollution −30%; industry grows slower
      businessIncentives: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { commercialDemand: 1, industrialDemand: 1, commercialIncome: 1, industrialIncome: 1 } }, // Shop and industry demand up; their tax income down
      freeTransit: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { trafficTrips: 1 } }, // Less traffic; money upkeep too
      fastTrackPermits: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { growth: 1, pollution: 1, crime: 1 } }, // Zones grow faster; a bit more pollution and crime
      eminentDomain: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { displacementCost: 1, satisfaction: 1 } }, // Displacing residents costs half the PC; satisfaction drops
      heritageProtection: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: { establishedLandValue: 1, establishedDemolitionCost: 1 } }, // Established neighbourhoods gain land value; very expensive to demolish
    } as Record<string, { enactCost: number; dailyUpkeep: number; dailyMoney: number; modifiers: Record<string, number> }>,
    // Opening a service building earns PC for the residents it covers; closing
    // one costs what they lose (see sim/serviceValue.ts).
    // SWITCHED OFF: every value is 0 until the Political Capital numbers pass.
    service: {
      // PC per resident for the first building of a kind covering them, by
      // building kind (4 police, 5 fire, 6 school, 7 hospital, 8 park).
      perResident: { 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 } as Record<number, number>,
      // Each further building of the same kind covering a resident is worth
      // this fraction of the one before. (Not used for a kind that has a
      // capacity, see service.capacity: those are priced by the residents
      // who gain or lose a seat.)
      repeatFactor: 0.5,
      // Closing a service costs this many times the value lost by residents
      // it leaves with no building of that kind. (Residents another still
      // covers are charged their reduced loss once, so moving a service is
      // cheap.) Keep it at 1 or more, or building and bulldozing a service
      // becomes a way to farm PC.
      closureMultiplier: 1.5,
    },
  },
} as const;
