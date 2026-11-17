# Services: proposal

*Status: switched ON 2026-11-17: school reach 20, capacity 4,000; hospital reach 30, capacity 8,000 (owner kept hospital proximity). Tick cost ~0.13 ms amortised, 0.6 ms daily re-seat, 6–12 ms on the tick after a road/building edit. School and hospital PC pay is 0 until ENGINEER 3 re-tunes.*

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
- **Road walks** (which tiles each building reaches, and at what distance) stay cached and are only redone when roads or buildings change, as today. The walk also returns distances.
- **Seat assignment** depends on where residents are, so it's redone once per game day, plus whenever roads or buildings change. It is not done every tick. Cost: about (homes in reach × buildings reaching them), sorted, so a few ms for a large city once a day. No traffic involvement.
- **Overflow rule** (engine's proposal), a pure function of the map with nothing saved: list every (home, building) pair in reach, sort by road distance, then home tile, then building tile, and seat each home whole at the first building with room. Overflow falls to the next nearest building by itself, and the result doesn't depend on build order or save/load. To accept: when homes near a full school grow, the farthest seated homes lose their seats. No "keep my seat" stickiness, because it would need saving and make identical cities behave differently.
- **Not chosen:** making schools and hospitals destinations in the traffic system. It's more realistic, but it adds traffic passes, risks routing feedback loops, and is harder to balance (owner and PM agreed).
- Engine's feasibility note: about 2 PRs. PR 1 ships with capacity effectively unlimited, so the layers and the golden baseline are identical; the numbers PR moves the baseline on purpose.

## What it touches
- **Coverage layers** for school and hospital: a home is covered only if it was assigned a seat. Downstream (education's land value and tax effect, health, satisfaction) works unchanged.
- **PC service rule** (ribbon cuttings and closures): value = residents newly seated or unseated (a what-if assignment with and without the building). Schools and hospitals drop the repeat discount: a second school over already-seated homes earns 0, and one that relieves a full school earns for the overflow it seats. Residents who re-seat elsewhere cost nothing on closure, so moving stays cheap, while closing the only hospital costs the whole city. The per-resident numbers must be redone, because one hospital will seat thousands.
- **Requests:** the need test ("home has no seat") works unchanged. Quest text needs separate "full" and "out of reach" wording, which requestProgress can report. Engine re-runs the variant numbers.
- **Satisfaction:** its services factor counts a home as covered if ANY service reaches it, so capacity barely moves it. Whether full schools or hospitals should hurt satisfaction (a new factor) is an open question.
- **UI:** engine exposes, per building, {capacity, seated, inReachUnseated}, and per home, {seatedAt or none, reason: outOfReach | full}. The coverage preview and inspect pane show capacity ("1,640 / 2,000 seats"); a "full" state; the quest log and badge hover use it. Graphics will want a mock page with a feedback form, as before.
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
1. Starting capacities and reaches per kind, from ENGINEER 3's dry run. Size capacities against real city populations (homes hold 4/10/20 residents, so a 2,000-seat school is 100+ full homes), or capacity never binds.
2. Hospitals: say "reach = anywhere connected by road", so capacity is the only thing the player thinks about? (Engine's suggestion; a 30+ reach is effectively that already.)
3. Police and fire stay road-based with larger reach (engine and PM recommend one rule everywhere; the preview, PC rule and requests all assume it), or move to a fading radius like SimCity Classic?
4. Should full schools or hospitals hurt satisfaction (a new satisfaction factor)?
5. Tiers (clinic vs hospital, primary vs high school): later, if ever.
6. What funding sliders reduce: decide in the economy pass. Engine notes capacity is nearly free to scale (one multiplier), while scaling reach moves coverage edges.
