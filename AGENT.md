# AGENT.md

This file provides guidance to AI agents when working with code in this repository.

Browser-based 2D top-down city builder (SimCity-style).

**IMPORTANT** 
I'm using a somewhat limited Pro plan so tokens and context length REALLY MATTER! Please ask before importing large resources and please be dilligent before adding too much context!


See the backlog/wishlist at WISHLIST.md

## Target Tech Stack

- TypeScript + Vite
- Vitest for tests
- Canvas 2D renderer (MVP); PixiJS later
- Cloudflare Pages for hosting
- IndexedDB for local saves (manual slots + autosave in slot 0); Cloudflare Workers + R2/D1 for cloud saves (future phases)
- Save files: the Save dialog exports the current city as a `.citysave.json` file and the Load dialog imports one (`src/persistence/SaveFile.ts`: JSON, layers as base64, upgraded through `migrate`). IndexedDB saves are tied to one site address (including the port), so a file is the way to move a city between ports, browsers or machines, or to hand one to an agent for testing
---

## Module Structure

The repo root is the project (`package.json`, `index.html`, `src/`).

```
src/
  sim/
    World.ts, Grid.ts, Scheduler.ts, EventBus.ts, rng.ts, constants.ts
    systems/
      NetworkSystem, PowerSystem, WaterSystem, SewageSystem, ServiceSystem,
      LandValueSystem, PollutionSystem, CrimeSystem, FireSystem, TransitSystem,
      AbandonmentSystem, EducationSystem, HealthcareSystem, ZoneGrowthSystem,
      EconomySystem, VibeSystem, PoliticsSystem
  render/
    CanvasRenderer.ts  (the frame: order of the passes, and the per-frame passes themselves),
    ChunkCache.ts      (WHEN a chunk of the static layer is redrawn: signatures, zoom smoothing, per-frame budgets),
    chunkPainter.ts    (WHAT the static layer looks like: `paintChunk`, and `chunkSignature` beside it),
    flatTiles.ts       (the flat rectangles look used in the static layer), drawnRoads.ts (road neighbour lookups),
    RebakeBudget.ts    (zoom smoothing shared by sprites, trees and cars),
    Camera.ts, Projection.ts, SpriteTypes.ts, CharacterPalette.ts
    clay/              ClaySprites.ts (image building sprites, baked lot-dressing variants, smoke/flare effects),
                       claySpriteData.ts (generated), groundTones.ts (ground mask + tones),
                       lotGround.ts (free-ground analysis), lotDressing.ts (landscaping planner, no DOM),
                       lotDressingDraw.ts (paints a plan); see SPRITE_GUIDE.md there
  input/
    InputController.ts (pointer/touch, drag-to-paint, panning), dragPath.ts
  commands/
    Command.ts (snapshotTile / restoreTile / tileDisruption), CommandHistory.ts,
    BatchCommand.ts, PaintZoneCommand.ts, BuildRoadCommand.ts, BulldozeCommand.ts,
    PlaceBuildingCommand.ts + PlacePowerPlant/WaterTower/SewagePlant/ServiceBuilding
  persistence/
    SaveFormat.ts, Serializer.ts, LocalStore.ts, RemoteStore.ts, SaveManager.ts,
    Autosave.ts
  ui/
    NewGameDialog, SaveLoadPanel, TileInfoPanel, EconPanel, ToastPanel,
    DemandChart, MusicPanel
  audio/               MusicManager.ts, compose.ts, tracks/, variants/, sketches/
  i18n/                index.ts, types.ts, locales/en.ts
  data/
    balance.ts
  __tests__/
  main.ts              wiring: systems, panels, toolbar, shortcuts, autosave
index.html
```

---

## Architecture Overview

### Data flow

```
Player input
    │
    ▼
Command (execute/undo) ──► World (mutates layers + buildings[])
                                │
                                ▼
                          Scheduler._tick()
                                │
                          ┌─────▼──────────────────────────────────┐
                          │  Systems run in order, each tick        │
                          │  (read world state, write world state)  │
                          └─────┬──────────────────────────────────-┘
                                │
                          world.events.emit(...)  ← alert-worthy moments
                                │
                          UI / future subscribers
```

### World — the central store

`World` (`src/sim/World.ts`) owns everything the sim reads and writes:

| Property | Type | Description |
|---|---|---|
| `world.grid` | `Grid` | Width/height, bounds check, `idx(tx,ty)` |
| `world.tick` | `number` | Monotonically incrementing tick counter |
| `world.rng` | `() => number` | Seeded deterministic RNG (`mulberry32`) |
| `world.layers` | `Layers` | All typed-array tile data (see table below) |
| `world.buildings` | `BuildingEntity[]` | All placed buildings `{ tx, ty, kind }` |
| `world.stats` | `Stats` | Aggregates: population, supply/demand, satisfaction, etc. |
| `world.budget` | `Budget` | `money`, `politicalCapital`, `income`, `expenses`, `taxRates` |
| `world.politics` | `Politics` | `peakPopulation` (highest population credited, for one-off milestones), `regen` (PC change from regeneration last tick, signed; for the HUD). Saved. |
| `world.character` | `{ egalitarian, green, planned }` | City-wide character axes; derived by VibeSystem from the average of the vibe layers |
| `world.events` | `EventBus` | Pub/sub for cross-system signals and UI alerts |
| `world.roadNetDirty` | `boolean` | Set to `true` when road topology changes; NetworkSystem clears it |

