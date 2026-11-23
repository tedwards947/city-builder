# Political Capital — Design Proposal

*Status: design agreed with the game designer, ready for engine and graphics review. Implementation notes are suggestions, not a spec.*

## Redesign in progress: local trust (owner, 2026-11-22)
PC as built is a meter you pay from, and cities sit at the cap 85–100% of days (ENG3, docs/FLIGHT_BRIEF_2026-11-22.md). The owner: brake, currency and reward together "isn't enough to make the gameplay interesting". The missing piece is a dilemma: nobody disagrees with you. Being decided step by step:
1. **Direction: D1, neighbourhood trust.** Each neighbourhood keeps its own goodwill instead of one city-wide number. Acting on Elm St (bulldozing, nuisance buildings, moves) spends Elm St's trust. Serving it (parks, transit, requests met) earns it. Neglected areas push back. It drops the old "one simple number" rule. Later it feeds Vibe (character per neighbourhood).
2. **What a neighbourhood is: B,** areas bounded by avenues, highways, rail, water and the map edge, each with a generated name; trust carries over when one splits or merges. **Prototype first on A**, the existing request grid cells, to test whether local trust is fun before building borders.
3. **What trust does: C, both.** Disruptive acts spend a neighbourhood's trust and are blocked below zero. Its trust level also gently shapes growth, density, tolerance of nuisances, land value and protests.
4. **What costs trust: one rule, you pay for what residents lose, where they live.** Their home (displacement), their last road access (charged as displacement; a road whose removal strands nobody is free, as is upgrading one in place), their services (net coverage loss), their peace (nuisance). **The cut-off warning comes first:** hovering shows the stranded homes in red with "Build another route first"; with a detour built the removal is free; a large cut asks to confirm. Today, bulldozing a road costs nothing and clearing abandoned buildings pays a reward, which is a likely exploit (ENG3 to check).
5. **How trust is earned: E1, each neighbourhood has its own values,** from its identity (a leafy area loves parks and hates roads; a working-class one wants jobs and transit). The same action pleases one district and angers its neighbour. Not passive regen, not quests (owner: "kinda repetitive"). Later, E2: deals when you need something from a neighbourhood. E3 (council votes) is held in reserve.
6. **Neighbourhoods change: F2 pressure from the city around them, with F1 ageing underneath.** New stations, avenues and attractions raise land value, and the neighbourhood is pushed to densify; rents rise, old residents get angry, and the identity drifts. Let it change, or hold it back (rent control or heritage ordinances, which cost money and growth). Ageing: needs shift (schools, then hospitals) and old buildings decline unless renewed. Events (F3) only to show these, not as a quest list.
7. **Identities: C,** the Vibe traits (egalitarian, green, planned, plus density and wealth) underneath, and the nearest named type shown as a label that drifts ("Harbourside: leafy wealthy, drifting downtown"). This is where the redesign joins Vibe.
8. **On the map: C,** neighbourhood names and trouble pins (protest, "rents rising") always on at mid zoom, plus a Neighbourhoods view (trust shading, values, recent changes and why, pressures).
9. **Decay comes from sustained poor health, never from age** (owner). Condition follows land value, services, crime, pollution, noise, jobs in reach and trust. A healthy old district never decays; a highway through it or its factory closing does it. Recovery is slow once the cause is fixed. Ageing residents shift existing needs: more hospital seats, fewer school seats, so capacity, not coverage, changes.
10. **The pull: neighbourhoods have ambitions** (owner likes it, to workshop). The owner's key point: once built, a neighbourhood is rarely revisited, and pushes (decay, gentrification, trust) can't fix that because a well-run district never triggers them. So each neighbourhood has a tier; the next tier needs things it lacks, set by its identity (working-class: a station in walking distance, then a market square; leafy: a big park, then a quiet street with no through traffic; downtown: a plaza, then culture). A tier up allows taller buildings and more tax, boosts trust and upgrades the label. Without it the district plateaus, it doesn't decay. On a full map this is where growth comes from. The push systems become the cost of chasing ambitions (a station brings gentrification pressure; construction spends trust).

**Vignettes (owner, 2026-11-22):** 1 "The new station" (a station in working-class Millbrook ripples into gentrification; let it change, hold it back, or face a protest) and 2 "Where does the power plant go?" (the same plant costs different trust per neighbourhood by its values; below zero blocks; build the detour first) were approved. 3 "Greystone grows old" is to be redone around ambitions and the capacity shift (the clinic step was moot: hospital coverage is already required).

