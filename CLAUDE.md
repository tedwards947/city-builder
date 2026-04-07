# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Status

Browser-based 2D top-down city builder (SimCity-style). The Vite + TypeScript project lives in `city-builder/`. The original single-file prototype is `city-builder-prototype.html` (reference only).

I'm using a Claude Pro plan so tokens and context length REALLY MATTER! Please ask before importing large resources and please be dilligent before reading too much...

**Currently on: Phase 5** — systems depth.

---

## Phase Roadmap

Check items off here as they are implemented and tested. When all items in a phase are checked, mark the phase header ✅.

### ✅ Phase 0: Foundation
- [x] Typed-array World with all layers
- [x] Grid with chunk dirty tracking
- [x] Seeded PRNG (mulberry32)
- [x] EventBus

### ✅ Phase 1: Minimum Viable Renderer
- [x] Canvas renderer with viewport culling
- [x] Camera with pan, zoom, pinch-to-zoom
- [x] Projection module (tileToWorld / worldToTile / depth hook)
- [x] Terrain rendering

### ✅ Phase 2: Interaction & First Commands
- [x] Unified pointer input (mouse + touch)
- [x] PaintZoneCommand, BuildRoadCommand, PlacePowerPlantCommand, BulldozeCommand
- [x] CommandHistory with undo (Ctrl+Z)
- [x] Tool selection UI + hover preview

### ✅ Phase 3: First Simulation Loop
- [x] Scheduler with pause / 1× / 2× / 3× speed
- [x] NetworkSystem (road connected components via flood fill)
- [x] PowerSystem (plant → road network → 1-tile radiation)
- [x] ZoneGrowthSystem (zoned + powered + road access → develop)
- [x] EconomySystem (taxes, maintenance, population)
- [x] HUD (money, population, power, date)

### ✅ Phase 3.5: Port & Tests
- [x] Ported prototype to Vite + TypeScript
- [x] Vitest suite: Grid, RNG, World mutations, all 4 commands, all 4 systems (78 tests)

### ✅ Phase 4: Persistence & Playability Polish
- [x] SaveFormat.ts with `version` field and migration stub
- [x] Serializer.ts — World ↔ bytes (typed arrays → ArrayBuffer)
- [x] LocalStore.ts — IndexedDB backend
- [x] SaveManager.ts — high-level save/load API (userId-scoped, defaults to 'local')
- [x] RemoteStore.ts — HTTP interface (stub, not implemented)
- [x] Multiple save slots UI (5 slots, save/load/delete, name prompt)
- [x] New game screen with map generation options (size, water amount, seed)
- [ ] Settings menu (sim speed default, key bindings) ← deferred post-Phase 5
- [ ] Tutorial tooltips ← deferred post-Phase 5
- [ ] Balance tuning from playtesting ← deferred post-Phase 5

**Exit criterion:** A stranger can start a new city, play 30 minutes, save, close, come back, continue.

### Phase 5: Systems Depth
- [x] WaterSystem — propagation system (copy PowerSystem pattern, different rules)
- [x] Sewage system — SewagePlant building, required for level 2→3 growth
- [x] Pollution as diffusion layer affecting desirability
- [x] Generic coverage system (police, fire, schools, hospitals, parks)
- [x] information tool -- insight to the player about each zone or tile and perhaps why it's not able to grow, etc
- [ ] Disaster event scheduler (fires, floods, random events) [SKIP FOR NOW]
- [x] Richer economics (variable tax rates, land value, demand curves)

