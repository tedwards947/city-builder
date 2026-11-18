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
      EconomySystem, VibeSystem, PoliticsSystem, OrdinanceSystem, RequestSystem
    politics.ts (PC rules), ordinances.ts (ordinance registry, enact/repeal, ordinanceModifier),
    requests.ts (resident request kinds: need per neighbourhood, pick, isMet)
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

Detailed reference (World, layers, systems order, EventBus, commands, how to add X, constants, debug tools, Balance Lab): docs/ARCHITECTURE.md — read only the section you need.

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

Detailed reference (World, layers, systems order, EventBus, commands, how to add X, constants, debug tools, Balance Lab): docs/ARCHITECTURE.md — read only the section you need.

---

## Testing

Vitest suite at `src/__tests__/`. After any code changes, run both and confirm they pass before declaring done:

```
npm test            # vitest run
npm run typecheck   # tsc --noEmit; `npm run build` = tsc && vite build
```

The typecheck has `noUnusedLocals` / `noUnusedParameters` on, so an unused import or variable breaks the build even though tests pass.

The same three checks (typecheck, tests, production build) run on GitHub for every pull request and for `main` (`.github/workflows/ci.yml`). Don't merge a PR whose check is red.

Detailed reference (World, layers, systems order, EventBus, commands, how to add X, constants, debug tools, Balance Lab): docs/ARCHITECTURE.md — read only the section you need.

### The "nothing changed" test

`goldenCity.test.ts` runs the whole simulation (every system, via `createSystems()`) on the test city for 400 ticks and compares a fingerprint — a hash of every tile layer and of the traffic volumes, plus stats and budget — with the stored one in `__snapshots__/goldenCity.test.ts.snap`.

- A speed-up or refactor of the simulation must leave it passing untouched. That is the proof it behaves the same.
- If you changed behaviour on purpose (a balance value, a new rule, a new layer, a different system order), it will fail and show which layers moved. Check that matches what you meant, then run `npx vitest run goldenCity -u` and commit the new snapshot with the change. Say in the PR that the simulation result changed.
- Rendering, UI and audio changes cannot affect it.

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
- A worktree starts from a commit, so uncommitted work in another tree is invisible to it. Commit before splitting work across worktrees.
- A new worktree has no `node_modules`; run `npm install` in it. `generated_imgs/` is git-ignored and exists only in the main checkout.
- `TODO.md` holds one ranked backlog per area (GRAPHICS, GAME ENGINE, …). Edit only your own section.
- **Update your own `TODO.md` section whenever one of your PRs merges** (done, next, waiting on whom), so the team can be rebuilt from the repo after a restart. The team setup and the restart procedure are in `TEAM.md`.
- Before starting, find the other sessions (`ListAgents`) and ask what files they own. If you must share a tree, agree on file ownership first and stay out of each other's files.
- Use a different dev-server port per session (`npx vite --port <n> --strictPort`), and delete any temporary harness files you create.
- **Keep browser checks silent.** Launch Chrome with `--mute-audio` and load the page with `?music=off` (`?sfx=off` too once effects land). The game skips music autoplay when `navigator.webdriver` is true, but Chrome driven over CDP usually reports false, so the flag is what reliably works.
- **You may commit, push, open and merge your own pull requests without asking the owner** (the owner's standing permission, 2026-11-16), as long as: the work is in your own worktree; CI is green; the golden baseline is untouched, or the PR says why it changed on purpose; and you tell the other sessions before you merge. Never stash, reset or check out over a tree another session is using.
- **Still ask the owner first** for anything hard to undo or outside your own work: deleting branches (except your own PR's head branch once it has merged, which `--delete-branch` may remove) or data, force-pushes or history rewrites, CI, settings or secrets changes, paid image generation, and anything the owner has said to hold.
- **Merge with auto-merge.** `main` is protected: the `check` status must pass, and direct pushes are blocked. Right after `gh pr create`, run `gh pr merge <n> --auto --merge --delete-branch`, and GitHub merges once CI is green, never before.
- **`main` is live.** Every merge to `main` deploys to the public site (https://city-builder-dmz.pages.dev/, Cloudflare Pages Git integration), and PRs get Cloudflare preview URLs. The owner wants merges to keep flowing at this stage; if a merge breaks the live game, revert it straight away and tell the others.
- **Never touch a tree that is serving the owner's game** (a running dev server they may be playing on): no edits, pulls, checkouts or restarts. A reload interrupts their play-test.

## Saving tokens (owner's rules, 2026-11-17)

Usage runs out fast with many sessions at once, so every session follows these:

- **Parallel only for independent, substantive work.** Leave a session idle when it has nothing real to do, and don't message idle sessions: every message makes the receiver reload its whole context.
- **Message only when the receiver must act.** Engineers talk to each other directly (e.g. engine ↔ graphics about an API), not through the PM. Send the PM only owner decisions and finished, merged work, in one short message per PR.
- **No re-checking what CI already gates.** Don't re-read diffs or re-run checks on another session's green PR.
- **No polling.** Use auto-merge and wait for notifications; don't loop on CI, the lab or `gh`.
- **Browser screenshots only when a visual change needs eyes**, and mock pages only when the owner asked for a review.
- **Routine, well-specified jobs go to HAIKU1** (status checks, small doc edits, re-running scripts, nightly summaries).
- **Compaction is the owner's job** (`/compact`). When you reach a natural pause (a PR merged, waiting on someone), end your message to the owner or PM with "good time to compact".
