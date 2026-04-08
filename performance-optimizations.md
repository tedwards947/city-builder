# Performance and Memory Optimization Plan

## Objective
Investigate and resolve high memory usage (reported up to 5GB) and optimize CPU performance in the city-builder application. The primary strategy focuses on reducing redundant draw calls, minimizing object allocations in hot loops, and optimizing the simulation systems.

## Key Files & Context
- `src/render/CanvasRenderer.ts`: Main bottleneck for CPU (draw calls) and memory (allocation storm).
- `src/sim/systems/TransitSystem.ts`: Most expensive simulation system (multiple BFS runs per update).
- `src/main.ts`: Entry point for the render and simulation loops.
- `src/render/Camera.ts`: Frequent object allocations for coordinate conversions.

## Proposed Solution

### 1. Chunked Rendering (The Biggest Win)
The current renderer redraws every visible tile every frame. For a 256x256 grid, this is 65,536 tiles, each with multiple `ctx.fillRect` and `ctx.arc` calls, totaling hundreds of thousands of draw calls per frame.
- **Implementation:** Introduce a `ChunkRenderer` (or update `CanvasRenderer`) that caches static tile data (terrain, roads, buildings, zones) into offscreen canvases for each 16x16 chunk.
- **Mechanism:** Only redraw a chunk when `grid.dirtyChunks` contains its ID.
- **Result:** Reduces draw calls from ~100k+ to ~256 `drawImage` calls per frame.

### 2. Allocation Storm Reduction
The render loop currently allocates millions of small objects (e.g., `{sx, sy}`, `{wx, wy}`, `rgba(...)` strings) per second.
- **Implementation:**
  - Pass coordinates as primitives (`x, y`) instead of objects.
  - Pre-allocate reusable objects for coordinates where objects are necessary.
  - Cache dynamic color strings (e.g., traffic congestion colors, pollution alpha) instead of generating them every frame for every tile.
  - Limit `ctx.setTransform` and `ctx.globalAlpha` calls.

### 3. Simulation System Optimizations
- **TransitSystem:**
  - The BFS from every zone tile is extremely expensive. I will investigate grouping tiles or spreading the update load across multiple ticks.
  - Cache connectivity results to avoid redundant BFS runs for zones in the same road network component.
- **PollutionSystem/FireSystem:** Ensure these systems only run when necessary and use efficient array operations.

### 4. Memory Leak Safeguards
- **CommandHistory:** Add a cap to the undo stack (e.g., 200 commands) to prevent unbounded memory growth during long play sessions.
- **EventBus:** While currently safe, I will add an `off` method for completeness and to prevent future leaks.

## Implementation Steps

### Phase 1: Allocation Optimization (Quick Wins)
1.  Refactor `Camera.ts` and `Projection.ts` to provide primitive-based coordinate methods (e.g., `worldToScreenX`, `worldToScreenY`).
2.  Update `CanvasRenderer.ts` to use these primitive methods, avoiding millions of short-lived objects.
3.  Cache frequently used color strings in `CanvasRenderer`.

### Phase 2: Chunked Rendering (Architectural Win)
1.  Create a `ChunkCache` to manage offscreen canvases for each grid chunk.
2.  Refactor `CanvasRenderer.render` to:
    - Identify visible chunks.
    - Refresh dirty chunks by drawing their tiles to the offscreen canvas.
    - Draw the cached chunk canvases to the main screen.
3.  Ensure overlays (traffic, crime) are handled correctly (either cached separately or drawn on top).

### Phase 3: Simulation Tuning
1.  Implement a capped `CommandHistory`.
2.  Add `EventBus.off`.
3.  Review `TransitSystem` for redundant BFS runs.

## Verification & Testing
- **Memory Profiling:** Use browser dev tools (Memory tab) to verify heap size reduction and frequency of GC collections.
- **CPU Profiling:** Use browser dev tools (Performance tab) to verify reduction in `Scripting` and `Rendering` time per frame.
- **Regression Testing:** Run existing test suite (`npm test`) to ensure simulation logic remains correct.
- **Visual Verification:** Ensure that chunk borders are seamless and that dirty tracking correctly updates all visuals when building/bulldozing.
