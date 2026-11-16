// The four PC play-test variants' numbers, designed and dry-run by the engine
// session (2026-11-16). Each is a partial BALANCE.politicalCapital tree, applied
// over the shipped numbers by the debug panel's picker (see pcPresets.ts).

export const VARIANT_VALUES = {
  A: {
    max: 100,
    capPerResident: 0.015,
    baseRegen: 0,
    neutralSatisfaction: 0.65,
    satisfactionRegenBonus: 0.83,
    disruptionCosts: {
      bulldozePerPop: 1.5,
      abandonedBuildingReward: 2.5
    },
    nuisance: {
      bands: [
        {
          within: 2,
          weight: 1
        },
        {
          within: 4,
          weight: 0.6
        },
        {
          within: 6,
          weight: 0.3
        }
      ],
      industrialPerResident: 0.05,
      buildingPerResident: {
        "1": 0.25,
        "3": 0.2
      }
    },
    service: {
      perResident: {
        "4": 0.006,
        "5": 0.0045,
        "6": 0.015,
        "7": 0.018,
        "8": 0.015
      },
      repeatFactor: 0.5,
      closureMultiplier: 2
    },
    milestones: [
      {
        population: 1000,
        reward: 25
      },
      {
        population: 2500,
        reward: 35
      },
      {
        population: 5000,
        reward: 50
      },
      {
        population: 10000,
        reward: 70
      },
      {
        population: 25000,
        reward: 110
      },
      {
        population: 50000,
        reward: 160
      }
    ],
    requests: {
      spawnEveryDays: 8,
      kinds: {
        park: {
          days: 30,
          reward: 15,
          penalty: 3
        },
        school: {
          days: 30,
          reward: 15,
          penalty: 3
        },
        hospital: {
          days: 30,
          reward: 15,
          penalty: 3
        },
        police: {
          days: 30,
          reward: 15,
          penalty: 3
        },
        fire: {
          days: 30,
          reward: 15,
          penalty: 3
        },
        utilities: {
          days: 30,
          reward: 15,
          penalty: 3
        },
        trafficJam: {
          days: 30,
          reward: 15,
          penalty: 3
        },
        blight: {
          days: 30,
          reward: 15,
          penalty: 3
        }
      }
    },
    establishedYears: 1.5,
    ordinancesEnabled: true,
    ordinances: {
      neighbourhoodWatch: {
        enactCost: 9,
        dailyUpkeep: 0.09,
        dailyMoney: 0,
        modifiers: {
          crime: 0.85
        }
      },
      curfew: {
        enactCost: 15,
        dailyUpkeep: 0.18,
        dailyMoney: 0,
        modifiers: {
          crime: 0.7,
          commercialIncome: 0.9
        }
      },
      cleanAirAct: {
        enactCost: 18,
        dailyUpkeep: 0.15,
        dailyMoney: 0,
        modifiers: {
          industrialPollution: 0.25,
          industrialGrowth: 0.8
        }
      },
      businessIncentives: {
        enactCost: 15,
        dailyUpkeep: 0.12,
        dailyMoney: 0,
        modifiers: {
          commercialDemand: 1.25,
          industrialDemand: 1.25,
          commercialIncome: 0.85,
          industrialIncome: 0.85
        }
      },
      freeTransit: {
        enactCost: 18,
        dailyUpkeep: 0.12,
        dailyMoney: 300,
        modifiers: {
          trafficTrips: 0.8
        }
      },
      fastTrackPermits: {
        enactCost: 12,
        dailyUpkeep: 0.12,
        dailyMoney: 0,
        modifiers: {
          growth: 1.5,
          pollution: 1.1,
          crime: 1.1
        }
      },
      eminentDomain: {
        enactCost: 24,
        dailyUpkeep: 0.24,
        dailyMoney: 0,
        modifiers: {
          displacementCost: 0.5,
          satisfaction: 0.9
        }
      },
      heritageProtection: {
        enactCost: 18,
        dailyUpkeep: 0.12,
        dailyMoney: 0,
        modifiers: {
          establishedLandValue: 1.2,
          establishedDemolitionCost: 2
        }
      }
    }
  },
  B: {
    max: 100,
    capPerResident: 0.01,
    baseRegen: 0,
    neutralSatisfaction: 0.75,
    satisfactionRegenBonus: 0.7,
    disruptionCosts: {
      bulldozePerPop: 2.5,
      abandonedBuildingReward: 2.5
    },
    nuisance: {
      bands: [
        {
          within: 2,
          weight: 1
        },
        {
          within: 4,
          weight: 0.6
        },
        {
          within: 6,
          weight: 0.3
        }
      ],
      industrialPerResident: 0.08,
      buildingPerResident: {
        "1": 0.4,
        "3": 0.3
      }
    },
    service: {
      perResident: {
        "4": 0.004,
        "5": 0.003,
        "6": 0.01,
        "7": 0.012,
        "8": 0.01
      },
      repeatFactor: 0.5,
      closureMultiplier: 3
    },
    milestones: [
      {
        population: 1000,
        reward: 20
      },
      {
        population: 2500,
        reward: 30
      },
      {
        population: 5000,
        reward: 40
      },
      {
        population: 10000,
        reward: 60
      },
      {
        population: 25000,
        reward: 100
      },
      {
        population: 50000,
        reward: 150
      }
    ],
    requests: {
      spawnEveryDays: 10,
      kinds: {
        park: {
          days: 20,
          reward: 10,
          penalty: 5
        },
        school: {
          days: 20,
          reward: 10,
          penalty: 5
        },
        hospital: {
          days: 20,
          reward: 10,
          penalty: 5
        },
        police: {
          days: 20,
          reward: 10,
          penalty: 5
        },
        fire: {
          days: 20,
          reward: 10,
          penalty: 5
        },
        utilities: {
          days: 20,
          reward: 10,
          penalty: 5
        },
        trafficJam: {
          days: 20,
          reward: 10,
          penalty: 5
        },
        blight: {
          days: 20,
          reward: 10,
          penalty: 5
        }
      }
    },
    establishedYears: 1.5,
    ordinancesEnabled: true,
    ordinances: {
      neighbourhoodWatch: {
        enactCost: 15,
        dailyUpkeep: 0.15,
        dailyMoney: 0,
        modifiers: {
          crime: 0.85
        }
      },
      curfew: {
        enactCost: 25,
        dailyUpkeep: 0.3,
        dailyMoney: 0,
        modifiers: {
          crime: 0.7,
          commercialIncome: 0.9
        }
      },
      cleanAirAct: {
        enactCost: 30,
        dailyUpkeep: 0.25,
        dailyMoney: 0,
        modifiers: {
          industrialPollution: 0.25,
          industrialGrowth: 0.8
        }
      },
      businessIncentives: {
        enactCost: 25,
        dailyUpkeep: 0.2,
        dailyMoney: 0,
        modifiers: {
          commercialDemand: 1.25,
          industrialDemand: 1.25,
          commercialIncome: 0.85,
          industrialIncome: 0.85
        }
      },
      freeTransit: {
        enactCost: 30,
        dailyUpkeep: 0.2,
        dailyMoney: 500,
        modifiers: {
          trafficTrips: 0.8
        }
      },
      fastTrackPermits: {
        enactCost: 20,
        dailyUpkeep: 0.2,
        dailyMoney: 0,
        modifiers: {
          growth: 1.5,
          pollution: 1.1,
          crime: 1.1
        }
      },
      eminentDomain: {
        enactCost: 40,
        dailyUpkeep: 0.4,
        dailyMoney: 0,
        modifiers: {
          displacementCost: 0.5,
          satisfaction: 0.9
        }
      },
      heritageProtection: {
        enactCost: 30,
        dailyUpkeep: 0.2,
        dailyMoney: 0,
        modifiers: {
          establishedLandValue: 1.2,
          establishedDemolitionCost: 3
        }
      }
    }
  },
  C: {
    max: 100,
    capPerResident: 0.008,
    baseRegen: 0,
    neutralSatisfaction: 0.8,
    satisfactionRegenBonus: 0.56,
    disruptionCosts: {
      bulldozePerPop: 4,
      abandonedBuildingReward: 2.5
    },
    nuisance: {
      bands: [
        {
          within: 2,
          weight: 1
        },
        {
          within: 4,
          weight: 0.6
        },
        {
          within: 6,
          weight: 0.3
        }
      ],
      industrialPerResident: 0.12,
      buildingPerResident: {
        "1": 0.6,
        "3": 0.45
      }
    },
    service: {
      perResident: {
        "4": 0.004,
        "5": 0.003,
        "6": 0.01,
        "7": 0.012,
        "8": 0.01
      },
      repeatFactor: 0.5,
      closureMultiplier: 5
    },
    milestones: [
      {
        population: 1000,
        reward: 15
      },
      {
        population: 2500,
        reward: 20
      },
      {
        population: 5000,
        reward: 30
      },
      {
        population: 10000,
        reward: 45
      },
      {
        population: 25000,
        reward: 75
      },
      {
        population: 50000,
        reward: 110
      }
    ],
    requests: {
      spawnEveryDays: 12,
      kinds: {
        park: {
          days: 15,
          reward: 8,
          penalty: 8
        },
        school: {
          days: 15,
          reward: 8,
          penalty: 8
        },
        hospital: {
          days: 15,
          reward: 8,
          penalty: 8
        },
        police: {
          days: 15,
          reward: 8,
          penalty: 8
        },
        fire: {
          days: 15,
          reward: 8,
          penalty: 8
        },
        utilities: {
          days: 15,
          reward: 8,
          penalty: 8
        },
        trafficJam: {
          days: 15,
          reward: 8,
          penalty: 8
        },
        blight: {
          days: 15,
          reward: 8,
          penalty: 8
        }
      }
    },
    establishedYears: 1.5,
    ordinancesEnabled: true,
    ordinances: {
      neighbourhoodWatch: {
        enactCost: 22,
        dailyUpkeep: 0.225,
        dailyMoney: 0,
        modifiers: {
          crime: 0.85
        }
      },
      curfew: {
        enactCost: 38,
        dailyUpkeep: 0.45,
        dailyMoney: 0,
        modifiers: {
          crime: 0.7,
          commercialIncome: 0.9
        }
      },
      cleanAirAct: {
        enactCost: 45,
        dailyUpkeep: 0.375,
        dailyMoney: 0,
        modifiers: {
          industrialPollution: 0.25,
          industrialGrowth: 0.8
        }
      },
      businessIncentives: {
        enactCost: 38,
        dailyUpkeep: 0.3,
        dailyMoney: 0,
        modifiers: {
          commercialDemand: 1.25,
          industrialDemand: 1.25,
          commercialIncome: 0.85,
          industrialIncome: 0.85
        }
      },
      freeTransit: {
        enactCost: 45,
        dailyUpkeep: 0.3,
        dailyMoney: 500,
        modifiers: {
          trafficTrips: 0.8
        }
      },
      fastTrackPermits: {
        enactCost: 30,
        dailyUpkeep: 0.3,
        dailyMoney: 0,
        modifiers: {
          growth: 1.5,
          pollution: 1.1,
          crime: 1.1
        }
      },
      eminentDomain: {
        enactCost: 60,
        dailyUpkeep: 0.6,
        dailyMoney: 0,
        modifiers: {
          displacementCost: 0.5,
          satisfaction: 0.9
        }
      },
      heritageProtection: {
        enactCost: 45,
        dailyUpkeep: 0.3,
        dailyMoney: 0,
        modifiers: {
          establishedLandValue: 1.2,
          establishedDemolitionCost: 4
        }
      }
    }
  },
  D: {
    max: 100,
    capPerResident: 0.015,
    baseRegen: 0,
    neutralSatisfaction: 0.8,
    satisfactionRegenBonus: 1.12,
    disruptionCosts: {
      bulldozePerPop: 3.5,
      abandonedBuildingReward: 3.5
    },
    nuisance: {
      bands: [
        {
          within: 2,
          weight: 1
        },
        {
          within: 4,
          weight: 0.6
        },
        {
          within: 6,
          weight: 0.3
        }
      ],
      industrialPerResident: 0.1,
      buildingPerResident: {
        "1": 0.6,
        "3": 0.4
      }
    },
    service: {
      perResident: {
        "4": 0.012,
        "5": 0.009,
        "6": 0.03,
        "7": 0.036,
        "8": 0.03
      },
      repeatFactor: 0.5,
      closureMultiplier: 2.5
    },
    milestones: [
      {
        population: 1000,
        reward: 40
      },
      {
        population: 2500,
        reward: 60
      },
      {
        population: 5000,
        reward: 80
      },
      {
        population: 10000,
        reward: 120
      },
      {
        population: 25000,
        reward: 200
      },
      {
        population: 50000,
        reward: 300
      }
    ],
    requests: {
      spawnEveryDays: 6,
      kinds: {
        park: {
          days: 20,
          reward: 20,
          penalty: 10
        },
        school: {
          days: 20,
          reward: 20,
          penalty: 10
        },
        hospital: {
          days: 20,
          reward: 20,
          penalty: 10
        },
        police: {
          days: 20,
          reward: 20,
          penalty: 10
        },
        fire: {
          days: 20,
          reward: 20,
          penalty: 10
        },
        utilities: {
          days: 20,
          reward: 20,
          penalty: 10
        },
        trafficJam: {
          days: 20,
          reward: 20,
          penalty: 10
        },
        blight: {
          days: 20,
          reward: 20,
          penalty: 10
        }
      }
    },
    establishedYears: 1.5,
    ordinancesEnabled: true,
    ordinances: {
      neighbourhoodWatch: {
        enactCost: 15,
        dailyUpkeep: 0.12,
        dailyMoney: 0,
        modifiers: {
          crime: 0.75
        }
      },
      curfew: {
        enactCost: 25,
        dailyUpkeep: 0.24,
        dailyMoney: 0,
        modifiers: {
          crime: 0.55,
          commercialIncome: 0.9
        }
      },
      cleanAirAct: {
        enactCost: 30,
        dailyUpkeep: 0.2,
        dailyMoney: 0,
        modifiers: {
          industrialPollution: 0.15,
          industrialGrowth: 0.8
        }
      },
      businessIncentives: {
        enactCost: 25,
        dailyUpkeep: 0.16,
        dailyMoney: 0,
        modifiers: {
          commercialDemand: 1.4,
          industrialDemand: 1.4,
          commercialIncome: 0.8,
          industrialIncome: 0.8
        }
      },
      freeTransit: {
        enactCost: 30,
        dailyUpkeep: 0.16,
        dailyMoney: 700,
        modifiers: {
          trafficTrips: 0.7
        }
      },
      fastTrackPermits: {
        enactCost: 20,
        dailyUpkeep: 0.16,
        dailyMoney: 0,
        modifiers: {
          growth: 1.8,
          pollution: 1.15,
          crime: 1.15
        }
      },
      eminentDomain: {
        enactCost: 40,
        dailyUpkeep: 0.32,
        dailyMoney: 0,
        modifiers: {
          displacementCost: 0.4,
          satisfaction: 0.88
        }
      },
      heritageProtection: {
        enactCost: 30,
        dailyUpkeep: 0.16,
        dailyMoney: 0,
        modifiers: {
          establishedLandValue: 1.3,
          establishedDemolitionCost: 4
        }
      }
    }
  },
};
