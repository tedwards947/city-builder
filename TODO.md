# TODO

One section per area, each a ranked list (1 = do first). Each session owns its own section: add, re-rank and tick off items there, and leave the other sections alone.

## GRAPHICS

Items marked [paid] need new nanobanana images (billed to the owner; ask before generating).

### Next (ranked)

1. **Clay trees.** Wild trees on unbuilt land are still flat shapes next to clay buildings. Needs a design conversation with the owner first (code-drawn clay blobs vs. the generated tree props already used for lot landscaping vs. new tree tiles [paid]; forests vs. single trees; how they meet roads and plots).

### Waiting on something else

- **Roads and terrain in the clay style**: waiting on the traffic redesign. Note from the engine session: traffic now concentrates on real routes, so street / avenue / highway should look clearly different; there is still no lane, direction or turn data, so intersections need no sim-driven art.
- **Vehicles in the clay style**: waiting on the traffic redesign. Vehicles will later follow flow maps and get a per-tile direction; hold direction-dependent art until the engine session says that has landed.
- **Vibe versions of the new designs** [paid] (33 × 4 images): waiting on vibe tuning. The vibe mechanic barely shows up in a normal city yet, so the art would not be seen.
- **Landscaping polish**: on hold. Known issues: identical neighbours (6 variants per sprite), uniform all-tower districts, plazas over shops' painted parking bays, the slate duplex (`res-2-b`) almost never dressed, green-vibe lots too busy.
- **Night and liveness**: on hold. Window-glow masks for a night mode [paid], a small bounce when a building is placed or levels up.

### Deprioritised

- **Vibe versions of the civic buildings** [paid] (24–32 images).

### Decided

- **Building taste:** the owner loves brutalist and modernist designs (favourite: `com-3-f`); lean that way for future high-level buildings. Of the brutalist batch, `res-3-h`, `res-3-j`, `com-3-i`, `com-3-j` were kept; the ziggurat and the inverted pyramid were rejected.
- **Code-drawn fallback sprites and the Shift+S sandbox** are deleted. Before a clay image loads, the flat chunk-layer drawing shows.
- **Empty zoned lots** stay bare grass with the zone colour, at least for now.

## GAME ENGINE

Ranked by how much it changes play, then by cost. "Unmeasured" means a suspected cost nobody has timed yet: measure first, then decide.

1. **Traffic step 1: flow-based traffic.** _Built (branch `worktree-engine`); needs play-testing and rate tuning (`BALANCE.transit.trips*`, `commuteMax`)._ Replace the "zones press on roads within 8 tiles" model in `TransitSystem` with travel-time maps per destination type (to commerce, to industry) and traffic sent downhill along them (homes → shops, homes → industry, industry → shops). Road speed counts, so avenues and highways finally matter. Same output layers (congestion, accessibility), so growth, land value, overlay and saves keep working. Rewrite the traffic tests around small hand-built maps; time it on a large city before and after.
   - _Built with it:_ traffic overlay rewrite (overload colours, commute tint, route trace on hover), and behind `?debug=true` traffic numbers in the tile inspector and a live tuning panel.
   - Follow-up: remove the now-unused traffic overlay code and legend from `CanvasRenderer` once the graphics batch touching that file has merged.
2. **Traffic step 2: commute effects.** Growth slows as travel time to jobs / customers / workers rises; past a threshold the zone declines a level at a time (decline only for now, no abandonment from commute). Show commute in the tile inspector and the traffic overlay. Check first whether zones can lose a level today outside abandonment.
3. **Traffic step 3: destination capacity and damping.** _Built (branch `engine-traffic-capacity`), as: traffic splits over near-equal routes, loaded roads slow down, and a full destination spills its overflow to others within 12 road tiles (no iterated prices — those never settled). Needs play-testing. Open questions: a jammed road now hurts growth twice, through the congestion penalty and through longer commutes — decide whether to keep both; a destination that stays over capacity has no effect yet beyond showing in the debug inspector — should it slow that zone, or its customers?_ Shops and jobs fill up, so one shop cannot absorb a city; congestion feeds back into travel time gradually so routes do not flip-flop between passes. Needs play-testing and tuning.
   - **Shops need industry (supply matters).** Goods already flow (each shop fetches from the nearest industry with output to spare) but nothing depends on it: commerce accessibility only counts customers. Add a `supplyWeight` to `BALANCE.transit`, default 0, and blend it into commerce accessibility in `TransitSystem` (the goods market's map already gives each shop its travel time to a supplier: `travelTime(data.goods.field, road)`); put the weight on the debug tuning panel. At 0 nothing changes; raising it makes shops with no industry in reach grow slower. This is a balance change (it alters the opening and pulls industry toward the centre), so tune it in a real city before making it the default. Possible follow-ups: unmet goods demand (`goods.field.demandRatio` > 1) slowing commerce; industry needing shops to sell to.
4. **Zoom hitch.** Every zoom change over 1% redraws every visible chunk (measured 20 ms at 1.5× up to 96 ms at 0.2× per redraw in headless Chrome), so a continuous zoom redraws repeatedly. Scale the cached chunks while zooming and redraw once it settles, or spread redraws over frames.
5. **Cars follow the traffic.** Point the cosmetic vehicles at the step-1 travel-time maps so they drive from homes toward shops and industry instead of wandering.
6. **Sim tick cost on a big map.** _Done (branch `engine-tick-perf`)._ On the owner's exported city (512×512 map, built area 100×50, population 6,664) the full sim tick went from about 95 ms to about 3.4 ms, with every layer, stat and event identical to the old systems over 1,200 ticks. How: `WorldIndex` (road / zone lists and the built-up area, one scan per tick) and `FieldBounds` (where pollution and vibes are live); see AGENT.md. What is left, avg ms per tick on that city: Service 0.9 (a road walk with Sets per service building every tick — cache it until roads or buildings change), Transit 0.65, LandValue 0.5, Vibe 0.3, Pollution 0.2, everything else under 0.15. Worst single tick is still about 80 ms: the first land-value and traffic passes after a load.
7. **Per-frame tile loop** (unmeasured). The renderer allocates a vibe object per visible tile per frame and the fallback sprite lookup builds a string key per call.
8. **Redundant autosave on tab return.** The game saves when the tab is hidden and then again on the first frame back.
9. **Keep `_chunkSignature` in step with the chunk layer.** Standing rule rather than a task: when graphics work changes what `_renderChunk` draws (graphics items 1 and 2 will), the signature in `CanvasRenderer` must read the same layers, or chunks stop updating.
