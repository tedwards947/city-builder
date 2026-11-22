# Flight brief, 2026-11-22

ENGINEER 3, for the owner and PM's design talks on the plane. Numbers from the Balance Lab on main at d3304d1 (after #531–#555). Money is per game day (8 ticks), as the economy panel shows it. PC is in points; "cap" is the city's PC cap.

## 1. Regression sweep after #531–#555

Full lab on d3304d1 (14 cities, all suites, 98 min), against the last full sweeps (04f1a41 before save v12, 9d34bb4 after).

| Change | Cities | Cause | Action |
|---|---|---|---|
| `connections.railIn` newly graded: 5 fail | gen-s1-t10000 (39 in), t15000, t20000, t25000, suburban-t25000 | #528/#530: a surface line is built where a city has none (was n/a) | Known. Track overload and jams, reported 2026-11-21 |
| `connections.tourists` new, information only | 7 shown, 7 n/a | #525 | – |
| Tree targets back to their pre-v12 values (tree home 16 → 13; testcity1 tree payback 35 → 130 days) | all | #510's fix to lab copies after save v12 | none: the 9d34bb4 numbers were the broken ones |
| `capstone.affordTwo` +12–25% left | 20–25k cities | #514's cheaper utility capstones | – |
| `econ.matureSurplus`, recommended preset, golden-1: 0.066 (fail) | golden-1 | #503 (ordinance money in expenses); unchanged since 2026-11-21 | Known |

- **Nothing new from #531–#555.** The elevated station, capstone Inspect, HUD, grey-out and lost fares moved no lab number. All 232 PC results are unchanged, and nothing failed that passed before apart from the known items above. No game bugs to route.
- The lab's PC suite now runs the shipped numbers only (#526), so the PC options of 2026-11-21 aren't re-swept.

## 2. PC: where it comes from and goes, and what Move would cost

The planner plays each city 60 days. PC a day by reason:

| City | Residents | Cap | Days at the cap | Regen | Ordinance upkeep | Requests failed | Services opened | Net a day |
|---|---|---|---|---|---|---|---|---|
| fullcity | 48.5k | 538 | 100% | +3.1 | −2.6 | −0.7 | +0.1 | ≈ 0 |
| newcity2 | 34.7k | 428 | 88% | +3.1 | −2.1 | −0.9 | +0.1 | ≈ +0.2 |
| golden-1 | 35.5k | 434 | 95% | +2.3 | −2.1 | −0.4 | +0.2 | ≈ 0 |
| gen-s1-t20000 | 19.9k | 309 | 85% | +1.5 | −0.6 | −0.9 | 0 | ≈ 0 |
| smallercity | 12.7k | 252 | 97% | +0.6 | −0.3 | −0.4 | +0.1 | ≈ 0 |

- Every flow is under 1% of the cap a day. PC sits full and almost nothing moves it. Regen is mostly wasted at the cap, and the three ordinances on the owner's cities take about what regen gives.
- **Move (TODO v), as proposed:** 25% of the build money, PC only for homes that lose coverage overall.

| Move | Money | PC, net rule | PC, if charged gross (every home it covered) |
|---|---|---|---|
| Police station, 2 tiles | $300 | 0–0.7 (≤ 0.2% of cap) | 7–10 (2–4%) |
| Hospital, 15–29 tiles, away from homes | $750 | 0–3.3 (≤ 1.1%) | 0–5 (≤ 2%) |
| Police HQ capstone, 6 tiles (fullcity) | $375,000 | 0 (it covers the whole city anywhere) | 269 (50%, the capstone cap) |
| Any building on fullcity | – | – | no free spot for most kinds: the map is full |

- Under the net rule a move costs almost no PC. Dense cities overlap coverage, and a capstone covers the whole city wherever it stands. So Move is a money spend, not a PC spend.

**Options**
- **A. Ship the net rule as proposed.** Move is a money cost ($300 to $375k), PC unchanged. Fine as a convenience; it doesn't make PC useful.
- **B. Flat PC fee per move**, for example 5% of the cap (13–27 PC). Every move is a small PC decision, and it can't be farmed.
- **C. A PC-led redesign:** PC as the currency for *changes* to a built city (moves, rezoning, demolition, ordinances), with regen cut to about 0.4–0.6 of today's so it is spent rather than banked. The 2026-11-21 study showed regen cuts alone change nothing while nothing spends PC; they need a spend like this.

## 3. Money sink for built-out cities without capstones

