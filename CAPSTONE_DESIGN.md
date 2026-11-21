# Capstone Buildings: Design

*Status: proposal (owner asked 2026-11-20). Nothing decided yet. The PM walks the questions with the owner one at a time.*

## Why
Owner: "really expensive [buildings] that solve an entire city's need for something: education, police, fire, hospital, power, water, sewage. Separate toolbar category, unlocked at a population level, and expensive enough to build and maintain that only really well-run cities can afford."

A capstone is the reward for running a big city well. It replaces dozens of small buildings with one landmark, frees up land, and ends a chore. The price is high enough that a city scraping by can't hold one.

## How it fits what exists
| Need | Today | A capstone would |
|---|---|---|
| Power, water, sewage | A plant beside a road serves that **whole road network**, and supply must cover demand (`utilityCoverage.ts`). Large plants already exist (3×3 power, 2×2 water and sewage). | Give output far beyond any city's demand on its network, so supply is never short again. The model is unchanged. |
| Police, fire, school, hospital | **Reach** in road steps (police 15, fire 15, school 20, hospital 30) and **capacity** in residents (3,000 / 4,000 / 4,000 / 8,000). A 20k city needs about 7 police, 5 fire, 5 schools and 3 hospitals. | Cover every home in the city (Q1). |
| Running costs | Each covered resident costs a little a day (`headcountCost`), plus building upkeep. | Keep paying the per-resident cost (it grows with the city either way) plus a big upkeep. |

## The seven (names and looks are the graphics' and owner's call, era 1900s onwards)
| Need | Working name | Footprint (SCALE.md) |
|---|---|---|
| Education | University | 4×4 campus |
| Police | Police Headquarters | 3×3 |
| Fire | Fire Headquarters | 3×3 |
| Health | General Hospital | 4×3 |
| Power | Power Station (coal, later hydro or nuclear by era) | 4×4 |
| Water | Waterworks (reservoir and filter beds; whether it must sit by water is for later) | 4×4 |
| Sewage | Sewage Works | 4×4 |

## Proposed rules (PM defaults, open to change)
- **One of each per city.** A separate **Capstones** toolbar category. Locked items show greyed out with the population needed.
- **Old buildings keep working.** Nothing is removed. A small station that no longer adds coverage costs almost no PC to close (under the PC services rule, residents still covered lose very little), so the player tidies up at their own pace and gets the land back.
- **A single point of failure.** If its road is cut, or it burns down or gets abandoned, the whole city loses that need at once. Keeping a few old buildings is insurance. That's a fun risk, not a bug.
- **Affordability.** It costs about as much as the airport to build ($1–3M), and its upkeep is about **2× the upkeep of the small buildings it replaces** in a 20k city. So it's a luxury bought with convenience and land, not a saving. ENGINEER 3 tunes it so a 20k city with a healthy surplus can carry one or two, and only a strong city carries all seven.

## Questions for the owner
### Q1. What does "the whole city" mean for police, fire, school and hospital?
- **A. Every home joined to it by road, at any distance, with no capacity limit.** *(PM pick)* Same rule as utilities: one road network, all covered. The road still matters (an island suburb with no road link misses out).
- **B. Every home, roads or not.** Simplest, but then where you put it doesn't matter at all.
- **C. A huge reach and capacity, but not unlimited** (e.g. 60 steps, 40,000 residents). The largest cities would still need a second one or some small buildings.

### Q2. Unlock: one population for all seven, or staggered?
- **A. Staggered.** *(PM pick)* Utilities at 15,000 (power, water, sewage), then police and fire at 20,000, then hospital and university at 30,000. Something to aim for at each stage.
- **B. One level for all**, e.g. 20,000.

### Q3. Is coverage the whole reward, or does each capstone add a perk?
- **A. Coverage and land are the reward.** *(PM pick)* Simple to balance.
- **B. A small city-wide perk each** (the university lifts land value and office demand; the general hospital raises satisfaction a little; the police HQ lowers crime more than full coverage does).

### Q4. Cost level
- **A. About the airport: $1–3M to build, upkeep about 2× what it replaces.** *(PM pick)*
- **B. Cheaper to run than what it replaces** (a real saving, with only the build cost as the barrier). Then every big city builds them all, and it's no longer a sign of a well-run city.

## Who does what (once decided)
- **Engine:** seven building kinds, one per city, population unlocks (reuse `unlockPopulation` and `onePerCity` from leisure), whole-city coverage as an extra source in the coverage layers, utility output.
- **Graphics:** the Capstones toolbar category, locked state, art within SCALE.md (art review page first, paid images with the owner's OK).
- **ENGINEER 3:** costs, upkeep, unlock levels; lab targets (for example, "a 20k city with a healthy surplus can carry two").
- **PM:** this doc.
