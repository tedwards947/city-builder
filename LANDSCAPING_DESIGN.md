# Landscaping — Design

*Status: owner decisions in (2026-11-17). Engine and graphics to check feasibility and phase it.*

A landscaping tool for planting trees of a chosen species and for adding and removing water. Beaches follow the water automatically.

## What exists today
- `world.layers.terrain`: grass, water, sand. Sand is placed on land beside water when the map is generated.
- `world.layers.vegetation`: 0 = none, 1–6 = tree species, with clay art for each.
- `openWater`: a cached map of water that reaches the map edge (used by the seaport).
- **The bulldozer clears trees** (owner, 2026-11-17, #239; before that it left them).

## Owner decisions

### Trees
- **The brush:** pick a species, pick a brush size, paint. No separate eraser: the owner dropped it, and the bulldozer clears trees instead (#239).
- **Trees affect gameplay** (all three):
  - a small land-value boost nearby;
  - absorbing a little pollution (trees already speed up pollution decay today, `pollution.vegDecayMult`; the owner's decision is to leave that as it is for planted trees, and the lab tunes it in phase 4);
  - a nudge toward the green vibe.
- **The aim:** tree belts become a reason to buffer industry from homes. See TODO DESIGN f (industry crime).
- **Cost:** money per tree (number from the lab).

### Beaches
- **Automatic and looks only.** Sand sits on shore tiles with nothing built on them and updates whenever water changes. No gameplay effect for now.
- **Art:** uses the art as it is built today. The deferred clay terrain pass (rounded shorelines) is not part of this.

### Water
- **Add or remove water tile by tile.** Costs money only for now; a PC cost may come later from balancing (deferred).
- **Existing things:**
  - adding water over buildings or zones bulldozes them, with the normal displacement PC cost;
  - **roads block water**: you must bulldoze a road before you can flood its tile;
  - trees on a flooded tile are removed;
  - **docks and bridges block removing water** (owner): a water tile under a road or under any building (a seaport's docks) cannot be filled in until that is bulldozed, the same as roads block adding water. So a port can be cut off, but never left with docks on dry land.
- **Seaport:** if editing cuts its water off from the map edge, the port stops trading, **but upkeep continues**. Reconnecting it (e.g. digging a canal) restores trade.
- **Water pumps** must still touch water. A pump whose water is removed stops working.
- **Limits:** none beyond the above (PM default; the owner may add some). Editing at the map edge is allowed, since that's how a port can be cut off or reconnected.

## For the engine (suggestions)
- Commands with undo, as for zoning: `PlantTreesCommand`, `ClearTreesCommand`, `EditWaterCommand`.
- After a water edit:
  - recompute `openWater` and the sand around the edit;
  - refresh ship routes, the port's "cut off" state and the pump checks;
  - redraw the affected chunks.
- Tree effects:
  - extend the land-value and pollution systems;
  - green vibe through `VibeSystem`;
  - all numbers start at 0 for ENGINEER 3's lab, as for PC.
- Save format: terrain and vegetation are already saved. Check that nothing else needs adding.
- Keep the golden test unchanged while the numbers are 0.

## For graphics (suggestions)
- **A "Landscape" toolbar family** with a fly-out:
  - trees, with a species picker and brush sizes;
  - add water;
  - remove water.
- **Placement preview:**
  - the price;
  - red for blocked tiles (roads), with the message "bulldoze the road first";
  - a warning when a port would be cut off, or a pump left dry;
  - the PC cost when buildings would be flooded.
- **Mocks with a feedback form first,** like earlier rounds.

## Phasing
1. Tree brush, with the bulldozer clearing trees (done: #234, #239).
2. Beaches follow water (comes with phase 3).
3. Water editing with all its rules.
4. Tree effects, with numbers from the lab.

## Open questions
- Tree price, and how strong each effect is (lab).
- Water price per tile (lab). Possibly a PC cost later.

## Shipped numbers (landscape suite, owner 2026-11-19)
The owner approved the eight targets and the starting numbers below. The `landscape` lab suite (`src/balance/landscape.ts`) tuned them as follows:

| Number | Start | Shipped | Why it moved |
|---|---|---|---|
| `landValue.treeBonus` / `treeBonusMax` | 2 / 16 | **3 / 16** | Land value eases toward its target in whole steps and stops short, so a +2 gain mostly rounded away and one tree took 160–340 days to pay. At 3 it takes 97–130. |
| `costs.tree` / `treeClear` | 200 / 5 | **200 / 5** | |
| `costs.water` | 750 | **750** | |
| `character.nudges.green.treePlanted` / `treeCleared` | 0.1 / −0.1 | **0.05 / −0.05** | Every nudge moves its tile at least 1 step, and a park's 5 points are capped at 60 steps. At 0.1 (3 steps a tree), 50 trees were 2.5 parks; at 0.05 (1 step) they are 0.83. |
| `pollution.vegDecayMult` | 0.95 | **0.98** | At 0.95 a 3-tile belt cut the pollution behind it by 59%; at 0.98, by 26.5%. |

**Grades** (saved cities; testcity1 runs at a loss over 10 days, so the surplus-based checks are n/a there):

| Target | gen-s1 | gen-suburban | testcity1 |
|---|---|---|---|
| land.treeHome (+12–20) | +13 | +13 | +13 |
| land.treePayback (60–180 days) | 97 | 112 | 130 |
| land.treeShock (≤ 3%) | +0.3% | +0.6% | +0.8% |
| land.treeSpam (gain ≤ 10%; price ≥ 30 days) | 0.8%; **2.0 days** | 1.0%; **2.3 days** | 2.4%; n/a |
| vibe.treeGreen (0.75–1.25 parks) | 0.83 | 0.83 | 0.83 |
| water.canal (1–5 days) | 2.5 | 1.7 | n/a |
| water.reclaim (25–100%) | 42% | 29% | n/a |
| land.treeBuffer (15–35%, made-up map) | 26.5% | | |

**land.treeSpam's price check fails, and no tree price fixes it.** Mature cities have few free tiles near homes (60–345), so planting all of them costs about 2 days of surplus at 200 a tree. That is a 15× gap. A price that passes (about 3,000 a tree) would put one tree's payback at about 1,500 days and break land.treePayback. The spam gain is 1–2.4%, far under its 10% cap, so trees are no money printer either way. **For the owner:** drop the price half of land.treeSpam, or replace it with "carpeting pays back no faster than one well-placed tree".

## Proposed lab targets and numbers (ENGINEER 3, 2026-11-19; approved by the owner the same day)
The proposal as approved. The shipped numbers are in the section above.

**Measured first, on the three saves:**
- Wild trees within 2 tiles of a home are rare: 5% of homes on gen-s1, 16% on gen-suburban, 21% on testcity1. Where there are any, it's usually 1 or 2.
- So turning the tree bonus on is a small shock: city income +0.1–0.3% at `treeBonus` 1, +0.2–0.7% at 2, and +0.5–1.5% at 4.

### Targets
| Id | Metric | Target | Why |
|---|---|---|---|
| land.treeHome | Land value gained by a home with 8 trees within 2 tiles | +12–20 (about half the service bonus of 35) | A tree belt is worth having, but it isn't a service. |
| land.treePayback | Days for a tree planted between two rows of level-3 homes to repay its price in extra home tax | 60–180 | Trees beside homes pay off; trees in the wild never do (decoration). |
| land.treeShock | Change in a mature save's income when the bonus is switched on (wild trees count too) | ≤ 3% | No windfall for maps that happen to be wooded. |
| land.treeSpam | Carpeting every free tile within 2 of homes on a mature save: income gain, and the price in days of surplus | gain ≤ 10%; price ≥ 30 days | No money printer. |
| land.treeBuffer | Pollution at the nearest homes behind a 3-tile tree belt from industry, against bare land | 15–35% lower | The owner's aim: tree belts buffer industry from homes. Tunes `pollution.vegDecayMult` (now 0.95). |
| vibe.treeGreen | Green nudge from 50 trees planted in a neighbourhood, against one park (`parkBuilt` 5) | 0.75–1.25 parks; clearing them takes it back | Trees are a small, steady green push. |
| water.canal | A 20-tile canal: days of a 10k city's surplus | 1–5 days | Reconnecting a cut-off port is worth doing. |
| water.reclaim | Filling a 10×10 block of water: share of a 10k city's 30-day surplus | 25–100% | Reclaiming land is a project, not a whim. |

### Starting numbers to tune from
These are worked out by hand from the formulas; the suite would confirm them.
- **`landValue.treeBonus` 2**, `treeRadius` 2, **`treeBonusMax` 16**: 8 trees max out at +16 land value, which is about +9% home tax at today's typical home land value of about 65.
- **`costs.tree` 200.** One tree between two rows of level-3 homes reaches about 12 of them. At +2 land value each (home tax × 0.75 × 2/128) that's about 2.2 a day, so it pays back in about 90 days; well-educated homes pay up to 1.5× that, so about 60. A belt of 30 trees costs 6,000: a day of a 10k city's surplus, or 30% of a new town's starting 20,000.
- **`costs.treeClear` 5**, the same as `bulldoze`. The bulldozer clears trees; clearing shouldn't be free, but shouldn't hurt either.
- **`character.nudges.green.treePlanted` 0.1, `treeCleared` −0.1**: 50 trees = one park.
- **`costs.water` 750 a tile** (a bridge is 30 a tile).
  - A 20-tile canal costs 15,000, which is 1.8–2.5 days of a 10k city's surplus (6–8.5k a day).
  - A 10×10 fill costs 75,000, which is 29–42% of its 30-day surplus.
- **`pollution.vegDecayMult`**: leave at 0.95 until land.treeBuffer is measured.

Water stays money-only (no PC), as decided. A PC cost can come later if play shows players flooding neighbourhoods casually.
