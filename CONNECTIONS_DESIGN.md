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

  **Early numbers (ENGINEER 3, 2026-11-21, for the owner and PM to design from; no game code).** The game has no employment as such. Homes send job trips (0.34 a home level) to industry and service doors (room: 2 a level for industry, 1 per service); shops employ nobody. Read off the jobs market on the 14 lab saves after 3 days, one day averaged, in trips a tick. "No job" counts trips that end at a door already over its room, or reach no door. "Empty" is door room no trip reaches. "City-wide" is what is left if every seeker took any job with room.

  | City | Residents | Job seekers | Job room | City-wide: seekers left over | City-wide: room left over | Nearest door: no job | Nearest door: room empty | Home demand | Industry demand |
  |---|---|---|---|---|---|---|---|---|---|
  | gen-s1-t10000 | 10.3k | 538 | 1,150 | 0% | 53% | 28% | 66% | 1.21 | 0.78 |
  | smallercity | 12.7k | 661 | 392 | **41%** | 0% | 43% | 4% | 0.76 | 1.66 |
  | gen-s1-t12500 | 13.4k | 707 | 1,275 | 0% | 45% | 23% | 58% | 1.16 | 0.87 |
  | gen-s1-t15000 | 15.4k | 803 | 997 | 0% | 19% | 68% | 75% | 1.12 | 1.02 |
  | gen-suburban-s2-t15000 | 16.0k | 841 | 2,421 | 0% | 65% | 45% | 81% | 1.22 | 0.65 |
  | testcity1 | 18.6k | 665 | 1,280 | 0% | 48% | 15% | 56% | 1.08 | 1.08 |
  | gen-s1-t20000 | 20.0k | 1,049 | 1,016 | 3% | 0% | 76% | 75% | 0.98 | 1.14 |
  | gen-suburban-s2-t20000 | 21.3k | 1,124 | 2,390 | 0% | 53% | 47% | 75% | 1.15 | 0.78 |
  | gen-suburban-s2-t25000 | 25.8k | 1,372 | 2,863 | 0% | 52% | 64% | 83% | 1.13 | 0.74 |
  | gen-s1-t25000 | 26.7k | 1,411 | 3,106 | 0% | 55% | 30% | 68% | 1.12 | 0.76 |
  | gen-suburban-s2-t30000 | 30.3k | 1,591 | 5,700 | 0% | 72% | 14% | 76% | 1.29 | 0.57 |
  | gen-s1-t30000 | 31.1k | 1,622 | 3,274 | 0% | 50% | 26% | 64% | 1.07 | 0.78 |
  | golden-1 | 35.5k | 1,275 | 3,952 | 0% | 68% | 0% | 68% | 1.28 | 0.99 |
  | gen-s1-t40000 | 42.1k | 2,230 | 2,854 | 0% | 22% | 35% | 49% | 0.91 | 0.98 |

  - **Jobs outnumber workers, not the other way round.** In 12 of 14 cities there is more job room than job seekers: 19–72% of it sits empty city-wide, because industry is overbuilt (industry demand 0.57–0.99). Only smallercity is short of jobs (41% of seekers have no room anywhere); gen-s1-t20000 is about even. This doesn't change with size between 10k and 42k.
  - **Where people work is the bigger mismatch.** Every trip goes to its nearest industry, so 14–76% of seekers end at a full door while 49–83% of the room sits empty elsewhere in the same city. Commuting out would mostly give the "no job" side somewhere to go that the city already has.
  - **What X% crossing would do.** In-commuters are treated as home levels the city didn't build, out-commuters as job levels it didn't build, through the growth formulas (`BALANCE.demand`):
    - **Uncapped at 25%:** 25–218 trips a tick out, and 4–1,081 in (190–590 on most 20–30k cities). Industry demand rises by 0.01–0.14 (0.06–0.14 everywhere but smallercity) and home demand by 0.01–0.03. That much traffic is 3–15× a highway point's inbound room (70) and 2–13× an avenue's capacity (80), so every entry jams, and badly.
    - **Capped like residents going out (30–60 trips a tick each way per point):** commuters cover 1–8% of the empty room, and home and industry demand move by 0.03 at most, mostly 0.01. Growth and tax barely notice. The entry road carries about as much again as it does now: one point already jams an avenue at 1.02–1.69.
    - **Tax:** in-commuters live elsewhere and pay no home tax; out-commuters already live and pay here. On these built-out cities, demand only changes how fast the remaining zoned land fills, so a cap of 30–60 is worth roughly nothing in tax.
  - **So commuters are a traffic feature unless they count for more.** Anything small enough not to jam an entry is too small to move growth. To make commuting a real way to grow without jobs (the Q2 worry), one commuter would have to count as more than one worker in the demand formulas, or commuters would need a different road, such as rail (200 a point) or a dedicated highway class. That is the design question for the plane.

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
- **Exports in the lab (ENGINEER 3, 2026-11-21):** trucks reach a point only from industry within `port.reach` (48 street tiles; a highway tile counts half) of the point's own tile at the map edge. On the 256 and 512 maps the join alone is 150–370 highway tiles, so no city's own industry was in reach and `exports` was n/a on 11 of 14 cities. Where the nearest point sends no trucks, the suite now builds an industry district by the point (three streets off the highway, about 120 tiles, a small plant set, 30 days) as a player exporting by highway would. Exports grade on 13 of 14 cities: $548–640 a day, all within $500–800 (golden-1 $548 with 124 levels). In play, highway exports only pay for industry built out near the map edge.
- **Tourists in the lab (PM, 2026-11-21):** the test cities have no attractions, so their points bring day-trippers only, and `entryJam` / `twoPoints` stay graded that way. On 20k+ cities with none, the suite also runs one and two points with the tourism probe's museum, big park and plaza placed (`connections.tourists`, information only). Each point then brings 30 tourists. The entry avenue jams less with one point (1.02–1.69 → 0.69–1.36) and a second point helps less (0.60–0.66 → 0.88–1.0 of the added load): attractions spread visitors deeper into the city. No re-tune.
- **Rail in the lab (owner, 2026-11-21, lab only):** the test cities had no ground track, so `railIn` was n/a on 13 of 14. Where a city has none, the suite now builds a surface line on its copy as a player would: ground track from the rail point to a straight station near the jobs, then on to more stations at least 16 tiles apart (it tries 25 sites per stop; 1–2 stations go in, never 3, because a new stretch may not run beside track already laid). It then measures the riders, the track's peak and the streets around the stations. 13 of 14 cities now grade (smallercity's own track can't be joined); 8 pass.

  | City | Residents | Stations | Riders in a tick | Track peak | Jammed road tiles | Streets by the stations: peak, at capacity |
  |---|---|---|---|---|---|---|
  | gen-s1-t10000 | 10.3k | 2 | 39 | 0.16 | 403 → 405 | 3.73 → 3.73, 17 → 17 of 36 |
  | gen-s1-t12500 | 13.4k | 1 | 54 | 0.22 | 522 → 529 | 4.59 → 4.59, 22 → 22 of 24 |
  | gen-s1-t15000 | 15.4k | 2 | 65 | **1.26** | 530 → **595** | 3.71 → 6.13, 19 → 26 of 32 |
  | gen-suburban-s2-t15000 | 15.9k | 1 | 43 | 0.17 | 672 → 672 | 1.80 → 2.08, 12 → 12 of 14 |
  | testcity1 | 18.6k | 2 | 41 | 0.11 | 112 → 117 | 0.90 → 1.51, 0 → 2 of 15 |
  | gen-s1-t20000 | 19.9k | 2 | 67 | **1.37** | 732 → **752** | 4.96 → 6.76, 19 → 21 of 32 |
  | gen-suburban-s2-t20000 | 21.2k | 1 | 69 | 0.28 | 882 → 884 | 4.14 → 4.40, 13 → 13 of 13 |
  | gen-suburban-s2-t25000 | 25.8k | 2 | 73 | **1.46** | 1003 → **1014** | 9.03 → 9.26, 28 → 29 of 30 |
  | gen-s1-t25000 | 26.7k | 1 | 75 | 0.30 | 956 → **995** | 6.83 → 7.50, 20 → 20 of 21 |
  | gen-suburban-s2-t30000 | 30.3k | 2 | 67 | 0.27 | 1128 → 1122 | 2.09 → 2.82, 24 → 26 of 41 |
  | gen-s1-t30000 | 31.0k | 2 | 79 | 0.32 | 1097 → **1107** | 6.36 → 3.83, 31 → 31 of 48 |
  | golden-1 | 35.5k | its own | 91 | 0.25 | 49 → 51 | – |
  | gen-s1-t40000 | 42.1k | 1 | 93 | 0.37 | 1484 → 1481 | 11.46 → 12.33, 18 → 20 of 30 |

  - **Riders in:** 39–93 a tick, rising with city size. Every city but gen-s1-t10000 reaches 40.
  - **Track:** 0.11–0.37 on most lines. But with two stations near the jobs, residents ride the line within the city, and the track runs over capacity (1.26–1.46 on three cities). Visitors alone would not fill it.
  - **Streets by the stations:** in the generated cities most of them were already at capacity before the line (12–31 of 13–48). The line adds 0–7 more, and peaks rise up to about 1.8×.
  - **The jam limit is tighter than the noise.** Generated cities have 400–1,500 jammed road tiles, and the count moves by −6 to +65 when the line opens, with two cities going down. The ±5 allowance (written for golden-1, 49 jammed) fails 6 cities, at +7 to +65 tiles (0.9–12% of what was already jammed). **PM (2026-11-21, lab grading):** the allowance is now 5 tiles or 2% of those already jammed, whichever is more. At that limit gen-s1-t12500, gen-suburban-s2-t25000 and gen-s1-t30000 come within it. The jam part still fails gen-s1-t15000 (+65, allowed +10), gen-s1-t20000 (+20, allowed +14) and gen-s1-t25000 (+39, allowed +19). `railIn` as a whole fails 5: gen-s1-t10000 (39 in), gen-s1-t15000 (track, jam), gen-s1-t20000 (track, jam), gen-suburban-s2-t25000 (track) and gen-s1-t25000 (jam).


## Who does what
- **Engine:** entry points (map generation, save, old saves), connections as gateways in the leisure market and as export doors, rail riders entering at the edge track node, the overlay and Inspect data.
- **Graphics:** the off-map stub and sign for highway and rail, a "joined" state, and the points shown while placing a road or track.
- **ENGINEER 3:** the numbers, and lab targets (for example, "the entry highway of a 20k city with one connection is jammed at peak, with two it isn't").
- **PM:** this doc.