**World mutator API** — always use these; never write layers directly from commands or input:

| Method | Description |
|---|---|
| `world.setZone(tx, ty, z)` | Paint a zone; resets devLevel/abandoned/distress/vegetation |
| `world.setRoad(tx, ty, r)` | Place/upgrade/remove road; sets `roadNetDirty`; resets abandoned/distress |
| `world.placeBuilding(tx, ty, kind)` | Place any building; pushes to `world.buildings[]`; resets abandoned/distress; sets `roadNetDirty` if it replaces a road |
| `world.clearTile(tx, ty)` | Bulldoze everything; removes from `world.buildings[]` |
| `world.isBuildable(tx, ty, allowWater = false)` | Returns false for water tiles or tiles occupied by a building. Roads pass `allowWater` to build bridges (cost × `BALANCE.costs.bridgeMultiplier`) |

### Grid

`Grid` (`src/sim/Grid.ts`): flat-array helpers.

```ts
grid.idx(tx, ty)        // → ty * width + tx
grid.inBounds(tx, ty)   // → boolean
grid.markDirty(tx, ty)  // → chunk dirty tracking
grid.markAllDirty()
```

### WorldIndex — never loop over the whole map

A map can be 512×512 with a city on 2% of it. **Systems must not scan every tile every tick** (that cost 100 ms per tick on such a map before it was fixed). `world.index` (`src/sim/WorldIndex.ts`) gives:

```ts
const { roads, roadCount, zoned, zonedCount } = world.index;   // Int32Array tile indices, in map order
const area = world.index.area(world, pad);   // rectangle that has EVER been built on (+pad), never shrinks
```

- Per-tile work on zones or roads: loop the lists. They are in ascending tile order, so `world.rng()` rolls happen in the same order as a whole-map loop would make them.
- State that only exists on or near built tiles (crime, distress, coverage…): loop `area` row by row. It never shrinks, so a demolished district still winds down.
- Fields that diffuse beyond the city (pollution, vibes): find where they are live with `FieldBounds.scan()` (`src/sim/FieldBounds.ts`), then work on that rectangle grown by one tile.
- Whole-layer `.fill()` is fine (native and fast); whole-layer JS loops are not.
- The Scheduler builds the index once per tick and pins it; outside a tick (tests, tools) every access rebuilds it, so it is never stale. Nothing may add a road, zone or building in the middle of a tick.
- `worldIndex.test.ts` checks pollution against a plain whole-map reference and the land-value average against a full sum; add the same kind of check when converting or adding a spreading system.

### Scheduler

`Scheduler` (`src/sim/Scheduler.ts`) drives the sim loop:
- `update(now)` called each animation frame; accumulates `dt * speed`, with `dt` clamped to `MAX_FRAME_GAP_MS` (250 ms) so time spent in a hidden tab is not simulated (unclamped, it queued minutes of ticks and stalled the game on return)
- Fires `_tick()` per accumulated interval (caps at 10 catch-up ticks)
- Each `_tick()`: increments `world.tick`, then calls `sys.update(world)` for every system in order
- Speed: 0 = paused, 1/2/3 = 1×/2×/3× (`baseTickMs = 500ms → 2 ticks/sec at 1×`)
- `ticksPerDay = 8`, so 1 game-day = 4 real seconds at 1×

### Systems

All systems implement `System { update(world: World): void }`. They are **pure functions over world state** — no dependencies injected, no globals. The only exception is per-system alert-cooldown state (e.g. `private _inShortage`, `private _lastAlertTick`) which is intentional instance state.

Because of that instance state, `createSystems()` in `main.ts` builds a **fresh set of systems for every `startGame`** (New Game and Load). Don't hold system singletons at module level.

#### System execution order (per tick)

The source of truth is `createSystems()` in `src/main.ts`.

| # | System | Writes |
|---|---|---|
| 1 | NetworkSystem | `roadNet[]` connected-component IDs |
| 2 | PowerSystem | `power[]`, `stats.powerSupply/Demand` |
| 3 | WaterSystem | `water[]`, `stats.waterSupply/Demand` |
| 4 | SewageSystem | `sewage[]`, `stats.sewageSupply/Demand` |
| 5 | ServiceSystem | `services[]`, `police[]`, `fireStation[]`, `school[]`, `hospital[]` |
| 6 | LandValueSystem | `landValue[]`, `stats.rDemand/cDemand/iDemand`, `stats.avgLandValue` |
| 7 | PollutionSystem | `pollution[]` (conserving Laplacian + decay) |
| 8 | CrimeSystem | `crime[]` |
| 9 | FireSystem | `fireRisk[]`, `fire[]` |
| 10 | TransitSystem | `congestion[]`, `accessibility[]`, `stats.avgCongestion` |
| 11 | AbandonmentSystem | `abandoned[]`, `distress[]` |
| 12 | EducationSystem | `education[]` (persistent, R zones only) |
| 13 | HealthcareSystem | `sickness[]`, `recentDeath[]` |
| 14 | ZoneGrowthSystem | `devLevel[]`, `stats.population` |
| 15 | EconomySystem | `budget.money/income/expenses` |
| 16 | VibeSystem | `vibeEgalitarian[]`, `vibeGreen[]`, `vibePlanned[]`, `world.character` |
| 17 | PoliticsSystem | `budget.politicalCapital`, `stats.satisfaction` |

