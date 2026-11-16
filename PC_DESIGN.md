# Political Capital — Design Proposal

*Status: design agreed with the game designer, ready for engine and graphics review. Implementation notes are suggestions, not a spec.*

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
| **Displacement** (existing) | Bulldozing or rezoning occupied homes costs PC for each resident displaced. |
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
- **Closing** one costs PC equal to the total value they lose, multiplied by a factor of at least 1, so building and bulldozing can't be farmed.
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
