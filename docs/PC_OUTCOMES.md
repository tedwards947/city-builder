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
