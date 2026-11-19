# Rail — Design

*Status: the owner agreed the design on 2026-11-18. Next, engine, graphics and ENGINEER 3 review it. Notes for implementers are suggestions, not a spec. Numbers are ENGINEER 3's to propose for the owner's OK.*

## Why
**Make suburbs truly possible.** A neighbourhood far out in the countryside can work in the industrial centre or shop downtown, because a train jumps residents across the map. Rail is a very powerful highway, but it jams like one, and junctions are its weak points.

## The trip: stations are portals
A trip that uses rail goes **home → car traffic → station → rail → station → car traffic → destination**.
- Every trip compares driving all the way with driving to a station, riding and driving on, and takes whichever is faster. Rail is very fast per tile; boarding and transfers add time. Nobody draws lines or routes.
- **Who rides:** commuters, shoppers, job seekers and airport visitors. **Freight never rides** (industry goods, seaport cargo).
- **Stations have no passenger cap.** Once riders leave a station, normal traffic rules apply, so the streets around a busy station jam. In practice a city needs about one station per neighbourhood.

## Three levels, one network
| Level | What it is | Crosses roads? |
|---|---|---|
| **Elevated** | Track on pillars | Passes over roads |
| **Ground** | Heavy rail | Level crossings: allowed, but they slow both cars and trains |
| **Subway** | Tunnels | Passes under anything |

- All three levels are **one shared track network**. Heavy-rail and subway trains run on all of it.
- **Transition buildings** (2×1) link the levels: **ground↔elevated** and **ground↔subway**. Elevated to subway goes through a ground stretch.
- **Underground view:** a toggle fades the surface and shows tunnels and subway platforms.

## Rail traffic
- Each track segment has a capacity. Riders fill trains, trains load the track, and an overloaded line slows down. The fix is a parallel line or smarter routing.
- **Junctions are sensitive**, as in real life. A **3-way junction carries a penalty, and a 4-way junction a much bigger one.** This stops a dense rail grid from replacing roads.
- **The look follows the load:** busier track shows more trains, as busier roads show more cars. Trains animate pulling in to and out of stations.

