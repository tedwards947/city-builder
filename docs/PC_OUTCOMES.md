# PC outcomes: do they move, and how often would a tier break?

ENGINEER 3, 2026-11-22, for the PC redesign (PC_DESIGN.md, "Redesign in progress": tiers whose conditions are outcomes). Lab only; no game change.

**Method.** Each request-grid cell (12 × 12 tiles) with at least 40 residents, sampled monthly while the planner plays on (it adds services as needed; on a saved city it builds no new blocks). The cities:
- six saved cities for a year: smallercity 12.7k, gen-s1-t20000 19.9k, gen-s1-t30000 31.0k, newcity2 34.7k, golden-1 35.5k, fullcity 48.5k;
- one growth run: a fresh 128 map from day 300 to 900 (6.3k → 15.2k, 12 → 29 cells).

Study code: `src/balance/pcOutcomes.ts`, `scripts/pc-outcomes.mjs`. "Drift" is how far a cell's value moves in a year (median cell). "Loses / gains" counts cells crossing a sample threshold between monthly samples, per cell-year.

## Spread and drift

| Outcome | Spread between cells (p10–p90, typical city) | Drift a year, built cities | Drift a year, growing city |
|---|---|---|---|
| Commute to a job (street tiles) | 2–9 on the owner's cities, 4–15 on the generated 256/512 ones | 0–0.2 | 0.7 |
| Street load, median tile | 0.1–0.5 on the owner's cities; 0.3–1.7 on generated | 0–0.05 | 0.36 |
| Street load, worst tile | 0.3–1.4 owner's; 0.9–5.8 generated | 0–0.16 | 0.41 |
| Nearest station's load | 0–1.1 (4 cities have stations) | 0 (fullcity, golden-1) to 0.21 (newcity2) | – (no station) |
| Land value ÷ city median | 0.8–1.2 | 0–0.03 | 0.02 |
| Pollution at homes (0–255) | 0 (p90 at most 3) | 0 | 0 |
| Crime at homes (0–255) | 4 (p90 4–9) | 0–0.07 | 0.05 |

- **Pollution and crime carry no signal.** Homes almost never carry pollution (growth keeps them away from it), and crime sits at about 4 of 255 in every cell of every city. As tier conditions they would be met everywhere, forever. They'd need a model change first (pollution and noise that reach homes; crime that varies).
- **Commute, street load, station load and land value differ a lot between cells, and barely move once a city is built.** fullcity moves 0.00 in a year; golden-1 moves less than 0.01.
- **During growth, street load and commute do move:** about 0.4 a year in load and 0.7 in commute. That's the city around a cell filling up.

## How often a tier would break (sample thresholds)

Losses and gains a year, as a share of cells. The first number in each cell is the change from the start of the run to its end; the second is losses and gains between monthly samples, per cell-year.

| Condition | Built city (fullcity / golden-1) | newcity2 | Growing city |
|---|---|---|---|
| Commute ≤ 10 | 0% · 0.01 / 0.01 | 0% · ~0 | 10% lose · 0.23 / 0.25 |
| Street load (median tile) ≤ 0.8 | 0% · 0.01 / 0.01 | 0% · ~0 | 20% lose · 0.33 / 0.08 |
| Worst street tile ≤ 1.5 | 0% · ~0 | 0% · ~0 | 7% lose · 0.23 / 0.03 |
| Station load ≤ 0.8 | 0% · 0.35 / 0.35 (fullcity), 0 (golden-1) | **37% lose** · 0.80 / 0.44 | – |
| Land value ≥ city median | 0% · ~0 | 0% · ~0 | 20% lose · 0.68 / 0.40 |

