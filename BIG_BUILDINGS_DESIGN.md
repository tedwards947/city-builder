# Big buildings: plan

*Status: plan agreed with the owner (2026-11-17), from the engine and graphics scoping notes. Phase 1 (no behaviour change) is starting.*

## Why
The game assumes one building per tile. Airports, seaports, military bases and landmarks need buildings that span several tiles. First step: **large power plant, large water plant, large sewage plant**, which make a good first case because they're plain and have no services logic.

## Ground rules (so balancing isn't disturbed)
- **Phase 1 changes no behaviour.** The multi-tile foundation lands with every existing kind still 1×1 and the golden baseline untouched.
- **The new kinds are debug-only** (`?debug=true`) until they're balanced. Their numbers are placeholders kept **outside** the PC and economy keys the balance lab tunes. The lab's personas and the city generator never place them.
- **They go public only after** ENGINEER 3 adds lab targets for them and the owner has played them.

## Data model (engine)
**Owner's idea (2026-11-17): every tile records which building it's part of, so buildings don't have to be square.** Adopted as follows:
- **Shapes, not rectangles:** each kind has a **shape**, a list of tile offsets from its anchor, e.g. `[[0,0],[1,0],[0,1]]` for an L. A square 3×3 is just nine offsets. Default: one tile. New kinds **9, 10, 11** (large power, water, sewage) start as plain squares. Later, L-shaped plants, runways and docks are just other shapes.
- **Per-tile building id:** a new `buildingId` array (Uint32) gives each tile the building it belongs to: **the anchor tile's index + 1** (0 = none). That id is the same after save/load, undo/redo and in identical cities, two buildings can never share one, and nothing needs saving. `world.buildingAt(tx, ty)` reads the id; the kind is already on the tile. A small anchor → entity map sits beside the list. **It lives on `world`, not in `world.layers`**, because `world.layers` is what the save and the golden baseline walk. One `rebuildBuildingIds()` runs after load, with incremental updates in place/clear/undo, and a test asserts incremental equals a full rebuild after random place/bulldoze/undo sequences.
- **Optional part role:** each offset can carry a role (`body`, `dock`, `runway`, `entrance`…). No extra layer: `buildingPartAt(tx, ty)` works it out from the id and the kind's shape (a layer only if a hot loop ever needs one). Rules can use it later: a seaport's dock tiles must touch water; a runway must be road-free and straight; only entrance tiles count for road access. The first three plants use `body` only.
- **One entity per building** in `world.buildings`, at its anchor. **Every shape includes offset (0,0), and that tile is the anchor**, because in an L the bounding box's top-left corner may be empty. Engine and graphics use the same definition.
- **Every shape tile also carries the kind** in `layers.building`, so anything asking "is there a building here?" keeps working (roads, zoning, fire spread, WorldIndex, renderer occupancy).
- **No rotation yet.** The entity has room for a `rot` field later; rotating a shape just rotates its offsets.
- The shape table, anchor and both derived layers live in `src/sim`, and graphics imports them, so engine and renderer can't disagree.
- **Rendering of non-square shapes:** a building's sprite covers the shape's bounding box, with transparent cut-outs where the shape has no tile. It draws at the bounding box's bottom row. Square shapes need nothing extra.

## Rules
- **Placing:** every shape tile in bounds, not water, no building, **no road** (a big building silently cutting a road network is worse than refusing). Zoned lots under it are displaced at the normal PC cost.
- **Connected:** any tile next to the shape's outline is a street or avenue (not a highway), or, once roles exist, next to an `entrance` tile. For 1×1 this is exactly today's rule.
- **Bulldozing** any tile removes the whole building, once, at its full cost. **Undo** restores the whole building as one entity.
- **Pollution:** from the building, once per kind, not 9× for a 3×3.
- **PC nearby-homes cost:** distance from the nearest footprint tile.
- **Fire:** footprint tiles burn separately, as small buildings do today (cosmetic). Revisit for landmarks.

## What a large utility is (placeholder numbers)
A **3×3 plant ≈ the output of 12 small ones, on the land of 9, for about 8× the cost and upkeep**: fewer clicks and a modest saving for committing to one site. One big plant is also a single point of failure for connection, which is fine and even interesting. The footprint, output, cost and upkeep multipliers are placeholders in `balance.ts` for ENGINEER 3 to tune.