---

## Tile Layers (`world.layers`)

All layers are flat typed arrays of length `width * height`. Index with `grid.idx(tx, ty)`.

| Layer | Type | Values / Notes |
|---|---|---|
| terrain | Uint8Array | 0=grass, 1=water, 2=sand |
| zone | Uint8Array | 0=none, 1=R, 2=C, 3=I |
| roadClass | Uint8Array | 0=none, 1=street, 2=avenue, 3=highway |
| building | Uint8Array | 0=none, 1=power plant, 2=water tower, 3=sewage plant, 4–8=service |
| vegetation | Uint8Array | 0=none, 1–6=tree species |
| devLevel | Uint8Array | 0–3 development level |
| power | Uint8Array | 0/1 — powered this tick |
| water | Uint8Array | 0/1 — water coverage this tick |
| sewage | Uint8Array | 0/1 — sewage coverage this tick |
| services | Uint8Array | 0/1 — service building coverage this tick |
| landValue | Uint8Array | 0–255 desirability (modulates tax income; smoothed each interval) |
| roadNet | Uint16Array | connected-component ID |
| pollution | Uint8Array | 0–255 pollution level (diffuses, decays) |
| crime | Uint8Array | 0–255 crime level |
| police | Uint8Array | 0/1 — police coverage this tick |
| congestion | Uint8Array | 0–255 road traffic congestion (TransitSystem) |
| accessibility | Uint8Array | 0–255 from travel time to the nearest complementary zone: 255 = next door, 0 = `transit.commuteMax` or unreachable (TransitSystem) |
| abandoned | Uint8Array | 0=normal, 1=abandoned (no income, no growth) |
| distress | Uint8Array | 0–255 distress accumulator |
| fireRisk | Uint8Array | 0–255 fire risk level |
| fire | Uint8Array | 0–255 fire intensity / ticks remaining |
| fireStation | Uint8Array | 0/1 — fire station coverage this tick |
| school | Uint8Array | 0/1 — school coverage this tick |
| education | Uint8Array | 0–255 persistent education level (R zones only) |
| hospital | Uint8Array | 0/1 — hospital coverage this tick |
| sickness | Uint8Array | 0–255 persistent sickness level (R zones only) |
| recentDeath | Uint8Array | 0–255 countdown after a death event (visual indicator) |
| visualVariant | Uint8Array | 0–255 stable lot ID; picks the sprite variant for a tile |
| vibeEgalitarian | Uint8Array | 0–255, 128 = neutral (VibeSystem; nudged by player actions, diffuses, decays to 128) |
| vibeGreen | Uint8Array | 0–255, 128 = neutral |
| vibePlanned | Uint8Array | 0–255, 128 = neutral |

`terrain` water tiles can carry a road (a bridge).

---

## Entities (`world.buildings`)

All placed buildings are in a single unified list:

```ts
world.buildings: BuildingEntity[]   // { tx: number, ty: number, kind: number }
```

`kind` maps to `BUILDING_*` constants (defined in `constants.ts`):

| Constant | Value | Description |
|---|---|---|
| BUILDING_POWER_PLANT | 1 | Power plant |
| BUILDING_WATER_TOWER | 2 | Water tower |
| BUILDING_SEWAGE_PLANT | 3 | Sewage treatment plant |
| BUILDING_POLICE | 4 | Police station |
| BUILDING_FIRE | 5 | Fire station |
| BUILDING_SCHOOL | 6 | School |
| BUILDING_HOSPITAL | 7 | Hospital |
| BUILDING_PARK | 8 | Park |

Systems filter by `kind`: `for (const b of world.buildings) { if (b.kind !== BUILDING_X) continue; ... }`

---

## Stats on World

```ts
world.stats: {
  population,
  powerSupply, powerDemand,
  waterSupply, waterDemand,
  sewageSupply, sewageDemand,
  servicesCoveredZones,
  rDemand, cDemand, iDemand,   // 0.25–2.0 growth probability multipliers
  avgLandValue,                  // 0–255 average across all tiles
  avgCongestion,                 // 0–255 average road congestion
  satisfaction,                  // 0–1 weighted citizen satisfaction
}
```

---

## EventBus — alert-worthy events

`world.events` is an `EventBus`. Systems emit events; `ToastPanel` subscribes (re-bound to the new world on every `startGame`).

The authoritative type catalog is `CityEvents` in `src/sim/EventBus.ts`. Every alert-worth event is listed there with its required payload fields.

