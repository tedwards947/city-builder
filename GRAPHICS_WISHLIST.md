# Graphics Wishlist

A plan and list of todos for graphical enhancements to City Builder.

## Goals
* To have a richer graphical experience in City Builder.
* To enable a graphical representation of the "vibe" mechanic (Egalitarian vs Laissez-faire, Green vs Industrial).
* To add light animations that breathe life and fun into the game.
* To introduce visual variety and pleasure to the game without using bitmap sprites.

## Core Requirements
* **Procedural Vector Graphics:** All entities rendered via Canvas 2D API commands (paths, gradients, shapes). No external PNG/JPG assets.
* **Agent-Driven Content:** An AI agent should be able to "generate" new entity drawing code and present it for review.
* **Visual Sandbox:** A dedicated view to see all entities in a grid for review/testing.
* **Metadata-Rich Registry:** Each entity has a unique ID, type (Service, R-Zone, etc.), and tags (vibe-related).
* **Animated Elements:** Support for procedural animations (e.g., smoke particles, blinking lights, waving flags) driven by a global `tick` or `time`.
* **Thematic Grouping:** Entities should be grouped into "Tilesets" or "Themes" that can be swapped or blended.
* **Color Variation:** For some aspects of buildings (ie the walls of a home), color should be varied between entities for more visual variety

## Enhanced Requirements & Ideas
* **Vibe-Responsive Variants:** Entities should react to the city's character. A residential house might add solar panels if the city is "Green" or look more dilapidated if "Industrial" pollution is high.
* **Night Mode Support:** Each entity should define "emissive" layers (lit windows, street lamps) that activate when a global night-cycle is triggered.
* **Level of Detail (LOD):** Drawing commands should be tiered. When zoomed out, complex details (like window panes) are skipped for performance.
* **Ambient Occlusion/Shadows:** Support for simple procedural drop-shadows or "ground contact" shadows to give depth.
* **Interactive Feedback:** Entities might "wiggle" or change state when clicked or hovered (e.g., a park fountain starts spraying).

## Technical Implementation Idea
* **Entity Files:** Each entity exists as a TypeScript object in `src/render/entities/`.
* **The Draw Function:** 
  ```ts
  interface VectorEntity {
    id: string;
    type: string;
    tags: string[];
    draw: (ctx: CanvasRenderingContext2D, t: number, variant: VibeState) => void;
  }
  ```
* **Global Registry:** A `SpriteRegistry` (name TBD) that the `CanvasRenderer` queries instead of drawing raw rects.