## Buildings
| Building | Footprint | Orientations |
|---|---|---|
| Train station, straight | 4×3 | horizontal, vertical |
| Train station, L-shaped (elbow) | 3×3 | 4 |
| Subway station | 1×1 entrance on the surface; 4-tile platform underground (the same length as the straight station's platform) | underground platform at 0° or 90° |
| Transition ramp (ground↔elevated, ground↔subway) | 2×1 | 4 each |

Stations have a road door (car traffic in and out) and track at the platform ends.

## Money, PC and growth
- **Cost gates rail, with no population unlock.** Rail is expensive, then taxes and revenue are tuned to match.
- **Track cost per tile:** ground is the cheapest, elevated costs more, and **subway is really, really expensive**.
- Stations have upkeep and earn a small fare per rider. Rail mostly costs money; its payoff is a city that works.
- **PC:** ground and elevated track near homes are a nuisance and cost PC like other unpopular buildings (PC_DESIGN.md). Subway costs no PC.
- **Growth near stations:** homes and shops near a station grow faster.

## Phases (each one playable)
1. Ground track, straight and L stations, the faster-trip choice, rail traffic and junction penalties.
2. Elevated track, subway stations, transition ramps and the underground view.
3. Busier lines show more trains, station animations, polish.

## Who does what
- **Engine:** the track network as its own layer, portal trips in TransitSystem (the faster-trip choice), track capacity and junction penalties, level crossings, save format.
- **Graphics:** a Nano Banana workshop page with **a few variants of each asset** (stations, subway entrance, ramps, train cars) and the usual feedback page for the owner's picks. Track, pillars, tunnels and junctions are drawn in code. Then the train animation and the busy-line look. Paid images are OK'd by the owner for this round.
- **ENGINEER 3:** propose numbers (track cost per level, station cost and upkeep, fare, rail speed, boarding time, track capacity, junction penalties, nuisance radius and PC, station growth bonus) and lab targets, including "a suburb that's only reachable by rail grows".
- **Sound:** once a rail network runs in the game, a few ambient rail options for the owner to review.

## Decisions after engine's review (owner, 2026-11-18)
- **Elevated track** runs over roads, empty land, water and ground track, never over buildings.
- **Water:** subway may run under water; ground track crosses water on bridges.
- **Transfers:** none. A rider boards once; junction penalties do the job. Heavy rail and subway have the same speed and capacity at first.
- **Station doors:** any street or avenue touching a non-track side connects the station (no single door tile).
- **No walking:** both ends of a rail trip need a road; a station without one warns.
- **Level crossings** are allowed on streets and avenues; the slowdown grows with the other side's traffic.
- **Later than phase 1:** PC nuisance for track and the station growth bonus.
- **Phase 1 = four engine PRs:** track layer and tool → stations → rail traffic → tests and lab hooks. Numbers live in `BALANCE.rail`.

## Proposed numbers for the later rail pieces (ENGINEER 3, 2026-11-19; waiting on the owner)
Nothing below is built or shipped. These are starting numbers for ENGINE to build against, with the lab targets to check them by.

### Track nuisance near homes (PC)
- It works like today's nuisance: a one-off PC cost when track is laid, per resident within the shared bands (within 2 tiles ×1, within 4 ×0.6, within 6 ×0.3).
- **Proposed PC per resident at weight 1, per tile of track:** ground **0.01**, elevated **0.015** (pillars and noise over the street), subway **0**. Stations, ramps and track on empty land: 0.
  - For scale: an industrial zone tile is 0.0667 and a power plant 0.267. So one tile of ground track is about a seventh of an industrial tile.
- Worked by hand:
  - A track tile one tile from a row of level-3 homes (20 residents each) weighs about 130 residents; with homes on both sides, about 300–400.
  - So 20 tiles of ground track through a neighbourhood cost about 25–80 PC. That's 0.1–0.35 of a PC bar at 10k residents (cap about 230).
- **Target rail.nuisance:**
  - 20 tiles of ground track past a full row of homes costs 0.1–0.4 of a bar on a 10k city;
  - the same line through empty land, or as subway, costs nothing;
  - elevated costs 1.3–1.7× ground.

### Growth near stations
- **Proposed:** homes and shops (not industry) within **4 tiles** (manhattan) of a station that has a road and riders grow **× 1.25** faster.
- Kept small on purpose: rail already gives a suburb its job access, which multiplies growth. The rail suite's suburb already grows 1.5–1.8× faster than the same suburb on a long street.
- **Target rail.stationGrowth:** homes beside a served station reach level 3 15–30% sooner than the same homes without the bonus. rail.suburb must still pass.
- This multiplies whatever growth model the owner picks for "homes level up too fast", so it should be tuned after that decision.

### Phase 2 placeholders: sanity check
At the shipped ground numbers (track 400 / 0.5 a tick; station 30,000 / 25):
| | Cost a tile | Upkeep a tile, a tick | 60-tile line | Days of a 10k city's surplus (6–8.5k a day) |
|---|---|---|---|---|
| Ground | 400 | 0.5 | 24,000 | 3–4 |
| Elevated 3× | 1,200 | proposed 1.5 (3×) | 72,000 | 8–12 |
| Subway 25× | 10,000 | proposed **2** (4×, not 25×) | 600,000 | 70–100 |

- **Elevated 3×: fine.** It buys no level crossings and passing over roads, for three times the price.
- **Subway 25× build cost: fine as "really, really expensive".** A 60-tile subway is about a third of an airport (2,000,000). It's a big-city project: at 10k residents it's 70–100 days of surplus.
- **Subway upkeep should not be 25×.** At 12.5 a tile a tick, 60 tiles cost 6,000 a day, which is a whole 10k city's surplus. Proposed 4× ground (2 a tile a tick): 60 tiles cost about 960 a day.
- **Other phase 2 starting numbers:**
  - subway station: 60,000, upkeep 40 (2× a train station: the hole is the cost);
  - ramps (ground↔elevated, ground↔subway): 5,000 and 15,000, upkeep 5 and 10.
- **Targets to add with phase 2:**
  - rail.subwayCost: a 60-tile subway line costs 60–120 days of a 10k city's surplus, and ≤ 30 days at 50k;
  - rail.elevatedCost: elevated costs 2.5–4× ground for the same line.
