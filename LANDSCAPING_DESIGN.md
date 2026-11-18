# Landscaping — Design

*Status: owner decisions in (2026-11-17). Engine and graphics to check feasibility and phase it.*

A landscaping tool for planting trees of a chosen species and for adding and removing water. Beaches follow the water automatically.

## What exists today
- `world.layers.terrain`: grass, water, sand. Sand is placed on land beside water when the map is generated.
- `world.layers.vegetation`: 0 = none, 1–6 = tree species, with clay art for each.
- `openWater`: a cached map of water that reaches the map edge (used by the seaport).
- **The bulldozer does not remove trees** (owner).

## Owner decisions

### Trees
- **The brush:** pick a species, pick a brush size, paint. Plus an **eraser** to remove trees, since the bulldozer doesn't.
- **Trees affect gameplay** (all three):
  - a small land-value boost nearby;
  - absorbing a little pollution;
  - a nudge toward the green vibe.
- **The aim:** tree belts become a reason to buffer industry from homes. See TODO DESIGN f (industry crime).
- **Cost:** money per tree (number from the lab).

### Beaches
- **Automatic and looks only.** Sand sits on shore tiles with nothing built on them and updates whenever water changes. No gameplay effect for now.
- **Art:** uses the art as it is built today. The deferred clay terrain pass (rounded shorelines) is not part of this.

### Water
- **Add or remove water tile by tile.** Costs money only for now; a PC cost may come later from balancing (deferred).
- **Existing things:**
  - adding water over buildings or zones bulldozes them, with the normal displacement PC cost;
  - **roads block water**: you must bulldoze a road before you can flood its tile;
  - trees on a flooded tile are removed.
- **Seaport:** if editing cuts its water off from the map edge, the port stops trading, **but upkeep continues**. Reconnecting it (e.g. digging a canal) restores trade.
- **Water pumps** must still touch water. A pump whose water is removed stops working.
- **Limits:** none beyond the above (PM default; the owner may add some). Editing at the map edge is allowed, since that's how a port can be cut off or reconnected.

## For the engine (suggestions)
- Commands with undo, as for zoning: `PlantTreesCommand`, `ClearTreesCommand`, `EditWaterCommand`.
- After a water edit:
  - recompute `openWater` and the sand around the edit;
  - refresh ship routes, the port's "cut off" state and the pump checks;
  - redraw the affected chunks.
- Tree effects:
  - extend the land-value and pollution systems;
  - green vibe through `VibeSystem`;
  - all numbers start at 0 for ENGINEER 3's lab, as for PC.
- Save format: terrain and vegetation are already saved. Check that nothing else needs adding.
- Keep the golden test unchanged while the numbers are 0.

## For graphics (suggestions)
- **A "Landscape" toolbar family** with a fly-out:
  - trees, with a species picker and brush sizes;
  - tree eraser;
  - add water;
  - remove water.
- **Placement preview:**
  - the price;
  - red for blocked tiles (roads), with the message "bulldoze the road first";
  - a warning when a port would be cut off, or a pump left dry;
  - the PC cost when buildings would be flooded.
- **Mocks with a feedback form first,** like earlier rounds.

## Phasing
1. Tree brush and eraser (low risk; can start right away).
2. Beaches follow water (comes with phase 3).
3. Water editing with all its rules.
4. Tree effects, with numbers from the lab.

## Open questions
- Tree price, and how strong each effect is (lab).
- Water price per tile (lab). Possibly a PC cost later.
