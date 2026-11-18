// Political Capital switched off: the numbers the game shipped with before the
// tuned set ("preset T") became the shipped BALANCE.politicalCapital on
// 2026-11-18. Every PC effect is at 0 or 1 (no nuisance, service, milestone,
// request or ordinance PC; PC only regenerates, and demolition is charged at
// the old flat rate). The debug panel's Off preset and the Balance Lab's Off
// variant apply this over the shipped numbers.
//
// Its keys are also the list of numbers the lab tunes: a preset (A–D, T) is a
// tree of the same shape, and src/balance/tunedT.ts reads T back from BALANCE
// by these keys. A new tunable PC number needs a line here.

export const PC_OFF: Record<string, unknown> = {
  overCapFadePerDay: 0,
  max: 100,
  capPerResident: 0,
  baseRegen: 0.1,
  neutralSatisfaction: 0,
  satisfactionRegenBonus: 0.3,
  disruptionCosts: { bulldozePerPop: 3.5, abandonedBuildingReward: 2.5 },
  nuisance: {
    bands: [{ within: 2, weight: 1 }, { within: 4, weight: 0.6 }, { within: 6, weight: 0.3 }],
    industrialPerResident: 0,
    buildingPerResident: { 1: 0, 3: 0 },
  },
  service: {
    perResident: { 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    repeatFactor: 0.5,
    closureMultiplier: 1.5,
  },
  milestones: [],
  requests: {
    spawnEveryDays: 0,
    kinds: {
      park: { days: 0, reward: 0, penalty: 0 },
      school: { days: 0, reward: 0, penalty: 0 },
      hospital: { days: 0, reward: 0, penalty: 0 },
      police: { days: 0, reward: 0, penalty: 0 },
      fire: { days: 0, reward: 0, penalty: 0 },
      utilities: { days: 0, reward: 0, penalty: 0 },
      trafficJam: { days: 0, reward: 0, penalty: 0 },
      blight: { days: 0, reward: 0, penalty: 0 },
      airport: { days: 0, reward: 0, penalty: 0 },
    },
  },
  establishedYears: 0,
  ordinancesEnabled: false,
  ordinances: {
    neighbourhoodWatch: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { crime: 1 },
    },
    curfew: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { crime: 1, commercialIncome: 1 },
    },
    cleanAirAct: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { industrialPollution: 1, industrialGrowth: 1 },
    },
    businessIncentives: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { commercialDemand: 1, industrialDemand: 1, commercialIncome: 1, industrialIncome: 1 },
    },
    freeTransit: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { trafficTrips: 1 },
    },
    fastTrackPermits: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { growth: 1, pollution: 1, crime: 1 },
    },
    eminentDomain: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { displacementCost: 1, satisfaction: 1 },
    },
    heritageProtection: {
      enactCost: 0,
      dailyUpkeep: 0,
      dailyMoney: 0,
      modifiers: { establishedLandValue: 1, establishedDemolitionCost: 1 },
    },
  },
};
