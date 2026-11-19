// The tutorial runner and its card (TUTORIAL_DESIGN.md). The card sits at the
// bottom centre (full width on a phone) with one goal, a "3 / 12" count, Skip
// step and Leave tutorial. The runner checks the current step a few times a
// second and passes every step that is already met; it never blocks a tool.
// The steps themselves are tutorial/steps.ts; the rules are tutorial/rules.ts.

import type { World } from '../sim/World';
import type { Camera } from '../render/Camera';
import type { AreaHighlight } from '../render/CanvasRenderer';
import { TILE_SIZE } from '../render/Projection';
import { TUTORIAL_STEPS } from '../tutorial/steps';
import { endTutorial } from '../tutorial/rules';
import type { TutorialStep, TutorialTarget, TutorialUi } from '../tutorial/types';
import { t } from '../i18n';

/** Set once the player has finished or left a tutorial: only stops the title's first-launch highlight. */
export const TUTORIAL_DONE_KEY = 'concretta.tutorialDone';

export function tutorialDone(): boolean {
  try { return window.localStorage.getItem(TUTORIAL_DONE_KEY) === '1'; } catch { return false; }
}
function markTutorialDone(): void {
  try { window.localStorage.setItem(TUTORIAL_DONE_KEY, '1'); } catch { /* private window: the highlight just shows again */ }
}

const CHECK_MS = 250;
/** How far the camera must move (world pixels) or zoom (factor) to count as looking around. */
const PAN_PX = 3 * TILE_SIZE, ZOOM_BY = 1.15;

