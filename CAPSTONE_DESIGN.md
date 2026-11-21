# Capstone Buildings: Design

*Status: Q1 and Q2 decided 2026-11-20; Q3 and Q4 open. The PM walks the questions with the owner one at a time.*

## Why
Owner: "really expensive [buildings] that solve an entire city's need for something: education, police, fire, hospital, power, water, sewage. Separate toolbar category, unlocked at a population level, and expensive enough to build and maintain that only really well-run cities can afford."

A capstone is the reward for running a big city well. It replaces dozens of small buildings with one landmark, frees up land, and ends a chore. The price is high enough that a city scraping by can't hold one.

## How it fits what exists
| Need | Today | A capstone would |
|---|---|---|
| Power, water, sewage | A plant beside a road serves that **whole road network**, and supply must cover demand (`utilityCoverage.ts`). Large plants already exist (3×3 power, 2×2 water and sewage). | Give output far beyond any city's demand on its network, so supply is never short again. The model is unchanged. |
| Police, fire, school, hospital | **Reach** in road steps (police 15, fire 15, school 20, hospital 30) and **capacity** in residents (3,000 / 4,000 / 4,000 / 8,000). A 20k city needs about 7 police, 5 fire, 5 schools and 3 hospitals. | Cover every home in the city (Q1). |
| Running costs | Each covered resident costs a little a day (`headcountCost`), plus building upkeep. | Keep paying the per-resident cost (it grows with the city either way) plus a big upkeep. |

## The seven (looks are the graphics' and owner's call)
Owner, 2026-11-20: these are expensive, so they should be **big and ornate**, and the police and fire HQs get **their own animations** (a police helicopter, a firefighting plane). The animations are looks only unless the owner decides otherwise.
| Need | Working name | Footprint (SCALE.md) |
|---|---|---|
| Education | University | 4×4 campus |
| Police | Police Headquarters, big and ornate, with a rooftop helipad and a **police helicopter** that flies patrols over the city | 4×4 |
| Fire | Fire Headquarters, big and ornate, with a **firefighting plane** that flies out to fires | 4×4 |
| Health | General Hospital | 4×3 |
| Power | **Nuclear Power Station** (owner, 2026-11-20): cooling towers, no smoke | 4×4 |
| Water | Waterworks (reservoir and filter beds; whether it must sit by water is for later) | 4×4 |
| Sewage | Sewage Works | 4×4 |

## Proposed rules (PM defaults, open to change)
- **One of each per city.** A separate **Capstones** toolbar category. Locked items show greyed out with the population needed.
- **Old buildings keep working.** Nothing is removed. A small station that no longer adds coverage costs almost no PC to close (under the PC services rule, residents still covered lose very little), so the player tidies up at their own pace and gets the land back.
- **A single point of failure.** If its road is cut, or it burns down or gets abandoned, the whole city loses that need at once. Keeping a few old buildings is insurance. That's a fun risk, not a bug.
- **Affordability.** It costs about as much as the airport to build ($1–3M), and its upkeep is about **2× the upkeep of the small buildings it replaces** in a 20k city. So it's a luxury bought with convenience and land, not a saving. ENGINEER 3 tunes it so a 20k city with a healthy surplus can carry one or two, and only a strong city carries all seven.

## Questions for the owner
### Q1. What does "the whole city" mean for police, fire, school and hospital? **Decided (owner, 2026-11-20): A.**
Every home joined to it by road, at any distance, with no capacity limit: the same rule as utilities. Rejected: B (every home, roads or not), C (huge but limited reach and capacity).

### Q2. Unlock **Decided (owner, 2026-11-20): each capstone at its own population milestone, sewage first.**
PM's proposed order and levels (ENGINEER 3 tunes; the owner confirms the order):
| # | Capstone | Population |
|---|---|---|
| 1 | Sewage Works | 10,000 |
| 2 | Waterworks | 12,500 |
| 3 | Fire Headquarters | 15,000 |
| 4 | Police Headquarters | 20,000 |
| 5 | General Hospital | 25,000 |
| 6 | Nuclear Power Station | 30,000 |
| 7 | University | 40,000 |
Sewage and water come first because they're the dullest chores. The nuclear station and the university are the late showpieces.

### Q3. Is coverage the whole reward, or does each capstone add a perk?
- **A. Coverage and land are the reward.** *(PM pick)* Simple to balance.
- **B. A small city-wide perk each** (the university lifts land value and office demand; the general hospital raises satisfaction a little; the police HQ lowers crime more than full coverage does).

### Q4. Cost level
- **A. About the airport: $1–3M to build, upkeep about 2× what it replaces.** *(PM pick)*
- **B. Cheaper to run than what it replaces** (a real saving, with only the build cost as the barrier). Then every big city builds them all, and it's no longer a sign of a well-run city.

## Who does what (once decided)
- **Engine:** seven building kinds, one per city, population unlocks (reuse `unlockPopulation` and `onePerCity` from leisure), whole-city coverage as an extra source in the coverage layers, utility output.
- **Graphics:** the Capstones toolbar category, the helicopter and plane animations, locked state, art within SCALE.md (art review page first, paid images with the owner's OK).
- **ENGINEER 3:** costs, upkeep, unlock levels; lab targets (for example, "a 20k city with a healthy surplus can carry two").
- **PM:** this doc.