### Phase 6: Transit
- [x] Flow simulation on road graph (not agent-based — flow scales, agents don't)
- [x] TripGenerator / TripAttractor components
- [x] Demand computation and flow solver (runs periodically)
- [x] Congestion as edge property feeding back into growth
- [x] Traffic overlay view
- [x] Road classes: street / avenue / highway (capacity/speed differ)
- [x] Road upgrade UI (mutate edges, don't demolish)
- [ ] Bus routes, subways as additional graphs, modal split
- [x] Visual agent layer (eye candy only, hard vehicle budget cap)
- [ ] Road pathing improvements -- residents need to travel to commercial zones to shop and to industrial zones to work. industry needs to ship things to commerce. don't use agents, but let's find a simple-ish way to model this so that traffic flow becomes something serious to consider

### Phase 7: Identity — Political Capital & City Character
- [x] PoliticsSystem — per-tick regen from satisfaction (servicesCoverage/powerCoverage/waterCoverage, weighted, extensible via SatisfactionFactor interface); satisfaction exposed on world.stats
- [x] Disruptive action cost table in `/data` (balance.ts politicalCapital section: max, baseRegen, satisfactionRegenBonus, satisfactionWeights, disruptionCosts)
- [x] Visible political capital meter in HUD (value + animated bar, color shifts at low/critical thresholds)
- [x] Disruptive actions gated on capital — bulldozing and painting over populated R zones check+deduct PC; undo restores it
- [x] CityCharacterSystem — event-driven nudges (zonePainted/tileCleared/roadBuilt/serviceBuilt/powerPlantBuilt) + per-tick decay; world.character axes clamped to ±axisMax
- [x] Sprite variant lookup keyed on character profile — CharacterPalette.resolvePalette(character, axisMax) returns a ColorPalette; renderer calls it once per frame
- [x] Ambient presentation shifts — green↔industrial (grass, zoneI, buildingI, park colors), egalitarian↔laissez-faire (zoneR/C warmth, vividness), planned↔organic (road shade/definition); all lerped, no meters shown
- [ ] **No character meter** — player discovers vibe through ambient feedback only
- [x] Balance tuning from playtesting

### Phase 7.5: Services and stuff
- [x] implement abandonment; build the scaffolding/capability and we'll worry about the conditions to become abandoned later. build a visual state for abandonment
- [ ] implement crime. opine and ask for clarification and then implement. eventually we'll implement education and that will impact crime (but not quite yet). police service proximity should have a direct impact on crime. too much crime should actively hurt political capital. you will probably need to expand the radius of police stations to make this non-tedious gameplay. zones should have knowledge of police and crime. if there's too much crime for too long, buildings abandon. we need a visual state for crime
- [ ] implement fire... fire risk, etc. fire stations actively impact it. opine and ask for clarification. buildings burn and if not put out quickly enough they become abandoned. even service or infrastructure buildings can be hurt by fire. we need a visual state for zones and buildings on fire
- [ ] implement educational levels. schools improve it. more educated citizens make more tax revenue and generate less crime. residential zones should be aware of educational facilities.
- [ ] implement healthcare. implement death and sickness. with perfect healthcare, cititzens live naturally to 75 years old (we might need to tune this??). if no healthcare, citizens get sick and die early. implement a visual state for a sick citizen (maybe a zone has a different border or something if there's a sick citizen. the inspect tooltip shows sickness). implement a temporary visual state for a dead citizen (maybe a zone has a border or something if there's been a recent death). up to you on how long that visual state persists. inspect tooltip should also display if there's been a recent death.
- [ ] implement leisure. parks improve leisure. no leisure doesn't _hurt_ things but lack of it might impede R and C growth.
- [ ] Balance tuning from playtesting

### Phase 8: Server & Cloud Saves
- [ ] RemoteStore implementation against backend
- [ ] API: POST/GET/DELETE /saves (save blobs opaque to server)
- [ ] Auth via Clerk or magic links
- [ ] Local-first: game always saves to IndexedDB; "sync to cloud" is a button

### Phase 9: Depth & Longevity
- [ ] Historical eras with shifting constraints
- [ ] Achievements via EventBus
- [ ] Scenarios
- [ ] Constituencies (v2 political capital — competing interest groups)
- [ ] Mod support
- [ ] Localization via t() lookup

### Phase 10: Speculative — defer indefinitely
- [ ] Emergent resistance / protest movements
- [ ] Individual citizen simulation
- [ ] Regional / multi-city
- [ ] Lockstep multiplayer
- [ ] Isometric view

---

## Target Tech Stack

- TypeScript + Vite
- Vitest for tests
- Canvas 2D renderer (MVP); PixiJS later
- Cloudflare Pages for hosting
- IndexedDB for local saves; Cloudflare Workers + R2/D1 for cloud saves (Phase 8)

---

## Module Structure

```
city-builder/src/
  sim/
    World.ts, Grid.ts, Scheduler.ts, EventBus.ts, rng.ts, constants.ts
    systems/
      NetworkSystem.ts, PowerSystem.ts, WaterSystem.ts, SewageSystem.ts,
      PollutionSystem.ts, ZoneGrowthSystem.ts, EconomySystem.ts
      (future: ServiceSystem, TransitSystem, PoliticsSystem, CharacterSystem)
  render/
    CanvasRenderer.ts, Camera.ts, Projection.ts
  input/
    InputController.ts
  commands/
    Command.ts, PaintZoneCommand.ts, BuildRoadCommand.ts,
    PlacePowerPlantCommand.ts, PlaceWaterTowerCommand.ts,
    PlaceSewagePlantCommand.ts, BulldozeCommand.ts, CommandHistory.ts
  persistence/
    SaveFormat.ts, Serializer.ts, LocalStore.ts, RemoteStore.ts, SaveManager.ts
  ui/
    NewGameDialog.ts, SaveLoadPanel.ts
  data/
    balance.ts
  __tests__/
    Grid.test.ts, rng.test.ts, World.test.ts, commands.test.ts,
    systems.test.ts, persistence.test.ts, newgame.test.ts
  main.ts
index.html
```

---

## Current World State (as of this session)

### Tile Layers (`world.layers`)
| Layer | Type | Purpose |
|-------|------|---------|
| terrain | Uint8Array | 0=grass, 1=water, 2=sand |
| zone | Uint8Array | 0=none, 1=R, 2=C, 3=I |
| roadClass | Uint8Array | 0=none, 1=street |
| building | Uint8Array | 0=none, 1=power plant, 2=water tower, 3=sewage plant, 4–8=service |
| devLevel | Uint8Array | 0–3 development level |
| power | Uint8Array | 0/1 — powered this tick |
| water | Uint8Array | 0/1 — water coverage this tick |
| sewage | Uint8Array | 0/1 — sewage coverage this tick |
| services | Uint8Array | 0/1 — service building coverage this tick |
| landValue | Uint8Array | 0–255 desirability (modulates tax income; smoothed each interval) |
| roadNet | Uint16Array | connected-component ID |
| pollution | Uint8Array | 0–255 pollution level (diffuses, decays) |
| abandoned | Uint8Array | 0=normal, 1=abandoned (no income, no growth, distinct visual) |
| distress | Uint8Array | 0–255 distress accumulator (increments when conditions unmet) |

### Entity Lists on World
- `world.powerPlants: PowerPlant[]` — `{ tx, ty }`
- `world.waterTowers: WaterTower[]` — `{ tx, ty }`
- `world.sewagePlants: SewagePlant[]` — `{ tx, ty }`
- `world.serviceBuildings: ServiceBuilding[]` — `{ tx, ty, kind }` (kind = BUILDING_POLICE/FIRE/SCHOOL/HOSPITAL/PARK)

### Stats on World
- `world.stats`: population, powerSupply, powerDemand, waterSupply, waterDemand, sewageSupply, sewageDemand, servicesCoveredZones, rDemand, cDemand, iDemand, avgLandValue
- `world.budget.taxRates: { R, C, I }` — player-adjustable (0.1–3.0), defaults match BALANCE.tax

### Zone Growth Requirements (layered)
- **Level 0→1**: power coverage + water coverage
- **Level 1→2**: power coverage + water coverage (+ surplus)
- **Level 2→3**: power + water + sewage coverage + services coverage (+ all surpluses)
- **R/C blocked at any level** if `pollution[i] > BALANCE.pollution.growthThreshold` (I zones immune)

### System Execution Order (per tick)
1. NetworkSystem — road connected components
2. PowerSystem — power layer + powerSupply/powerDemand
3. WaterSystem — water layer + waterSupply/waterDemand
4. SewageSystem — sewage layer + sewageSupply/sewageDemand
5. ServiceSystem — services coverage layer (direct radius, no road network)
6. LandValueSystem — land value per tile + demand multipliers (runs every tickInterval)
7. PollutionSystem — pollution diffusion (conserving Laplacian + decay)
8. ZoneGrowthSystem — reads all of the above; growth probability × demand multiplier
9. EconomySystem — taxes × landValue multiplier × taxRates, maintenance, population

### Toolbar Tools & Key Bindings
| Key | Tool | Command |
|-----|------|---------|
| 1 | View (none) | — |
| i | Inspect | TileInfoPanel (hover info) |
| 2 | Road | BuildRoadCommand |
| 3 | Res zone | PaintZoneCommand(ZONE_R) |
| 4 | Com zone | PaintZoneCommand(ZONE_C) |
| 5 | Ind zone | PaintZoneCommand(ZONE_I) |
| 6 | Plant | PlacePowerPlantCommand |
| 7 | Water | PlaceWaterTowerCommand |
| 8 | Sewage | PlaceSewagePlantCommand |
| 9 | Clear | BulldozeCommand |
| 0 | Police | PlaceServiceBuildingCommand(POLICE) |
| q | Fire | PlaceServiceBuildingCommand(FIRE) |
| w | School | PlaceServiceBuildingCommand(SCHOOL) |
| e | Hospital | PlaceServiceBuildingCommand(HOSPITAL) |
| r | Park | PlaceServiceBuildingCommand(PARK) |

---

## Core Architecture Principles

Load-bearing decisions — don't change without good reason.

**Typed-array tile layers:** Each world property is a flat `Uint8Array[width * height]`. Adding a simulation concern = adding a layer. `Grid.idx(tx, ty)` = `ty * width + tx`. Never use arrays-of-objects for tile data.

**ECS-style, not inheritance:** Tiles have component layers; entities (power plants, water towers, sewage plants) are small typed arrays on World. A new concern = a new component + system, not a new class hierarchy.

**Tick-based sim, decoupled from render:** `Scheduler` fires at a fixed rate (2 ticks/sec at 1×). Render runs at display refresh. The sim knows nothing about rendering.

**Systems communicate through world state and EventBus:** Systems write to layers; later systems read them. Cross-system signals go through `EventBus`.

**Command pattern for all mutations:** Every player action is a `Command` with `execute(world)` / `undo(world)`. Commands snapshot tile state to reverse themselves. Never mutate world state directly from input handlers.

**`restoreTile` in Command.ts must be kept in sync** with every new building type — it keeps entity lists (powerPlants, waterTowers, sewagePlants) consistent on undo. When adding a new building type: update `BUILDING_*` constant, add entity list to World, add `placeBuilding` / `clearTile` handling in World, add `restoreTile` handling in Command.ts.

**Seeded deterministic RNG:** Use `mulberry32(seed)` only. Never call `Math.random()` in sim logic.

**Data-driven balance:** All costs, rates, and thresholds live in `balance.ts`. No magic numbers in code.

**Renderer behind an interface:** All world→screen math goes through `Projection`. `Projection.depth()` returns `0` for top-down, `tx+ty` for isometric — this is the isometric swap hook.

**Chunked dirty tracking:** 16×16 tile chunks. Mutations call `grid.markDirty(tx, ty)`.

**TypeScript constraints:** `erasableSyntaxOnly: true` — no constructor parameter properties. Use explicit field declarations + assignment in body. `verbatimModuleSyntax` — use `import type` for type-only imports.

---

## Extensibility Hooks to Preserve

Already in the code — must not be removed:

- `roadClass` byte: `ROAD_STREET=1`, `ROAD_AVENUE=2`, `ROAD_HIGHWAY=3`
- `politicalCapital` on budget: present but unused (Phase 7)
- `character` object (`{egalitarian, green, planned}`) on world: unused (Phase 7)
- Events carry rich context so future systems can react meaningfully
- Road connected-components graph: transit flow solver will run on this same graph
- `Projection.depth()` returns 0 for top-down, ready for isometric

---

## Key Constants

In `city-builder/src/data/balance.ts`:

```
costs:        road=10, zoneR=20, zoneC=25, zoneI=25, powerPlant=2000,
              waterTower=500, sewagePlant=1500, bulldoze=5
              service: police=1200, fire=800, school=1500, hospital=3000, park=300
tax/tick:     zoneR=0.8, zoneC=1.2, zoneI=1.5  (per dev level)
maintenance:  road=0.01, powerPlant=5, waterTower=2, sewagePlant=3  (per tick)
              service: police=3, fire=2, school=4, hospital=6, park=0.5  (per tick)
service:      coverageRange: police=5, fire=5, school=4, hospital=6, park=3  (manhattan tiles)
power:        plantOutput=500, perDevLevel=2, propagationRange=1
water:        towerOutput=300, perDevLevel=1, propagationRange=1
sewage:       plantOutput=400, perDevLevel=2, propagationRange=1
pollution:    industryOutput=30, powerPlantOutput=15, decayRate=0.90,
              diffusionRate=0.12, growthThreshold=40
growth:       tickInterval=4, probability=0.08, maxLevel=3
              popPerLevel: {1:4, 2:10, 3:20}
ticksPerDay:  8, baseTickMs=500, startingMoney=20000
```

Untuned — balance pass needed after more systems land.

---

## Testing

Vitest suite at `city-builder/src/__tests__/`. 154 tests across 7 files. After any code changes, run tests and confirm all pass before declaring done.

```
cd city-builder && npm test
```

---

## Lessons from Previous Sessions

- Don't claim bugs are fixed without running the code. If you can't verify in a browser, say so.
- Lead with "what is the observed state" before theorizing about causes.
- Don't use `else if` chains when checking multiple independent directions (road-access bug precedent).
- Zone colors should be defined as a cohesive palette with contrast checked against terrain colors.
- Pollution diffusion must be **conserving** (Laplacian step subtracts what it spreads) — additive diffusion causes values to grow unboundedly even with decay.
- When a user says zones can develop without a resource, check whether the growth gate uses `dev[i] >= N` as a guard — that means the resource is only required for levels ≥ N, which may not be the intended behaviour.