export interface TutorialHooks {
  /** Pulse these toolbar keys (empty: none). */
  onPoint(keys: readonly string[]): void;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class Tutorial {
  readonly ui: TutorialUi = { panned: false, zoomed: false, inspectedHome: false, budgetOpened: false, overlayOn: false, cardClosed: false };
  private world: World | null = null;
  private readonly steps: readonly TutorialStep[];
  private readonly hooks: TutorialHooks;
  private readonly card: HTMLElement;
  private readonly count: HTMLElement;
  private readonly text: HTMLElement;
  /** The step's counted goals, e.g. "Shops 3 / 8 · Industry 0 / 8" (empty for a step with none). */
  private readonly progress: HTMLElement;
  private readonly actions: HTMLElement;
  /** The step the card shows (-1: none). */
  private shown = -1;
  /** The keys last sent to onPoint, so nothing is sent until there is something to pulse. */
  private pointed = '';
  private confirming = false;
  private lastCheck = -Infinity;
  private target: TutorialTarget | null = null;
  private cam0: { x: number; y: number; zoom: number } | null = null;

  constructor(hooks: TutorialHooks, steps: readonly TutorialStep[] = TUTORIAL_STEPS) {
    this.hooks = hooks;
    this.steps = steps;
    this.card = node('div', 'tut-card');
    this.card.id = 'tutorial-card';
    this.card.hidden = true;
    this.card.setAttribute('role', 'status');
    this.card.setAttribute('aria-live', 'polite');
    const top = this.card.appendChild(node('div', 'tut-top'));
    top.appendChild(node('span', 'tut-label', t('ui.tutorial.label')));
    this.count = top.appendChild(node('span', 'tut-count'));
    this.text = this.card.appendChild(node('div', 'tut-text'));
    this.progress = this.card.appendChild(node('div', 'tut-progress'));
    this.actions = this.card.appendChild(node('div', 'tut-actions'));
    document.body.append(this.card);
  }

  get active(): boolean { return this.world !== null; }

  /** Call whenever the city in play changes: starts the runner at the saved step if the city has a tutorial, else stops it. */
  attach(world: World, camera: Camera): void {
    const state = world.tutorial;
    this.world = state ? world : null;
    for (const k of Object.keys(this.ui) as Array<keyof TutorialUi>) this.ui[k] = false;
    this.cam0 = { x: camera.x, y: camera.y, zoom: camera.zoom };
    this.shown = -1;
    this.confirming = false;
    this.lastCheck = -Infinity;
    this.target = null;
    if (state) this.steps[state.step]?.enter?.(world);   // once after a load
    this.show();
  }

  /** Call every frame. Notes camera moves at once; checks the step a few times a second. */
  update(camera: Camera, now: number): void {
    const world = this.world;
    if (!world || !this.cam0) return;
    if (Math.hypot(camera.x - this.cam0.x, camera.y - this.cam0.y) > PAN_PX) this.ui.panned = true;
    if (camera.zoom > this.cam0.zoom * ZOOM_BY || camera.zoom < this.cam0.zoom / ZOOM_BY) this.ui.zoomed = true;
    if (now - this.lastCheck < CHECK_MS) return;
    this.lastCheck = now;
    const state = world.tutorial;
    if (!state) { this.stop(); return; }   // ended elsewhere
    let step = state.step;
    while (step < this.steps.length && this.steps[step].done(world, this.ui)) step++;
    if (step !== state.step) this.go(step);
    else {
      this.target = this.steps[step]?.target?.(world) ?? null;
      this.showProgress();
    }
  }

  /** The current step's counts, kept up to date between checks. A goal that is reached is ticked. */
  private showProgress(): void {
    const world = this.world;
    const goals = world && !this.confirming ? this.steps[world.tutorial?.step ?? -1]?.progress?.(world) ?? [] : [];
    const line = goals.map(g => `${t('ui.tutorial.progress.' + g.key)} ${g.n} / ${g.of}${g.n >= g.of ? ' ✓' : ''}`).join(' · ');
    if (this.progress.textContent !== line) this.progress.textContent = line;
    this.progress.hidden = line === '';
  }

  /** The current step's ghost on the map, softly pulsing. */
  highlights(now: number): AreaHighlight[] {
    const tg = this.active && !this.confirming ? this.target : null;
    if (!tg) return [];
    const alpha = 0.55 + 0.45 * Math.sin(now / 420);
    const out: AreaHighlight[] = [];
    if (tg.path && tg.path.length > 0) {
      const xs = tg.path.map(p => p[0]), ys = tg.path.map(p => p[1]);
      out.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), alpha, tiles: tg.path.map(([x, y]) => ({ x, y })) });
    }
    if (tg.area) out.push({ x0: tg.area.x, y0: tg.area.y, x1: tg.area.x + tg.area.w - 1, y1: tg.area.y + tg.area.h - 1, alpha });
    return out;
  }

  private go(step: number): void {
    const world = this.world!;
    if (step >= this.steps.length) { this.finish(); return; }
    world.tutorial!.step = step;
    this.steps[step].enter?.(world);
    this.confirming = false;
    this.show();
  }

  private finish(): void {
    if (this.world) endTutorial(this.world);
    markTutorialDone();
    this.stop();
  }

  private stop(): void {
    this.world = null;
    this.target = null;
    this.show();
  }

  /** Redraw the card for the current step (or hide it). */
  private show(): void {
    const world = this.world;
    const step = world ? world.tutorial?.step ?? -1 : -1;
    const s = this.steps[step];
    if (!world || !s) {
      this.card.hidden = true;
      this.shown = -1;
      this.point([]);
      return;
    }
    if (this.shown !== step) this.point(s.point ?? []);
    this.shown = step;
    this.target = s.target?.(world) ?? null;
    this.card.hidden = false;
    this.count.textContent = t('ui.tutorial.count', { n: step + 1, total: this.steps.length });
    this.actions.textContent = '';
    const last = step === this.steps.length - 1;
    this.showProgress();
    if (this.confirming) {
      this.text.textContent = t('ui.tutorial.leaveAsk');
      this.button(t('ui.tutorial.leaveYes'), true, () => this.finish());
      this.button(t('ui.tutorial.leaveNo'), false, () => { this.confirming = false; this.show(); });
      return;
    }
    this.text.textContent = t('ui.tutorial.step.' + s.id, s.vars?.(world));
    if (last) {
      this.button(t('ui.tutorial.close'), true, () => { this.ui.cardClosed = true; this.lastCheck = -Infinity; this.finish(); });
      return;
    }
    this.button(t('ui.tutorial.skip'), false, () => this.go(step + 1));
    this.button(t('ui.tutorial.leave'), false, () => { this.confirming = true; this.show(); });
  }

  private point(keys: readonly string[]): void {
    const sig = keys.join(',');
    if (sig === this.pointed) return;
    this.pointed = sig;
    this.hooks.onPoint(keys);
  }

  private button(label: string, primary: boolean, act: () => void): void {
    const b = this.actions.appendChild(node('button', 'tut-btn' + (primary ? ' primary' : ''), label));
    b.type = 'button';
    b.addEventListener('click', act);
  }
}
