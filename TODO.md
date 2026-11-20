# TODO

One section per area, each a ranked list (1 = do first). Each session owns its own section: add, re-rank and tick off items there, and leave the other sections alone.

DESIGN is the owner's list: things that need a design decision before anyone builds them. Sessions add to it only when the owner asks, and move an item into their own section once it is decided.

## GRAPHICS

Items marked [paid] need new nanobanana images (billed to the owner; ask before generating).

### Next (ranked)

**Tutorial UI is in (TUTORIAL_DESIGN.md, 2026-11-19):** `src/ui/TutorialCard.ts` runs the steps 4×/s (passes met ones, Skip step, Leave asks once), draws the card (bottom centre, full width under 600px), pulses the step's toolbar item (opening its fly-out) plus the speed buttons and demand chart, and ghosts `target()` on the map (area highlight). Title and Menu have a Tutorial button, lit on a first launch (`concretta.tutorialDone`). The steps, rules and map are ENGINE's (see its section); the map is a placeholder until the owner builds the real one. Copy (`ui.tutorial.*`) waits on the owner.

**Toolbar regrouped (2026-11-19, owner via PM):** View · Inspect · Clear, Roads · Rail · Ports (seaport, airport), Zones, Utilities · Services (park joined) · Landscape, then Views (the data maps plus the underground view, moved out of Rail) · Budget · Ordinances · Requests · Undo · Redo · Menu. Fly-out items can start a group (`sepBefore`): Rail is ground / elevated / subway. Park's icon is now a bench. Hotkeys unchanged.

