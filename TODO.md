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

_(owned by the game-engine session)_
