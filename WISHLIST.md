# Wishlist! This is Tony's wishlist/backlog

## Bug Backlog

- [ ]


## Priority 2:

- [ ] make bad traffic have other deleterious effects besides just hurting growth (pollution? idk)

## Priority 3:

- [ ] Sprite registry / metadata system
  - [ ] make sure the sprites are very extensible (and eventually moddable?)
  - [ ] they should be able to be tagged with various metadata to allow the game to be smart about which sprite/sprite vibes go where

## Various Major Backlog Items

### Population and employment: Richness and Improvements

- [ ] population: each residential zone level can have a maximum number of people that can live there. as a zone upgrades, more people can move in. the number of residents in each zone is not fixed.. it starts at 0 and moves up to the maximum allowed in that level. upon leveling, it increases slowly. population increase is driven by distress, health, services, leisure, taxes, etc.
- [ ] jobs: commercial and industrial zones have employment figures commensurate with their levels.
- [ ] unemployment: eventually we'll need to make sure every citizen has a job (to a healthy degree; some employment is good)...
- [ ] deaths should actually decrease population (and when people die, they no longer live in a zone)

### Leisure

- [ ] implement leisure. parks improve leisure. no leisure doesn't _hurt_ things but lack of it might impede R and C growth.

### Server & Cloud Saves

- [ ] RemoteStore implementation against backend
- [ ] API: POST/GET/DELETE /saves (save blobs opaque to server)
- [ ] very simple auth; username match only for now. will optimize and migrate in future.
- [ ] Local-first: game always saves to IndexedDB; "sync to cloud" is a button
- [ ] Auth via Clerk or magic links

### Figure out Political Capital

Should we evolve it or just kill it? it's a dead mechanic at this point. Should it be replaced by neighborhood culture and vibes? or not.

### Improve traffic / flow

Arterials/connecting roads should actually have a purpose... to make this happen, citizens need to "flow" from residential to commercial and industrial. goods need to "flow" to commercial. this should generate traffic. don't use agents, though!

### Transit / subway

Once we improve traffic / flow, we can implement subways to bulk-carry large numbers of citizens between major neighborhoods

## Major Feature: Neighborhoods and culture!

Something to keep in mind: Can we re-use the political capital system/infrastructure at all?

### Culture mechanic

That "Goldilocks" zone for culture is a classic urban planning trope—too sterile/expensive and it's soulless; too dangerous/poor and it's struggling. Implementing this as a derived "Culture" metric that feeds into a "Vibe" layer is a great way to add flavor without micromanagement.

#### The "Culture" Formula

If we define Culture as a value from 0–255, we could use a bell curve (Gaussian) logic for Land Value and Crime:

- Land Value Peak: High culture thrives where rent is "attainable" but the area isn't a slum. If 255 is maximum land value, the "Culture Peak" might be around 120–160.
- Crime Peak: A little bit of "edge" helps culture, but too much kills it. If 255 is maximum crime, the "Culture Peak" might be around 40–80.
- Education Scalar: High education should act as a multiplier. You can't have a thriving arts district if everyone is struggling with basic literacy.
- Result: Culture = BellCurve(LandValue) _ BellCurve(Crime) _ (Education / 255)

### Neighborhood "Vibes" & Culture

Each area (geographic proximity) can have a vibe. This is an area of effect type thing.

- [ ] sprites are chosen based on vibe/culture
- [ ] ambient lighting, etc too

### Vibes/neighborhood list

* TODO: define vibes list

### Additional Dimensions to consider

- The "Gentrification" Clock: You could track a "Vibe Age." If an Arts District stays at high Culture for too long, it naturally drives up LandValue. Eventually, the Land Value exceeds the "Culture Peak," and the area naturally transitions from "Arts District" to "Luxury Downtown." This forces the player to constantly "find" or "seed" new creative zones as the old ones get too expensive.

- Vibe-Specific Benefits
  - Arts Districts: Boosts nearby Land Value and Political Capital satisfaction.
  - Bar Districts: High tax revenue but generates a "Crime Aura" and "Noise Distress" for nearby Residential.
  - Shantytowns: Low tax, high crime, but provides a pool of low-wealth workers for Industrial zones (if you implement
    wealth classes later).

### Visual Implementation

Since you already have a CharacterPalette.ts that shifts colors based on city-wide "Character" (Egalitarian vs. Laissez-faire), we could extend the renderer to apply a local tint or sprite-set swap based on the vibe layer byte.

1.  Sprites: Your sprite logic could check world.layers.vibe[i] to decide whether to draw a "Luxury Condo"
    or a "Bohemian Loft."
2.  Overlays: High-culture areas could spawn "Decal" sprites (murals, cafe seating) on top of the road or sidewalk
    tiles.
3.  Lighting: The CanvasRenderer could apply a localized globalCompositeOperation (like 'overlay' or 'color') using a
    low-opacity radial gradient centered on vibe hubs to create that "Bar District" purple glow or "Industrial" smog.
