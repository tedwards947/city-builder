# Capstone Buildings: Design

*Status: **built and live** (2026-11-21): C1 kinds (#486), C2 whole-city coverage (#488), C3 numbers and lab suite (#499, #505), art and toolbar (#492), animations (#500). Owner playtest pending.*

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
Owner, 2026-11-20: these are expensive, so they should be **big and ornate**, and the police and fire HQs get **their own animations** (a police helicopter, a firefighting plane). The animations are looks only unless the owner decides otherwise. Art picks from graphics' code-drawn mock-ups (3 variants each), owner 2026-11-20, are in the table; paid images come after, with the owner's OK (given 2026-11-20 for these). The police helicopter and the medevac helicopter take off, fly around doing things and land again (owner).
| Need | Working name | Footprint (SCALE.md) |
|---|---|---|
| Education | University. Art: **B** | **8×8** campus (owner, 2026-11-20) |
| Police | Police Headquarters, big and ornate, with a rooftop helipad and a **police helicopter** that flies patrols over the city. Art: **B, brutalist** | 4×4 |
| Fire | Fire Headquarters, big and ornate, with a **firefighting plane** (water bomber) that flies out to fires from **its own runway**. Art: **C, modern**: a runway row, the 4×4 block, and a code-drawn apron and taxiway (the bomber taxis like the airport's planes); runway length is a setting | **runway length × 5, at least 8×5** |
| Health | General Hospital, now a **teaching hospital with a medical school**, with a **medevac helicopter**. Art: **A, modern** | **6×4 or 6×5** (owner picking) |
| Power | **Nuclear Power Station** (owner, 2026-11-20): cooling towers, no smoke. Art: **A, twin cooling towers**, with light steam | 4×4 |
| Water | Waterworks. Art: **art deco pump hall with intake pipes**. **Must sit beside open water** (owner, 2026-11-21: it's a pump station), like the large water plant | 4×4 |
| Sewage | Sewage Works. Art: **C, Victorian pumping station** | 4×4 |

## Proposed rules (PM defaults, open to change)
- **One of each per city.** A separate **Capstones** toolbar category. Locked items show greyed out with the population needed.
- **Old buildings keep working.** Nothing is removed. A small station that no longer adds coverage costs almost no PC to close (under the PC services rule, residents still covered lose very little), so the player tidies up at their own pace and gets the land back.
- **A single point of failure.** If its road is cut or it's bulldozed, the whole city loses that need at once (all seven; see Engine plan). Keeping a few old buildings is insurance. That's a fun risk, not a bug.
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

### Q3. Is coverage the whole reward, or does each capstone add a perk? **Decided (owner, 2026-11-20): A, coverage and land are the reward.**
- **A. Coverage and land are the reward.** *(PM pick)* Simple to balance.
- **B. A small city-wide perk each** (the university lifts land value and office demand; the general hospital raises satisfaction a little; the police HQ lowers crime more than full coverage does).

### Q4. Cost level **Decided (owner, 2026-11-20): A, to try; ENGINEER 3 checked it, and the running cost now grows with residents covered (see Costs).**
- **A. About the airport: $1–3M to build, upkeep about 2× what it replaces.** *(PM pick)*
- **B. Cheaper to run than what it replaces** (a real saving, with only the build cost as the barrier). Then every big city builds them all, and it's no longer a sign of a well-run city.

## Costs (ENGINEER 3's model, 2026-11-20; owner chose the running-cost rule)
ENGINEER 3 measured 15 cities (10k–40k, 10 days each). The small buildings a capstone replaces cost more as the city grows, so a **fixed** upkeep was too steep at unlock (the Sewage Works ate about 80% of a 10k city's surplus) and nearly free at 40k (every big city would carry all seven).
- **Running cost grows with the residents it covers (owner, 2026-11-20).** Each capstone kind has its own extra rate a day per covered resident, on top of the normal per-resident cost (`runningCost.perResident`), so it costs about **1.5× what it replaces at every size**. Starting rates: sewage 0.23, water 0.085, fire 0.09, police 0.11, hospital 0.07, power 0.30, university 0.06 (now sewage 0.155, water 0.053, power 0.20 against large plants, university 0.07; see below) (at 20k: 4.6k / 1.7k / 1.8k / 2.2k / 1.4k / 6.0k / 1.2k a day; double at 40k).
- **C3 (ENGINEER 3, 2026-11-21):** the extra is charged on **every resident a capstone covers**, seated at it or at a small building, as the utility capstones charge the whole population. Charged only on those seated at it, a player who kept the busier small stations and dropped the quiet ones paid 0.66–0.99× what no capstone cost, a saving. University 0.06 → **0.07** (the school's large per-resident cost diluted its premium to 1.11×). Capstones suite (`--suite capstones`): each capstone alone costs 1.21–1.61× the small buildings it replaces on the 20–40k test cities, covers every home, a healthy 20k city keeps $4.7–9.2k a day after its two cheapest, and the 40k city cannot carry them (−$1.9k a day with six; the Waterworks had no water). golden-1 is the exception: with 36 hospitals and 28 schools it is oversupplied, so its hospital and university capstones are a real saving (0.56× and 0.99×). That fail is expected and stays: an overbuilt city that consolidates earns a fair saving. No gate and no lower bar, which would be fitting the target to one city (PM 2026-11-21).
- **What that gives:** at 10–15k the first one or two are easy to carry; a healthy 20k city carries 2–3, a weak one 0–1; a typical 40k city can't carry all seven (+16.1k against a 13.4k surplus), a strong one can.
- **Build cost (airport band):** sewage $1.0M, water $1.0M, fire $1.25M, police $1.5M, hospital $2.0M, nuclear $2.5M, university $3.0M. Played cities hold $2–30M, so upkeep, not the build cost, is the real limit.
- **The extra is charged for the whole covered population**, for all seven (ENGINEER 3, 2026-11-21). Charging only residents seated at the capstone made it a saving: a player keeping the busy small stations and dropping the quiet ones paid 0.66–0.99× today's cost with 100% coverage. Charged on everyone covered, a capstone alone costs about 1.35× (1.14–1.60×), and keeping small buildings only adds their own cost (insurance has a price). Lab targets: `capstone.premium`, `affordTwo`, `allSeven`, `coverage`.
- ~~Utilities are measured against small plants (owner, 2026-11-20).~~ **Utilities are measured against large plants (owner, 2026-11-21).** The newcity2 test showed a city on large plants paying 2.4–2.5× for the Sewage Works and Nuclear Station. Rates re-tuned so each utility capstone alone costs about 1.35–1.5× the large plants it replaces (ENGINEER 3): sewage 0.23 → **0.155**, water 0.085 → **0.053**, power 0.30 → **0.20**. Against large plants they now cost 1.26–1.71× (median about 1.43; before 1.82–2.48). Against small plants they cost 0.87–1.12×, about break-even, so a city still on small plants loses nothing by consolidating. The capstones suite builds the large-plant case (each utility's plants swapped for enough large ones to meet demand) and `capstone.premium` grades utilities against it; the small-plant figure is shown for information.
- **A healthy 40k city can carry all seven (owner's accepted trade-off, 2026-11-21).** With the cheaper utility capstones, gen-s1-t40000 keeps about $5.3k a day with six placed (−$1.9k before). `capstone.allSeven` is shown, not graded.
- Not modelled: the land freed by about 140 small buildings at 40k, which becomes homes and income.

## Engine plan (owner-approved 2026-11-21)
- **Utility capstones need a road too** (engine correction, 2026-11-21; the table above was right). A power, water or sewage plant needs a street or avenue beside it and serves that road network (plus a few tiles round it). So a utility capstone has the same single point of failure as the service ones: cut its street and it supplies nothing, and a district on a separate road network isn't served. It is otherwise a very large output, one per city, with an unlock. The Waterworks also needs open water, and stops supplying if the water beside it is filled in.
- **"Joined by road"** = every home on the same road network as the capstone's street, **highways included**, so a suburb reached only by highway counts.
- **Seats:** a home a capstone covers needs no school or hospital seat; the small buildings' seats go to nobody. This is the main engine work.
- **Failure:** service buildings don't burn or get abandoned today, so a capstone is lost only when its road is cut or it's bulldozed. Bulldozing it charges the normal PC services rule for the whole city, **capped at 50% of the PC cap for one capstone** (owner, 2026-11-21). ENGINEER 3's model: uncapped, a city that removed its small buildings would pay 47–76% of the cap at 20k, up to 100% for the university at 40k, and the charge can take PC below 0. A city that kept small buildings pays almost nothing (residents are re-seated).
- **Entrance:** any street or avenue beside it; no frontage rule. Fire HQ: runway length × 5, at least 8×5, length a setting.
- **Phases, one PR each:** C1 the seven kinds (shapes, one per city, unlocks, costs, per-resident running cost in `BALANCE.capstones`; debug-only until art; the three utility capstones fully work); C2 whole-city coverage for police, fire, school and hospital (network-wide, no seats; PC rule, requests, Inspect, cut-off warning); C3 numbers with ENGINEER 3 and the data graphics needs for the police helicopter, medevac helicopter and water bomber (looks only). No save version bump.

## Who does what (once decided)
- **Engine:** seven building kinds, one per city, population unlocks (reuse `unlockPopulation` and `onePerCity` from leisure), whole-city coverage as an extra source in the coverage layers, utility output.
- **Graphics:** the Capstones toolbar category, the helicopter and plane animations, locked state, art within SCALE.md (art review page first, paid images with the owner's OK).
- **ENGINEER 3:** costs, upkeep, unlock levels; lab targets (for example, "a 20k city with a healthy surplus can carry two").
- **PM:** this doc.
