# Homes level up too fast: options measured

*ENGINEER 3, 2026-11-19. A report for the owner's decision.* **Shipped (owner, 2026-11-19): option B for homes, with `exodusPerPoint` 7e-5 (`growth.homeProbabilityByLevel`). Shops stay as they are for now.**

**Today:** `growth.probability` 0.08, rolled every 4 ticks (2 rolls a day), the same at every level and for every zone. At full demand that's about 6 days a level, so level 3 in about 19 days.

## How it was measured
- Each option was run on a local experiment branch, not merged.
- **Fresh town:** a planner town on its own money for 360 days (one map, seed 7, so a single run with some noise). The times to level 3 are the median and spread over every tile that got there.
- **Saves:** the three saved cities, 180 days as they stand.
- **Lab:** PC preset T (pc suite, variant T) and the debt/tax suite, graded on the fresh map plus the three saves.

**Options:**
- **A:** probability 0.04 for everything.
- **B:** per level, homes only: 0→1 at 8%, 1→2 at 4%, 2→3 at 2%.
- **C:** homes stay at least 20 days at a level before the next.
- **D:** a home reaches level 3 only with land value ≥ 70 or a park within 4 tiles.
- **B+D.**
- **"B all":** option B applied to shops and industry too.

## Results (fresh planner town)
| Option | Days from level 1 to level 3, homes (p25 / median / p75) | Residents day 180 / 360 | Income a day, day 180 / 360 | Bank at day 360 | Homes at level 3 by day 360 |
|---|---|---|---|---|---|
| Today | 11.5 / **23** / 45 | 3,740 / 7,898 | 3,972 / 7,946 | 266k | 92% |
| A | 20 / **37** / 70 | 2,288 / 6,768 (−39% / −14%) | −30% / −17% | 184k | 82% |
| B | 23.5 / **44.5** / 89 | 3,000 / 7,222 (−20% / −9%) | −7% / −1% | 274k | 81% |
| C | 49.5 / **60** / 80 | 2,820 / 7,332 (−25% / −7%) | −16% / −11% | 227k | 86% |
| D | 11.5 / **24** / 46.5 | 3,328 / 7,526 (−11% / −5%) | −13% / −5% | 207k | 90% |
| B+D | 27.5 / **52** / 89.5 | 3,200 / 7,240 (−14% / −8%) | −9% / −7% | 238k | 77% |
| B all zones | 27 / 50.5 / 86 | 2,450 / 6,922 (−34% / −12%) | −25% / −8% | 198k | 80% |

**The saves barely change under any option** (residents ±1%, income ±1% over 180 days). Nearly every home on them is already at level 3, and none of the options take levels away.

## Lab: PC preset T and the tax targets
| Option | PC preset T (pass / 98) | Debt / tax suite (pass / 13) | What fails |
|---|---|---|---|
| Today | 96 | 13 | pc.earned.share (fresh), pc.ord.eminent (testcity1); both fail today |
| A | 96 | 12 | tax.noDominant (fresh: level 15 beats 10 on residents and income) |
| B | 94 | 11 | tax.high on both generated saves (9–11% fewer residents at tax 20, target 2–8%); pc.refill (fresh, 91 days); pc.ord.eminent (gen-suburban) |
| C | 96 | 12 | tax.noDominant (fresh) |
| D | 95 | 12 | tax.noDominant (fresh); pc.ribbon.first (fresh) |
| B+D | 96 | 10 | tax.high on all three saves (9–10% fewer residents at tax 20) |

- **Why B fails tax.high:** the tax exodus knocks homes down a level, and under B a home climbs back to level 3 at 2% instead of 8%, so high tax empties more homes.
- **Retune for B or B+D:** `tax.level.exodusPerPoint` 1e-4 → **7e-5**. Re-graded with it, the debt/tax suite passes all 13 under both B and B+D (5e-5 passes too).
- **PC preset T needs no retune** for any option. B's two extra PC misses are single-map edge cases (refill 91 days on the fresh map; eminent domain on one save). B+D doesn't show them.

## Shops and industry
- **Shops level about as fast as homes do today:** median 21.5 days from level 1 to level 3.
- **Industry is much slower already:** 60 days, held back by demand, and only 30% of industry reaches level 3 by day 360.
- Options B–D touch homes only, so shops keep today's pace. Under B, homes take 44.5 days to level 3 and shops 21; shops then run ahead of their customers, though commercial demand still holds them back.
- **"B all zones"** slows shops to 53.5 days and industry to 107 days. It costs a fresh town a third of its residents at day 180 and 25% of its income.
- **My read:** slow shops a little too, if homes slow, so they don't race ahead of homes. Leave industry alone; demand already paces it.

## Recommendation
- **B (the PM's pick), with `exodusPerPoint` 7e-5.**
  - It doubles the time to level 3 (23 → 44.5 days median).
  - It costs the least money: −7% income at day 180, −1% at day 360, and the bank at day 360 is unchanged. Low levels still fill quickly, so a new town still grows.
  - With the exodus retune, all tax targets pass, and PC preset T is at 94–96.
- **A is the blunt one:** it slows everything, including the first level, and costs a new town 30% of its income at day 180.
- **C** gives the most even pacing (no home reaches level 3 in under 40 days from level 1; median 60). But it's a new rule to explain, and it slows the early town more than B.
- **D alone does almost nothing** for a planner who builds parks. 90% of homes still reach level 3 in about 24 days, because most homes near a park qualify. It is a nice reason to build parks. Paired with B it slows things a little further (median 52 days) and cuts the share reaching level 3 to 77%.
- **If the owner wants D's flavour,** B+D with the same exodus retune passes all tax targets. Tune D's land value bar once it's in (today's level-3 homes have a median of 66–67 and a 75th percentile of 67–75 on the saves).
- **Shops:** consider 1→2 at 6% and 2→3 at 4% for shops, so they stay a step ahead of homes but not two. I haven't measured this.
