// Developer-only panel (?debug=true): the city's focus markers (sim/markers.ts),
// the points the title screen's camera tour visits, in this order. Frame a
// view and press "Add this view", or arm "Place by click" and click tiles.
// Each row: a note, Go (look at it), Here (move it to the present view),
// up / down (its turn in the tour) and delete. "Play tour" runs the title's
// camera over the city as the title screen would. Every change is one undo
// step, and the markers are saved with the city.

import type { World } from '../sim/World';
import type { Camera } from '../render/Camera';
import type { CommandHistory } from '../commands/CommandHistory';
import { SetMarkersCommand } from '../commands/MarkerCommands';
import type { Marker } from '../sim/markers';
import { TILE_SIZE } from '../render/Projection';
import { viewScale } from '../title/CameraTour';
import { debugDock, panelFold } from './debugDock';

export interface MarkerPanelHooks {
  getWorld: () => World;
  getHistory: () => CommandHistory;
  camera: Camera;
  /** Whether the Focus tool (place by click) is the current tool, and switching it. */
  placing: () => boolean;
  setPlacing: (on: boolean) => void;
  /** Whether the tour preview is running, and switching it. */
  touring: () => boolean;
  setTouring: (on: boolean) => void;
}

const BTN = 'font-size:11px;padding:1px 5px;cursor:pointer;border-radius:4px;border:1px solid #556;background:#223;color:#dde;';
const ON = 'background:#3a5f8a;border-color:#7ab;color:#fff;';

/** The zoom a marker records for the view the camera shows now (the tour multiplies it back by viewScale). */
export function markerZoomOf(camera: Camera): number {
  return Math.round(camera.zoom / viewScale(Math.min(camera.viewportW, camera.viewportH)) * 100) / 100;
}

/** The tile at the middle of the view. */
function centreTile(camera: Camera): { tx: number; ty: number } {
  return {
    tx: Math.floor((camera.x + camera.viewportW / (2 * camera.zoom)) / TILE_SIZE),
    ty: Math.floor((camera.y + camera.viewportH / (2 * camera.zoom)) / TILE_SIZE),
  };
}

export class MarkerPanel {
  private readonly hooks: MarkerPanelHooks;
  private readonly list: HTMLElement;
  private readonly placeBtn: HTMLButtonElement;
  private readonly tourBtn: HTMLButtonElement;
  private sig = '';

  constructor(hooks: MarkerPanelHooks) {
    this.hooks = hooks;
    const panel = document.createElement('div');
    panel.id = 'debug-markers';
    panel.style.cssText = 'flex:none;background:rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:8px;'
      + 'padding:10px 12px;font-size:11px;color:#ccd;line-height:1.5;backdrop-filter:blur(8px);';
    for (const type of ['mousedown', 'pointerdown', 'wheel', 'click', 'touchstart', 'keydown']) {
      panel.addEventListener(type, (e) => e.stopPropagation());
    }
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;color:#9ad;margin-bottom:4px;cursor:pointer;';
    panel.appendChild(title);
    const body = document.createElement('div');
    panel.appendChild(body);
    panelFold(title, 'Focus markers (debug)', 'markers', [body], false);

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;';
    const add = this.button('Add this view', 'A marker at the middle of the view, at this zoom', () => this.addView());
    add.id = 'debug-marker-add';
    this.placeBtn = this.button('Place by click', 'Click a tile to put a marker there; click a marker to take it away. The bulldozer also removes markers.', () => hooks.setPlacing(!hooks.placing()));
    this.placeBtn.id = 'debug-marker-place';
    this.tourBtn = this.button('Play tour', 'Run the title screen\'s camera over this city. Any press on the map stops it.', () => hooks.setTouring(!hooks.touring()));
    this.tourBtn.id = 'debug-marker-tour';
    bar.append(add, this.placeBtn, this.tourBtn);
    body.appendChild(bar);

    this.list = document.createElement('div');
    body.appendChild(this.list);
    const note = document.createElement('div');
    note.style.cssText = 'color:#89a;margin-top:4px;';
    note.textContent = 'The title tour visits these in order. Save to file to keep them with the city.';
    body.appendChild(note);
    debugDock().appendChild(panel);
  }