| Event | Emitter | Key payload fields |
|---|---|---|
| `powerShortage` | PowerSystem | `supply, demand, deficit` |
| `powerRestored` | PowerSystem | `supply, demand` |
| `waterShortage` | WaterSystem | `supply, demand, deficit` |
| `waterRestored` | WaterSystem | `supply, demand` |
| `sewageShortage` | SewageSystem | `supply, demand, deficit` |
| `sewageRestored` | SewageSystem | `supply, demand` |
| `crimeSpike` | CrimeSystem | `avgCrime, threshold, affectedTiles` (cooldown-throttled) |
| `fireIgnition` | FireSystem | `tx, ty, zone, devLevel` |
| `fireSpreading` | FireSystem | `tx, ty` |
| `fireDamage` | FireSystem | `tx, ty, zone, level` (level after the fire) |
| `budgetWarning` | EconomySystem | `money, daysLeft` (cooldown-throttled) |
| `debtEntered` / `debtCleared` | EconomySystem | `money` (once on each transition) |
| `tileAbandoned` | AbandonmentSystem | `tx, ty, zone, level` |
| `tileDeveloped` | ZoneGrowthSystem | `tx, ty, zone, level` |
| `deathEvent` | HealthcareSystem | `tx, ty` |
| `healthcareCrisis` | HealthcareSystem | `avgSickness, threshold, affectedTiles` (cooldown-throttled) |

Usage:
```ts
world.events.on('powerShortage', payload => { /* payload.supply, payload.demand, ... */ });
world.events.emit('myEvent', { tx, ty, ... }); // from a system
```

---

## Zone Growth Requirements (layered)

- **Level 0→1**: power coverage + water coverage
- **Level 1→2**: power coverage + water coverage (+ surplus)
- **Level 2→3**: power + water + sewage coverage + services coverage (+ all surpluses) + education level (R zones only)
- **R/C blocked at any level** if `pollution[i] > BALANCE.pollution.growthThreshold` (I zones immune)
- **R blocked at any level** if `sickness[i] > BALANCE.healthcare.growthThreshold`

---

## Toolbar Tools & Key Bindings

| Key | Tool | Command |
|-----|------|---------|
| 1 | View (none) | — |
| i | Inspect | TileInfoPanel (hover info) |
| 2 | Road (street) | BuildRoadCommand |
| a | Avenue | BuildRoadCommand |
| h | Highway | BuildRoadCommand |
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

Other keys: `t` / `c` / `f` / `v` toggle the traffic / crime / fire / vibe overlay (only one overlay at a time); Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z or Ctrl+Y redo; Space pause/resume. Shortcuts are ignored while typing in an input, and other Ctrl/Cmd/Alt combos are left to the browser.

### Pointer input

- **Drag to paint:** roads drag as an axis-locked straight line; zones and bulldoze paint every tile crossed (`dragPath.ts`). Buildings are tap-only.
- **One stroke = one undo step:** a drag is wrapped in a `CommandHistory` batch (`BatchCommand`).
- **Panning:** left-drag with the View, Inspect or any building tool; right/middle drag or two-finger drag with any tool (including paint tools).

### Command rules (enforced in the commands, covered by `commands.test.ts`)

- Repainting a tile with the zone it already has is refused, free of charge. Exception: on an abandoned tile it clears the lot and pays the blight-clearing PC reward once.
- The zone tool refuses to paint over a road.
- Money below zero blocks everything that costs money **except bulldozing** (demolition is how a broke city cuts upkeep).
- A command refused for lack of money or political capital sets `cmd.failReason` (`'funds'` / `'politicalCapital'`); `InputController` passes it to `main.ts`, which shows a throttled toast.
- Anything that displaces residents (bulldoze, rezone, building or road over a zone) costs political capital via `tileDisruption()` and is blocked if unaffordable. Undo reverses the net PC change.
- PC prices come from `pcQuote(world, action)` / `pcQuoteMany(world, actions)` in `src/sim/politics.ts` (pure; `{ cost, reward, affordable, displacedPopulation, parts[] }`, each part naming the tile responsible, its signed amount and a 0–1 strength). Commands charge exactly their quote (`chargeQuote` / `refundCharges`), so a preview built on the quote cannot disagree with a click. `nuisanceRings(source)` gives the fall-off rings the nuisance cost uses. `planAutoRoad` and `planZoneFill` carry a `pc` quote.
- Service buildings earn PC when opened and cost PC when closed (`src/sim/serviceValue.ts`, values under `BALANCE.politicalCapital.service`, all 0 for now): per resident covered, less for each further building of the same kind covering them, closure × `closureMultiplier`. A closure is never refused: it takes what PC there is, and the quote's `shortfall` says how much went unpaid. Coverage of standing buildings is remembered until `world.grid.edits` changes, so change roads and buildings through `World` methods (they mark the tile dirty), not by writing the layers.
- Never write `world.budget.politicalCapital` directly. `src/sim/politics.ts` is the one write point: `changePc(world, delta, reason, { tx, ty, undo })` for a cost or reward (emits `pcChanged`), `regenPc` for the per-tick change (`regenRate(satisfaction)` gives the amount: negative below `neutralSatisfaction` once that is switched on; a loss drains PC down to 0), `pcCap(world)` for the cap (a base plus `capPerResident` × population, 0 for now). Regeneration and the blight-clearing reward stop at the cap; PC over the cap is never taken away. `changePc` returns what it actually applied, which is what undo must reverse. `CommandHistory` adds the per-command `pcChanged` events up into one `pcAction` per finished player action (a click, a whole drag / auto road / zone fill, an undo or redo step; nothing for a batch that was refused and taken back): UI that shows one number per action listens to `pcAction`.