- **In a built city a tier almost never breaks on its own.** Over a year the start-to-end change is 0% on fullcity and golden-1. It takes a player's act (a road, a plant, a station closing) to break one, which fits trust ("you pay for what residents lose").
- **Near a threshold, cells flicker.** Losses and gains come in equal numbers month to month (fullcity's station: 0.35 each way), which is noise and not change. "Lost if broken for a while" is needed. A 2–3 month grace, or a hysteresis band of about ±0.05 on loads, would remove most of it.
- **Where the city is changing, outcomes break.** In the growth run 10–20% of cells a year lose a commute, load or land-value condition, and few regain it. On newcity2, station load ≤ 0.8 is lost by 37% of station cells in a year as riders grow. That's the "pressure from the city around them" the design wants.
- **Land value relative to the median is a zero-sum condition:** half the cells are below the median by definition, and its flicker rate is the highest of all (0.68 a cell-year in growth). As a condition it should be absolute, or a band.

## Options

- **A. Outcomes as drafted (commute, load, station, land value).** In a built city tiers stay put unless the player acts; during growth and around busy stations they break 10–37% a year. It needs a grace period against flicker. Pollution and crime are dropped until their models give a spread.
- **B. Mix in placement conditions** (a park or school within walking distance) as the stable half of each tier, with one outcome as the moving half (station load, street load). Tiers then break mostly where the city is under pressure.
- **C. Make the outcomes livelier first:** pollution and noise that reach homes, crime that varies by neighbourhood. Then re-measure. It costs model work before the PC prototype.

## Prototype slice 1: local trust per cell (2026-11-22)

Debug-only, off as shipped (`BALANCE.politicalCapital.localTrust.enabled`; `src/sim/localTrust.ts`). Each request-grid cell keeps its own trust beside the city's PC, which is unchanged:
- every part of a command's PC quote (displacement, nuisance, service closed and opened, blight cleared, big project) is also charged to the cell where those residents live;
- a cell holds its residents' share of the city's cap × `shareMult` (at least 10) and regenerates as fast;
- an action is refused when a cell can't cover its part.

Not yet included: the road cut-off charge (#563, still open); requests, milestones and ordinances stay city-wide. Measured with the planner, chaser and demolisher, 180 days, on a fresh map, smallercity, gen-s1-t20000 and fullcity, local trust off and at ×1, ×5 and ×20:

| Persona | PC refusals, off → on | Trust in cells at the end (p10 / p50 / p90 of cap) | City PC at the cap, off → on ×1 |
|---|---|---|---|
| Planner | 0 → 0 on every city | full (1 / 1 / 1; fresh 1 / 1.04 / 3.9) | unchanged |
| Chaser | 0 → 0 on every city | full | unchanged |
| Demolisher, saves | 322–371 → 341–381 (×1), 322–371 (×20) | full (1 / 1 / 1) | 19–22% → 88–96% |
| Demolisher, fresh | 420 → 403 (×1) | 0.26 / 0.62 / 1.08 | 0% → 0% |

- **Only the demolisher is ever refused,** with local trust on or off. The planner and chaser never disrupt enough to touch it.
- **At ×1 a cell is smaller than one act.** A cell holds 5–15 PC; displacing one home costs 40–80. The demolisher's first bulldoze in any cell is refused before anything is spent, so trust never spreads (cells end full) while the city's PC, no longer spent, sits at its cap.
- **At ×5–×20 the city's PC runs out first,** and local trust changes nothing (refusals within ±20).
- **So with pools on today's scale, local trust only moves the refusal from one gate to the other.** It doesn't yet box a disruptor into one area while the rest flows. That needs (a) no city pool, or a much larger one, so the city never binds; (b) cells sized to a few displacements (×5–10 of the share, or a flat per-cell amount); and (c) a disruptor that concentrates, since the demolisher bulldozes a random block anywhere. Rewards (ribbon cuttings) aren't capped at a cell's cap, as in the city, so fresh cells reach 4× their cap.
- **Next step, if wanted:** local only (the city gate off in the prototype), cells at ×5 with a floor of one displacement, and a "local demolisher" bot that works one area.

## Prototype slice 2: the city gate off, cells sized in displacements, an area bot (2026-11-22)

Still debug-only and off (`localTrust: { enabled, cityGate: false, displacements: 1–3 }`). Only the cells refuse; the city's PC is still charged, for comparison. A cell holds 1–3 displacements of its average home (50–500 PC; more on bigger cities) and refills in the same time as the city does.

The **area bot** (`src/balance/trustStudy.ts`) plays like the planner or chaser. From day 10 to day 120 it also bulldozes and rezones a block of homes every other day in the busiest cell, then stops. Each run is 240 days on a fresh map, smallercity, gen-s1-t20000 and fullcity:

| Result | 1 displacement | 2 | 3 |
|---|---|---|---|
| Area bot's bulldozes refused | 96–99% | 94–98% | 92–96% |
| First refused | day 10 (its first block) | day 10 | day 10–12 |
| Its cell's trust while it works | about 2% of cap | about 2–4% | about 2% |
| Days to refill once it stops | 15–62 (median about 45) | 30–60 (about 51) | 43–57 (about 50) |
| Planner and chaser refused elsewhere | 0 | 0 | 0 |
| Other cells at the end (p10 of cap) | full | 0.97–1 | 0.98–1 |

- **Boxed in locally while the rest flows: yes.** The bot gets about one displacement through per refill and is refused the rest. No normal play is refused anywhere: the planner and chaser are refused 0 times on every city, with or without the bot.
- **Recovery takes about 50 days whatever the size,** because a cell refills in proportion to its cap. The size sets how much a player can do in one go (1–3 homes), and the regen sets how often. That's two separate dials.
- **The citywide demolisher** (a random block anywhere) is refused less than under the city gate (31–65% against 87–95%), because every cell is its own pool and it spreads its damage. Cells end at p10 26–44% of cap. With the city gate off, the city's PC goes far below 0 (−1k to −23k). That's an artifact of keeping it for comparison; in the redesign the city pool goes.
- **Not covered yet:** what earns trust beyond regen (the identity's values, E1), requests and the road cut-off (#563), and the UI.
