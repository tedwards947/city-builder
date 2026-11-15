# TODO

One section per area, each a ranked list (1 = do first). Each session owns its own section: add, re-rank and tick off items there, and leave the other sections alone.

DESIGN is the owner's list: things that need a design decision before anyone builds them. Sessions add to it only when the owner asks, and move an item into their own section once it is decided.

## GRAPHICS

Items marked [paid] need new nanobanana images (billed to the owner; ask before generating).

### Next (ranked)

1. **Refine the clay trees** (in the game and "good enough to carry on", per the owner). To revisit: more broadleaf variety (beech is the only round-crowned tree; oak, birch, maple and willow were rejected twice, first too cartoonish, then too gnarly; the owner likes compact dense crowns with hidden trunks) [paid]; forests look a little planted because the tidy rows line up across tiles (the owner rejected random scatter and mirrored trees as sloppy, so add wobble carefully); larch is muted in `trees.mjs` (`MUTE`), retune if needed; frame cost of large forests and of zooming has not been measured; after the engine's zoom fix lands, key the per-tile trees on the chunk's own drawn size (`_chunkTs`). Review pages: `art/clay-set/trees.html`, `art/clay-set/forest.html`.

### Waiting on something else

- **Terrain in the clay style** (grass, sand, water, rounded shorelines): deferred by the owner.
- **Vibe versions of the new designs** [paid] (33 × 4 images): waiting on vibe tuning. The vibe mechanic barely shows up in a normal city yet, so the art would not be seen.
- **Landscaping polish**: on hold. Known issues: identical neighbours (6 variants per sprite), uniform all-tower districts, plazas over shops' painted parking bays, the slate duplex (`res-2-b`) almost never dressed, green-vibe lots too busy.
- **Night and liveness**: on hold. Window-glow masks for a night mode [paid], a small bounce when a building is placed or levels up.

### Deprioritised

- **Vibe versions of the civic buildings** [paid] (24–32 images).

### Decided

- **Problem indicators:** merged pins per district when zoomed out, a badge per building when zoomed in (option A on `art/clay-set/indicators.html`). Hovering a badge with the inspect tool explains it.
- **No power / no water:** a building without power goes dark (no look for no water: the owner found it too quiet), plus a bolt / drop pin per district when zoomed out and a bolt / drop badge on every affected lot when zoomed in (option D on `art/clay-set/utilities.html`, with badges added after the owner found the look alone did not explain itself). Empty zoned lots have no building to change, so they keep the old dark tint. The no-sewage / no-services tints are unchanged; ask the owner before reworking them.
- **Commute:** violet pins for long-commute and cut-off lots, and the inspected lot's trip drawn along the roads (K1 + K2 on the same page); the inspect pane lists each trip against the limit.
- **Roads and traffic:** code-drawn clay roads with crosswalks and stop lines at junctions (J2) and per-tile clay cars for traffic (T1); the wandering cars are gone. Mock: `art/clay-set/roads.html`.
- **Building taste:** the owner loves brutalist and modernist designs (favourite: `com-3-f`); lean that way for future high-level buildings. Of the brutalist batch, `res-3-h`, `res-3-j`, `com-3-i`, `com-3-j` were kept; the ziggurat and the inverted pyramid were rejected.
- **Code-drawn fallback sprites and the Shift+S sandbox** are deleted. Before a clay image loads, the flat chunk-layer drawing shows.
- **Empty zoned lots** stay bare grass with the zone colour, at least for now.

## GAME ENGINE

Ranked by how much it changes play, then by cost. "Unmeasured" means a suspected cost nobody has timed yet: measure first, then decide.

1. **Traffic balance pass** (with the owner, by play-testing; use `?debug=true`). Known issues:
   - A jammed road hurts growth twice: the old congestion penalty (`congestionGrowthPenalty` 0.75) and, since roads slow down under load, longer commutes. In the owner's exported city, with only 6.8% of roads over capacity, homes average ×0.54 growth from the congestion penalty alone. Probably lower it to about 0.3.
   - A destination that stays over capacity (a small shop strip serving a whole suburb) has no effect beyond the debug inspector. Should it slow that zone, or its customers?
   - Industry placed away from homes can lose most of its growth to commute time when its one road in is jammed. Decide whether industry should use a gentler rule.
   - Trip rates, commute limit and road capacities were set on a small city. They look right on the owner's 6,664-person city; a city with few avenues and highways overloads badly.
