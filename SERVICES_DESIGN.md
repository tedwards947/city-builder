# Services: proposal

*Status: direction agreed with the owner (2026-11-16); numbers and details to settle. Build it after the PC play-test, and keep it separate from the economy pass so each can be balanced on its own.*

## Why
Placing services is tedious and expensive. Even with the new ranges (police 15, fire 15, school 8, hospital 8, park 6), a small city needs about one school and one hospital per neighbourhood. The number of buildings grows with **how much map you cover**, not **how many people you have**, so every new patch of homes asks for its own set of buildings. Real cities have one hospital per tens of thousands of people.

For comparison, SimCity Classic had only police and fire to place. Their influence spread out in a radius as a fading strength, scaled by budget funding. Hospitals spawned by themselves; there were no schools.

## Direction: a model that suits each service
| Service | Should feel like | Model |
|---|---|---|
| **Park** | Very local ("is there a park near me?") | Reach only, small (about 4–6 road steps). Unchanged in spirit. |
| **Police, fire** | District-wide | Reach only, larger (about 15–20 road steps). |
| **School** | A few neighbourhoods each | **Capacity + generous reach**: serves up to N residents (e.g. 2,000) within about 15–20 road steps. |
| **Hospital** | City or district | **Mostly capacity**: serves up to N residents (e.g. 5–10k) within a large reach (30+ road steps). A small city needs one. |

With capacity, **schools and hospitals scale with population**: you add one when the existing ones are full, not when you sprawl.

## How capacity works (cheap, no traffic)
- Coverage is already worked out along roads and cached, and only recalculated when roads or buildings change. Capacity is added in that same recalculation.
- Each developed home (residents = its population) is assigned to the nearest building of the kind that has it in reach and still has seats. If none has seats, the home isn't covered by that kind.
- The cost is about the same as today, with no per-tick routing and no feedback into traffic.
- **Not chosen:** making schools and hospitals destinations in the traffic system. It's more realistic, but it adds traffic passes, risks routing feedback loops, and is harder to balance (owner and PM agreed).
- Open: whether a full building's overflow should fall to the next nearest one (yes, probably) and how the ordering stays stable.

## What it touches
- **Coverage layers** for school and hospital: a home is covered only if it was assigned a seat. Downstream (education's land value and tax effect, health, satisfaction) works unchanged.
- **PC service rule** (ribbon cuttings and closures): value = residents newly seated or unseated. Closing a full hospital in a one-hospital city should hurt. The per-resident numbers need a re-run.
- **Requests:** school and hospital requests become "residents here have no seat", met when a seat reaches them. The road-shaped clusters still fit. Engine re-runs the variant numbers.
- **UI:** coverage preview and inspect pane show capacity ("1,640 / 2,000 seats"); a "full" state; the quest log and badge hover use it. Graphics will want a mock page with a feedback form, as before.
- **Save:** capacity is derived, so nothing new needs saving unless overflow ordering needs it.

## Funding sliders (part a): plan only, for the economy pass
- One funding slider per service type (police, fire, school, hospital, park), probably in the Budget panel. Each scales that service's upkeep, and so its money cost.
- **What underfunding reduces is to be decided later** (owner): capacity or quality (smooth, fits the capacity model) vs reach (like SimCity Classic, but coverage edges move).
- It ties into ENGINEER 3's economy brief: service upkeep ×0.5, a land-value tax floor of 0.25, debt that drains PC with a hint, and later a tax slider tied to satisfaction. Sliders give the player a money lever with a gameplay cost, and a better way out of debt than bulldozing.

## Order, so balancing stays manageable
1. **Finish the PC play-test** and switch the numbers on.
2. **Services model (this doc):** engine builds capacity with numbers chosen so behaviour starts close to today (large capacity). ENGINEER 3 dry-runs it on the owner's city and a fresh city (buildings needed per 1k/10k residents, coverage, PC rewards, requests). Graphics mocks the capacity UI. Then the owner play-tests services alone.
3. **Economy pass:** ENGINEER 3's upkeep and tax recommendations, debt behaviour, then the funding sliders, using the Economy debug panel presets. Each step with a dry run, then a play-test.

## Open questions
1. Starting capacities and reaches per kind, from a dry run.
2. Overflow behaviour and ordering when buildings are full.
3. Should police and fire move to a fading radius like SimCity Classic, or stay road-based with larger reach? (Road-based keeps one rule everywhere.)
4. Tiers (clinic vs hospital, primary vs high school): later, if ever.
5. What funding sliders reduce (capacity/quality vs reach): decide in the economy pass.