## Rendering and UI (graphics)
- **One contract:** for any tile, anchor, footprint, kind, "am I the anchor", plus per-building state (power, fire, road access) read at the anchor.
- **Sprites** are drawn live on top of the cached map chunks, so they cross chunk edges for free. A big sprite draws when the loop reaches its **bottom row** (so it doesn't overpaint neighbours below), and the visible area is **padded** by the largest footprint so it doesn't vanish at the edge. Game sprites are 256px for 2×2 and 384px for 3×3.
- The flat stand-in (before images load, far zoomed out) draws per tile as a slice of one shape.
- **One problem badge per building**, centred; district pins count buildings, not tiles.
- **Hover, inspect and bulldoze** outline the whole footprint from any of its tiles; the inspect pane shows the building once.
- **Placement preview:** a ghost of the footprint (sprite at ~55% once art exists, a tinted rectangle before); blocked tiles tinted red; white outline when clear; amber when no edge touches a road; price tag and nuisance rings measured from the footprint. The pointer sits at the centre for odd sizes and the top-left of the centre four for even sizes.
- **Toolbar:** new tiles appear only under `?debug=true` (the toolbar's `shown` hook already supports this).
- **Lot dressing:** none on big buildings at first.

## Art
- **Code-drawn stand-in first:** a clay-toned slab with the kind's icon plus tanks and stacks. Smoke and steam emitters work on it. Good enough for debug balancing.
- **Real clay art is [paid]:** one look per building (3 images), plus a reference image per new footprint size and 1–2 retries each. Realistic total **8–12 paid images**. Abandoned/gritty looks (+3) and vibe sets (+12) later, if ever.

## Phases
| # | Engine | Graphics | Visible? |
|---|---|---|---|
| 1 | Model and API: shape table (all one tile), derived `buildingId` (and `buildingPart`) layers, `buildingAt`, shape-aware place/clear/isBuildable, whole-building undo, bulldoze once per building, perimeter helper for utilities and service seeding. Tests use test-only 2×2 and L-shaped kinds. Golden unchanged. | Agree the contract. | No |
| 2 | Kinds 9–11 with placeholder numbers, output per kind, pollution rule. Debug-only. | Footprint-aware drawing with the stand-in: bottom-row draw order, culling pad, one badge, footprint outlines, debug-only toolbar tiles. | `?debug=true` only |
| 3 | PC nearby-homes cost and quotes over the footprint, inspect data. | Placement ghost with blocked tiles, price tag, rings from the footprint. | `?debug=true` only |
| 4 | — | **[paid]** reference images plus 3 buildings; cutout pipeline taught w×h plots. | `?debug=true` only |
| 5 | ENGINEER 3: lab targets for large utilities, then numbers. Owner plays. Switch on outside debug. | Lot dressing, abandoned looks, pin polish. | Public |

**Others:** ENGINEER 2 adds a save round-trip test with a big building, and (later, opt-in) generator support so big test cities can use them. ENGINEER 3 leaves the tuner alone and adds big-building targets in phase 5.

## Risks
- **Undo** is the likeliest source of bugs (orphan tiles, duplicate entities), so it gets the most tests.
- **Balance:** safe while kinds 1–8 are untouched and the lab and generator don't place the new kinds. `placeBuilding` draws one random number per building for its look; keeping exactly that for 1×1 keeps the baseline.
- **Old builds** can't read a save with a big building. The live site always runs the newest build, so this is low risk.
- **Art:** the image model has to keep the same camera on a wider plot, hence the reference images and retries.

## Later
Rotation, and non-square shapes in real buildings (airports, runways, docks), a shore rule for seaports, large services and landmarks (coverage from the perimeter is already in phase 1), fire and abandonment for whole landmarks.

## Art status (2026-11-17)
The owner picked, from `art/clay-set/bigplants.html` (front-facing round): **brutalist large power plant (P2), modern water pump (W3), brutalist large sewage plant (S2)**. They are in the game under `?debug=true`: `art/clay-set/cutout.mjs` cuts them from `raw-big/` to `public/sprites/clay/{power,pump,sewage}-large.png` (128px a tile) and grows a too-short ground slab backwards to the standard plot shape. Smoke and steam come from sprite emitters; the sewage skimmer arms and the pump's intake pipe are drawn by code (`drawBigArtExtras`). The placement ghost shows the sprite at 55%. The code-drawn stand-in remains for kinds without art and until images load. 18 paid images were used.

## Public (2026-11-17)
The owner switched the three plants on for normal play ahead of balancing ("it's just me playing"): the toolbar entries no longer need `?debug=true`. Their numbers are still placeholders, the lab has no targets for them, and nuisance for kinds 9 and 11 is still 0. This overrides the "debug-only until balanced" ground rule above.

## Owner decisions (2026-11-17)
1. **Footprints:** large power **3×3**, large water **2×2**, large sewage **2×2**.
2. **Placeholder value:** more output per dollar, about 12× output for about 8× cost and upkeep on a 3×3, scaled for 2×2. Tuned by the balance lab later.
3. **Roads under a footprint:** placement refused, not replaced.
4. **Art:** code-drawn stand-ins first; paid art once the plants feel right.
5. **Shapes:** every tile records which building it's part of, so buildings needn't be square (owner's idea).
