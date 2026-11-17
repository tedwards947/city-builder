// The auto-tuner's current best PC number set (variant "T" / Tuned), graded by default
// so the nightly lab reports it. Replace with a newer tuner result (best.values of
// balance-results/tune-*.json) when one beats it. Not used by the game.
// Source: tuner from D on main 3ba7d3e, 547 evaluations (2026-11-17).

export const TUNED_T: Record<string, unknown> = {
  "overCapFadePerDay": 0.03,
  "max": 150,
  "capPerResident": 0.015,
  "baseRegen": 0,
  "neutralSatisfaction": 0.7,
  "satisfactionRegenBonus": 1.12,
  "disruptionCosts": {
    "bulldozePerPop": 3.5,
    "abandonedBuildingReward": 3.5
  },
  "nuisance": {
    "bands": [
      {
        "within": 2,
        "weight": 1
      },
      {
        "within": 4,
        "weight": 0.6
      },
      {
        "within": 6,
        "weight": 0.3
      }
    ],
    "industrialPerResident": 0.1,
    "buildingPerResident": {
      "1": 0.267,
      "3": 0.178
    }
  },
  "service": {
    "perResident": {
      "4": 0.009,
      "5": 0.009,
      "6": 0.013,
      "7": 0.026,
      "8": 0.012
    },
    "repeatFactor": 0.25,
    "closureMultiplier": 3.75
  },
  "milestones": [
    {
      "population": 1000,
      "reward": 40
    },
    {
      "population": 2500,
      "reward": 60
    },
    {
      "population": 5000,
      "reward": 80
    },
    {
      "population": 10000,
      "reward": 120
    },
    {
      "population": 25000,
      "reward": 200
    },
    {
      "population": 50000,
      "reward": 300
    }
  ],
  "requests": {
    "spawnEveryDays": 6,
    "kinds": {
      "park": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      },
      "school": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      },
      "hospital": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      },
      "police": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      },
      "fire": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      },
      "utilities": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      },
      "trafficJam": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      },
      "blight": {
        "days": 20,
        "reward": 13.3,
        "penalty": 10
      }
    }
  },
  "establishedYears": 1.5,
  "ordinancesEnabled": true,
  "ordinances": {
    "neighbourhoodWatch": {
      "enactCost": 15,
      "dailyUpkeep": 0.12,
      "dailyMoney": 0,
      "modifiers": {
        "crime": 0.75
      }
    },
    "curfew": {
      "enactCost": 25,
      "dailyUpkeep": 0.24,
      "dailyMoney": 0,
      "modifiers": {
        "crime": 0.55,
        "commercialIncome": 0.9
      }
    },
    "cleanAirAct": {
      "enactCost": 30,
      "dailyUpkeep": 0.2,
      "dailyMoney": 0,
      "modifiers": {
        "industrialPollution": 0.15,
        "industrialGrowth": 0.8
      }
    },
    "businessIncentives": {
      "enactCost": 25,
      "dailyUpkeep": 0.16,
      "dailyMoney": 0,
      "modifiers": {
        "commercialDemand": 1.4,
        "industrialDemand": 1.4,
        "commercialIncome": 0.8,
        "industrialIncome": 0.8
      }
    },
    "freeTransit": {
      "enactCost": 30,
      "dailyUpkeep": 0.16,
      "dailyMoney": 700,
      "modifiers": {
        "trafficTrips": 0.7
      }
    },
    "fastTrackPermits": {
      "enactCost": 20,
      "dailyUpkeep": 0.16,
      "dailyMoney": 0,
      "modifiers": {
        "growth": 1.8,
        "pollution": 1.15,
        "crime": 1.15
      }
    },
    "eminentDomain": {
      "enactCost": 40,
      "dailyUpkeep": 0.32,
      "dailyMoney": 0,
      "modifiers": {
        "displacementCost": 0.4,
        "satisfaction": 0.88
      }
    },
    "heritageProtection": {
      "enactCost": 30,
      "dailyUpkeep": 0.16,
      "dailyMoney": 0,
      "modifiers": {
        "establishedLandValue": 1.3,
        "establishedDemolitionCost": 4
      }
    }
  }
};
