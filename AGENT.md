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
| crime | Uint8Array | 0–255 crime level (ZoneGrowthSystem and PoliticsSystem read this) |
| police | Uint8Array | 0/1 — police coverage this tick |
| abandoned | Uint8Array | 0=normal, 1=abandoned (no income, no growth, distinct visual) |
| distress | Uint8Array | 0–255 distress accumulator (increments when conditions unmet) |
| school | Uint8Array | 0/1 — school coverage this tick |
| education | Uint8Array | 0–255 persistent education level (only R zones) |
| hospital | Uint8Array | 0/1 — hospital coverage this tick |
| sickness | Uint8Array | 0–255 persistent sickness level (only R zones; rises without healthcare) |
| recentDeath | Uint8Array | 0–255 countdown after a death event (visual indicator while > 0) |

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
- **Level 2→3**: power + water + sewage coverage + services coverage (+ all surpluses) + education level (R zones only)
- **R/C blocked at any level** if `pollution[i] > BALANCE.pollution.growthThreshold` (I zones immune)
- **R blocked at any level** if `sickness[i] > BALANCE.healthcare.growthThreshold`

### System Execution Order (per tick)
1. NetworkSystem — road connected components
2. PowerSystem — power layer + powerSupply/powerDemand
3. WaterSystem — water layer + waterSupply/powerDemand
4. SewageSystem — sewage layer + sewageSupply/sewageDemand
5. ServiceSystem — services coverage layer (direct radius, no road network)
6. EducationSystem — persistent education levels for R zones
7. LandValueSystem — land value per tile + demand multipliers (runs every tickInterval)
8. PollutionSystem — pollution diffusion (conserving Laplacian + decay)
9. CrimeSystem — crime levels per tile (affected by education)
10. FireSystem — fire risk, ignition, and spreading
11. TransitSystem — flow simulation and accessibility
12. AbandonmentSystem — handles building abandonment
13. HealthcareSystem — sickness accumulation/decay and death events for R zones
14. ZoneGrowthSystem — reads all of the above; growth probability × demand multiplier
14. EconomySystem — taxes × landValue multiplier × education multiplier × taxRates, maintenance, population
15. CityCharacterSystem — ambient city profile shifts
16. PoliticsSystem — per-tick PC regen from satisfaction

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
- **Typed-array accumulation rates must be ≥ 1**, or `Math.floor` truncates them to 0 every tick (sickness bug: `sicknessRate: 0.08` → never accumulated). Prefer integer ±1 increments gated by a probability roll (`if (rng() < prob) layer[i]++`) over fractional additive rates. This also makes accumulation feel organic rather than mechanical — each zone's trajectory diverges. Apply this pattern to any new `Uint8Array` accumulator (sickness, education, etc.).
