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
- IndexedDB for local saves; Cloudflare Workers + R2/D1 for cloud saves (future phases)
---

## Module Structure

```
city-builder/src/
  sim/
    World.ts, Grid.ts, Scheduler.ts, EventBus.ts, rng.ts, constants.ts
    systems/
      NetworkSystem.ts, PowerSystem.ts, WaterSystem.ts, SewageSystem.ts,
      PollutionSystem.ts, ZoneGrowthSystem.ts, EconomySystem.ts, CrimeSystem.ts
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
    systems.test.ts, persistence.test.ts, newgame.test.ts, eventbus.test.ts
  main.ts
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
| `world.character` | `{ egalitarian, green, planned }` | City character axes (Phase 7) |
| `world.events` | `EventBus` | Pub/sub for cross-system signals and UI alerts |
| `world.roadNetDirty` | `boolean` | Set to `true` when road topology changes; NetworkSystem clears it |

**World mutator API** — always use these; never write layers directly from commands or input:

| Method | Description |
|---|---|
| `world.setZone(tx, ty, z)` | Paint a zone; resets devLevel/abandoned/distress/vegetation |
| `world.setRoad(tx, ty, r)` | Place/upgrade/remove road; sets `roadNetDirty` |
| `world.placeBuilding(tx, ty, kind)` | Place any building; pushes to `world.buildings[]` |
| `world.clearTile(tx, ty)` | Bulldoze everything; removes from `world.buildings[]` |
| `world.isBuildable(tx, ty)` | Returns false for water tiles or tiles occupied by a building |

### Grid

`Grid` (`src/sim/Grid.ts`): flat-array helpers.

```ts
grid.idx(tx, ty)        // → ty * width + tx
grid.inBounds(tx, ty)   // → boolean
grid.markDirty(tx, ty)  // → chunk dirty tracking
grid.markAllDirty()
```

### Scheduler

`Scheduler` (`src/sim/Scheduler.ts`) drives the sim loop:
- `update(now)` called each animation frame; accumulates `dt * speed`
- Fires `_tick()` per accumulated interval (caps at 10 catch-up ticks)
- Each `_tick()`: increments `world.tick`, then calls `sys.update(world)` for every system in order
- Speed: 0 = paused, 1/2/3 = 1×/2×/3× (`baseTickMs = 500ms → 2 ticks/sec at 1×`)
- `ticksPerDay = 8`, so 1 game-day = 4 real seconds at 1×

### Systems

All systems implement `System { update(world: World): void }`. They are **pure functions over world state** — no dependencies injected, no globals. The only exception is per-system alert-cooldown state (e.g. `private _inShortage`, `private _lastAlertTick`) which is intentional instance state.

#### System execution order (per tick)

| # | System | Writes |
|---|---|---|
| 1 | NetworkSystem | `roadNet[]` connected-component IDs |
| 2 | PowerSystem | `power[]`, `stats.powerSupply/Demand` |
| 3 | WaterSystem | `water[]`, `stats.waterSupply/Demand` |
| 4 | SewageSystem | `sewage[]`, `stats.sewageSupply/Demand` |
| 5 | ServiceSystem | `services[]`, `police[]`, `fireStation[]`, `school[]`, `hospital[]` |
| 6 | EducationSystem | `education[]` (persistent, R zones only) |
| 7 | LandValueSystem | `landValue[]`, `stats.rDemand/cDemand/iDemand`, `stats.avgLandValue` |
| 8 | PollutionSystem | `pollution[]` (conserving Laplacian + decay) |
| 9 | CrimeSystem | `crime[]` |
| 10 | FireSystem | `fireRisk[]`, `fire[]` |
| 11 | TransitSystem | `congestion[]`, `accessibility[]`, `stats.avgCongestion` |
| 12 | AbandonmentSystem | `abandoned[]`, `distress[]` |
| 13 | HealthcareSystem | `sickness[]`, `recentDeath[]` |
| 14 | ZoneGrowthSystem | `devLevel[]`, `stats.population` |
| 15 | EconomySystem | `budget.money/income/expenses` |
| 16 | CityCharacterSystem | `world.character` axes |
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
| accessibility | Uint8Array | 0–255 reachable complementary zone capacity (TransitSystem) |
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

`world.events` is an `EventBus`. Systems emit events; the UI (toast system, future) subscribes.

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

**ECS-style, not inheritance:** Tiles have component layers; entities (buildings) are small objects in `world.buildings[]`. A new concern = a new component + system, not a new class hierarchy.

**Tick-based sim, decoupled from render:** `Scheduler` fires at a fixed rate (2 ticks/sec at 1×). Render runs at display refresh. The sim knows nothing about rendering.

**Systems communicate through world state and EventBus:** Systems write to layers; later systems read them. Cross-system signals go through `EventBus`.

**Command pattern for all mutations:** Every player action is a `Command` with `execute(world)` / `undo(world)`. Commands snapshot tile state to reverse themselves. Never mutate world state directly from input handlers.

**`restoreTile` in Command.ts must be kept in sync** with every new building type — it keeps `world.buildings[]` consistent on undo. When adding a new building type: update `BUILDING_*` constant, add `placeBuilding` / `clearTile` handling in World, add `restoreTile` handling in Command.ts.

**Seeded deterministic RNG:** Use `mulberry32(seed)` only. Never call `Math.random()` in sim logic.

**Data-driven balance:** All costs, rates, and thresholds live in `balance.ts`. No magic numbers in code.

**Renderer behind an interface:** All world→screen math goes through `Projection`. `Projection.depth()` returns `0` for top-down, `tx+ty` for isometric — this is the isometric swap hook.

**Chunked dirty tracking:** 16×16 tile chunks. Mutations call `grid.markDirty(tx, ty)`.

**TypeScript constraints:** `erasableSyntaxOnly: true` — no constructor parameter properties. Use explicit field declarations + assignment in body. `verbatimModuleSyntax` — use `import type` for type-only imports.

---

## How to Add…

### A new tile layer

1. Add `myLayer: Uint8Array` to the `Layers` interface in `World.ts`
2. Initialize `myLayer: new Uint8Array(n)` in the World constructor
3. Create a system that reads/writes it
4. Register the system in `main.ts` (in the correct order relative to its dependencies)
5. Update `SaveFormat.ts` / `Serializer.ts` to persist it

### A new building type

1. Add `BUILDING_MYTYPE = N` constant in `constants.ts` (next unused integer)
2. Add `{ cost: X, maintenance: Y }` to `BALANCE.buildings[N]` in `balance.ts`
3. Update `restoreTile` in `Command.ts` to handle the new kind on undo
4. Add a `PlaceBuildingCommand` variant or reuse `PlaceBuildingCommand` with the new constant
5. Add coverage range to `BALANCE.service.coverageRange` if it's a service building
6. Update `ServiceSystem` if it needs coverage logic
7. Add a key binding in `InputController.ts` and toolbar entry

### A new system

1. Create `src/sim/systems/MySystem.ts` implementing `System { update(world: World): void }`
2. Only read layers that are already written by earlier systems (see execution order table above)
3. If it emits alert events, add the event + payload type to `CityEvents` in `EventBus.ts`
4. If it needs cooldown state, add `private _lastAlertTick = -Infinity` as an instance field
5. Add balance constants to `balance.ts` — no magic numbers in the system
6. Register in `main.ts` at the correct position in the system array
7. Write tests in `src/__tests__/systems.test.ts` or a new file

### A new EventBus alert

1. Add the event name + payload shape to `CityEvents` in `EventBus.ts`
2. Emit from the relevant system: `world.events.emit('myEvent', { tx, ty, ... })`
3. Use a cooldown (`private _lastAlertTick`) to prevent spam for aggregate/recurring conditions
4. Write a test in `eventbus.test.ts` verifying payload fields and cooldown behavior

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
costs:        road=10, zoneR=20, zoneC=25, zoneI=25
buildings:    powerPlant={cost:2000,maint:5}, waterTower={500,2}, sewagePlant={1500,3}
              police={1200,3}, fire={800,2}, school={1500,4}, hospital={3000,6}, park={300,0.5}
tax/tick:     zoneR=0.8, zoneC=1.2, zoneI=1.5  (per dev level)
maintenance:  road=0.01 (per tick)
service:      coverageRange: police=12, fire=15, school=4, hospital=6, park=3  (manhattan tiles)
power:        plantOutput=500, perDevLevel=2, propagationRange=1
water:        towerOutput=300, perDevLevel=1, propagationRange=1
sewage:       plantOutput=400, perDevLevel=2, propagationRange=1
pollution:    industryOutput=30, powerPlantOutput=15, decayRate=0.94,
              diffusionRate=0.15, growthThreshold=20
crime:        alertThreshold=60, alertCooldownTicks=40, abandonThreshold=180
fire:         baseProbability=0.0003, burnDuration=20, spreadProbability=0.04
healthcare:   crisisThreshold=100, crisisCooldownTicks=40, growthThreshold=180
growth:       tickInterval=4, probability=0.08, maxLevel=3
              popPerLevel: {1:4, 2:10, 3:20}
ticksPerDay:  8, baseTickMs=500, startingMoney=20000
```

