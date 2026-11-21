# Outside Connections: Design

*Status: proposal (owner asked 2026-11-20: "outside connections now... only highways and rail", with capacity for each and visitors included). Nothing decided yet. The PM walks the questions with the owner one at a time.*

## Why
Today a city is an island. New maps have no highway in (the generator lays no roads), tourists come only through the $2M airport, and goods leave only by seaport. A road or a line running off the edge of the map means nothing.

Outside connections make the edge matter. Joining a highway or a rail line to the region brings people in and lets goods out, and where you join shapes the city: the trunk road from the border is the city's spine, and a rail line from the border is a reason to build rail at all.

## What exists to build on
| Thing | Today | Where |
|---|---|---|
| Road capacity a tile | street 20, avenue 80, **highway 200** trips a tick | `BALANCE.roadClasses` |
| Track capacity a tile | **250** riders a tick (busy lines sit near 100% by design) | `BALANCE.rail.capacity` |
| Tourist gateways | airport only, **60** tourists a tick, capped by the city's pull | `BALANCE.leisure.gateways` |
| City pull | sum of attraction `pull` (big park 4, 2×2 park 2, plaza 6, beach park / lido 10, museum 20) | `BALANCE.leisure.kinds` |
| Exports | industry → seaport only, **15** trucks a tick a port, $8 each | `BALANCE.port` |
| Residents travelling out | `visitors` market, homes → airport | `MARKET_DEFS` |

## Capacity: the thinking
**Real world, for scale.** A highway lane carries about 2,000 cars an hour, so a four-lane highway moves roughly 8–10k people an hour. A busy commuter rail line moves 20–40k. So **a rail line carries about 3× a highway**, and that's the ratio the proposal uses.

**In the game, a connection is a source of trips on its edge tile.** What it brings has to drive or ride inward on the road or track it lands on, so the physical limit is the tile (highway 200, track 250). The connection's own number is how much the region *sends*, and it is set well below the tile so residents have room too. When the city's own traffic is added, the entry road fills up. That jam is the fun part: the fix is a second connection, a parallel avenue or a rail line, not a bigger number.

**Rail spreads its load, a highway doesn't.** Everyone arriving by highway enters on one tile and fans out from there. Rail riders get off at whichever station is best for them, so the same number of people loads the city's streets far less. That is the real reason rail carries more.

**Proposed numbers (placeholders for ENGINEER 3):**
| Connection | Visitors in a tick | Exports out a tick | Share of its entry tile | Compare |
|---|---|---|---|---|
| Highway | 30 | 10 trucks | 40 of 200 = 20% | about half an airport, but free to join |
| Rail | 90 (3× a highway) | none (freight never rides, RAIL_DESIGN) | 90 of 250 = 36% | 1.5 airports, spread over stations |
| Airport (today) | 60 | none | n/a | $2M, anywhere on the map |

**Pull becomes the limit.** Visitors = the city's pull, capped by all its gateways together. A mid-size city today has a pull of about 30–60, so one rail connection alone already lifts the cap above it, and a second connection adds nothing. For connections to matter, pull has to grow too (Q4).

## Questions for the owner
### Q1. Where can a connection be?
- **A. Fixed entry points on each map.** *(PM pick)* Each map has 2–4 highway points and 1–2 rail points on its edges, shown as a road or track running off the map with a sign. You build out to one to join it. Where they sit shapes the city, the number of gateways is fixed so capacity can't be spammed, and it's how most city builders do it.
- **B. Anything that reaches the edge.** Any highway or ground track touching the map edge is a connection. Freer, but 20 stubs would mean 20× the capacity, so it needs a cap per city.

### Q2. What comes through?
- **Visitors** in (owner: yes).
- **Exports by highway** *(PM pick: yes)*: industry trucks drive out to a joined highway, like a small seaport (10 trucks a tick against the port's 15). Inland maps (Lakes) get a trade route. Rail freight stays out (it would need a freight yard).
- **Residents travelling out** *(PM pick: yes)*: the `visitors` market (homes → airport today) also uses the connections, so a busy highway is busy both ways.
- **Commuters** in and out (residents working in the region, outsiders filling jobs) *(PM pick: later)*. It's the biggest change to balance, because it lets a town grow without its own jobs.

### Q3. The capacity numbers
Highway 30 visitors plus 10 trucks; rail 90 visitors (3×); airport stays at 60. *(PM pick: these as the starting point, then ENGINEER 3 tunes them in the lab.)* Alternative: rail at 2× (60) so the airport keeps more of its point.

### Q4. Pull has to grow
- **A. Day-trippers come for shops too.** *(PM pick)* Highway and rail visitors also count part of the city's shop tiles as pull (a shopping trip from the next town), so a big commercial city draws day-trippers without attractions. The airport stays attractions only.
- **B. Raise attraction pull.** Simpler, but then a city with no attractions gets nobody by road.
- **C. Leave it.** A second connection mostly adds export and traffic room, not visitors.

### Q5. Does a connection cost anything?
- **A. Free to join.** *(PM pick)* You pay for the road or track out to it, and that's the price.
- **B. A one-off fee or PC cost** (a regional agreement). It's a sink, but an odd one for a road.

## Old saves
Fixed points are a new saved field (additive, no version bump). An old save gets points generated the same way every time from its size and seed. A highway or track already running to the edge becomes a point where it touches, so nothing a player built stops working. The tutorial map's highway stub becomes its one highway point. The showcase is regenerated.

## Who does what (once decided)
- **Engine:** entry points (map generation, save, old saves), connections as gateways in the leisure market and as export doors, rail riders entering at the edge track node, the overlay and Inspect data.
- **Graphics:** the off-map stub and sign for highway and rail, a "joined" state, and the points shown while placing a road or track.
- **ENGINEER 3:** the numbers, and lab targets (for example, "the entry highway of a 20k city with one connection is jammed at peak, with two it isn't").
- **PM:** this doc.