**Ambitions (owner, 2026-11-22):**
- **A tier caps density (A), with an identity landmark later (C).** Homes and shops can't grow past the neighbourhood's tier, whatever the demand.
- **Three tiers:** tier 1 allows levels 1–2 (roughly what a new neighbourhood reaches today, so early game is unchanged); tier 2 allows level 3; tier 3 allows towers (merged 2×2 lots), and later the landmark.
- **Needs are lasting conditions, not timed quests,** shown as a checklist in the neighbourhood panel. Tier 2 needs two, tier 3 three including one "big" item (a station or a leisure building). Mostly "within walking distance", so place matters. A tier is lost if a condition stays broken for a while.
- **Needs, outcome draft 2 (PM, 2026-11-22, from ENG3's docs/PC_OUTCOMES.md; for owner review).** Only four outcomes carry signal today: commute, street load, station load and land value. Pollution and crime at homes are flat, so they are out until those models change. Tier 2 needs one outcome, tier 3 two, stricter. Limits start from the owner's cities' ranges (p10–p90) and ENG3 tunes them. Land value is an absolute level, not a share of the median (that would be zero-sum). **Grace:** a condition must stay broken 3 months before the tier drops, with a ±0.05 band against flicker.

| Identity | Tier 2 (level 3) | Tier 3 (towers) |
|---|---|---|
| Family suburb | worst street tile ≤ 1.2 (quiet streets) | worst street tile ≤ 0.9; commute ≤ 8 |
| Working-class | commute ≤ 8 | commute ≤ 6; a station within walking distance, its load ≤ 0.9 |
| Leafy wealthy | median street load ≤ 0.4 | median street load ≤ 0.3; land value ≥ a high level |
| Downtown | a station within walking distance, its load ≤ 1.0 | station load ≤ 0.8; commute ≤ 6 |
| Creative | commute ≤ 9 | a station within walking distance, its load ≤ 0.9; land value ≥ a middle level |

What ENG3's data says this does: in a built city tiers hold unless the player acts; while the city grows or a line fills up, 10–37% of tiers break a year. Success breaks them (density loads the station and the streets).
Open: a station "within walking distance" is a placement gate inside an outcome. ENG3's option B would make that explicit, with one stable placement and one moving outcome per tier. Owner to say.

Neighbouring needs clash (leafy wants no avenue, downtown wants traffic and rail), which ties the E1 dilemma to growth.

- **Losing a tier: C.** Buildings stay and nothing new grows past the cap; trust drifts down with a bubble ("Millbrook is losing its station"); long neglect leads into the poor-health decay. How often a tier would be lost: ENG3 to measure later.
- **No ageing.** The game has no resident age or health, and neighbourhood age would bring back time-driven change. Ageing (F1) is dropped: all change comes from what the player or the city does.
- **Conditions are outcomes that move with the city, not placements** (owner, 2026-11-22). Seats are cheap (hospitals, schools), and space is solved by planning ("leave space for a double highway and it'll never be an issue"), so placement conditions get done once and forgotten. Outcomes keep moving: commute time, traffic load on its streets, its station's load, noise and pollution, land value or crime relative to the city. Success breaks them (density overloads the station and jams the streets), and the whole city affects them, so a perfect plan still meets new pressure. Neighbour clashes stay. **The table above is to be redone in outcome terms.**

**Vignette 3, "Greystone, your first suburb"** (to redo with outcomes): on a full map, the first suburb is where growth is; reaching a tier means trade-offs that land on neighbours (a bypass past Riverside, calming an avenue that downtown wants).

**Next:** owner reviews needs draft 2; then the prototype (trust on the request grid cells), by ENG3 or CITY-ONCALL.

## Why
Political Capital (PC) is a dead mechanic right now. It has one way to earn it (regenerating from satisfaction) and one way to spend it (displacing residents), and a hard cap of 100. A happy city refills that from empty in about two minutes at 1× (0.4 PC per tick, 2 ticks per second), so it almost never stops you doing anything.

**Core pillar:** you shouldn't be able to bulldoze whole neighbourhoods freely, so building the city has to be thoughtful. Almost no city builder punishes mass demolition, which makes this a selling point.

**Constraint:** PC stays **one simple number**, a second currency next to money.

## Design rules
| # | Rule |
|---|---|
| 1 | **PC is a currency.** Shown next to cash. Actions show their PC price and are refused if you can't afford them. |
| 2 | **The cap grows with population** (e.g. `100 + pop/100`). This stops players saving up and then flattening a whole district. |
| 3 | **PC is scarce.** A full refill takes minutes. Earned bonuses matter more than passive regeneration. |
| 4 | **Passive regeneration follows satisfaction and can go negative.** A happy city earns slowly; an unhappy one loses PC (it can't drop below 0). Passive regeneration stops at the cap. |
| 5 | **One-off bonuses can go over the cap.** Rewards are never wasted. |

## Ways to spend PC
| Item | How it works |
|---|---|
| **Displacement** (existing) | Bulldozing or rezoning occupied homes (or building roads or buildings over them) costs PC for each resident displaced. The cost scales with the cap, like regeneration and ordinance upkeep, so a tower costs the same share of the cap at every city size (owner decision 2026-11-17; the factor is exactly 1 at the shipped numbers). |
| **Unpopular buildings near homes** | Industrial zones, sewage plants and power plants (airports later) cost PC based on the residents within a radius, with less cost the further away they live. In empty land they cost only money. Building homes next to an existing nuisance costs nothing. Only homes complain. |
| **Big projects** | A flat PC cost on top of money and any nearby-homes cost. *Deferred: a `pcCost` field at 0 for now; stadium, airport and landmarks need multi-tile buildings first.* |
| **Closing services** | See "One rule for services" below. |
| **Ordinances** | A PC lump sum to enact plus a small daily PC upkeep. Repealing refunds nothing. See "Ordinances" below. |

## Ways to earn PC
| Item | How it works |
|---|---|
| **Satisfaction** (existing, reworked) | See rule 4. |
| **Ribbon cuttings** | See "One rule for services" below. |
| **Population milestones** | One-off PC at 1k, 2.5k, 5k, 10k, 25k… with a toast. Each fires once. |
| **Resident requests** | For example, "Elm St. wants a park within 10 days." Success earns PC; failure costs a little. See "Resident requests" below. |

### One rule for services (ribbon cuttings and closures)
Each nearby resident gets less value from each additional service building of the same type. The first park matters a lot, a second park close by matters less but still something.
- **Opening** a park, police, fire, school or hospital building earns PC equal to the total value residents gain.
- **Closing** one costs PC for what residents lose. Residents left with **no** building of that kind count at the closure multiplier (at least 1), so building and bulldozing can't be farmed and closing the only hospital hurts. Residents **still covered** by another building count their smaller loss at ×1 (owner decision, 2026-11-17, after the balance lab showed moves could never be cheap under the old rule).
- Residents still covered by another building of the same type lose very little, so **moving** a service is cheap.

## Parked
- **Neighbourhood initiative** (spend PC to push an area's vibe): wait until vibe has a real effect on gameplay.

## For the game engine engineer (suggestions)
- Put the PC logic in pure functions so it's easy to test: cap, granting over the cap, nearby-homes cost, service value change.
- Commands already use a `pcCost`/`pcDelta` execute/undo pattern (`PlaceBuildingCommand`, `PaintZoneCommand`, `BulldozeCommand`, `BuildRoadCommand`), so new costs and rewards should reuse it to keep undo exact.
- Regeneration lives in `PoliticsSystem.update`; tuning lives in `balance.ts` → `politicalCapital`.
- Persistence: the next milestone index, active ordinances and open requests need saving. The cap is derived, so it doesn't.
- Phasing idea: (1) core economy (cap, regeneration, nearby-homes cost, flat costs, service rule, milestones) → (2) ordinances → (3) requests.

## For the graphics/UI engineer
- **HUD:** PC shown as `pc / cap`. The bar scales to the cap, and there's a clear state for draining (negative regeneration) and for being over the cap.
- **Cost preview:** the PC price, or reward, shown while hovering or placing, especially the nearby-homes cost and closure costs. Possibly a radius ring for nuisance buildings.
- **Feedback:** toasts for ribbon cuttings, milestones and requests. Floating "+PC / −PC" text at the tile would feel good.
- **Ordinance panel:** a list of toggles with enact cost and daily upkeep.
- **Request markers:** a pin on the map at the requesting street, with a countdown.

## Decisions from the engineering review (2026-11-15)
Owner answers to questions from the engine and graphics sessions. Where these clash with anything above, these win.
- **At 0 PC:** closing a service is never refused. It takes whatever PC there is, down to 0, so a broke, unhappy city can always cut costs. Displacing residents is still refused.
- **Industrial zoning near homes:** charged per tile at a small rate, like money. A drag stops part-way when PC runs out.
- **Blight-clearing reward:** kept, but it stops at the cap like passive regeneration, so it can't be farmed into overflow.
- **Big projects:** placeholder only. Every building gets a `pcCost` field set to 0. Stadium, airport and landmarks become a separate future feature that needs multi-tile buildings and paid art.
- **Refill target:** a happy city refills from 0 to the cap in about 5 minutes at 1× (about 75 game days). Today it's about 2 minutes. Final numbers get tuned in a joint play-test.
- **Old saves:** milestones already passed count as reached, with no lump-sum payout.
- **Service value** counts only residents inside each service's existing coverage radius. Utilities (water tower etc.) earn no ribbon-cutting PC.
- **Ordinances:** enacting or repealing can't be undone with Ctrl+Z. They get their **own toolbar tile and panel**, like Budget.
- **Requests** point at a neighbourhood with no name, shown as a pin alongside the district problem pins. No street names.
- **Starting PC** stays at 100, and the cap formula starts at 100.
- **UI look and feel** (HUD states, cost previews, floating text, PC colour, inspect-pane lines, milestone treatment): decided from graphics' mock pages under `art/clay-set/`.
- **Delivery:** engine's plan is to land prep work and steps P1–P8 with all numbers at 0, so nothing changes visibly; switching each step's numbers on is its own small pull request.

## Ordinances (decided 2026-11-16)
Each ordinance is a trade-off, not a free buff. It costs a lump of PC to enact plus a small daily PC upkeep (numbers set in the balance play-test). First set (eight):

| Ordinance | Benefit | Drawback | Sim it uses |
|---|---|---|---|
| Neighbourhood Watch | Crime −15% | PC upkeep only | Crime |
| Curfew | Crime −30% | Shop income −10% | Crime, tax |
| Clean Air Act | Industrial pollution −30% | Industry grows slower | Pollution, growth |
| Business Incentives | Shop and industry demand up | Their tax income down | Demand, tax |
| Free Transit | Less traffic | Money upkeep too | Traffic |
| Fast-Track Permits | Zones grow faster | A bit more pollution and crime | Growth |
| Eminent Domain | Displacing residents costs half the PC | City-wide satisfaction drops, so PC is earned more slowly | PC, satisfaction |
| Heritage Protection | Established neighbourhoods gain land value | They become very expensive to demolish | Land value, PC |

Percentages are starting points, to be tuned in play-testing. Not chosen: Tree Planting Program. Parked: Rent Control (its benefits, no abandonment over land value and an egalitarian vibe pull, act on things the sim doesn't have yet), until vibe or land-value abandonment exist.

**At 0 PC:** active ordinances are suspended (no effect, no upkeep) and resume by themselves once PC recovers. This matches the "suspended" row state in the mock.

## Resident requests (decided 2026-11-16)
A neighbourhood asks for something by a deadline. Success earns PC; failure costs a little.
- **Kinds:** a park; a school or hospital; police or fire (each meaning coverage over the area); restored power or water (only during shortages); fixing a traffic jam (nearby roads back under capacity); clearing blight (abandoned buildings nearby cleared or revived). Not chosen: "clear the air", "leave us alone".
- **How many:** up to 3 open at once. A new one appears every few game-weeks while under the limit.
- **Who asks:** mostly the neighbourhoods that most lack what they're asking for, with a little randomness.
- **Shown as:** an unnamed neighbourhood badge with a countdown ring (F2), with met and missed states (F4), merged when zoomed out (F5).
- Rewards, penalties and deadlines are set in the balance play-test.

## Open questions
1. Exact numbers: regeneration rate, neutral satisfaction point, cap growth per resident, radii, milestone amounts, ordinance costs and effect sizes, request rewards, penalties and deadlines. To settle in a joint balance play-test.

## Research references
Democracy 4 (PC spent on policy), Caesar III (favour, requests, desirability), Against the Storm (orders give reputation, reputation counters impatience), Anno 1800 (influence, attractiveness), Frostpunk 2 (factions on 3 ideology axes), Cities: Skylines 2 (demolishing owner-occupied homes costs more), ZIMBY (no deletion).