---

## Core Architecture Principles

Load-bearing decisions — don't change without good reason.

**Typed-array tile layers:** Each world property is a flat `Uint8Array[width * height]`. Adding a simulation concern = adding a layer. `Grid.idx(tx, ty)` = `ty * width + tx`. Never use arrays-of-objects for tile data.

**ECS-style, not inheritance:** Tiles have component layers; entities (buildings) are small objects in `world.buildings[]`. A new concern = a new component + system, not a new class hierarchy.

**Tick-based sim, decoupled from render:** `Scheduler` fires at a fixed rate (2 ticks/sec at 1×). Render runs at display refresh. The sim knows nothing about rendering.

**Systems communicate through world state and EventBus:** Systems write to layers; later systems read them. Cross-system signals go through `EventBus`.

**Command pattern for all mutations:** Every player action is a `Command` with `execute(world)` / `undo(world)`. Commands snapshot tile state to reverse themselves. Never mutate world state directly from input handlers.

**`restoreTile` in Command.ts must be kept in sync** with every new building type — it keeps `world.buildings[]` consistent on undo. When adding a new building type: update `BUILDING_*` constant, add `placeBuilding` / `clearTile` handling in World, add `restoreTile` handling in Command.ts.

**`snapshotTile` / `restoreTile` must cover every player-visible persistent layer.** They currently include abandoned, distress, vegetation and visualVariant as well as zone/road/building/devLevel. A layer missing from the snapshot becomes an undo exploit (precedent: bulldoze + undo revived abandoned buildings for free).

**Seeded deterministic RNG:** Use `mulberry32(seed)` only. Never call `Math.random()` in sim logic.

**Data-driven balance:** All costs, rates, and thresholds live in `balance.ts`. No magic numbers in code.

**Renderer behind an interface:** All world→screen math goes through `Projection`. `Projection.depth()` returns `0` for top-down, `tx+ty` for isometric — this is the isometric swap hook.

**Traffic is flow-based, not agent-based** (`TransitSystem`, tests in `transit.test.ts`). No trips or routes are simulated. Traffic is a list of MARKETS (`MARKET_DEFS` in `src/sim/TrafficData.ts`): shopping (homes → commerce), jobs (homes → industry) and goods (commerce → industry: each shop fetches from the nearest industry with output to spare). Each market has its own map, door capacities, prices and road volumes, and `TransitSystem`, `TrafficOverlay` and the debug tools all loop over the list — **to add or change a kind of trip, edit `MARKET_DEFS` (and its rate/capacity keys in `BALANCE.transit`), not the pass.** Per iteration and per market: (1) a Dijkstra flood gives each road tile its travel time to the nearest "door" (road tile beside a developed destination zone), a tile costing `1 / speedMult`, more when loaded past `freeFlow` (`congestionDelay`); (2) each origin's trips are put on its best adjacent road and swept downhill, each tile handing its traffic to ALL nearer neighbours, weighted by how little of a detour each is (`ROUTE_SPREAD`) — traffic ends at the first door it reaches; (3) a door that got more than its capacity (zone levels × `shopCapacity`/`jobCapacity`/`goodsCapacity`) spills the excess to doors with room within `SPILL_RADIUS` road tiles, and what still does not fit stays there as over capacity. Congestion = total volume / class capacity; accessibility comes from travel time (homes: nearer of shops or jobs; commerce and industry: homes). Highways carry traffic but give zones no access (same rule as growth). **Stability matters more than cleverness here.** Steps 2 and 3 have no feedback on purpose; an earlier version balanced door loads with iterated "prices" and never settled in a dense city (one new road tile reshuffled hundreds of roads for a minute). The only feedback is congestion → travel time → routes, kept calm by the multi-neighbour split, eased cost changes (`COST_EASE`) and per-tile averaging of volumes that keep changing (`_merge`). If you add a mechanism that feeds back into routing, re-run a stability check like the 'one new road tile in a congested town' test. A pass is a few iterations (more on the first pass, after a road edit and from `recompute()`); `world.traffic.settled` says when it has stopped moving. `main.ts` calls `refreshIfRoadsChanged()` every frame so road edits show at once, also while paused. The vehicles in `VehicleLayer` are cosmetic. The last pass is published as `world.traffic` (`src/sim/TrafficData.ts`: travel-time maps and per-flow volumes, not saved). `src/render/TrafficOverlay.ts` draws the traffic overlay from it as its own layer after `renderer.render()` (road load past 100%, commute tint on zones, route trace on hover); `CanvasRenderer` has no traffic overlay of its own any more. With `?debug=true` (`src/debug.ts`) the tile inspector adds traffic numbers and `TrafficTuningPanel` shows sliders that edit `BALANCE` live and call `TransitSystem.recompute()`.

