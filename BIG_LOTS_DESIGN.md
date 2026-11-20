# 2×2 Lots: Design

*Status: owner decided the core rules on 2026-11-19 (TODO DESIGN h). Engine review next. Rules marked "PM default" were not asked of the owner and can be changed.*

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
- **Shape:** an aligned 2×2 square, with no L shapes or larger blocks for now. All four tiles must be level 3, the same zone, and not part of another building.
- **Road access:** a street or avenue on any edge of the 2×2, the same as stations (`World.buildingAccessRoads`).
- **The streak:** each of the four lots must stay above the satisfaction and land-value thresholds for about **10 days in a row**. Once that holds, the daily merge chance applies. Numbers are placeholders for ENGINEER 3.
- **Merging displaces nobody.** The residents and jobs of the four lots move in, then it fills up to the new capacity through normal growth. **No PC cost**, because nobody chose to do it.
- **Bulldozing or rezoning any tile of it** affects the whole building, so the usual per-resident displacement PC applies to all of it. The preview shows the whole 2×2.
- **Services, crime and fire** treat it as one building with the combined numbers. A fire burns the whole building. Engine decides the details.
- **Rarity:** a cap, or a falling chance, so a district doesn't merge all at once. Something like "at most one merge per district per few days". ENGINEER 3 to tune.
- **Undo:** a merge is a simulation event, not a player action, so there's nothing to undo.

## Seeing past tall buildings (owner: "maybe when you hover over them they disappear?")
- **Desktop:** towers within about 2 tiles of the cursor fade to about 30%, but only while a build tool is selected (View and Inspect keep them solid).
- **Phone:** towers fade while you're dragging with a build tool, plus a **"Low buildings"** toggle under Views that draws every 2×2 at its footprint only.
- Graphics' call on the details. The owner reviews on 5174.

## Who does what
- **Engine:** the merged-lot model (a 2×2 zone building kind per zone, reusing `buildingShapes.ts`), the streak and trigger, capacity, decline and abandonment, and bulldoze, rezone and displacement. Save: follow AGENT.md's save rule (additive if possible, otherwise a version bump with an upgrade). Placeholder art at first.
- **Graphics:** the 2×2 art per zone, with variety (tall and low), within SCALE.md. Paid images need the owner's OK, as usual. Also hover-to-hide and the "Low buildings" toggle.
- **ENGINEER 3:** thresholds, streak, chance, cap and the 1.5× capacity. Lab targets such as "a mature downtown gets its first 2×2 by day N", "suburbs at the edge get none" and "towers add traffic". Golden stays unchanged until the owner approves numbers.
- **PM:** this doc, and relaying the owner's picks.

## Open (for later)
1. Bigger merges: 3×3 landmarks? These would tie into the "city with memory" idea (heritage).
2. Should a 2×2 count toward requests or milestones (a "first tower" toast)?
