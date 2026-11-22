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
| Train station, straight | 3×1, all platform (the station house is drawn beside the track and takes no tile) | 4 (the rotation picks the side the house is drawn on) |
| Train station, curved (L) | 2×2: three platform tiles round the corner, the house on the fourth | 4 |
| Elevated station (owner, 2026-11-21; #541, #543) | 1×1 ground entrance with a 3-tile platform overhead beside it (like the subway station, but up). The platform crosses land, water, any road or ground track, never buildings or zones; the road under it keeps working. Door on a street or avenue under or beside it. 55,000 / upkeep 40 (2× ground, ENG3 to check); PC as elevated track | 4 |
| Subway station | 1×1 entrance on the surface; 3-tile platform underground (the same length as the straight station's platform) | underground platform at 0° or 90° |
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
- **Station doors:** any street or avenue beside any tile of a station connects it (no single door tile).
- **No track beside a platform:** track of a platform's own level cannot run alongside it (side-on), and a station cannot be placed where it would. Track joins a platform only at its ends.
- **No walking:** both ends of a rail trip need a road; a station without one warns.
- **Level crossings** are allowed on streets and avenues; the slowdown grows with the other side's traffic. Since 2026-11-19 (owner, rail.crossing): cars wait `carDelay` 8 × rail load × road load street tiles (each load up to 1), trains `trainDelay` 2 × road load; the overlay shows the crossing's road at (1 − ½ × rail load) of its capacity (looks only).
- **Later than phase 1:** PC nuisance for track and the station growth bonus.
- **Phase 1 = four engine PRs:** track layer and tool → stations → rail traffic → tests and lab hooks. Numbers live in `BALANCE.rail`.

## Phase 2 numbers (ENGINEER 3, 2026-11-19)
**Shipped (owner-approved 2026-11-19):** elevated track 1,200 a tile (3× ground), subway 10,000 a tile (25×), subway upkeep 2 a tile a tick (4×). New lab targets:
- **rail.subwayCost:** 60 tiles of subway cost 60–120 days of a 10–25k city's surplus, and ≤ 30 days at 40k or more. Today: 105 days on gen-s1, 70 on gen-suburban. testcity1 is n/a (it runs at a loss), and there is no 40k save yet.
- **rail.elevatedCost:** elevated costs 2.5–4× ground. Today: 3×.

**Also owner-approved 2026-11-19** (today's placeholders, shipped as they are):
| Number | Proposed | Why |
|---|---|---|
| Elevated upkeep | **1.5 a tile a tick** (3× ground) | Same multiple as its build cost. A 60-tile elevated line costs about 720 a day to keep, under a subway's 960. |
| Subway station | **60,000, upkeep 40** | 2× a train station: the hole is the cost. |
| Ramps | **elevated 5,000 / upkeep 5; subway 15,000 / upkeep 10** | One ramp is about 4 tiles of elevated track, or 1.5 tiles of subway. A line has two, so ramps are small next to the track. |
| `rail.rampTime` | **1** (street tiles a ramp adds) | A pair of ramps then costs about what one level crossing does on a busy road (`crossing.trainDelay` 2; cars wait up to `carDelay` 8), which elevated track never has. Going up pays off in time once the line skips more than one busy crossing. |

## Proposed numbers for the later rail pieces (ENGINEER 3, 2026-11-19; approved by the owner the same day)
The proposal as approved. ENGINE builds track nuisance and station growth in phase 2; the phase 2 prices are in the section above. These are starting numbers for ENGINE to build against, with the lab targets to check them by.

### Track nuisance near homes (PC)
- It works like today's nuisance: a one-off PC cost when track is laid, per resident within the shared bands (within 2 tiles ×1, within 4 ×0.6, within 6 ×0.3).
- **Proposed PC per resident at weight 1, per tile of track:** ground **0.01**, elevated **0.015** (pillars and noise over the street), subway **0**. Stations, ramps and track on empty land: 0.
  - For scale: an industrial zone tile is 0.0667 and a power plant 0.267. So one tile of ground track is about a seventh of an industrial tile.
- Worked by hand:
  - A track tile one tile from a row of level-3 homes (20 residents each) weighs about 130 residents; with homes on both sides, about 300–400.
  - So 20 tiles of ground track through a neighbourhood cost about 25–80 PC. That's 0.1–0.35 of a PC bar at 10k residents (cap about 230).
- **Target rail.nuisance** (owner-approved 2026-11-19, graded by the rail suite: 0.05–0.4 bars on the free 20-tile run with the most homes within 2 tiles, where it touches 40+ homes; elevated 1.3–1.7×; subway and empty land 0). As first proposed:
  - 20 tiles of ground track past a full row of homes costs 0.1–0.4 of a bar on a 10k city;
  - the same line through empty land, or as subway, costs nothing;
  - elevated costs 1.3–1.7× ground.

### Growth near stations
- **Proposed:** homes and shops (not industry) within **4 tiles** (manhattan) of a station that has a road and riders grow **× 1.25** faster. **Shipped × 1.4** (owner, 2026-11-19, after the station resize): × 1.25 made homes only about 15% sooner to level 3.
- Kept small on purpose: rail already gives a suburb its job access, which multiplies growth. The rail suite's suburb already grows 1.5–1.8× faster than the same suburb on a long street.
- **Target rail.stationGrowth** (owner-approved 2026-11-19, graded by the rail suite: the suburb's homes within 4 tiles of its station, median days to level 3, bonus on against off, 15–30% sooner; rail.suburb still passes). The probe settles the suburb and its line for 30 days in the full sim, empties those homes, then runs the growth system alone for 360 days: with only 4 homes in reach, the full sim's noise (−69% to +73% between seeds) swamped a ×1.25. Reworked after the station resize (2026-11-19): it now watches every built home the bonus reaches, round both stations of the line (4–7 homes), leaves out homes that never reach level 3 in any run (held back by a service or education gate, not by the bonus), takes the mean over 100 seeds (20 seeds swung gen-s1 from 1% to 18%), and grades the mean, not the median. Results: testcity1 15%, gen-suburban 18%, gen-s1 9% (13% at 200 seeds), so gen-s1 fails, just under the band. A ×1.25 chance comes out at about 15% sooner, not 20%, because some waits (gates, the tax exodus) don't speed up. So the owner OK'd a higher multiplier and the lab picked **× 1.4**: testcity1 24%, gen-s1 17%, gen-suburban 26% (1.35: 19 / 14 / 25%, gen-s1 fails; 1.45: 26 / 20 / 27%, but rail.suburb access on gen-s1 dips to 29.8% against its 30% floor; 1.5: 29 / 23 / 29%). As first proposed: homes beside a served station reach level 3 15–30% sooner than the same homes without the bonus. rail.suburb must still pass.
- This multiplies whatever growth model the owner picks for "homes level up too fast", so it should be tuned after that decision.

### Level crossings (owner-approved 2026-11-19)
Measured on a bare map (a 96-tile road, homes at one end and jobs at the other, crossed mid-way by a line at a set load). The old single `crossing.delay` 2 made cars wait delay × rail load whatever the road's load: a full line added about 3% to a busy avenue's trips, and the crossing never showed as a jam because it costs time, not capacity. Raising that one number would also have slowed the trains crossing every busy road (delay × road load), and rail would lose to driving.
- Split: **carDelay 8**, **trainDelay 2** (trains unchanged).
- Car wait = carDelay × rail load × min(1, road load). Gates are down in proportion to the trains (linear in rail load, as in life); only a busy road queues behind them, which gives the contrast without a steeper power on rail load.
- The traffic overlay and the drawn cars show the crossing's road at (1 − ½ × rail load) of its capacity, so a player sees where a line hurts. The sim's congestion layer is untouched.
- **Target rail.crossing** (fresh map only, on its own bare map): a full line across a busy avenue (road load ≥ 1) makes the trips through it ≥ 10% longer, so an elevated hop pays off; a quarter-full line across a quiet street (road load ≤ 0.5) ≤ 1%. Shipped: busy +12% (road 1.51), quiet +0.9% (road 0.4). Fixes stay fun: an elevated hop, a subway, a second line (half the load, half the wait), or moving the road.
- **rail.suburb's access floor 30% → 25%** (owner, 2026-11-19): the suburb's job access had sat at 30% of the city's on gen-s1 since the station resize, and the longer car waits at its street crossings took it to 29.8%.

### Station prices after the resize (owner-approved 2026-11-19)
The stations shrank (#340: straight 3×1, curved 2×2). They sell fewer rides: the gen-s1 suburb's taxes and fares fell from 1.62× to 1.03× its starter line's upkeep, and its rider access from 95 to 72; testcity1 didn't move. Stations are now **27,500 / 20** (were 30,000 / 25). The starter line costs 79k, 2.03× a fresh Planner's bank at day 180 (rail.early ≥ 2; 27,500 is about the lowest that keeps it), 29% of the day-360 bank, and 9–15 days of a saved city's surplus. rail.pays 1.06–1.18. Cheaper options failed rail.early (25,000 / 20: 1.90; 20,000 / 15: 1.64).

### Phase 2 placeholders: sanity check
At the shipped ground numbers (track 400 / 0.5 a tick; station 30,000 / 25 then, 27,500 / 20 since the resize):
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
