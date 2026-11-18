// The auto-tuner's current best PC number set (variant "T" / Tuned), graded by default
// so the nightly lab reports it. Replace with a newer tuner result (best.values of
// balance-results/tune-*.json) when one beats it. The game's debug panel shows the
// same object as preset T (src/ui/pcVariantValues.ts), so this file is the only copy.
// Source: T re-tune under the shipped service numbers (school 20 / 4,000, hospital 30 / 8,000),
// 2026-11-17, 400 evaluations from the paused run's partial best, on fresh-128, testcity1,
// gen-s1-t10000 and gen-suburban-s1-t10000: 92/98 PC on those cities (previous T 86/98).

export const TUNED_T: Record<string, unknown> = {
  "overCapFadePerDay": 0.03,
  "max": 150,
  "capPerResident": 0.008,
  "baseRegen": 0,
  "neutralSatisfaction": 0.7,
  "satisfactionRegenBonus": 1.12,
  "disruptionCosts": {
    "bulldozePerPop": 2.33,
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
    "industrialPerResident": 0.0667,
    "buildingPerResident": {
      "1": 0.267,
      "3": 0.178
    }
  },
  "service": {
    "perResident": {
      "4": 0.0044,
      "5": 0.0044,
      "6": 0.00635,
      "7": 0.00398,
      "8": 0.00587
    },
    "repeatFactor": 0.45,
    "closureMultiplier": 1.67
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
        "reward": 5.91,
        "penalty": 8
      },
      "school": {
        "days": 20,
        "reward": 5.91,
        "penalty": 8
      },
      "hospital": {
        "days": 20,
        "reward": 5.91,
        "penalty": 8
      },
      "police": {
        "days": 20,
        "reward": 5.91,
        "penalty": 8
      },
      "fire": {
        "days": 20,
        "reward": 5.91,
        "penalty": 8
      },
      "utilities": {
        "days": 20,
        "reward": 5.91,
        "penalty": 8
      },
      "trafficJam": {
        "days": 20,
        "reward": 5.91,
        "penalty": 8
      },
      "blight": {
        "days": 20,
        "reward": 5.91,
        "penalty": 8
      }
    }
  },
  "establishedYears": 1.5,
  "ordinancesEnabled": true,
  "ordinances": {
    "neighbourhoodWatch": {
      "enactCost": 10,
      "dailyUpkeep": 0.18,
      "dailyMoney": 0,
      "modifiers": {
        "crime": 0.75
      }
    },
    "curfew": {
      "enactCost": 17,
      "dailyUpkeep": 0.36,
      "dailyMoney": 0,
      "modifiers": {
        "crime": 0.55,
        "commercialIncome": 0.9
      }
    },
    "cleanAirAct": {
      "enactCost": 20,
      "dailyUpkeep": 0.3,
      "dailyMoney": 0,
      "modifiers": {
        "industrialPollution": 0.15,
        "industrialGrowth": 0.8
      }
    },
    "businessIncentives": {
      "enactCost": 17,
      "dailyUpkeep": 0.24,
      "dailyMoney": 0,
      "modifiers": {
        "commercialDemand": 1.4,
        "industrialDemand": 1.4,
        "commercialIncome": 0.8,
        "industrialIncome": 0.8
      }
    },
    "freeTransit": {
      "enactCost": 20,
      "dailyUpkeep": 0.24,
      "dailyMoney": 700,
      "modifiers": {
        "trafficTrips": 0.7
      }
    },
    "fastTrackPermits": {
      "enactCost": 13,
      "dailyUpkeep": 0.24,
      "dailyMoney": 0,
      "modifiers": {
        "growth": 1.8,
        "pollution": 1.15,
        "crime": 1.15
      }
    },
    "eminentDomain": {
      "enactCost": 27,
      "dailyUpkeep": 0.32,
      "dailyMoney": 0,
      "modifiers": {
        "displacementCost": 0.4,
        "satisfaction": 0.88
      }
    },
    "heritageProtection": {
      "enactCost": 20,
      "dailyUpkeep": 0.24,
      "dailyMoney": 0,
      "modifiers": {
        "establishedLandValue": 1.3,
        "establishedDemolitionCost": 4
      }
    }
  }
};
