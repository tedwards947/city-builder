// The tutorial (TUTORIAL_DESIGN.md): the shapes shared by the step list
// (tutorial/steps.ts), the tutorial-only rules (tutorial/rules.ts) and the
// card and its runner (UI).

import type { World } from '../sim/World';

/** What the player has done in the UI, which the city itself does not record. Filled by the UI. */
export interface TutorialUi {
  panned: boolean;
  zoomed: boolean;
  /** Clicked a home tile with Inspect. */
  inspectedHome: boolean;
  budgetOpened: boolean;
  /** Any overlay (view) switched on. */
  overlayOn: boolean;
  /** The last card closed. */
  cardClosed: boolean;
}

/** Where on the map a step points: a path of tiles to draw along, or an area to outline. */
export interface TutorialTarget {
  path?: [number, number][];
  area?: { x: number; y: number; w: number; h: number };
}

export interface TutorialStep {
  /** Names the card's copy: ui.tutorial.step.<id>. */
  id: string;
  /** Toolbar item keys to pulse (ui/Toolbar.ts), e.g. ['water', 'sewage']; also 'speed' and 'demand'. */
  point?: string[];
  /** The spot on the map to show, if the map has one for this step. */
  target?(world: World): TutorialTarget | null;
  /** Values for the card's copy. */
  vars?(world: World): Record<string, string | number>;
  /**
   * Called each time the step becomes the current one, and once after a load
   * for the current step. Safe to call again and again.
   */
  enter?(world: World): void;
  /** Whether the city (and the UI) already meets the step's goal. Any way of getting there counts. */
  done(world: World, ui: TutorialUi): boolean;
}

/** `world.tutorial`: set while the city is the tutorial city. Saved. */
export interface TutorialState {
  /** The current step: an index into TUTORIAL_STEPS. */
  step: number;
  /** The id of the scripted park request, once it has opened. */
  request?: number;
}