  /** Call every frame. */
  update(): void {
    const placing = this.hooks.placing(), touring = this.hooks.touring();
    this.placeBtn.style.cssText = BTN + (placing ? ON : '');
    this.tourBtn.style.cssText = BTN + (touring ? ON : '');
    this.tourBtn.textContent = touring ? 'Stop tour' : 'Play tour';
    const markers = this.hooks.getWorld().markers;
    const sig = JSON.stringify(markers);
    if (sig === this.sig) return;
    this.sig = sig;
    this.list.replaceChildren(...markers.map((m, k) => this.row(m, k, markers.length)));
    if (markers.length === 0) {
      const none = document.createElement('div');
      none.style.color = '#89a';
      none.textContent = 'None: the tour finds its own spots.';
      this.list.appendChild(none);
    }
  }

  private button(text: string, tip: string, act: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.title = tip;
    b.style.cssText = BTN;
    b.addEventListener('click', act);
    return b;
  }

  private set(markers: Marker[]): void {
    this.hooks.getHistory().run(new SetMarkersCommand(markers));
  }

  private change(k: number, edit: (m: Marker) => Marker): void {
    this.set(this.hooks.getWorld().markers.map((m, j) => (j === k ? edit({ ...m }) : m)));
  }

  private addView(): void {
    const world = this.hooks.getWorld(), { tx, ty } = centreTile(this.hooks.camera);
    if (!world.grid.inBounds(tx, ty)) return;
    const zoom = markerZoomOf(this.hooks.camera);
    const at = world.markers.findIndex(m => m.x === tx && m.y === ty);
    if (at >= 0) this.change(at, m => ({ ...m, zoom }));
    else this.set([...world.markers, { x: tx, y: ty, kind: 'focus', zoom }]);
  }

  private row(m: Marker, k: number, count: number): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:3px;align-items:center;margin:2px 0;';
    const num = document.createElement('span');
    num.style.cssText = 'flex:none;width:16px;color:#ff8ec4;font-weight:bold;';
    num.textContent = String(k + 1);
    const label = document.createElement('input');
    label.type = 'text';
    label.value = m.label ?? '';
    label.placeholder = `${m.x}, ${m.y} · ×${(m.zoom ?? 0).toFixed(2)}`;
    label.title = `Tile ${m.x}, ${m.y}; zoom ${m.zoom ?? 'default'}. Type a note.`;
    label.maxLength = 80;
    label.style.cssText = 'flex:1;min-width:0;font-size:11px;padding:1px 4px;border-radius:4px;border:1px solid #445;background:#151a24;color:#dde;';
    label.addEventListener('change', () => this.change(k, (x) => {
      const text = label.value.trim();
      if (text) x.label = text; else delete x.label;
      return x;
    }));
    const cam = this.hooks.camera;
    const go = this.button('Go', 'Look at it as the tour will', () => {
      cam.zoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, (m.zoom ?? cam.zoom) * (m.zoom ? viewScale(Math.min(cam.viewportW, cam.viewportH)) : 1)));
      cam.x = (m.x + 0.5) * TILE_SIZE - cam.viewportW / (2 * cam.zoom);
      cam.y = (m.y + 0.5) * TILE_SIZE - cam.viewportH / (2 * cam.zoom);
    });
    const here = this.button('Here', 'Move it to the middle of the present view, at this zoom', () => {
      const world = this.hooks.getWorld(), { tx, ty } = centreTile(cam);
      if (!world.grid.inBounds(tx, ty) || world.markers.some((o, j) => j !== k && o.x === tx && o.y === ty)) return;
      this.change(k, x => ({ ...x, x: tx, y: ty, zoom: markerZoomOf(cam) }));
    });
    const swap = (to: number) => () => {
      const list = this.hooks.getWorld().markers.slice();
      [list[k], list[to]] = [list[to], list[k]];
      this.set(list);
    };
    const up = this.button('↑', 'Earlier in the tour', swap(k - 1));
    up.disabled = k === 0;
    const down = this.button('↓', 'Later in the tour', swap(k + 1));
    down.disabled = k === count - 1;
    const del = this.button('✕', 'Delete', () => this.set(this.hooks.getWorld().markers.filter((_, j) => j !== k)));
    row.append(num, label, go, here, up, down, del);
    return row;
  }
}