**Chunked dirty tracking:** 16×16 tile chunks. Mutations call `grid.markDirty(tx, ty)`. A dirty mark means "check this chunk", not "redraw it": `ChunkCache` compares a per-chunk content signature and redraws the cached chunk canvas only if it changed. The signature (`chunkSignature`) sits next to the drawing (`paintChunk`) in `src/render/chunkPainter.ts`. **If `paintChunk` starts reading a new layer, mix that layer into `chunkSignature` too**, or the chunk will not update when it changes; `chunkPainter.test.ts` fails if one is missing. Reduce the value to what is actually drawn (a threshold, a bucket), so sim noise does not cause redraws. Per-frame art (clay sprites, overlays, fire, cars, badges) is not cached and is unaffected.

**The renderer's call:** `renderer.render(world, camera, { hoverTile, tool, overlay, coveragePreview, now })`; every option is optional. Anything cached at a tile size (a baked sprite, a tree clump, a car) uses a `RebakeBudget` so it is drawn stretched while the zoom moves and re-made a few per frame once it stops; do the same for any new cache, or zooming will stutter again. After a change to drawing code that is not meant to change the look, `npm run bench` before and after: the `picture` values must be identical.

**TypeScript constraints:** `erasableSyntaxOnly: true` — no constructor parameter properties. Use explicit field declarations + assignment in body. `verbatimModuleSyntax` — use `import type` for type-only imports.

---

## How to Add…

### A new tile layer

1. Add `myLayer: Uint8Array` to the `Layers` interface in `World.ts`
2. Initialize `myLayer: new Uint8Array(n)` in the World constructor
3. Create a system that reads/writes it
4. Register the system in `createSystems()` in `main.ts` (in the correct order relative to its dependencies)
5. Update `SaveFormat.ts` / `Serializer.ts` to persist it (make it optional in `WorldSnapshot.layers` so old saves still load)
6. If the player can change it or see it, add it to `snapshotTile` / `restoreTile`

### A new building type

1. Add `BUILDING_MYTYPE = N` constant in `constants.ts` (next unused integer)
2. Add `{ cost: X, maintenance: Y }` to `BALANCE.buildings[N]` in `balance.ts`
3. Update `restoreTile` in `Command.ts` to handle the new kind on undo
4. Add a `PlaceBuildingCommand` variant or reuse `PlaceBuildingCommand` with the new constant
5. Add coverage range to `BALANCE.service.coverageRange` if it's a service building
6. Update `ServiceSystem` if it needs coverage logic
7. Add a key binding in `main.ts` (keydown switch), a toolbar entry in `index.html`, and strings in `i18n/locales/en.ts`. Tooltip cost/upkeep is read from `BALANCE`; don't hardcode numbers in HTML or locale text

### A new system

1. Create `src/sim/systems/MySystem.ts` implementing `System { update(world: World): void }`
2. Only read layers that are already written by earlier systems (see execution order table above)
   - Loop over `world.index` lists or `area`, never over every tile (see *WorldIndex* above)
3. If it emits alert events, add the event + payload type to `CityEvents` in `EventBus.ts`
4. If it needs cooldown state, add `private _lastAlertTick = -Infinity` as an instance field
5. Add balance constants to `balance.ts` — no magic numbers in the system
6. Register in `createSystems()` in `main.ts` at the correct position
7. Write tests in `src/__tests__/systems.test.ts` or a new file

### A new EventBus alert

1. Add the event name + payload shape to `CityEvents` in `EventBus.ts`
2. Emit from the relevant system: `world.events.emit('myEvent', { tx, ty, ... })`
3. Use a cooldown (`private _lastAlertTick`) to prevent spam for aggregate/recurring conditions
4. Write a test in `eventbus.test.ts` verifying payload fields and cooldown behavior

### A new music track

Tracks are code: `MusicManager` plays a `Track` (see `audio/types.ts`) with WebAudio oscillators, no audio files.
1. Write it with the helpers in `audio/compose.ts` (header explains the mini-notation): independent voices with their own rhythms, compiled to the step-locked `Track` format. Voice 0 is the lead; timbre comes from `genre` + voice index. There are no drums, so bass lines should land on the downbeat.
2. Drafts under review go in `audio/variants/<song-slug>/vN.ts` (exporting `meta` and `track`); short melody demos in `audio/sketches/`. `node scripts/build-music-review.mjs <out.html>` builds a listening page from them, and `node scripts/music-stats.mjs` prints length and loudness (keep `peakVelSum` under ~2.5–3.5).
3. Once approved, move the file into `audio/tracks/`, fix its `compose.ts` import path, and name takes of an existing song `"Song · Take"`. `shufflePlaylist` shuffles the playlist (a fresh order every pass, first track included) and keeps takes of one song from playing back to back. Cut takes live in `audio/variants/_dropped/`, outside the tests.
4. `musicVariants.test.ts` checks every take runs about three minutes and compiles cleanly.

---

## Extensibility Hooks to Preserve

Already in the code — must not be removed:

