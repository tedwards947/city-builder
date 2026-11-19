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