2. **Traffic step 2: commute effects.** Growth already slows as travel time rises. Still to do: past a threshold a zone declines a level at a time (decline only for now, no abandonment from commute), and commute shown in the normal tile inspector. Check first whether zones can lose a level today outside abandonment and fire.
3. **Shops need industry (supply matters).** Goods already flow (each shop fetches from the nearest industry with output to spare) but nothing depends on it: commerce accessibility only counts customers. Add a `supplyWeight` to `BALANCE.transit`, default 0, and blend it into commerce accessibility in `TransitSystem` (the goods market's map already gives each shop its travel time to a supplier: `travelTime(data.goods.field, road)`); put the weight on the debug tuning panel. At 0 nothing changes; raising it makes shops with no industry in reach grow slower. This is a balance change (it alters the opening and pulls industry toward the centre), so tune it in a real city before making it the default. Possible follow-ups: unmet goods demand (`goods.field.demandRatio` > 1) slowing commerce; industry needing shops to sell to.
4. **Zoom smoothness.** _Fixed the stutter:_ sprites and map chunks are no longer re-baked on every wheel step; they are drawn stretched while the zoom moves and sharpened a few per frame once it stops (on the owner's city in headless Chrome a zoom-step frame went from about 90 ms to about 12 ms). The zoom step is also scaled by how far the wheel event scrolled (one mouse notch is still 10%), so a trackpad no longer zooms uncontrollably fast.
5. **Show traffic on the roads** (on hold, with GRAPHICS). The owner is dropping the wandering cosmetic cars and choosing a per-tile way to show traffic from the graphics session's mock page. The engine side already has what that needs per road tile in `world.traffic`: total volume (`trafficVolume`), capacity (`roadCapacity`), each market's own volume (`shopping`, `jobs`, `goods`, so trucks can show where goods traffic is), and the direction of travel toward each market's destinations (`field.parent`). Add anything missing once the look is picked.
6. **First tick after a load.** About 60–80 ms on the owner's 512×512 city: land value does one whole-map pass and traffic its first 24 iterations. Spread them over a few ticks or do them before the first frame.
7. **Per-frame tile loop** (unmeasured). The renderer allocates a vibe object per visible tile per frame.

Standing rules (see AGENT.md): systems never loop over the whole map (`world.index`, `FieldBounds`); when `_renderChunk` reads a new layer, `_chunkSignature` must read it too; anything that feeds back into traffic routing gets a stability check.

Done and merged:
- Flow-based traffic with markets (shopping, jobs, goods), capacity with local overflow, congestion slowing roads, routes split over near-equal ways; settles within two passes after an edit (#29, #30).
- Traffic overlay with load past 100%, commute tint and route trace; `?debug=true` inspector numbers and live tuning panel (#29).
- Save files: export / import a city as `.citysave.json` (#30).
- Sim tick on a 512×512 map: about 95 ms → 3 ms in Node, 31 ms → 1.6 ms in Chrome, results identical (#31).
- Cleanup: old traffic overlay code removed from the renderer, traffic uses the shared index, service coverage is recomputed only when roads or buildings change, no second autosave on returning to the tab.

## DESIGN

Raised by the owner. Lettered, not ranked.

a. **Make "vibe" mean something.** Right now it does very little.
   - What exists: three per-tile layers (egalitarian, green, planned) that player actions nudge (zoning, roads, parks, service buildings, displacing people), which then spread to neighbours and decay back to neutral. They are averaged into a city-wide "character".
   - What it affects: only looks — the colour palette, which sprite variant a lot gets, and the vibe overlay. Nothing in the simulation reads it: not growth, land value, demand, crime, traffic or political capital.
   - It also fades to nothing. In the owner's exported city (population 6,664, tick 20,726) all three layers are exactly neutral on every tile, and the city-wide character is 0 / 0 / 0. Nudges only happen at the moment of an action and decay wins.
   - To decide: what vibe is for (identity and looks only, or a gameplay lever), what keeps it alive in a standing city (ongoing sources such as zones, parks and industry, not just one-off nudges), what it should change in the sim, and how the player sees and steers it.
   - Owners once decided: the sim side is GAME ENGINE (`VibeSystem`), the look is GRAPHICS (vibe sprite variants are already on that list).

b. **Give political capital more to do.** It has a real job, but a thin one.
   - What exists: a 0–100 pool. It refills every tick, 0.1 when citizens are miserable up to 0.4 when they are fully satisfied. Satisfaction is four things: service coverage of homes (40%), power coverage (20%), water coverage (20%) and low crime (20%).
   - What it is spent on: displacing people. Bulldozing or re-zoning occupied homes costs 3.5 per resident (a full level-3 lot is 70 of the 100), and the action is refused if the pool is short. Clearing abandoned buildings pays a little back.
   - Why it feels thin: that is the only thing it gates, so a player who is not demolishing never thinks about it. In the owner's exported city (population 6,664) the pool is full at 100 and satisfaction is 0.99. A happy city refills an empty pool in about four minutes at 1×.
   - To decide: what else should cost it (raising taxes, building next to homes — industry, highways, a power plant — rezoning, cutting services, running a deficit?), what else should feed satisfaction (commute, pollution, jobs, land value, shortages, taxes, fires), whether a low pool should have consequences beyond refusing an action, and whether it stays one city-wide pool or becomes per district.
   - Ties to (a): vibe could be what citizens want (a green district objects to industry more), with political capital as the price of going against it.
