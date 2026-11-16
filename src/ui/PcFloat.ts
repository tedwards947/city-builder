// Floating political-capital totals: when a player action changes PC, one
// signed number rises from the tile where the action ended and fades out.
// One per finished action (a click, a whole drag, a fill), from the engine's
// `pcAction` event, so a long bulldoze drag shows a single total.

import type { World } from '../sim/World';
import type { CityEvents } from '../sim/EventBus';
import type { Camera } from '../render/Camera';
import { TILE_SIZE } from '../render/Projection';
import { pcDelta } from './pcFormat';

const LIFE_MS = 1900;

export class PcFloat {
  private readonly layer: HTMLElement;
  private readonly camera: Camera;
  private world: World | null = null;
  // The event bus hands listeners an untyped payload (as ToastPanel's handlers take it).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly onAction = (e: any) => this.show(e as CityEvents['pcAction']);

  constructor(parent: HTMLElement, camera: Camera) {
    this.camera = camera;
    this.layer = document.createElement('div');
    this.layer.id = 'pc-floats';
    parent.append(this.layer);
  }

  /** Listen to this world's actions (call again after New Game or Load). */
  setWorld(world: World): void {
    this.world?.events.off('pcAction', this.onAction);
    this.world = world;
    world.events.on('pcAction', this.onAction);
    this.layer.textContent = '';
  }

  private show(e: CityEvents['pcAction']): void {
    // Undo and redo put PC back quietly; the HUD shows it. No tile, nowhere to float.
    if (e.undo || e.delta === 0 || e.tx === undefined || e.ty === undefined) return;
    const el = document.createElement('div');
    el.className = 'pc-float ' + (e.delta < 0 ? 'neg' : 'pos');
    el.textContent = pcDelta(e.delta);
    el.style.left = this.camera.worldToScreenX((e.tx + 0.5) * TILE_SIZE) + 'px';
    el.style.top = this.camera.worldToScreenY(e.ty * TILE_SIZE) + 'px';
    this.layer.append(el);
    setTimeout(() => el.remove(), LIFE_MS);
  }
}
