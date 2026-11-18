# TODO

One section per area, each a ranked list (1 = do first). Each session owns its own section: add, re-rank and tick off items there, and leave the other sections alone.

DESIGN is the owner's list: things that need a design decision before anyone builds them. Sessions add to it only when the owner asks, and move an item into their own section once it is decided.

## GRAPHICS

Items marked [paid] need new nanobanana images (billed to the owner; ask before generating).

### Next (ranked)

1. **School and health map views** (P1, owner: "when we get around to it"). Overlays for school seats and hospital beds, like the crime and fire overlays, so the capacity marks (fill bar under each building, amber dot on homes turned away) also show without the tool selected. Today they show only while the school or hospital tool is selected or one is inspected.
2. **Seaport polish** (optional, from `art/clay-set/seaport.html`): trucks driving in through the gate; the barrier arm lifting (cut the painted arm and draw it in code). Owner hasn't asked.

Seaport G2 and the seaport art are in (picks A1, B3, C1–C4, D2/D3 → E1 on `art/clay-set/seaport.html`): painted kit from two sprite sheets (`art/clay-set/raw-port/`, cut by `port-sheet.mjs` to `public/sprites/clay/port/`; 4 paid images, one of them wasted; office replaced by option 4 of `sheet-3.png` at the owner's request), stone docks, code-drawn ships on `shipRoute` (`src/render/clay/ships.ts`), cranes working while a ship is in (`portArt.ts`). **Ships only show once a port trades**: the lab has the port trade numbers at 0 on main, so no port has ships yet (engine/ENGINEER 3). Seen in a browser with trade forced on: docks east, west, north and south, a ship under a bridge, zoomed out.

### Waiting on something else

- **Terrain in the clay style** (grass, sand, water, rounded shorelines): deferred by the owner.
- **Vibe versions of the new designs** [paid] (33 × 4 images): waiting on vibe tuning. The vibe mechanic barely shows up in a normal city yet, so the art would not be seen.
- **Landscaping polish**: on hold. Known issues: identical neighbours (6 variants per sprite), uniform all-tower districts, plazas over shops' painted parking bays, the slate duplex (`res-2-b`) almost never dressed, green-vibe lots too busy.
- **Night and liveness**: on hold. Window-glow masks for a night mode [paid], a small bounce when a building is placed or levels up.
- **Refine the clay trees**: on hold, fine for now per the owner (in the game and "good enough to carry on", per the owner). To revisit: more broadleaf variety (beech is the only round-crowned tree; oak, birch, maple and willow were rejected twice, first too cartoonish, then too gnarly; the owner likes compact dense crowns with hidden trunks) [paid]; forests look a little planted because the tidy rows line up across tiles (the owner rejected random scatter and mirrored trees as sloppy, so add wobble carefully); larch is muted in `trees.mjs` (`MUTE`), retune if needed; frame cost of large forests and of zooming has not been measured; after the engine's zoom fix lands, key the per-tile trees on the chunk's own drawn size (`_chunkTs`). Review pages: `art/clay-set/trees.html`, `art/clay-set/forest.html`.

### Deprioritised

- **Vibe versions of the civic buildings** [paid] (24–32 images).

### Decided

- **Political capital UI** (design in `PC_DESIGN.md`; mocks with the owner's picks in `art/clay-set/pc.html`): HUD shows `pc / cap` with a bar and the signed rate (A2). Placing an unpopular building shows three fall-off rings and tints the homes that object (B9 + B7), red before the click when refused (B4). An industrial zone drag tints homes, floats the total on release and goes red only when PC would run short (B10 + B11). Services add the reward to the price over today's coverage preview (C7); closing shows its cost and is never refused (C2, C3, C6); inspect pane lines (C4, C5). One floating total per action (D2), milestone banner and toast (D5). Ordinances get their own tile, panel and confirm step (E1–E3). Requests are round badges with a countdown ring (F2, F4, F5). No PC prices in fly-outs, only a "◆ near homes" hint (G3–G5). PC is written as a teal diamond and number. Build order and engine dependencies are in the review sent to the PM session; each step waits for its engine side.
- **Toolbar:** a two-column palette of line icons under the stats panel (concept A on `art/clay-set/toolbar.html`; the owner preferred line icons to clay thumbnails). Families (roads, zones, utilities, services, parks, overlays, menu) open fly-outs; the Manual / Auto road switch is in the Roads fly-out. To add a tool, add an item to `TOOLBAR` in `src/ui/Toolbar.ts`, an icon in `toolbarIcons.ts` and its two strings.
- **Problem indicators:** merged pins per district when zoomed out, a badge per building when zoomed in (option A on `art/clay-set/indicators.html`). Hovering a badge with the inspect tool explains it.
- **No power / no water:** a building without power goes dark (no look for no water: the owner found it too quiet), plus a bolt / drop pin per district when zoomed out and a bolt / drop badge on every affected lot when zoomed in (option D on `art/clay-set/utilities.html`, with badges added after the owner found the look alone did not explain itself). Empty zoned lots have no building to change, so they keep the old dark tint. The no-sewage / no-services tints are unchanged; ask the owner before reworking them.
- **Commute:** violet pins for long-commute and cut-off lots, and the inspected lot's trip drawn along the roads (K1 + K2 on the same page); the inspect pane lists each trip against the limit.
- **Roads and traffic:** code-drawn clay roads with crosswalks and stop lines at junctions (J2) and per-tile clay cars for traffic (T1); the wandering cars are gone. Mock: `art/clay-set/roads.html`.
- **Building taste:** the owner loves brutalist and modernist designs (favourite: `com-3-f`); lean that way for future high-level buildings. Of the brutalist batch, `res-3-h`, `res-3-j`, `com-3-i`, `com-3-j` were kept; the ziggurat and the inverted pyramid were rejected.
- **Code-drawn fallback sprites and the Shift+S sandbox** are deleted. Before a clay image loads, the flat chunk-layer drawing shows.
- **Empty zoned lots** stay bare grass with the zone colour, at least for now.

## GAME ENGINE

Status as of 2026-11-17, after seaport phase 5 and the request reasons. Details of every system below are in AGENT.md.

### Next (ranked)

1. **Seaport: the numbers still off.** The trade numbers are in (phase 5: exports, imports, goods shortage income penalty, cost $200,000 and upkeep $30, `transit.goodsCapacity` 0.55). Still at no effect, with no lab target yet: `goods.shortageDemandPenalty`, `port.industrialDemandMult`, `port.truckWeight`, `pollution.seaportOutput`, `nuisance.buildingPerResident[12]`. Parked until ENGINEER 3's targets exist; agree the split of `BALANCE.port` / `BALANCE.goods` with ENGINEER 3 directly. **Waiting on ENGINEER 3 (lab) and the owner.**
2. **Re-measure the service speed fix (#206) on a quiet machine** and add the figures to that PR. Ask ENGINEER 3 to "freeze" the tuner first. Optional.
3. **Tax slider's growth-demand follow-up:** ENGINEER 3 lists this as waiting on ENGINE. Check with ENGINEER 3 whether #199 (`taxDemandMult`) already covers it.

### On hold (do not start without the owner)

- **Incremental service walk.** On the 160k-resident city the tick after a road or building edit is still about six times dearer than before the capacity numbers (#195, partly fixed in #206). Only if the owner sees a hitch.
- **Traffic balance pass** (with the owner, by play-testing; `?debug=true`). A jammed road hurts growth twice (`congestionGrowthPenalty` 0.75 plus longer commutes; probably lower it to about 0.3); a destination that stays over capacity has no effect; industry with one jammed road in loses most of its growth; trip rates, commute limit and road capacities were set on a small city. Jams should stay, and be fun to resolve.
- **Traffic step 2: commute effects.** Past a threshold a zone declines a level at a time; commute shown in the normal tile inspector.
- **Show traffic on the roads** (with GRAPHICS). `world.traffic` already has per-tile volume, capacity, each market's volume and direction; add anything missing once the look is picked.
- **Per-frame tile loop** and **auto road mode follow-ups** (route round obstacles, flip the L, chain): only if the owner asks.

Standing rules (see AGENT.md): systems never loop over the whole map (`world.index`, `FieldBounds`); when `paintChunk` reads a new layer, `chunkSignature` must read it too (a test checks this); anything that feeds back into traffic routing gets a stability check.

### Done and merged

- Seaport phases 1–5 (#202, #209, #211, #212, trade numbers): shapes with roles and four rotations, open-water placement, a fourth traffic market (`exports`), imports as a goods source, city-wide industry boost, city-wide goods shortage, ship route and ships per day.
- Services by capacity (#195, #206): schools and hospitals seat whole homes nearest-first (school 20 tiles / 4,000, hospital 30 / 8,000); police and fire are road-based reach only.
- Economy (#184, #187, #189, #199): Tight numbers are the default ("Original" kept as a preset); debt rule; tax level slider that also moves satisfaction and growth demand (`taxEffect` for the UI).
- Political capital: regeneration, upkeep, displacement and debt drain scale with the cap (`capScale`); requests and seats (#165, #179, #180, #194).
- Requests say why they are unmet: `requestProgress` gives `unmetFull` / `unmetOutOfReach` / `unmetReason` for the coverage kinds (GRAPHICS uses it for the quest text and the school and health overlays).
- Debt countdown is on: `budget.debtGraceDays` is 30 with the game-over screen (#198).
- Earlier: flow-based traffic with markets, overlay and debug panel (#29, #30); save files (#30); sim tick 95 ms → 3 ms on a 512×512 map (#31); renderer split; zoom stutter fix; CI checks, the golden-city test and `npm run bench`.

## ENGINEER 2

Second engine session: engine tasks the main engine session isn't on, cleanup and CI. Items 1 and 2 were moved here from GAME ENGINE by agreement with that session.

1. **Load spike on the first land-value / traffic tick.** _Done._ On the owner's 512×512 city, the first tick that ran land value and traffic after a load cost about 60 ms. Land value's whole-map pass now skips the neighbourhood scans far from anything built, with identical results (~40 → ~8 ms, #65). Traffic settles during the load, before the first frame (~20 ms hidden in loading). Now the worst of the first 8 ticks is about 10 ms, and `npm run bench` reports both figures.
2. **Highway beside a home with no road.** _Done._ Upgrading a street or avenue to highway still abandons the developed zones beside it that have no other street or avenue, and charges displacement for the homes among them. A highway built on empty land, or over a highway, cuts nobody off, so a home that never had a road is left alone (owner's rule, `zonesCutOffByHighway`).
3. **Political Capital live tuning panel** (`?debug=true`): _Built._ It has an input for every `BALANCE.politicalCapital` number, generated from the balance object, so new keys appear by themselves. It shows PC / cap, regeneration (applied, and the rate at the current satisfaction), 0 → cap refill time, satisfaction with each factor, and the next milestone. "Load proposed" switches on the engine's proposed numbers (`src/ui/pcPresets.ts`), "Reset" puts the shipped ones back, and "Copy values" exports the block for a numbers-on PR.
4. **CI and cleanup proposals** sent to the PM for the owner: perf numbers in CI, Cloudflare Pages PR previews (needs the owner's account), require CI before merging, prune merged branches.
5. **+$10k cheat** (DESIGN 7): _Done._ A "+$10k" button in the PC panel's Shortcuts (`?debug=true`) adds $10,000 to the city's money.
6. **Click a toast to focus** (DESIGN 5): _Next._ Agree files with GRAPHICS first (`src/ui`, `src/render`).

## ENGINEER 3

Balance Lab: targets, tuner, grading and the tuned numbers (`src/balance/`, `scripts/balance*.mjs`).

Done and merged:
- Tuned PC preset T (`src/balance/tunedT.ts`, used by the lab and the debug panel) (#169, #190).
- Lab grades the economy, service capacity and debt game over; tax-slider targets (#185, #193, #195, #197).
- Trade suite: seaport and goods targets the owner approved (port.payback, port.split, port.farm, goods.today, goods.port.fix), probes in `src/balance/trade.ts`, sweep `npm run balance:trade`. Proposed numbers (preset "proposed", 12/12): goodsCapacity 0.55, shortageIncomePenalty 0.25, port exportTripsPerLevel 0.1, exportCapacity 15, exportIncomePerTrip 8, importCapacity 200, cost 200k, upkeep 30. ENGINE ships them in the seaport P5 numbers PR.

Paused (2026-11-17, owner's break):
- Re-tune T under the shipped service numbers (school 20 / 4,000, hospital 30 / 8,000); school and hospital PC pay is too high. Stopped at eval 211 of 400: score 25.806 → 8.856, 89/98 → 92/98 (fresh-128, testcity1, gen-s1-t10000, gen-suburban-s1-t10000). The partial best is T with service.perResident 4/5/6/7/8 → 0.0066 / 0.0066 / 0.00953 / 0.0102 / 0.0088, repeatFactor 0.25 → 0.45 and closureMultiplier 2.5 → 1.67. Saved locally in city-builder-eng3-econ/balance-results/tune-T-svc-partial.{json,log}; not yet graded or shipped.
- To resume: put those values in `src/balance/tunedT.ts` on a branch, then rerun `caffeinate -i node scripts/balance-tune.mjs --start T --saves testcity1,gen-s1-t10000,gen-suburban-s1-t10000 --budget 200 --out balance-results/tune-T-svc.json` (about 2–3 hours). Grade the result against main's T with `npm run balance -- --suite pc --variants T` (plus `--suite svc`) and ship it in tunedT.ts if it's better.

Next:
1. Tune `BALANCE.budget.debtPcDrainPerDay` and the tax level's `satisfactionPerPoint` / `demandStrength`.

Waiting on:
- ENGINE: the tax slider's growth-demand follow-up, before its targets can be added.
- ENGINE: the seaport P5 numbers PR, shipping the proposed trade numbers.

## DESIGN

Raised by the owner. Lettered, not ranked.

a. **Make "vibe" mean something.** Right now it does very little.
   - What exists: three per-tile layers (egalitarian, green, planned) that player actions nudge (zoning, roads, parks, service buildings, displacing people), which then spread to neighbours and decay back to neutral. They are averaged into a city-wide "character".
   - What it affects: only looks — the colour palette, which sprite variant a lot gets, and the vibe overlay. Nothing in the simulation reads it: not growth, land value, demand, crime, traffic or political capital.
   - It also fades to nothing. In the owner's exported city (population 6,664, tick 20,726) all three layers are exactly neutral on every tile, and the city-wide character is 0 / 0 / 0. Nudges only happen at the moment of an action and decay wins.
   - To decide: what vibe is for (identity and looks only, or a gameplay lever), what keeps it alive in a standing city (ongoing sources such as zones, parks and industry, not just one-off nudges), what it should change in the sim, and how the player sees and steers it.
   - Owners once decided: the sim side is GAME ENGINE (`VibeSystem`), the look is GRAPHICS (vibe sprite variants are already on that list).

b. **Give political capital more to do.** _Designed: see PC_DESIGN.md._ All of the mechanics are on main and switched off (numbers at 0): cap that grows with population, satisfaction-based regen that can drain, political debt, nearby-homes costs, the service rule, milestones, ordinances and resident requests. Left: the balance play-test with the ?debug=true PC tuning panel ("Load proposed" has the dry-run numbers), then a "numbers on" PR. Revisit after the play-test: whether banked PC above the cap needs a fade or ceiling. Parked: the Rent Control ordinance, until vibe or land-value abandonment exist (its benefits have nothing to act on yet).

c. **Tune service ranges.** The owner wants a dedicated session to tune the coverage ranges of services (today: police 12, fire 15, school 4, hospital 6, park 3 road steps). They decide how many buildings a neighbourhood needs, the PC rewards and closure costs of the service rule, and when a resident request is met: a park reaches only 3 tiles, so a dense neighbourhood can need several parks before its park request counts as met (75% of homes covered). Request rules stay as they are until then.

d. **PC play-test, round 1 (variant A, Gentle): findings.** Logged by the PM at the owner's request. Each owning session moves its items into its own section when it picks them up. **Don't change code while the owner is play-testing** (a dev-server reload interrupts the game). Investigating by reading code or running scripts outside the served trees is fine.
   1. **Police/fire request expired after both stations were placed** (bug, ENGINE to investigate). Met means at least 75% of the 12×12 neighbourhood's homes are covered by both police and fire. Coverage spreads along streets and avenues from road tiles next to the building. Suspects: a station not touching a road (covers only its own tile, no warning); coverage reaching only part of the cell; the badge area differing from the checked cell; variant A's metAt; the timing of the met check. Reproduce with the PC panel's Shortcuts.
   2. **Park request expired after placing a park** (rule problem, DESIGN c). A park reaches 3 road steps, so one park rarely covers 75% of a dense cell. Brings the service-range tuning session forward, or calls for a lower park metAt.
   3. **Request progress is invisible** (UX, GRAPHICS + ENGINE). The player can't see how close a request is ("60% of homes covered, 75% needed"). Placement could also warn when a service building doesn't touch a road. Engine exposes the need per open request; graphics shows it on the badge hover and in the quest log.
   4. **Quest log** (feature, GRAPHICS mocks first, then GRAPHICS + ENGINE). A place to review open requests after their toast is gone: kind, area, days left, reward and penalty, progress, and recently met or missed ones. The engine already keeps `world.politics.requests` and the open/met/failed events.
   5. **Click a toast to jump to its place** (feature, GRAPHICS + ENGINE). Clicking any location-based toast (a request, a fire, any alert tied to a tile) pans or zooms the camera there and briefly highlights it; quest-log rows jump the same way. Request events carry their area; fire and other alerts need checking. Needs a camera "focus on area" call.
   6. **Make zoning free in money** (owner's proposal, PM agrees; ENGINE). Zoning costs $20 for R and $25 for C/I per tile today (`BALANCE.costs.zoneR/C/I`). PC already makes zoning a decision (displacement when rezoning, nearby-homes cost for industry), so the money cost only taxes planning, and growth follows demand anyway. Set the zone costs to 0, keep every PC cost, and check early-game money balance.
   7. **Cheat button: +$10k** (owner; GRAPHICS for the HUD spot, or ENGINEER 2 in the PC panel's Shortcuts). A button next to the money figure in the info pane that adds $10,000, so PC can be play-tested without money getting in the way; the economy gets its own play-test later. Debug-only (`?debug=true`), never shown to players.
   - Notes for 5 (click-to-focus), from ENGINEER 2's read-only survey: fireIgnition, fireDamage and tileAbandoned already carry a tile, and requests carry an area. crimeSpike and healthcareCrisis carry only city averages, so CrimeSystem / HealthcareSystem need to add a worst tile or bounding box. `showToast` has no location slot. `Camera.centerOnTile` exists, but there's no fit-to-area. Plan: `Camera.focusArea(rect)`, an optional `focus` argument on `showToast`, click to focus then dismiss. One small PR by ENGINEER 2, agreed with GRAPHICS and ENGINE.

e. **Bigger service buildings (deferred).** Once schools and hospitals have capacity (SERVICES_DESIGN.md), they may want to be larger than one tile, probably 2×2, now that multi-tile buildings exist (BIG_BUILDINGS_DESIGN.md). A bigger footprint suits buildings that serve thousands and would make them read as important on the map. Raised by the owner 2026-11-17; decide after capacity is tuned. It needs: shapes for the service kinds, art (paid), and the coverage seeding from the perimeter that phase 1 already has.
