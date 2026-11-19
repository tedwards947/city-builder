// The tutorial's shape (TUTORIAL_DESIGN.md), shared by the step list
// (steps.ts, ENGINE) and the card, pulse and map ghost (ui/TutorialCard.ts,
// GRAPHICS). A step is met by the state of the city, never by one exact click.

import type { World } from '../sim/World';

/** What the UI has seen the player do, for steps the city's state cannot show. Flags only ever turn on. */
export interface TutorialUi {
  panned: boolean;
  zoomed: boolean;
  /** Clicked with Inspect on a home tile (zone R, developed or not). */
  inspectedHome: boolean;
  budgetOpened: boolean;
  overlayOn: boolean;
  /** The last card's button was pressed. */
  cardClosed: boolean;
}

export interface TutorialTarget {
  /** Tiles to ghost, e.g. the street to draw. */
  path?: [number, number][];
  /** A spot to outline, e.g. where the power plant could go. */
  area?: { x: number; y: number; w: number; h: number };
}

export interface TutorialStep {
  /** The card's copy is ui.tutorial.step.<id>. */
  id: string;
  /** Toolbar item keys to pulse (ui/Toolbar.ts), plus 'speed' and 'demand'. */
  point?: string[];
  /** Where on the map to point, if anywhere (from Focus markers on the tutorial map). */
  target?(world: World): TutorialTarget | null;
  /** Called each time the step becomes current, and once after a load. Idempotent. */
  enter?(world: World): void;
  /** Values for the copy's {placeholders}. */
  vars?(world: World): Record<string, string | number>;
  done(world: World, ui: TutorialUi): boolean;
}

/** `world.tutorial` while a tutorial is running (absent otherwise). `request` is the scripted request's id. */
export interface TutorialState { step: number; request?: number }