**Landscaping UI is in** (owner's picks from `art/clay-set/landscape-tools.html`: A1, B2 by default, C1, D1–D4, E1; no eraser, the bulldozer clears trees). Toolbar family Landscape (Trees `K`, Add water, Remove water) with species (Mixed + six) and brush 1/3/5 (`[` `]`) in the fly-out; strokes gather under a round brush and apply on release as one undo (`src/input/landscape.ts`, InputController); ghost trees/water, red blocked tiles, flood outlines, port/pump rings and the cursor tag (`src/ui/landscapePreview.ts`, renderer). Engine commands: TreeCommands (#234), EditWaterCommand (#236), warnings (#237). Not done: an inspect-pane line for a cut-off port or dry pump.

1. **Rail art (RAIL_DESIGN.md), in workshop.** Round 1 picks (art/clay-set/rail.html): T1 classic track, S1 Victorian stations, N2 globe-lamp entrance, R2 brick ramp, R5 brick-arch portal, C1–C3 heavy-rail liveries (subway cars all no), E2 steel elevated, U1 blueprint underground, J1 plain junctions. The owner wants two tracks drawn on every rail tile (one track in the engine), trains drawn top-down in code like road cars, at the right scale, fading in and out except when pulling in to and out of stations. Round 2 (rail2.html) shows that. **Keep S2 (brutalist) for a later "large train station".** In the game: toolbar, double track, Victorian stations (straight ones redrawn from a template), trains (`clay/trains.ts`: runs between junctions and dead ends, headway from `railLoad`, stop at platforms, fade at ends). The subway station's surface is the owner's A1 (2026-11-19, art/clay-set/subway-station.mjs bakes `subway-station`): a small brick station house at the back of its lot, with a lamp, planters, a bench and a blue "M" sign drawn in code (`drawSubwayEntrance`). **Ramps:** the brick ramp and portal redraws (raw-rail/brick-ramps.png, brick-portals.png) drifted off their templates (angled camera, wrong toward-us ramp): redo before phase 2, and find a ramp-climb animation the owner likes (the code climb in rail2.html L1 was 'immersion-breaking'). Subway liveries M1–M4 all picked. **Ramp climb: the owner picked R5** (rail2.html): the elevated deck ¼ of a tile up, the train's shadow staying under it; draw the brick ramp for that height. Trains keep running round the track (owner, 2026-11-19, reversing the earlier "ephemeral" note): `clay/trainNet.ts` drives them through junctions, up and down ramps, back from dead ends and terminus platforms, fading only through subway ramps; past capacity they slow and bunch nose to tail, queueing before busy junctions.
2. **Airport: built (2026-11-18).** `src/render/clay/airport.ts` draws it (straight-on steel terminal, J2 bridges, side-on planes, slide in and out, liveries red/navy/blue + rare orca/kawaii, no panda), placeable from the toolbar. The owner never picked between J2/J3/J5/J6 in round 3; J2 is in (swap in `drawBridge`). Planes come and go only while the airport has a road; one cycle a minute, from the clock. Maybe later: plane frequency from passenger trips, an inspector line from `buildingTripsAt`, a dusk look (C3).
1. **Ships: another round (owner still not happy after #243, 2026-11-17 night).** Ask what's off first (size, look, how they move?), then workshop again with `art/clay-set/ships.html`.
2. **Quest log / badge: traffic requests that are "holding" (engine #248).** `requestProgress()` now has `heldDays` and `holdDays`. A traffic request counts as met only after it passes `holdDays` (3) daily checks in a row, so it can sit at `covered >= coveredNeeded` with `met` false, and `progressPercents` then shows one point under the target. When `holdDays > 1 && heldDays > 0`, show "holding, day {heldDays} of {holdDays}" instead. #253 does the same for school, hospital and utilities requests: there `covered` is a 3-day average while `unmetFull` / `unmetOutOfReach` are live, so for a day or two after a fix the log can show nobody unmet but `covered` below 1 and `met` false. The "holding" line covers that too. Also new and still unused: the `tileDeclined` event, and `taxEffect().exodusChance` (#247, off for now).
3. **Seaport polish** (optional, from `art/clay-set/seaport.html`): trucks driving in through the gate; the barrier arm lifting (cut the painted arm and draw it in code). Owner hasn't asked.

Request text says why homes still lack a service ("nearby schools are full" / "no school in reach", from ENGINE's `unmetReason`), in the badge tooltip and the request log.

School and health map views are in: Overlays → School seats (`g`) and Hospital beds (`b`) show the seat marks (fill bar under each building, amber dot on homes in reach without a place) with no tool selected, with a key bottom-left. The overlay key now has a dark backing and no longer inherits the badges' centred text.

Seaport G2 and the seaport art are in (picks A1, B3, D3 → E1 on `art/clay-set/seaport.html`): painted kit from sprite sheets (`art/clay-set/raw-port/sheet-1..4.png`, cut by `port-sheet.mjs` to `public/sprites/clay/port/`; 5 paid images, one of them wasted; office is option 4 of `sheet-3.png`), stone docks. **Ships are painted clay**, reworked from the owner's workshop picks (`art/clay-set/ships.html`: A3+, B4, C3, D1, E1): 2.25 tiles long, rare (one ship about a port at a time, a turn every 30–90 s), passing only out at sea on long straight runs of `shipRoute` (8+ tiles off the docks), with a wake, a gentle bob and ripples round a docked ship; the docked ship lies under the crane booms (`src/render/clay/ships.ts`); cranes work while the docked one is in (`portArt.ts`). Container blocks are grids of third-size stacks. Ships show only at ports that trade. **?debug=true "Send ship"** (next to +$10k) sends one ship on each lane now, trade or not.

### Waiting on something else

- **Retouch the train station art** (owner, 2026-11-19): the scale doesn't look quite right. Do it after the main rail work (phase 2) is in. Deferred by the owner (2026-11-19); ask what looks off before changing anything.
- **Tower scaling too small** (owner, 2026-11-19, not urgent): confirm which tower (the airport's control tower, or the level 3 apartment and office towers) before changing it.
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

Status as of 2026-11-17, after the landscaping tree effects. Details of every system below are in AGENT.md.

### Next (ranked)

1. **Landscaping** (LANDSCAPING_DESIGN.md). The engine side is all merged: tree brush and eraser commands; `EditWaterCommand` with beaches re-laid; a cut-off seaport stops trading and a dry large water plant stops supplying; `treeQuote` / `waterQuote` previews with port and pump warnings; tree effects on land value and the green vibe. Toolbar and preview are GRAPHICS' (waiting on the owner's mock picks). Numbers shipped by ENGINEER 3 (landscape suite, owner-approved 2026-11-19): tree 200, clear 5, water 750 a tile, `treeBonus` 3 (cap 16), green ±0.05 a tree, `vegDecayMult` 0.98. Done.
2. **Seaport: five numbers still at no effect.** The split of `BALANCE.port` / `BALANCE.goods` with ENGINEER 3 is settled and the trade numbers are merged (trade suite #219, phase 5 numbers #220). Left at no effect because the lab has no target for them: `goods.shortageDemandPenalty`, `port.industrialDemandMult`, `port.truckWeight`, `pollution.seaportOutput`, `nuisance.buildingPerResident[12]`. ENGINEER 3 proposes numbers once the owner approves targets. **Waiting on the owner (targets), then ENGINEER 3.** Nothing for ENGINE to build.
3. **Tax exodus** (owner's rule, 2026-11-18): built; ENGINEER 3 shipped `exodusPerPoint` 1e-4, then 7e-5 when homes levelled up slower (2026-11-19). Above the neutral tax level each developed home has a (level − neutral) × `tax.level.exodusPerPoint` chance per growth pass of losing one level. Done.
4. **Buildings in traffic** (owner, 2026-11-18). Groundwork merged: `BALANCE.transit.buildings` has a row per building kind (`takes` / `sends` trips per market, `incomePerTrip`, `demandMult`), buildings can send trips as well as take them, and there is a `visitors` market (homes → buildings, `transit.tripsVisitors`). The airport's engine side is merged too: `BUILDING_AIRPORT` = 13, a 12×5 block, never turned, one per city, entered only from roads along its terminal frontage; no toolbar item offers it yet (graphics adds that with the art). Owner, 2026-11-18: arrivals do not pay; building doors give homes no accessibility (#269). Numbers set by ENGINEER 3 (owner-approved): airport cost 2,000,000, upkeep 150 a tick, `tripsVisitors` 0.05, takes 100 visitors at 6 each, sends 30 shoppers and 10 job seekers, commercial demand × 1.1. Police, fire, school and hospital take 1 job trip each (ENGINEER 3, after the overflow fix #272). The `airport` resident request is in (2026-11-18); ENGINEER 3 set its reward to 250 PC (owner-approved). (c) Landmarks are a row each.
5. **Rail, phase 1** (RAIL_DESIGN.md; the owner approved the plan on 2026-11-18). Four PRs: (A) the track layer, track tool and level crossings, _built_; (B) the straight and L stations, _built_ on footprints graphics may still change; (C) rail in TransitSystem, _built_: track and stations join the route search, track capacity, junction and crossing penalties, fares, freight never rides; (D) rail rows in the tile inspector, _built_. Rail on the traffic overlay, the rail jam past capacity (`rail.jam`) and the rail tool's Auto mode: _built_. Left: whatever hooks the lab asks for; **Phase 2** (owner asked for it 2026-11-19), in PRs: (A) elevated and subway as levels of the rail layer, with rules, prices, tools and the underground-view flag, _built_; (B) ramps (2×1) and the subway station, _built_; (C) traffic on all levels, _built_; (D) track nuisance PC (ground 0.01, elevated 0.015 per resident per tile) and station growth ×1.25 within 4 tiles (×1.4 since 2026-11-19), _built_; (E) Auto mode on all levels, bridging over a line with elevated track, _built_. Phase 2's engine side is complete; graphics owes the toolbar buttons, the drawing of elevated, subway, ramps and the subway station, and the underground view. No walking: both ends of a rail trip need a road. PC nuisance for track and the station growth bonus wait until after phase 1. Numbers set by ENGINEER 3 (owner-approved 2026-11-18, rail suite): speed 10, boarding 2, track 400 / 0.5, stations 30,000 / 25 (27,500 / 20 since the resize, owner 2026-11-19), fare 0.5, 4-way delay 4.
6. **Re-measure the service speed fix (#206) on a quiet machine** and add the figures to that PR. Ask ENGINEER 3 to "freeze" the tuner first. Optional.

Nothing else is unblocked: the next engine work comes from the on-hold list, at the owner's say-so.

### On hold (do not start without the owner)

- **Incremental service walk.** On the 160k-resident city the tick after a road or building edit is still about six times dearer than before the capacity numbers (#195, partly fixed in #206). Only if the owner sees a hitch.
- **Traffic balance pass** (with the owner, by play-testing; `?debug=true`). A jammed road hurts growth twice (`congestionGrowthPenalty` 0.75 plus longer commutes; probably lower it to about 0.3); a destination that stays over capacity has no effect; industry with one jammed road in loses most of its growth; trip rates, commute limit and road capacities were set on a small city. Jams should stay, and be fun to resolve.
- **Traffic step 2: commute effects.** Past a threshold a zone declines a level at a time; commute shown in the normal tile inspector.
- **Show traffic on the roads** (with GRAPHICS). `world.traffic` already has per-tile volume, capacity, each market's volume and direction; add anything missing once the look is picked.
- **Per-frame tile loop** and **auto road mode follow-ups** (route round obstacles, flip the L, chain): only if the owner asks.

Standing rules (see AGENT.md): systems never loop over the whole map (`world.index`, `FieldBounds`); when `paintChunk` reads a new layer, `chunkSignature` must read it too (a test checks this); anything that feeds back into traffic routing gets a stability check.

### Done and merged
- **Map types (owner, 2026-11-19):** New city offers Random / River / Coastal / Lakes / Bay / Classic (`sim/terrainGen.ts`), with forests in patches on the new ones. Classic stays the default of `new World`, so the lab, tests and golden are unchanged.
- **Tutorial logic (TUTORIAL_DESIGN.md, 2026-11-19):** the 13 real step checks (`tutorial/steps.ts`), the tutorial-only rules (`tutorial/rules.ts`, `TutorialSystem`: money floor, PC full, no fires, no requests) and a services step that follows on from Inspect, the saved `world.tutorial` field, and a PLACEHOLDER 48×48 map (`npm run gen-tutorial`). The owner hand-builds the real map: `?debug=true`, Menu → New city → Tutorial 48×48, build, save to file, replace `public/tutorial/tutorial.citysave.json`.

- Seaport phases 1–5 and trade numbers (#202, #209, #211, #212, #219, #220).
- Services by capacity: schools and hospitals seat homes nearest-first; police and fire are road-based (#195, #206).
- Economy: Tight default, debt rule, tax slider (#184, #187, #189, #194, #198, #199). Tax exodus (#247, #252).
- Political capital: cap scaling, requests and seats, PC numbers on with preset T (#165, #179, #180, #245, #256).
- Requests say why they are unmet (#222, #227). Traffic and school/hospital/utilities requests need a 3-day hold (#248, #253).

## ENGINEER 2

Second engine session: engine tasks the main engine session isn't on, cleanup and CI. Items 1 and 2 were moved here from GAME ENGINE by agreement with that session.

1. **Load spike on the first land-value / traffic tick.** _Done (#65)._ Worst of the first 8 ticks is now about 10 ms, down from ~60 ms.
2. **Highway beside a home with no road.** _Done._ Upgrading to highway no longer cuts off homes that never had another road (`zonesCutOffByHighway`).
3. **Political Capital live tuning panel** (`?debug=true`). _Built._ One input per `BALANCE.politicalCapital` key, with "Load proposed", "Reset" and "Copy values".
4. **CI and cleanup proposals** sent to the PM for the owner: perf numbers in CI, Cloudflare Pages PR previews (needs the owner's account), require CI before merging, prune merged branches.
5. **+$10k cheat** (DESIGN d.7): _Done (#223)._
6. **Click a toast to focus** (DESIGN d.5): _Done (#224)._

## ENGINEER 3

Balance Lab: targets, tuner, grading and the tuned numbers (`src/balance/`, `scripts/balance*.mjs`).

Done and merged:
- Tuned PC preset T (`src/balance/tunedT.ts`) (#169, #190, #245, #250, #255): 96/98 PC on the lab's test cities after #255.
- Lab grades the economy, service capacity, debt game over and tax slider; debt and tax suite (#185, #193, #195, #197, #246).
- Trade suite: seaport and goods targets (#219); ENGINE shipped the numbers (#220).
- Owner's answers (2026-11-18): closure, move, refill, tax and traffic targets (#248, #250, #252, #255, #257).
- Airport numbers (owner-approved 2026-11-18): airport cost 2,000,000 and upkeep 150 a tick; `tripsVisitors` 0.05; takes 100 visitors a tick at 6 each (a 10k city fills 83–88%, pays back in about 2 game years); sends 30 shoppers and 10 job seekers; commercial demand × 1.1. (#270).
- Debt drain 0.75 a day: shipped by ENGINE with the PC numbers (#256).
- Service jobs: police, fire, school and hospital take 1 job trip each (owner-approved), after ENGINE's overflow fix (#272); golden test city +1.4% residents at 400 ticks (#273).

- Airport suite (owner-approved targets 2026-11-18): airport.seats, .payback, .demand, .cost, .traffic, .request; 17/17 on the saved cities (1 n/a). The airport request's reward is 250 PC (#282).
- Rail numbers and rail suite (owner-approved 2026-11-18): speed 10, boarding 2, track 400 / 0.5, stations 30,000 / 25, fare 0.5, 4-way delay 4; targets rail.suburb, .beatsRoad, .freight, .junctions, .parallel, .early, .midgame, .pays (#291). rail.pays graded on a fixed 60-tile starter line (owner, #293), band 0.8–2.0 (owner, #295). rail.parallel probe fixed (#299); capacity 250 and a ≥ 25% cut for the second line, testcity1 n/a (owner, #303).
- Growth pace (owner, 2026-11-19; docs/GROWTH_OPTIONS.md, #305): option B for homes only, `growth.homeProbabilityByLevel` 8% / 4% / 2% (empty→1, 1→2, 2→3; shops and industry stay at `probability` 0.08), with `tax.level.exodusPerPoint` 7e-5. Tax/debt suite 13/13; golden test city −19% residents at 400 ticks (#307).
- Landscape suite and numbers (owner-approved targets 2026-11-19): land.treeHome, .treePayback, .treeShock, .treeSpam, .treeBuffer, vibe.treeGreen, water.canal, water.reclaim. Tree 200, clear 5, water 750 a tile, `treeBonus` 3 (cap 16), green ±0.05 a tree, `vegDecayMult` 0.98. All pass after the owner dropped land.treeSpam's price half (#311; dropped in the rail phase 2 PR).

- Title screen showcase city (owner, 2026-11-19): `public/showcase/showcase.citysave.json` from `npm run gen-showcase` (`src/gen/showcase.ts`): 21k residents, airport, seaport, a train line, an elevated line, a subway, towers downtown, parks and tree belts; about a quarter of the roads jammed (the owner's testcity1: 14%), surplus about 15k a day; 3.1 MB (59 kB gzipped) (this PR).
Approved by the owner (2026-11-19, proposals in #305):
- Rail leftovers: ENGINE builds track nuisance and the station growth bonus with the RAIL_DESIGN.md numbers in rail phase 2.
- Rail phase 2 prices: elevated 1,200 a tile (3×), subway 10,000 (25×), subway upkeep 2 (4×). Targets rail.subwayCost and rail.elevatedCost added; rail suite 26/26 after ENGINE's #310 (#314).
- Rail phase 2 placeholders shipped as numbers (owner, 2026-11-19): elevated upkeep 1.5, subway station 60,000 / 40, ramps 5,000 / 5 and 15,000 / 10, `rampTime` 1. Targets rail.nuisance (testcity1 0.11 bars, elevated 1.5×; the gens are n/a, with no free run beside homes) and rail.stationGrowth (18–22% sooner) (this PR).

- Station prices after the resize (owner-approved 2026-11-19): 27,500 / 20 (were 30,000 / 25); rail.early 2.03, rail.pays 1.06–1.18. rail.stationGrowth probe reworked (every home the bonus reaches round both stations, gated homes left out, mean over 100 seeds): testcity1 15%, gen-suburban 18%, gen-s1 9%, which fails (band 15–30%). Rail suite 29/30.
- Station growth ×1.4 (owner OK'd raising it, 2026-11-19): ×1.25 gave only ~15% sooner. rail.stationGrowth testcity1 24%, gen-s1 17%, gen-suburban 26%; rail suite 30/30. Swept 1.35 (gen-s1 14%, fails), 1.45 (passes, but rail.suburb access on gen-s1 fell to 29.8%) and 1.5 (29 / 23 / 29%).
- Level crossings (owner-approved 2026-11-19): `crossing.delay` split into carDelay 8 / trainDelay 2; car wait = carDelay × rail load × road load; overlay shows a crossing at (1 − ½ × rail load) capacity (looks only). Target rail.crossing: busy +12%, quiet +0.9%.
- rail.suburb access floor 30% → 25% (owner, 2026-11-19): gen-s1 sat at 29.8% after the station resize and the crossing change.

Next:
1. Nothing queued.

## DESIGN

Raised by the owner. Lettered, not ranked.

a. **Make "vibe" mean something.** Right now it does very little.
   - What exists: three per-tile layers (egalitarian, green, planned) that player actions nudge (zoning, roads, parks, service buildings, displacing people), which then spread to neighbours and decay back to neutral. They are averaged into a city-wide "character".
   - What it affects: only looks — the colour palette, which sprite variant a lot gets, and the vibe overlay. Nothing in the simulation reads it: not growth, land value, demand, crime, traffic or political capital.
   - It also fades to nothing. In the owner's exported city (population 6,664, tick 20,726) all three layers are exactly neutral on every tile, and the city-wide character is 0 / 0 / 0. Nudges only happen at the moment of an action and decay wins.
   - To decide: what vibe is for (identity and looks only, or a gameplay lever), what keeps it alive in a standing city (ongoing sources such as zones, parks and industry, not just one-off nudges), what it should change in the sim, and how the player sees and steers it.
   - Owners once decided: the sim side is GAME ENGINE (`VibeSystem`), the look is GRAPHICS (vibe sprite variants are already on that list).

b. **Give political capital more to do.** Designed and built: see PC_DESIGN.md. Open: the owner's play-test, and whether banked PC above the cap needs a fade or ceiling. Parked: the Rent Control ordinance.

c. **Tune service ranges.** The owner wants a dedicated session to tune the coverage ranges of services (today: police 12, fire 15, school 4, hospital 6, park 3 road steps). They decide how many buildings a neighbourhood needs, the PC rewards and closure costs of the service rule, and when a resident request is met: a park reaches only 3 tiles, so a dense neighbourhood can need several parks before its park request counts as met (75% of homes covered). Request rules stay as they are until then.

d. **PC play-test, round 1 (variant A, Gentle): findings.** Logged by the PM at the owner's request. Each owning session moves its items into its own section when it picks them up. **Don't change code while the owner is play-testing** (a dev-server reload interrupts the game). Investigating by reading code or running scripts outside the served trees is fine.
   1. **Police/fire request expired after both stations were placed** (bug, ENGINE to investigate). Met means at least 75% of the 12×12 neighbourhood's homes are covered by both police and fire. Coverage spreads along streets and avenues from road tiles next to the building. Suspects: a station not touching a road (covers only its own tile, no warning); coverage reaching only part of the cell; the badge area differing from the checked cell; variant A's metAt; the timing of the met check. Reproduce with the PC panel's Shortcuts.
   2. **Park request expired after placing a park** (rule problem, DESIGN c). A park reaches 3 road steps, so one park rarely covers 75% of a dense cell. Brings the service-range tuning session forward, or calls for a lower park metAt.
   3. **Request progress is invisible** (UX, GRAPHICS + ENGINE). The player can't see how close a request is ("60% of homes covered, 75% needed"). Placement could also warn when a service building doesn't touch a road. Engine exposes the need per open request; graphics shows it on the badge hover and in the quest log.
   4. **Quest log** (feature, GRAPHICS mocks first, then GRAPHICS + ENGINE). A place to review open requests after their toast is gone: kind, area, days left, reward and penalty, progress, and recently met or missed ones. The engine already keeps `world.politics.requests` and the open/met/failed events.
   5. **Click a toast to jump to its place.** Done (ENGINEER 2 item 6, #224).
   6. **Make zoning free in money** (owner's proposal, PM agrees; ENGINE). Zoning costs $20 for R and $25 for C/I per tile today (`BALANCE.costs.zoneR/C/I`). PC already makes zoning a decision (displacement when rezoning, nearby-homes cost for industry), so the money cost only taxes planning, and growth follows demand anyway. Set the zone costs to 0, keep every PC cost, and check early-game money balance.
   7. **Cheat button: +$10k.** Done (ENGINEER 2 item 5, #223).


e. **Bigger service buildings (deferred).** Once schools and hospitals have capacity (SERVICES_DESIGN.md), they may want to be larger than one tile, probably 2×2, now that multi-tile buildings exist (BIG_BUILDINGS_DESIGN.md). A bigger footprint suits buildings that serve thousands and would make them read as important on the map. Raised by the owner 2026-11-17; decide after capacity is tuned. It needs: shapes for the service kinds, art (paid), and the coverage seeding from the perimeter that phase 1 already has.

f. **Industry has almost no crime downside (later).** Noticed by the owner, 2026-11-17; to solve later. Unpoliced level-3 industry peaks at crime 60 (`BALANCE.crime.baseRateI` 0.5), below every threshold (growth block 100, which applies only to homes and shops; distress 130; abandon 150). Crime doesn't spread between tiles, so the only cost is a small pull on the city-wide satisfaction average, which industry mostly dilutes. Options: raise industry's rate; let crime spill onto nearby tiles, so an unpoliced industrial area hurts the homes next to it and buffers and police stations matter (PM's pick); or tie it to jobs or output. Keep it fun to resolve, not a chore.

g. **Low tax does nothing for a mature city (later).** Since the tax exodus (#247) and the owner-approved tax targets (2026-11-18), high tax is cash now that slowly costs residents, and low tax only speeds growth into empty zoned land, so in a built-out city it is pure lost income. Possible engine rule: low tax raises a built city's ceiling, e.g. faster level-ups or a higher density cap below level 10. Parked by the owner's pick; revisit after play-testing.

h. **2×2 buildings for very happy neighbourhoods** (owner, 2026-11-18). Top-level zoned buildings that are made very, very happy level up again into a larger 2×2 building, a reward to aim for. To design: the trigger (e.g. 4 adjacent top-level lots of the same zone, all at very high satisfaction or land value for a while), what happens if happiness drops (shrink back, or decline like other buildings), PC and displacement when merging, residents and jobs per 2×2, and art for R, C and I (likely paid, with brutalist/modern towers for R). The engine already has multi-tile shapes (`buildingShapes.ts`, per-tile buildingId). Fits the "city with memory" idea (heritage).

i. **Tutorial** (owner, 2026-11-19): design in TUTORIAL_DESIGN.md (guided first city, basics only, small hand-made map). Built (UI by graphics, logic by engine). Next: the owner hand-builds the real map and workshops the copy.

j. **Title screen** (owner, 2026-11-19). A first-load screen: the logo over a big live showcase city (about 15–25k residents, with an airport, rail, a seaport and jams), the camera gliding between interesting spots picked from live data (busiest roads, airport, busy stations, port, tallest towers). Shows what the game is. **Shown on the first launch each day; otherwise the game opens straight into the previous city.** Buttons: Continue (when a save exists), New city, Load. The logo appears at once and the city loads behind it. Built and live: engine #330, showcase city #331. **The name is Concretta** (owner, 2026-11-19). Name strings done (#333). **Logo: the owner turned down the six workshop logos (#335) and is instead building a showcase city by hand whose roads, rail and terrain spell CONCRETTA**; the tour zooms into each letter, using engine's debug-only Focus markers to pick the shots. The owner's save then replaces `public/showcase/showcase.citysave.json`. The screen's look (GRAPHICS) waits on that. Rough split: ENGINEER 3 builds the showcase save with the lab player; ENGINE the spot finder and camera tour; GRAPHICS the screen and logo.
   - **ENGINE's part is built** (spot finder, camera tour, launch rule, Continue / New city / Load, a placeholder title). Still owed: the real showcase save from ENGINEER 3 (replace `public/showcase/showcase.citysave.json`, now a small generated city), and the screen's look and the logo from GRAPHICS (`#title-screen` in `index.html`).
   - **Focus markers are built** (debug only): the owner places them in the showcase city with `?debug=true` (the "Focus markers" panel), saves to file, and the title tour visits them in order. See AGENT.md, Markers.
   - **Title polish is built** (owner's notes, 2026-11-19): no wiggle while the tour zooms (smooth zoom), nothing but the title panes on screen (no HUD, toasts, badges, pins or grid), and the showcase cannot fail (funds frozen; restarts from its file if it shrinks). See AGENT.md, Title screen.
   - **Title theme** (owner, later): the music session writes a short title theme for this screen.
