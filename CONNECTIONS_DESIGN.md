# Outside Connections: Design

*Status: **built and tuned** (2026-11-21): P1–P4 (#465, #472, #476, #479), outbound-room fix (#482), numbers and lab suite (#496, #504), signs (#469), Inspect (#475). Left: rail riders out (P5) and commuters, both later. (Owner asked 2026-11-20: "outside connections now... only highways and rail", with capacity for each and visitors included). Nothing decided yet. The PM walks the questions with the owner one at a time.*

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
### Q1. Where can a connection be? **Decided (owner, 2026-11-20): A, fixed entry points, scaled with map size.**
Each map has fixed highway and rail entry points on its edges, shown as a road or track running off the map with a sign. You build out to one to join it. The number grows with the map (owner: "2× highway, 2× rail for small, etc."; the larger sizes are the PM's default):
| Map | Size | Highway points | Rail points |
|---|---|---|---|
| Tutorial | 48×48 | 1 (its existing stub) | 0 |
| Small | 128×128 | 2 | 2 |
| Medium | 256×256 | 3 | 3 |
| Large | 512×512 | 4 | 4 |
Points are spread over different edges, never in water, and not right next to each other. Rejected: B, anything that reaches the edge (it needs a cap, or 20 stubs give 20× the capacity).

### Q2. What comes through? **Decided (owner, 2026-11-20): the PM picks below.**
- **Visitors** in (owner: yes).
- **Exports by highway** *(PM pick: yes)*: industry trucks drive out to a joined highway, like a small seaport (10 trucks a tick against the port's 15). Inland maps (Lakes) get a trade route. Rail freight stays out (it would need a freight yard).
- **Residents travelling out** *(PM pick: yes)*: the `visitors` market (homes → airport today) also uses the connections, so a busy highway is busy both ways.
- **Commuters** in and out (residents working in the region, outsiders filling jobs) *(PM pick: later)*. It's the biggest change to balance, because it lets a town grow without its own jobs.

### Q3. The capacity numbers **Decided (owner, 2026-11-20): the PM pick, ENGINEER 3 tunes from there.**
Highway 30 visitors plus 10 trucks; rail 90 visitors (3×); airport stays at 60. *(PM pick: these as the starting point, then ENGINEER 3 tunes them in the lab.)* Alternative: rail at 2× (60) so the airport keeps more of its point.

**Tuned (ENGINEER 3, owner 2026-11-21; connections suite):** highway **70 in** (tourists and day-trippers), **15 residents out**, **10 trucks**; day-trippers `shopPull` **0.07** a commerce level; rail **200 in** (about 3× a highway). Residents going out want far more room than any point has (100–200 a tick turned away at 20–30k), so every joined point runs full outbound whatever the number; what splits between two points is what comes in, so the inbound side is the big one. On the 20–30k test cities one point onto an avenue jams it at peak (1.02–1.33) and a second point brings it down to 0.61–0.98, except a city whose avenue was already three-quarters full before joining (1.32). `.twoPoints` is graded on the load the joins add, not the absolute peak (PM 2026-11-21): with two points the avenue gains at most 0.75 of what one point adds. The 20–30k cities come out at 0.60–0.66, that one included (0.61). Export trucks are limited at highway points (a point takes 10 and no more drive to it), seaports unchanged. Rail at 200: new_city2 brings in 122 a tick (pull and shops are the limit), track 0.49. Lab targets: `connections.entryJam`, `.twoPoints`, `.exports`, `.industryNeutral`, `.railIn`.

### Q4. Pull has to grow **Decided (owner, 2026-11-20): A, day-trippers come for shops too.**
- **A. Day-trippers come for shops too.** *(PM pick)* Highway and rail visitors also count part of the city's shop tiles as pull (a shopping trip from the next town), so a big commercial city draws day-trippers without attractions. The airport stays attractions only.
- **B. Raise attraction pull.** Simpler, but then a city with no attractions gets nobody by road.
- **C. Leave it.** A second connection mostly adds export and traffic room, not visitors.

### Q5. Does a connection cost anything? **Decided (owner, 2026-11-20): A, free to join.**
- **A. Free to join.** *(PM pick)* You pay for the road or track out to it, and that's the price.
- **B. A one-off fee or PC cost** (a regional agreement). It's a sink, but an odd one for a road.

## Old saves
Fixed points are a new saved field (additive, no version bump). An old save gets points generated the same way every time from its size and seed. A highway or track already running to the edge becomes a point where it touches, so nothing a player built stops working. The tutorial map's highway stub becomes its one highway point. The showcase is regenerated.

## Engine plan (owner-approved 2026-11-20)
- **Points are data, not roads:** tile, kind, edge, in `world.connections`. Graphics draws the stub and sign off the map; the player joins by building a highway (not a street) or track onto the point's edge tile. Classic maps (lab, tests, golden) get points without their roads changing; the showcase isn't regenerated.
- **Old saves:** highways or track already at the edge become points first, in a fixed order, **up to the map's count**; the rest are generated from the seed on dry, empty edge tiles.
- **Counts for other sizes:** up to 64 → 1 highway, 0 rail; up to 128 → 2 + 2; up to 256 → 3 + 3; larger → 4 + 4.
- **Rail carries visitors in only in v1.** Residents travel out by highway or airport. Rail out is P5, only if a spike shows it's clean (it needs a door on a track node).
- **Trips may start and end on highway tiles at points only** (in the core traffic pass, with its own tests and a perf check).
- **Small rules:** day-trippers arrive as shopping trips (not attraction visits); rail arrivals pay no fare (fares stay on boarding at a station); room for residents travelling out by highway is 30 a tick to start; highway exports earn the port's $8 a truck, with no imports and no industry demand bonus.
- **Phases, one PR each:** P1 points (generation, save, old saves, `connectionStatus`; no traffic effect, graphics can start signs); P2 highway (visitors, exports, residents out); P3 day-trippers; P4 rail in; P5 numbers and lab targets with ENGINEER 3, and rail out if wanted.

## Tuned numbers (ENGINEER 3, owner-approved 2026-11-21)
Once the outbound room became a real limit (#482), every point runs at its full outbound room, so a second point adds room rather than halving the load. What splits between points is what comes in, so the inbound side is the big one:
- **Highway point:** 70 visitors in (tourists plus day-trippers), 15 residents out, 10 export trucks; `shopPull` 0.06. One point onto an avenue jams its entry (peak 1.05–1.13 on 20–30k cities); a second point brings the first back to about 0.7.
- **Rail point: about 200 visitors** (owner: keep rail about 3× a highway), as long as the line holds. In practice the city's pull and shops decide how many come.
- **Export trucks are limited at highway points** like residents (only those with room drive there); the seaport keeps its behaviour.
- Exports earn about $630 a day when industry is within reach; industry levels don't move. Lab targets: `entryJam`, `twoPoints`, `exports`, `industryNeutral`, `railIn`.

## Who does what
- **Engine:** entry points (map generation, save, old saves), connections as gateways in the leisure market and as export doors, rail riders entering at the edge track node, the overlay and Inspect data.
- **Graphics:** the off-map stub and sign for highway and rail, a "joined" state, and the points shown while placing a road or track.
- **ENGINEER 3:** the numbers, and lab targets (for example, "the entry highway of a 20k city with one connection is jammed at peak, with two it isn't").
- **PM:** this doc.
