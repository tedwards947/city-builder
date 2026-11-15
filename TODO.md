# TODO

One section per area, each a ranked list (1 = do first). Each session owns its own section: add, re-rank and tick off items there, and leave the other sections alone.

## GRAPHICS

Ranked by how much the player notices it, then by cost. Items marked [paid] need new nanobanana images (billed to the owner; ask before generating).

1. **Bring back the per-lot status markers.** Crime dots, the sickness cross and the death marker are drawn on the chunk layer, so the clay plots now cover them. Redraw them on top of the sprite (the status tints already are). This is lost gameplay feedback, not just looks.
2. **Roads and terrain in the clay style.** Buildings are clay; roads, grass, water, sand and wild trees are still the old flat art, and the seam shows at every plot edge. Biggest remaining visual clash. Likely a mix of code-drawn clay shapes and a few tiles [paid].
3. **Empty zoned lots.** A zoned tile with nothing built yet (level 0) is still a flat coloured square. Give it a clay plot: bare lawn / paving / dirt, maybe a "for sale" sign or a construction stage.
4. **Vibe versions of the 27 new designs** [paid] (27 × 4 = 108 images). Green, gritty, communal and wealthy districts still show one design per slot, so they look as same-ish as the neutral town used to.
5. **Landscaping polish.**
   - Neighbouring lots can get identical dressing (6 variants per sprite): raise the count or avoid matching neighbours.
   - All-tower districts read uniform (tree rows dominate): add more tower treatments.
   - Plazas and ground tones can sit over shops' painted parking bays.
   - The slate duplex (`res-2-b`) almost never gets any dressing.
   - Green-vibe sprites are already leafy, so dressing makes them the busiest lots: tone it down there.
6. **Fire and damage in the clay style.** The fire animation is old-style, and a fire-damaged or burnt-out building has no look of its own.
7. **Vibe versions of the civic buildings** [paid] (6–8 buildings × 4 = 24–32 images). Police, fire, hospital, school, power, sewage (and water tower, park) look the same in every district.
8. **Vehicles in the clay style.** Cars on the roads are still flat shapes.
9. **More level-3 designs** [paid]. Towers have four designs per zone; a dense downtown repeats quickly.
10. **Night and liveness.** Window-glow masks for a night mode (one extra image per sprite [paid]), and a small bounce when a building is placed or levels up.
11. **Retire the old sprite code.** `TestHouse` and `IndustrialHouse` are still registered in production; decide whether the ~80 code-drawn fallback sprites and the Shift+S sandbox stay, and remove what does not.
12. **Smaller sprite downloads.** Game sprites are 1.5 MB; palette PNG or WebP would cut that to about a third, but needs an extra tool and is slightly lossy. Low priority.

## GAME ENGINE

Ranked by how much it changes play, then by cost. "Unmeasured" means a suspected cost nobody has timed yet: measure first, then decide.

1. **Traffic step 1: flow-based traffic.** _Built (branch `worktree-engine`); needs play-testing and rate tuning (`BALANCE.transit.trips*`, `commuteMax`)._ Replace the "zones press on roads within 8 tiles" model in `TransitSystem` with travel-time maps per destination type (to commerce, to industry) and traffic sent downhill along them (homes → shops, homes → industry, industry → shops). Road speed counts, so avenues and highways finally matter. Same output layers (congestion, accessibility), so growth, land value, overlay and saves keep working. Rewrite the traffic tests around small hand-built maps; time it on a large city before and after.
2. **Traffic step 2: commute effects.** Growth slows as travel time to jobs / customers / workers rises; past a threshold the zone declines a level at a time (decline only for now, no abandonment from commute). Show commute in the tile inspector and the traffic overlay. Check first whether zones can lose a level today outside abandonment.
3. **Traffic step 3: destination capacity and damping.** Shops and jobs fill up, so one shop cannot absorb a city; congestion feeds back into travel time gradually so routes do not flip-flop between passes. Needs play-testing and tuning.
4. **Zoom hitch.** Every zoom change over 1% redraws every visible chunk (measured 20 ms at 1.5× up to 96 ms at 0.2× per redraw in headless Chrome), so a continuous zoom redraws repeatedly. Scale the cached chunks while zooming and redraw once it settles, or spread redraws over frames.
5. **Cars follow the traffic.** Point the cosmetic vehicles at the step-1 travel-time maps so they drive from homes toward shops and industry instead of wandering.
6. **Sim tick cost on a big city** (unmeasured). Time each system per tick on a full 256×256 city and fix the worst. Known suspects: Power / Water / Sewage mark every chunk dirty on every tick (now only costs a signature check per visible chunk, but should be targeted), and whole-map scans in several systems.
7. **Per-frame tile loop** (unmeasured). The renderer allocates a vibe object per visible tile per frame and the fallback sprite lookup builds a string key per call.
8. **Redundant autosave on tab return.** The game saves when the tab is hidden and then again on the first frame back.
9. **Keep `_chunkSignature` in step with the chunk layer.** Standing rule rather than a task: when graphics work changes what `_renderChunk` draws (graphics items 1 and 2 will), the signature in `CanvasRenderer` must read the same layers, or chunks stop updating.
