# 2×2 Lots: Design

*Status: owner decided the core rules on 2026-11-19 (TODO DESIGN h) and approved the engine's model and phase plan the same day. Phase 1 (the model) is built; see "The model" below. Rules marked "PM default" were not asked of the owner and can be changed.*

## Why
Towers belong on big lots, not squeezed onto one tile (owner, 2026-11-19). A very happy, valuable block of four top-level lots can merge into one 2×2 building. It's a reward to aim for, and it gives downtowns a skyline.

## Owner decisions
| # | Question | Decision |
|---|---|---|
| 1 | Trigger | **Happy + land value.** A 2×2 square of **level-3 lots of the same zone**, all **very happy** and on **high land value**, for a while. Then there's a small daily chance it merges. Towers cluster downtown and by parks or water, not in a happy suburb at the edge. |
| 2 | Zones | **All three.** Homes: residential towers or a courtyard block. Shops: office towers or a low mall. Industry: a big factory or warehouse (low). |
| 3 | Decline | **It declines as one.** It stays 2×2, but it loses residents or jobs and can be abandoned as a whole, like any building. |
| 4 | Capacity | **About 1.5×** the four lots it replaces (residents, jobs, taxes, and the traffic that comes with them). The balance lab tunes the exact number. |
| 5 | Scale (docs/SCALE.md) | 1 tile = 17 m. Towers only on 2×2, **true height, 20 floors at most**, with heights varying below that. Some 2×2s stay low (malls, factories). A level 3 on 1×1 is a 4-floor mid-rise. |

## Rules (PM defaults)
- **Shape:** an aligned 2×2 square, with no L shapes or larger blocks for now. All four tiles must be level 3, the same zone, not abandoned, and not part of another merged lot.
- **Road access:** no new rule. The four lots already have a road each (they reached level 3), and each tile of the merged lot keeps using its own.
- **The streak:** each of the four lots must be happy and on valuable land for about **10 days in a row** (`BALANCE.lots.streakDays`); a bad day for a lot starts its count again. Once all four have that, the block rolls a daily merge chance (`chancePerDay`). Numbers are placeholders for ENGINEER 3, and **the chance ships at 0 (no merges) until the owner approves them**.
- **Merging displaces nobody.** The residents and jobs of the four lots move in, then it fills up to the new capacity through normal growth. **No PC cost**, because nobody chose to do it.
- **Bulldozing, rezoning, paving or building over any tile of it** brings the whole building down. The other tiles are left as empty lots, still zoned. The per-resident displacement PC applies to everyone in it, counted once, and one undo puts the whole building back. Clearing an abandoned one earns the blight reward for all four tiles.
- **Services, crime and fire** work per tile, as for any lot, with each tile counting 1.5× a level 3. **It declines as one:** abandonment judges the whole building once, on the worst of its four tiles (a street or avenue beside any tile counts as its road); all four tiles carry the same distress, recover together and are abandoned together. It rolls for fire once (not once a tile), and when it catches, or a fire spreads onto any tile, the whole building burns. A fire that guts it (burns out on a tile with no fire station in reach) leaves four empty zoned lots. A highway cuts it off only when it takes the last street beside any of its tiles, and then all of it. It never drops a level.
- **Rarity:** at most `BALANCE.lots.maxPerDay` merges a game day across the city (1 for now), picked at random from the blocks that won their roll. The sim has no districts, so the cap is city-wide. ENGINEER 3 to tune.
- **Undo:** a merge is a simulation event, not a player action, so there's nothing to undo.

## The model (engine, approved 2026-11-19)
A merged lot is **four zone tiles, not a building kind** (`src/sim/lots.ts`). Every system that counts residents, jobs, taxes and trips reads the zone and level of each tile, so they all keep working.
- Each of its tiles is at **`devLevel` 4**, one above what a lot grows to (`BALANCE.growth.maxLevel` stays 3).
- **`world.layers.lot`** gives each tile its quarter: 1 NW (the anchor), 2 NE, 3 SW, 4 SE; 0 is an ordinary lot. `world.lotAnchor(i)` gives the anchor's tile index, or −1. `world.lotTilesAt(i)` gives the four tiles.
- **Capacity** comes from two tables in `BALANCE.growth`: `popPerLevel[4]` (30 residents a tile, 1.5 × level 3) and `levelWeight` (4.5 for level 4, used wherever a system multiplies by the level: taxes, trips, utility demand, crime, fire risk, pollution, the demand tally). ENGINEER 3 tunes both; keep them in step.
- **One building:** `World.razeLot` brings all four tiles down, and everything that changes one of its tiles calls it first. Commands snapshot all four tiles for undo.
- **Art contract:** draw once at the anchor over the 2×2 and skip the other three tiles. `layers.visualVariant[anchor]` picks the look (tall or low). `lotSummary(world, i)` gives the combined numbers for Inspect. The event `lotMerged { tx, ty, zone }` fires at a merge.
- **The trigger** (`systems/LotMergeSystem.ts`, once a game day): a lot counts as happy and valuable on a day when it is at level 3, not abandoned, has no distress, stands on land worth at least `BALANCE.lots.minLandValue` for its zone (industry's is lower: land beside industry is cheap by rule), and the city's satisfaction is at least `minSatisfaction`. Each such day adds one to the lot's streak (`world.lotStreak`, saved); any other day sets it to 0. Nothing merges in the tutorial city. A merge shows a toast, and Inspect shows a lot's streak while merging is on.
- **Save:** version 11. The `lot` layer is new and optional, so every older save loads unchanged; the number went up only so that an older build refuses a newer save instead of misreading level 4. On load, a damaged lot layer is put right (`cleanLots`).
- **Debug:** with `?debug=true`, the **Merge 2×2** button merges the zoned block nearest the middle of the view, whatever its level (`__city.mergeLot(tx, ty)` for scripts).

**Phases.** 1: the model, save, group rules for bulldoze / rezone / road / building / undo / displacement, Inspect, the debug button, a placeholder slab (done). 2: abandonment, recovery, fire and highway cut-off by group (done). 3: the trigger (streak, thresholds, daily chance, cap), shipped at chance 0 until the owner approves numbers (done; the debug button **Merging: off/on** tries it at a 25% daily chance). 4: an audit of every level reader, and lab hooks for ENGINEER 3.

## Seeing past tall buildings (owner: "maybe when you hover over them they disappear?")
- **Desktop:** towers within about 2 tiles of the cursor fade to about 30%, but only while a build tool is selected (View and Inspect keep them solid).
- **Phone:** towers fade while you're dragging with a build tool, plus a **"Low buildings"** toggle under Views that draws every 2×2 at its footprint only.
- Graphics' call on the details. The owner reviews on 5174.

## Who does what
- **Engine:** the merged-lot model (below), the streak and trigger, capacity, decline and abandonment, and bulldoze, rezone and displacement. Placeholder art at first.
- **Graphics:** the 2×2 art per zone, with variety (tall and low), within SCALE.md. Paid images need the owner's OK, as usual. Also hover-to-hide and the "Low buildings" toggle.
- **ENGINEER 3:** thresholds, streak, chance, cap and the 1.5× capacity. Lab targets such as "a mature downtown gets its first 2×2 by day N", "suburbs at the edge get none" and "towers add traffic". Golden stays unchanged until the owner approves numbers.
- **PM:** this doc, and relaying the owner's picks.

## Open (for later)
1. Bigger merges: 3×3 landmarks? These would tie into the "city with memory" idea (heritage).
2. Should a 2×2 count toward requests or milestones (a "first tower" toast)?