- `roadClass` byte: `ROAD_STREET=1`, `ROAD_AVENUE=2`, `ROAD_HIGHWAY=3`
- `politicalCapital` on budget: live — regenerated by PoliticsSystem, spent by disruptive commands
- `character` object (`{egalitarian, green, planned}`) on world: live — written by VibeSystem, read by the renderer palette
- Events carry rich context so future systems can react meaningfully
- Road connected-components graph: transit flow solver will run on this same graph
- `Projection.depth()` returns 0 for top-down, ready for isometric

---

## Key Constants

`src/data/balance.ts` is the source of truth — read it rather than trusting this snapshot (last synced 2026-11-13):

```
costs:        road=10 (bridge ×3), zoneR=20, zoneC=25, zoneI=25, bulldoze=5
roadClasses:  street={cost:10,maint:0.04}, avenue={50,0.12}, highway={150,0.35}
              capacity 20/80/200, speedMult 1.0/1.4/2.0 (both used by TransitSystem)
transit:      flowInterval=8, tripsRtoC=0.33, tripsRtoI=0.34, tripsCtoI=0.38 (per origin dev level),
              shopCapacity=2, jobCapacity=2, goodsCapacity=2 (trips per destination level), freeFlow=0.5, congestionDelay=1,
              commuteMax=48 street tiles, congestionGrowthPenalty=0.75, accessFloor=0.05
buildings:    powerPlant={cost:2000,maint:15}, waterTower={500,6}, sewagePlant={1500,10}
              police={1200,12}, fire={800,10}, school={1500,15}, hospital={3000,25}, park={300,4}
tax/tick:     zoneR=0.65, zoneC=1.0, zoneI=1.25  (per dev level)
              R/C scale by landValue/128; I uses fixed industryLandValueMult=0.6
service:      coverageRange: police=12, fire=15, school=4, hospital=6, park=3  (manhattan tiles)
power:        plantOutput=350, perDevLevel=2, propagationRange=1
water:        towerOutput=250, perDevLevel=1, propagationRange=1
sewage:       plantOutput=300, perDevLevel=2, propagationRange=1
pollution:    industryOutput=40, powerPlantOutput=30, decayRate=0.97,
              diffusionRate=0.20, growthThreshold=20
crime:        growthThreshold=100, distressThreshold=130, abandonThreshold=150,
              alertThreshold=60, alertCooldownTicks=40
fire:         baseProbability=0.00015, burnDuration=20, spreadProbability=0.04,
              abandonThreshold=110, damageLevels=1
healthcare:   crisisThreshold=100, crisisCooldownTicks=40, growthThreshold=180
growth:       tickInterval=4, probability=0.08, maxLevel=3
              popPerLevel: {1:4, 2:10, 3:20}
vibe:         simInterval=4, nudgeByteScale=25, nudgeMaxBytes=60, decayProbability=0.25
budget:       lowFundsWarningDays=30, warningCooldownTicks=240
abandonment:  distressInterval=4, abandonThreshold=20
politics:     max PC=100, bulldozePerPop=3.5, abandonedBuildingReward=2.5
ticksPerDay:  8, baseTickMs=500, startingMoney=20000, startingPoliticalCapital=100
```

How the stakes work:

- **Debt:** below $0 only bulldozing is allowed. EconomySystem warns ~30 game-days ahead and on entering/leaving debt; the HUD shows a debt badge.
- **Fire:** a fire that burns out on a tile with no fire station coverage drops the building one level (level 1 becomes an empty lot). Covered tiles are put out before they take damage.
- **Crime:** peak unpoliced crime is ~56 per level for commercial, ~28 residential, ~20 industrial. Commercial L2 (112) is stable; commercial L3 (168) passes `abandonThreshold` and abandons, so it needs police.
- **Fire risk:** only heavily polluted L3 industry without a fire station reaches `fire.abandonThreshold`.

Known balance gaps:

- The economy is generous: test cities bank $350k+ by day 500, so debt is rare once a city is established.
- With police and fire coverage nothing abandons except through lost power, water or road access.

---

## Testing

Vitest suite at `src/__tests__/`. After any code changes, run both and confirm they pass before declaring done:

```
npm test            # vitest run
npm run typecheck   # tsc --noEmit; `npm run build` = tsc && vite build
```

The typecheck has `noUnusedLocals` / `noUnusedParameters` on, so an unused import or variable breaks the build even though tests pass.

The same three checks (typecheck, tests, production build) run on GitHub for every pull request and for `main` (`.github/workflows/ci.yml`). Don't merge a PR whose check is red.

### The "nothing changed" test

`goldenCity.test.ts` runs the whole simulation (every system, via `createSystems()`) on the test city for 400 ticks and compares a fingerprint — a hash of every tile layer and of the traffic volumes, plus stats and budget — with the stored one in `__snapshots__/goldenCity.test.ts.snap`.

- A speed-up or refactor of the simulation must leave it passing untouched. That is the proof it behaves the same.
- If you changed behaviour on purpose (a balance value, a new rule, a new layer, a different system order), it will fail and show which layers moved. Check that matches what you meant, then run `npx vitest run goldenCity -u` and commit the new snapshot with the change. Say in the PR that the simulation result changed.
- Rendering, UI and audio changes cannot affect it.

### Measuring speed

