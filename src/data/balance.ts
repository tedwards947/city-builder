// All costs, tax rates, maintenance costs, and balance constants.
// No magic numbers in game code.

/** A kind of trip in the traffic system (sim/TrafficData.ts MARKET_DEFS). */
export type TrafficMarketKey = 'shopping' | 'jobs' | 'goods' | 'exports' | 'visitors' | 'leisure' | 'event';

/**
 * What one building kind does in the traffic system (sim/buildingTraffic.ts).
 * Amounts are trips per tick for the whole building, shared evenly between
 * the streets and avenues that touch it. Anything left out is 0 (or 1 for a
 * multiplier): no effect.
 */
export interface BuildingTrafficRow {
  /** Trips it can take, per market: it is a destination (people working at a school, visitors to a landmark). */
  takes?: Partial<Record<TrafficMarketKey, number>>;
  /** Trips it puts on the road, per market: it is an origin (arrivals at an airport looking for shops or jobs). */
  sends?: Partial<Record<TrafficMarketKey, number>>;
  /** Money per trip it takes, per market, per tick (up to what it has room for). Trade, not tax. */
  incomePerTrip?: Partial<Record<TrafficMarketKey, number>>;
  /** City-wide growth demand multipliers while at least one of the kind stands with a road to it. */
  demandMult?: { R?: number; C?: number; I?: number };
}