Untuned — balance pass needed after more systems land.

---

## Testing

Vitest suite at `city-builder/src/__tests__/`. After any code changes, run tests and confirm all pass before declaring done.

```
cd city-builder && npm test
```

Test files:
- `systems.test.ts` — per-system behavior (large; add new system tests here or in a new file)
- `eventbus.test.ts` — EventBus alert events: emission, payload shape, cooldown deduplication
- `commands.test.ts` — command execute/undo, restoreTile correctness
- `persistence.test.ts` — save/load round-trip
- `World.test.ts`, `Grid.test.ts`, `rng.test.ts`, `newgame.test.ts`

---

## Lessons from Previous Sessions

- Don't claim bugs are fixed without running the code. If you can't verify in a browser, say so.
- Lead with "what is the observed state" before theorizing about causes.
- Don't use `else if` chains when checking multiple independent directions (road-access bug precedent).
- Zone colors should be defined as a cohesive palette with contrast checked against terrain colors.
- Pollution diffusion must be **conserving** (Laplacian step subtracts what it spreads) — additive diffusion causes values to grow unboundedly even with decay.
- When a user says zones can develop without a resource, check whether the growth gate uses `dev[i] >= N` as a guard — that means the resource is only required for levels ≥ N, which may not be the intended behaviour.
- **Typed-array accumulation rates must be ≥ 1**, or `Math.floor` truncates them to 0 every tick (sickness bug: `sicknessRate: 0.08` → never accumulated). Prefer integer ±1 increments gated by a probability roll (`if (rng() < prob) layer[i]++`) over fractional additive rates. This also makes accumulation feel organic rather than mechanical — each zone's trajectory diverges. Apply this pattern to any new `Uint8Array` accumulator (sickness, education, etc.).