Built-out lab cities, a year on their own money (#518). fullcity, with all seven capstones and Free Transit, keeps 4% of income.

| City | Residents | Keeps a day | Share of income | Sink to keep 5% | Sink to keep 10% |
|---|---|---|---|---|---|
| gen-s1-t10000 | 11.0k | $4.5k | 32% | $3.8k (27%) | $3.1k (22%) |
| smallercity | 13.4k | $5.2k | 26% | $4.2k (21%) | $3.2k (16%) |
| gen-s1-t15000 | 16.3k | $5.9k | 30% | $5.0k (25%) | $4.0k (20%) |
| gen-s1-t20000 | 21.4k | $6.8k | 29% | $5.6k (24%) | $4.4k (19%) |
| gen-s1-t25000 | 29.5k | $12.1k | 34% | $10.3k (29%) | $8.5k (24%) |
| gen-s1-t30000 | 33.0k | $13.0k | 33% | $11.0k (28%) | $9.1k (23%) |
| gen-s1-t40000 | 45.8k | $11.7k | 24% | $9.3k (19%) | $6.9k (14%) |
| fullcity (capstones) | 48.5k | $4.3k | 4% | – | – |

- Without capstones a built-out city keeps 24–37% of income (the suburban cities too; one is 18%). Matching fullcity takes a sink of about a quarter of income: median 27% to keep 5%, 22% to keep 10%. That is about $0.25–0.35 a resident a day.
- fullcity shows the capstones and Free Transit are such a sink: about $15k a day over their replacements (17% of income).

**Options**
- **A. Capstones are the sink.** Nothing new. A city that skips them keeps a quarter of its income; a city that builds them keeps 4–10%. The player chooses.
- **B. Upkeep that grows once growth stops:** for example +1% of income a game month after the population has been flat for a month, up to +20%. It reaches a city without capstones and spares a growing one.
- **C. One-off projects worth $1.5–6M a year at 20–40k** (monuments, district upgrades, a city fair): a choice, not a tax. They need content (art, effects).

## 4. Elevated rail

`rail.pays` sets a suburb's taxes and fares against a 60-tile starter line's upkeep (two stations), target 0.8–2.0. New lab case `rail.paysElevated`: the same suburb against an elevated starter line (two elevated stations, 60 tiles of elevated track). Riders are as on the ground; an elevated line skips level crossings, so it may carry a few more.

| Line | Upkeep a tick | Build | rail.pays |
|---|---|---|---|
| Ground (stations 20, track 0.5) | 70 | $79,000 | 1.06–1.33 (pass, 5 cities) |
| Elevated as shipped (stations 40, track 1.5 = 3×) | 170 | $182,000 | 0.44–0.55 (fail on all 5) |
| Elevated track at 2× (1.0) | 140 | $158,000 | 0.53–0.67 (fail) |
| Elevated track at 1.5× (0.75) | 125 | $146,000 | 0.59–0.74 (fail) |

- Most of the elevated premium is the track: 60 tiles add 60 upkeep, the two stations 40.

**Options**
- **A. Keep 3×.** Elevated is a downtown tool for where land is dear or crossings jam, not a line to a suburb. It never pays for itself from one suburb.
- **B. Elevated track to 2×.** Still a premium, and the payback is half the ground line's.
- **C. Cheaper to run, dear to build:** keep 3× to build, but upkeep 1.5× (track 0.75). Payback 0.59–0.74: still under 0.8 from one suburb, but the closest of the three. What it saves on level crossings isn't measured yet.

## 5. Commuters (#529)

Lab cities: jobs outnumber workers city-wide in 12 of 14 (19–72% of job room empty), but 14–76% of job seekers end at a full nearest door. A highway point takes 70 in and 15 out a tick today, and one point already jams its avenue on 20k+ cities.

| Option | What crosses | Growth (industry demand) | Entry road | Work |
|---|---|---|---|---|
| **A. Traffic only** | Capped like residents out: 30–60 trips a tick each way per point | +0.01 to +0.03: nothing | +30–60 trips a tick: about one more jam's worth | Small: a door in the jobs market at each point |
| **B. Demand weighting** | The same 30 a point, each counted as about 8 workers in the growth formula | about +0.1 at 20k (what 250 uncapped commuters would give) | as A | Small: a weight in `LandValueSystem` |
| **C. Rail riders** | Commuters ride in by rail only, up to the rail point's room (200 a tick; visitors use 39–93 now) | +0.06 to +0.08 at 20k | none on roads; the track takes the load | Medium: commuters as rail-only trips, and room shared with visitors |

- Uncapped at 25%, commuters would be 4–1,081 trips a tick and would jam every entry. That is why A and B cap them.
- B makes commuting a real way to grow without local jobs (the Q2 worry), but it is an abstraction. C makes rail matter, which fits "rail carries a lot more than a highway".