/** What one leisure building kind is (BALANCE.leisure.kinds, sim/leisure.ts). */
export interface LeisureRow {
  category: 'parks' | 'unique';
  unlockPopulation: number;
  pcCost: number;
  landValue: { bonus: number; radius: number };
  countsAsPark: boolean;
  /** Leisure trips a tick it can take (residents and tourists together). 0 or missing: it is not a destination yet. */
  capacity?: number;
  /** Its head start over other attractions, in street tiles of travel time: people go this much further for it. */
  appeal?: number;
  /** Tourists a tick it draws to the city while a road reaches it (the city's pull is the sum). */
  pull?: number;
  /** Money per leisure trip it takes, per tick. 0 or missing: free entry. */
  ticket?: number;
  /** Share of its arrivals that go on to the shops from its doors (free attractions: "they spend nearby"). */
  shopShare?: number;
}

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
    // Landscaping (sim/landscaping.ts): per tree planted with the tree brush,
    // and per tree removed with the eraser. Balance Lab, owner 2026-11-19
    // (landscape suite): a tree beside level-3 homes repays 200 in about
    // 100–130 days; clearing costs what bulldozing does.
    tree: 200,
    treeClear: 5,
    // Per tile turned to water or to land with the water tools. Flooding a
    // building or zoned lot also costs `bulldoze` and its displacement PC.
    // 750 (landscape suite): a 20-tile canal is about 2 days of a 10k city's
    // surplus; filling a 10×10 block of water about a third of its month.
    water: 750,
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
    // The airport (12×5, one per city). Really expensive (owner, 2026-11-18;
    // Balance Lab): 10× the seaport, 220–320 days of a mature 10k city's
    // surplus; upkeep 1,200 a day. Its passengers pay it back in about 2 game
    // years (transit.buildings[13]).
    13: { cost: 2000000, maintenance: 150 }, // BUILDING_AIRPORT
    // Train stations (RAIL_DESIGN.md). Placeholders until the balance lab proposes them.
    // Stations: 27,500 / 20 (Balance Lab rail suite, owner 2026-11-19, after the station resize):
    // rail is gated by cost, so a starter line (two stations and 60 tiles, 79k) is a mid-game
    // buy, about twice a fresh city's bank at day 180. The smaller stations sell fewer rides,
    // so their upkeep came down from 25 (30,000 / 25 before).
    14: { cost: 27500, maintenance: 20 }, // BUILDING_STATION (straight, three platform tiles)
    15: { cost: 27500, maintenance: 20 }, // BUILDING_STATION_L (curved, 2×2)
    // Rail phase 2 placeholders (RAIL_DESIGN.md, ENGINEER 3's starting numbers).
    16: { cost: 5000, maintenance: 5 },    // BUILDING_RAMP_ELEVATED (2×1) Owner-approved 2026-11-19.
    17: { cost: 15000, maintenance: 10 },  // BUILDING_RAMP_SUBWAY (2×1) Owner-approved 2026-11-19.
    18: { cost: 60000, maintenance: 40 },  // BUILDING_SUBWAY_STATION (2× a train station: the hole is the cost) Owner-approved 2026-11-19.
    // Leisure (LEISURE_DESIGN.md). PLACEHOLDERS until the Balance Lab sets them: dear to build
    // and dear to run ("upkeep is high for all"); the two unique ones cost a lot (and PC: leisure below).
    19: { cost: 6000,   maintenance: 30 },  // BUILDING_BIG_PARK (3×3)
    20: { cost: 8000,   maintenance: 35 },  // BUILDING_BEACH_PARK (3×2)
    21: { cost: 4000,   maintenance: 15 },  // BUILDING_PLAZA (2×2)
    22: { cost: 60000,  maintenance: 60 },  // BUILDING_MUSEUM (2×2, one per city)
    23: { cost: 400000, maintenance: 200 }, // BUILDING_STADIUM (4×4 + plaza, one per city)
    24: { cost: 2500,   maintenance: 14 },  // BUILDING_MID_PARK (2×2)
  } as Record<number, { cost: number; maintenance: number }>,
  // ── Leisure and tourism (LEISURE_DESIGN.md, sim/leisure.ts) ──────────────────
  // One row per leisure building kind. ALL PLACEHOLDERS until the Balance Lab sets them.
  //   category          'parks' (Parks and leisure: repeatable) or 'unique' (Unique buildings: one per city).
  //   unlockPopulation  Residents the city must have (or have had) before it can be built. 0 = from the start.
  //   pcCost            Political capital it costs to build ("big projects cost PC"). 0 = none.
  //   landValue         Raises land value by `bonus` on the tiles touching it, falling in a straight line
  //                     to nothing just past `radius` tiles from its nearest tile. bonus 0 = no effect.
  //   countsAsPark      Counts as a park for the 2×2 lots' prime-spot rule (BALANCE.lots.parkRadius).
  leisure: {
    kinds: {
      8:  { category: 'parks',  unlockPopulation: 0,     pcCost: 0,   landValue: { bonus: 0,  radius: 0 }, countsAsPark: true,  capacity: 4,   appeal: 5,  pull: 0,  ticket: 0, shopShare: 0   }, // the park: a little leisure (owner 2026-11-20); its land value comes from its service coverage
      19: { category: 'parks',  unlockPopulation: 0,     pcCost: 0,   landValue: { bonus: 20, radius: 5 }, countsAsPark: true,  capacity: 30,  appeal: 20, pull: 4,  ticket: 0, shopShare: 0.5 }, // big park
      20: { category: 'parks',  unlockPopulation: 0,     pcCost: 0,   landValue: { bonus: 20, radius: 5 }, countsAsPark: true,  capacity: 40,  appeal: 35, pull: 10, ticket: 0, shopShare: 0.5 }, // beach park
      21: { category: 'parks',  unlockPopulation: 0,     pcCost: 0,   landValue: { bonus: 30, radius: 4 }, countsAsPark: false, capacity: 20,  appeal: 15, pull: 6,  ticket: 0, shopShare: 0.5 }, // plaza / monument: the biggest lift
      22: { category: 'unique', unlockPopulation: 2000,  pcCost: 100, landValue: { bonus: 15, radius: 4 }, countsAsPark: false, capacity: 60,  appeal: 50, pull: 20, ticket: 6, shopShare: 0   }, // museum
      23: { category: 'unique', unlockPopulation: 10000, pcCost: 200, landValue: { bonus: 5,  radius: 3 }, countsAsPark: false }, // stadium: only a little; it is a destination on event days only (part 4)
      24: { category: 'parks',  unlockPopulation: 0,     pcCost: 0,   landValue: { bonus: 14, radius: 4 }, countsAsPark: true,  capacity: 14,  appeal: 12, pull: 2,  ticket: 0, shopShare: 0.5 }, // 2×2 park
    } as Record<number, LeisureRow>,
    // Leisure trips a home sends per level, per tick (the `leisure` traffic market). Residents go
    // less often than they shop (transit.tripsRtoC is 0.33). The market runs only while an
    // attraction with a capacity stands on a road. PLACEHOLDER.
    tripsPerLevel: 0.04,
    // The furthest anyone travels for leisure: travel time in street tiles (like transit.commuteMax,
    // which is 48), counted AFTER the attraction's head start: the best attraction is reached from
    // `reach` tiles away, one with 30 less appeal from 30 tiles nearer. Tourists and residents
    // share it. PLACEHOLDER.
    reach: 96,
    // Gateways: tourists a tick each building of the kind can bring in while a road reaches it.
    // Tourists = the city's pull (the sum of its attractions' `pull`), capped by the gateways'
    // total. Only the airport for now (border connections later). PLACEHOLDER.
    gateways: { 13: 60 } as Record<number, number>,
    // Homes need leisure in reach to keep growing (owner 2026-11-20): a home growing to
    // `fromLevel` or beyond (to level 3, and four homes merging into a 2×2 tower) with no
    // attraction in reach (sim/leisureTraffic.ts leisureReachAt above `minReach`) has its chance
    // multiplied by `growthMult`. Lower levels are not affected. growthMult 1 = off.
    // PLACEHOLDER: slows, does not stop, so cities built before leisure do not freeze.
    need: { fromLevel: 3, growthMult: 0.5, minReach: 0 } as { fromLevel: number; growthMult: number; minReach: number },
    // Event days (sim/eventDays.ts): once a week the venue (the stadium) fills. ALL PLACEHOLDERS.
    //   weekday            0 = Monday … 5 = Saturday (sim/calendar.ts).
    //   seats              Fans a tick the venue takes. 0 = no events.
    //   fansPerLevel       Fans each home level sends on event day (shopping is transit.tripsRtoC, 0.33).
    //   touristFans        Fans arriving at the gateways, capped by what the gateways bring.
    //   ticket             Money per fan in the seats, per tick of the event day.
    //   reach              Travel time (street tiles) beyond which fans do not come; jams make roads longer.
    //   jam                A home is stuck when a road beside it is at `load` × capacity or more and the
    //                      crowd alone is `eventShare` × capacity or more of that.
    //   pcPerStuckResident Political capital each stuck resident costs, per event day.
    //   dropAfter          Event days stuck (net of good ones) after which a home loses a level. 0 = never.
    event: {
      kind: 23, weekday: 5, seats: 400, fansPerLevel: 0.15, touristFans: 40, ticket: 4, reach: 120,
      jam: { load: 1, eventShare: 0.25 }, pcPerStuckResident: 0.01, dropAfter: 3,
    } as { kind: number; weekday: number; seats: number; fansPerLevel: number; touristFans: number; ticket: number; reach: number;
      jam: { load: number; eventShare: number }; pcPerStuckResident: number; dropAfter: number },
  },
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
    // Tax exodus: for each point above neutral, every developed home has an
    // exodusPerPoint chance per growth pass (growth.tickInterval ticks) of
    // losing one level, down to an empty lot. 0 = off. 1e-4 (Balance Lab, owner
    // 2026-11-18): about 3.5% fewer residents after 150 days at 20 on a mature city.
    // 7e-5 since homes level up slower (owner 2026-11-19): a home that drops a
    // level takes longer to climb back, so the same exodus emptied more homes.
    level: { min: 0, max: 20, neutral: 10, step: 1, satisfactionPerPoint: 0.01, demandStrength: 1, exodusPerPoint: 0.00007 },
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
    // Police (4) and fire (5) too since the pacing change (owner, 2026-11-20): a growing
    // district needs another station, not just one in reach.
    capacity: { 4: 3000, 5: 4000, 6: 4000, 7: 8000 } as Record<number, number>,
  },
  // Running costs that grow with the city (sim/runningCost.ts; owner, 2026-11-20, pacing
  // option A): on top of each building's fixed upkeep, a day's cost per resident a police
  // station, fire station, school or hospital covers, and per unit of power, water and
  // sewage supplied. Large plants run at largePlantMult of the per-unit cost.
  // ENGINEER 3's numbers, tuned to the lab's econ.pace curve.
  runningCost: {
    perResident: { 4: 0.03, 5: 0.02, 6: 0.04, 7: 0.04 } as Record<number, number>,
    perUnit: { power: 0.05, water: 0.06, sewage: 0.04 },
    largePlantMult: 0.6,
    // The first this many residents are free: the costs above are scaled by
    // (population − freeResidents) ÷ population, so a town under it pays only fixed upkeep
    // and the early game is unchanged.
    freeResidents: 1000,
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
    // Trees nearby raise land value (LANDSCAPING_DESIGN.md): treeBonus per
    // tree tile within treeRadius tiles (a square, the tile itself included),
    // up to treeBonusMax in all. Wild and planted trees count alike. Applied
    // within reach of the built-up area only. Balance Lab, owner 2026-11-19
    // (landscape suite): 3 a tree, at most 16, so 6 trees max out a lot (+13
    // once land value settles; it eases in whole steps).
    treeBonus: 3,
    treeRadius: 2,
    treeBonusMax: 16,
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
    // 0.98 (landscape suite, owner 2026-11-19): a 3-tile tree belt cuts the
    // pollution at the homes behind it by about a quarter (0.95 cut 59%).
    vegDecayMult: 0.98,       // single tree / sparse
    vegDecayMultForest: 0.88,  // dense forest (species 1-6 are currently all treated same, but could differentiate)
  },
  growth: {
    tickInterval: 4,
    probability: 0.08,
    // Homes (R) roll their own chance by the level they are at (owner 2026-11-19,
    // docs/GROWTH_OPTIONS.md option B): empty → 1 at 8%, 1 → 2 at 4%, 2 → 3 at 2%,
    // so level 3 takes about twice as long. Shops and industry use `probability`.
    homeProbabilityByLevel: { 0: 0.08, 1: 0.04, 2: 0.02 } as Record<number, number>,
    maxLevel: 3,
    // Level 4 is a tile of a merged 2×2 lot (sim/lots.ts, BIG_LOTS_DESIGN.md), which lots do not
    // grow to (maxLevel stays 3): it holds 1.5× a level 3.
    popPerLevel: { 1: 4, 2: 10, 3: 20, 4: 30 } as Record<number, number>,
    // What a lot of each level counts for wherever a system multiplies by the level (taxes, trips,
    // utility demand, crime, fire risk, pollution, the demand tally). Levels 0–3 count as
    // themselves; a merged lot's tile as 4.5 = 1.5 × level 3. Keep in step with popPerLevel[4].
    levelWeight: [0, 1, 2, 3, 4.5] as readonly number[],
  },
  // Per road-class data — keyed by ROAD_STREET/AVENUE/HIGHWAY (1/2/3).
  // upgrade cost = roadClasses[target].cost − roadClasses[current].cost
  roadClasses: {
    1: { cost: 10,  maintenance: 0.04, capacity: 20,  speedMult: 1.0 }, // Street
    2: { cost: 50,  maintenance: 0.12, capacity: 80,  speedMult: 1.4 }, // Avenue
    3: { cost: 150, maintenance: 0.35, capacity: 200, speedMult: 2.0 }, // Highway
  } as Record<number, { cost: number; maintenance: number; capacity: number; speedMult: number }>,
  // Rail (RAIL_DESIGN.md). Placeholder numbers until the balance lab proposes them.
  rail: {
    // Per tile of track, by level (the RAIL_ bits in sim/constants.ts): 1 = ground, 2 = elevated, 4 = subway.
    // Ground track on water costs times costs.bridgeMultiplier. Upkeep is per economy tick, like a road's.
    track: {
      1: { cost: 400, maintenance: 0.5 },   // ground (owner 2026-11-18; a highway is 150 / 0.35)
      // Owner-approved 2026-11-19 (RAIL_DESIGN.md): elevated 3× ground to build and to keep up;
      // subway 25× to build but only 4× to keep up (at 25× a 60-tile line would eat a 10k city's
      // whole surplus).
      2: { cost: 1200, maintenance: 1.5 },    // elevated
      4: { cost: 10000, maintenance: 2 },     // subway
    } as Record<number, { cost: number; maintenance: number }>,
    // Rail traffic (TransitSystem). Times are in street tiles, like road travel times.
    // Speed 10 and boarding 2 (owner 2026-11-18): a suburb 50–90 tiles out gets a third to a
    // half of the city's job access by rail; at 6 and 4 it was a fifth to a third.
    speedMult: 10,         // a tile of track takes 1 / speedMult (a highway's is 2)
    // 250 (owner 2026-11-18, rail suite): a full 3,200-resident suburb jams one line, and a
    // second line clears it.
    capacity: 250,         // riders a tile of track carries before it counts as full (a highway: 200)
    congestionDelay: 1,    // past transit.freeFlow × capacity: time × (1 + congestionDelay × (load − freeFlow))
    // A line past `jam.from` of its capacity JAMS: every tile of it takes
    // jam.delay × (load − jam.from) ^ jam.power street tiles longer (load counts up to 3).
    // This is in street tiles, not a multiple of the track's own tiny time, so a jammed line
    // can lose to a slower second line or to the road. delay 0 = no jam.
    jam: { from: 1, delay: 4, power: 1 },
    boardTime: 2,          // getting on at a station, and again getting off
    rampTime: 1,           // passing a ramp between ground and elevated or subway track: two ramps ≈ one busy level crossing (owner 2026-11-19)
    // Homes and shops (not industry) within `radius` tiles (manhattan) of a station that has a
    // road and riders grow `mult` times as fast (owner-approved, RAIL_DESIGN.md 2026-11-19).
    // Kept small: rail already gives a suburb its job access. mult 1 = off. Raised from 1.25
    // to 1.4 after the station resize (owner 2026-11-19): ×1.25 made homes only ~15% sooner
    // to level 3 (rail.stationGrowth); ×1.4 gives 17–26% on the saved cities.
    stationGrowth: { radius: 4, mult: 1.4 },
    // Junctions are the weak points: extra time to pass one, and less capacity. A 4-way is much worse.
    junction3: { delay: 1, capacityMult: 0.6 },
    junction4: { delay: 4, capacityMult: 0.35 },
    // A level crossing: cars wait carDelay × rail load × road load street tiles (each load
    // counted up to 1), trains wait trainDelay × road load. Owner 2026-11-19 (rail.crossing):
    // a full line across a busy avenue adds about 12% to the trips through it, so an elevated
    // hop pays off; a quiet line across a quiet street barely matters. Was one `delay` 2 both ways.
    // overlayCut: the traffic overlay (and the cars drawn) show a crossing tile's road as if it
    // had (1 − overlayCut × rail load) of its capacity, so the player sees where a line hurts.
    // Looks only: the simulation's congestion layer is untouched.
    crossing: { carDelay: 8, trainDelay: 2, overlayCut: 0.5 },
    fare: 0.5,             // income per rider boarding, per economy tick (like transit.buildings incomePerTrip)
  },
  transit: {
    flowInterval: 8,      // run every 8 ticks (slower than growth)
    // Trips put on the road per developed level of the ORIGIN zone tile.
    // A road tile is full (congestion 255) when the trips passing through it
    // reach its class capacity (street 20, avenue 80, highway 200).
    tripsRtoC: 0.33,      // homes → commerce
    tripsRtoI: 0.34,      // homes → industry
    tripsCtoI: 0.38,      // commerce → industry: shops fetching goods, per COMMERCE level
    // homes → places that draw visitors (an airport, a landmark), per home
    // level. Only buildings take these trips (`buildings` below), so with no
    // such building, or at 0, the visitors market does not run at all.
    // 0.05 (Balance Lab, owner 2026-11-18): a 10k city sends about 85 a tick.
    tripsVisitors: 0.05,
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
    // What each building kind does in traffic, keyed by building kind
    // (sim/buildingTraffic.ts): the trips it takes and sends per market, what
    // it earns per trip and what it does to growth demand. A new building
    // (an airport, a landmark) joins traffic by getting a row here; no engine
    // code is needed. A row's numbers ship at no effect until the Balance Lab
    // sets them (the airport's are set; the services' jobs wait on ENGINE). The seaport is not here: its trade has rules of its own
    // (BALANCE.port, sim/seaport.ts).
    buildings: {
      // A few people work at each service (owner: "a little"; 1 each, Balance
      // Lab 2026-11-18). Homes' accessibility counts zones only (#269), and
      // commuters who find one full drive on to the next door (#272).
      4: { takes: { jobs: 1 } },   // police: people who work there
      5: { takes: { jobs: 1 } },   // fire station
      6: { takes: { jobs: 1 } },   // school
      7: { takes: { jobs: 1 } },   // hospital
      // The airport (passengers only). Homes send it visitors, and the city
      // earns per passenger; arrivals leave it for the shops and to look for
      // work; while it stands on a road, shops are in more demand.
      13: {
        // Balance Lab, owner 2026-11-18. A 10k city fills 83–88% of the 100
        // seats a tick; a terminal on plain streets jams (the owner wants the
        // traffic). Arrivals don't pay.
        takes: { visitors: 100 }, incomePerTrip: { visitors: 6 },
        sends: { shopping: 30, jobs: 10 },
        demandMult: { C: 1.1 },
      },
    } as Record<number, BuildingTrafficRow>,
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
        // Per tree planted with the tree brush, and per tree removed with the
        // eraser (a negative number makes clearing un-green). On the tree's
        // own tile; it spreads like any other nudge. Every nudge moves its
        // tile at least 1 step, and a park's 5 points are capped at 60, so
        // 0.05 a tree makes 50 trees about 0.8 of a park (landscape suite,
        // owner 2026-11-19).
        treePlanted:           0.05,
        treeCleared:          -0.05,
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
    // regeneration. 0 = off. 0.75: a city in debt for the 30-day grace period
    // loses about 15% of its cap.
    debtPcDrainPerDay: 0.75,
  },

  // When four top-level lots merge into a 2×2 building (sim/lots.ts, systems/LotMergeSystem.ts,
  // BIG_LOTS_DESIGN.md). The "prime spot" trigger: ENGINEER 3's numbers, approved by the owner 2026-11-19.
  lots: {
    // A ready block's chance to merge, per game day: homes and shops at `chancePerDay`, industry
    // at `industryChancePerDay`. Industry needs no prime spot (it merges anywhere), so at the
    // home/shop chance it made about three quarters of all merges, mostly at the city's edge;
    // a fifth of the chance keeps the towers downtown the headline (ENGINEER 3, owner-approved
    // 2026-11-20). Both 0 = no merges.
    chancePerDay: 0.003,
    industryChancePerDay: 0.0006,
    streakDays: 10,        // days in a row all four lots must count (happy, in a prime spot) before the block is ready
    minSatisfaction: 0.9,  // the city's satisfaction (0–1) a day needs to count
    maxPerDay: 1,          // merges per game day, city-wide
    spacing: 4,            // no merge within this many tiles of a merged lot
    // A prime spot, for homes and shops (industry merges anywhere):
    minLandValue: 55,      // land value (0–255) the lot needs: a low bar that screens out blight
    jobsRadius: 8,         // "jobs nearby" = developed shop and industry tiles within this many tiles
    topJobsShare: 0.1,     // in the city's top tenth for jobs nearby: prime
    parkRadius: 2,         // or within this of a park …
    waterRadius: 3,        // … or this of water, while at or above the city's median for jobs nearby
  },

  ticksPerDay: 8,
  baseTickMs: 500,      // 2 ticks/sec at 1×
  startingMoney: 20000,
  startingPoliticalCapital: 100,

  // ── Political Capital ────────────────────────────────────────────────────────
  // PC regenerates each tick based on citizen satisfaction.
  // These are the Balance Lab's tuned numbers ("preset T"), shipped 2026-11-18.
  // The numbers the lab tunes are the keys of PC_OFF (src/data/pcOff.ts, the
  // debug panel's Off preset: every PC effect at 0); src/balance/tunedT.ts
  // reads them back from here, so this block is the only copy of T.
  // Disruptive player actions drain it. The cap is enforced by PoliticsSystem.
  politicalCapital: {
    // The cap at no population. Passive regeneration and the blight-clearing
    // reward stop at the cap; other one-off rewards may go over it.
    max: 150,
    // Extra cap per resident, so a bigger city can hold more (0.01 = +1 per
    // 100 people). 0 = off.
    capPerResident: 0.008,
    // PC banked above the cap fades: once per game day, this share of the
    // excess is lost (0.02 = 2% a day, half gone in about 35 days). It never
    // takes PC below the cap. 0 = off.
    overCapFadePerDay: 0.03,
    // Passive change per tick:
    //   (baseRegen + (satisfaction − neutralSatisfaction) × satisfactionRegenBonus)
    //     × (cap ÷ max)
    // The last factor makes a bigger city (a bigger cap) fill or drain
    // proportionally faster, so empty-to-full takes the same time at any size.
    // A positive result stops at the cap; a negative one drains PC, down to 0.
    // With the numbers below a city at satisfaction 1 earns 0.336 a tick at
    // the base cap, and one at 0.4 loses as much.
    baseRegen: 0,
    satisfactionRegenBonus: 1.12,
    // The satisfaction (0–1) at which the satisfaction part is zero: above it
    // the city earns, below it the city loses. (0, with a positive baseRegen,
    // means nothing ever drains.)
    neutralSatisfaction: 0.7,
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
      // Per displaced resident, times cap ÷ max: a bigger city (a bigger cap)
      // pays proportionally more, so a tower is the same share of the cap at
      // any size.
      bulldozePerPop: 2.33,
      abandonedBuildingReward: 3.5, // per abandoned building level cleared (clearing blight is popular)
    },
    // Unpopular things put near homes cost PC for each resident within reach,
    // less the further away they live. Homes built later next to one do not count.
    // A rate of 0 switches that nuisance off.
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
      industrialPerResident: 0.0667,
      // PC per resident at weight 1, by building kind (1 = power plant, 3 =
      // sewage plant, 9 = large power plant, 11 = large sewage plant, 12 =
      // seaport). A large building is felt from its nearest tile (a seaport
      // from its yard, not its docks). 9, 11 and 12 have no tuned number yet.
      buildingPerResident: { 1: 0.267, 3: 0.178, 9: 0, 11: 0, 12: 0 } as Record<number, number>,
      // PC per resident at weight 1, for each tile of rail track laid, by level (the RAIL_ bits:
      // 1 ground, 2 elevated, 4 subway). Owner-approved (RAIL_DESIGN.md, 2026-11-19): a tile of
      // ground track is about a seventh of an industrial tile; elevated is worse (pillars and
      // noise over the street); a subway upsets nobody. Stations and ramps cost nothing.
      trackPerResident: { 1: 0.01, 2: 0.015, 4: 0 } as Record<number, number>,
    },
    // One-off PC rewards the first time the city's population reaches each
    // threshold, e.g. { population: 1000, reward: 20 }. They may go over the
    // cap. Each pays once per city, however the population moves afterwards.
    // An empty list switches them off.
    milestones: [
      { population: 1000, reward: 40 },
      { population: 2500, reward: 60 },
      { population: 5000, reward: 80 },
      { population: 10000, reward: 120 },
      { population: 25000, reward: 200 },
      { population: 50000, reward: 300 },
    ] as { population: number; reward: number }[],
    // Ordinances (src/sim/ordinances.ts): a lump of PC to enact, a daily PC
    // (and for some, money) upkeep, and multipliers the sim systems read
    // through ordinanceModifier(). 1 = no effect.
    // "Established" (Heritage Protection's establishedLandValue and
    // establishedDemolitionCost) is not defined yet: which tiles count is an
    // open design question for the owner and the PM. Until it is decided,
    // nothing reads those two names.
    // Heritage Protection: a tile counts as "established" once it has stayed
    // developed for this many game years (engine wires it). 0 = off.
    establishedYears: 1.5,
    // Resident requests (src/sim/requests.ts, RequestSystem). spawnEveryDays 0
    // would switch them off, as would days 0 for one kind.
    requests: {
      spawnEveryDays: 6,  // a new request every this many game days while under maxOpen (0 = never)
      maxOpen: 3,
      cellSize: 12,       // neighbourhoods are cells of this many tiles square…
      minHomes: 6,        // …with at least this many developed homes
      randomness: 0.3,    // 0 = always the neediest; 1 = need counts for little
      // Per kind: a neighbourhood asks only when its need is above askAt (so
      // a well-served city goes quiet), and the request is met once the need
      // is down to metAt. Need is 0–1, see requests.ts.
      // A kind whose need swings by itself (traffic; school and hospital
      // seats; a power or water shortage) can be made durable:
      // smoothDays = judge it on the average of this many daily readings,
      // for asking and for meeting; holdDays = it is met only after passing
      // on this many daily checks in a row. Both default to 1 (the reading
      // of the day, met at once).
      kinds: {
        park: { days: 20, reward: 5.91, penalty: 8, askAt: 0.5, metAt: 0.25 },
        police: { days: 20, reward: 5.91, penalty: 8, askAt: 0.5, metAt: 0.25 },
        fire: { days: 20, reward: 5.91, penalty: 8, askAt: 0.5, metAt: 0.25 },
        school: { days: 20, reward: 5.91, penalty: 8, askAt: 0.5, metAt: 0.25, smoothDays: 3, holdDays: 3 },
        hospital: { days: 20, reward: 5.91, penalty: 8, askAt: 0.5, metAt: 0.25, smoothDays: 3, holdDays: 3 },
        utilities: { days: 20, reward: 5.91, penalty: 8, askAt: 0.5, metAt: 0, smoothDays: 3, holdDays: 3 },
        trafficJam: { days: 20, reward: 5.91, penalty: 8, askAt: 0.1, metAt: 0.05, smoothDays: 3, holdDays: 3 },
        blight: { days: 20, reward: 5.91, penalty: 8, askAt: 0.1, metAt: 0 },
        // "Residents want an airport" (owner, 2026-11-18): asked once the
        // city can pay for one and has none; met by an airport with a road
        // to its terminal. A long deadline and no penalty: it is a big ask,
        // not neglect. Reward 250 (Balance Lab, owner 2026-11-18): about one
        // full PC bar where it first fires (cap 230–245 at the 10–12k
        // residents a city has when it first holds the cash; airport.request);
        // it may take PC over the cap. Asked
        // once per city: never again after it is met, and after it expires
        // only once cooldownDays have passed.
        airport: { days: 120, reward: 250, penalty: 0, askAt: 0.5, metAt: 0, once: true, cooldownDays: 360 },
      } as Record<string, { days: number; reward: number; penalty: number; askAt: number; metAt: number; smoothDays?: number; holdDays?: number; once?: boolean; cooldownDays?: number }>,
    },
    // The toolbar tile and panel stay hidden while this is false
    // (ordinancesEnabled()).
    ordinancesEnabled: true as boolean,
    ordinances: {
      neighbourhoodWatch: { enactCost: 10, dailyUpkeep: 0.18, dailyMoney: 0, modifiers: { crime: 0.75 } },
      curfew: { enactCost: 17, dailyUpkeep: 0.36, dailyMoney: 0, modifiers: { crime: 0.55, commercialIncome: 0.9 } },
      cleanAirAct: { enactCost: 20, dailyUpkeep: 0.3, dailyMoney: 0, modifiers: { industrialPollution: 0.15, industrialGrowth: 0.8 } },
      businessIncentives: { enactCost: 17, dailyUpkeep: 0.24, dailyMoney: 0, modifiers: { commercialDemand: 1.4, industrialDemand: 1.4, commercialIncome: 0.8, industrialIncome: 0.8 } },
      freeTransit: { enactCost: 20, dailyUpkeep: 0.24, dailyMoney: 700, modifiers: { trafficTrips: 0.7 } },
      fastTrackPermits: { enactCost: 13, dailyUpkeep: 0.24, dailyMoney: 0, modifiers: { growth: 1.8, pollution: 1.15, crime: 1.15 } },
      eminentDomain: { enactCost: 27, dailyUpkeep: 0.32, dailyMoney: 0, modifiers: { displacementCost: 0.4, satisfaction: 0.88 } },
      heritageProtection: { enactCost: 20, dailyUpkeep: 0.24, dailyMoney: 0, modifiers: { establishedLandValue: 1.3, establishedDemolitionCost: 4 } },
    } as Record<string, { enactCost: number; dailyUpkeep: number; dailyMoney: number; modifiers: Record<string, number> }>,
    // Opening a service building earns PC for the residents it covers; closing
    // one costs what they lose (see sim/serviceValue.ts).
    // A value of 0 switches that kind off.
    service: {
      // PC per resident for the first building of a kind covering them, by
      // building kind (4 police, 5 fire, 6 school, 7 hospital, 8 park).
      perResident: { 4: 0.0044, 5: 0.0044, 6: 0.00635, 7: 0.00398, 8: 0.00587 } as Record<number, number>,
      // Each further building of the same kind covering a resident is worth
      // this fraction of the one before. (Not used for a kind that has a
      // capacity, see service.capacity: those are priced by the residents
      // who gain or lose a seat.)
      repeatFactor: 0.45,
      // Closing a service costs this many times the value lost by residents
      // it leaves with no building of that kind. (Residents another still
      // covers are charged their reduced loss once, so moving a service is
      // cheap.) Keep it at 1 or more, or building and bulldozing a service
      // becomes a way to farm PC.
      closureMultiplier: 1.85,
    },
  },
} as const;