```
npm run bench                                  # built-in test city
npm run bench -- path/to/city.citysave.json    # a city exported from the game (Save/Load → Export)
```

Prints the time of a sim tick (in Node and in Chrome, with the cost of each system) and of drawing a frame in headless Chrome (standing still, panning, zooming, at three zoom levels), plus a `picture` fingerprint of the pixels drawn in each view and with each overlay, the hover outline, the inspect routes and a coverage preview. Options: `--json`, `--no-browser`; Chrome is found automatically or taken from `$CHROME`.

- Run it before and after any change meant to affect speed, or that adds per-tick or per-frame work, and put both sets of numbers in the PR. Compare runs on the same machine only.
- The `picture` values are the same on every run of the same code on the same city. Use them to prove a rendering refactor changed no pixels; if you meant to change the look, they will differ and that is fine.
- The frame times are drawn on the CPU so that they repeat from run to run (within about 10%); they are not what a player's GPU does, so compare them with each other, not with 16.7 ms.
- A big exported city tells you more than the built-in one. The code is in `src/bench/` and `scripts/bench.mjs`; it is not part of the game build.
- CI runs the Node part on the built-in city for every PR and puts the numbers in the job summary. It fails only on a large slowdown (limits in `scripts/bench-check.mjs`), so measure smaller changes yourself.

Test files:
- `systems.test.ts` — per-system behavior (large; add new system tests here or in a new file)
- `abandonment`, `crime`, `fire`, `education`, `vibes` — one file per system
- `eventbus.test.ts` — EventBus alert events: emission, payload shape, cooldown deduplication
- `commands.test.ts` — command execute/undo, restoreTile correctness, PC costs, exploit regressions
- `stakes.test.ts` — debt events and blocking, fire damage, reachable abandonment thresholds, refusal reasons
- `history-batch.test.ts` — batched strokes, undo/redo
- `dragPath.test.ts`, `input-drag.test.ts` — drag-to-paint paths and synthetic pointer events
- `saveFile.test.ts` — export / import of save files, bad-file rejection
- `chunkCache.test.ts`, `chunkPainter.test.ts`, `rebakeBudget.test.ts` — the static layer is redrawn only when its picture changes; the signature covers every layer the painter reads; zoom smoothing
- `transit.test.ts`, `trafficCity.test.ts` — traffic model on small hand-built maps, and stability on a 6,500-person test city (`fixtures/testCity.ts`)
- `goldenCity.test.ts` — the whole simulation on the test city against a stored fingerprint (see below)
- `persistence.test.ts`, `autosave.test.ts`, `newgame.test.ts` — save/load round-trip (pins `SAVE_VERSION` = 9), autosave, new game
- `World`, `Grid`, `rng`, `Vegetation`, `graphics`, `i18n`, `audio`, `ToastPanel`

Not covered by tests: anything wired in `main.ts` (toolbar, shortcuts, overlays, autosave resume on startup) and real IndexedDB. Check those in a browser.

---

## Lessons from Previous Sessions

- Don't claim bugs are fixed without running the code. If you can't verify in a browser, say so.
- Lead with "what is the observed state" before theorizing about causes.
- Don't use `else if` chains when checking multiple independent directions (road-access bug precedent).
- Zone colors should be defined as a cohesive palette with contrast checked against terrain colors.
- Pollution diffusion must be **conserving** (Laplacian step subtracts what it spreads) — additive diffusion causes values to grow unboundedly even with decay.
- When a user says zones can develop without a resource, check whether the growth gate uses `dev[i] >= N` as a guard — that means the resource is only required for levels ≥ N, which may not be the intended behaviour.
- **Typed-array accumulation rates must be ≥ 1**, or `Math.floor` truncates them to 0 every tick (sickness bug: `sicknessRate: 0.08` → never accumulated). Prefer integer ±1 increments gated by a probability roll (`if (rng() < prob) layer[i]++`) over fractional additive rates. This also makes accumulation feel organic rather than mechanical — each zone's trajectory diverges. Apply this pattern to any new `Uint8Array` accumulator (sickness, education, etc.).

---

## Multiple sessions / worktrees

More than one agent session may be working in this repo at once.

- **One worktree and branch per session.** Don't share a working tree: use a git worktree (in Claude Code, the `EnterWorktree` tool; otherwise `git worktree add ../city-builder-<topic> -b <topic> origin/main`) and bring it back to `main` as a small pull request when the work is green.
- A worktree starts from a commit, so uncommitted work in another tree is invisible to it. Commit (when the user asks) before splitting work across worktrees.
- A new worktree has no `node_modules`; run `npm install` in it. `generated_imgs/` is git-ignored and exists only in the main checkout.
- `TODO.md` holds one ranked backlog per area (GRAPHICS, GAME ENGINE, …). Edit only your own section.
- Before starting, find the other sessions (`ListAgents`) and ask what files they own. If you must share a tree, agree on file ownership first and stay out of each other's files.
- Use a different dev-server port per session (`npx vite --port <n> --strictPort`), and delete any temporary harness files you create.
- Commit only when the user asks, and tell the other sessions before you do so two sessions don't commit the same tree. Never stash, reset or check out over a tree another session is using.
