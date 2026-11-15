// The manual / auto switch for the road tools: hold a road button (or
// right-click it) and a small menu opens above it. The choice is one setting
// shared by street, avenue and highway, and is remembered between visits.
// Until the player chooses, it is auto on desktop and manual on touch screens.

import type { RoadMode } from '../input/InputController';
import { t } from '../i18n';

const STORAGE_KEY = 'city-builder:roadMode';
const HOLD_MS = 450;

/**
 * The mode to start in when the player has not chosen one: auto with a mouse
 * or trackpad, manual on a touch screen (tablets and phones), where dragging a
 * finger is the natural way to draw.
 */
export function defaultRoadMode(): RoadMode {
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'manual' : 'auto';
  } catch {
    return 'manual';
  }
}

/** The player's saved choice, or the default for this kind of device. */
export function loadRoadMode(): RoadMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'auto' || saved === 'manual') return saved;
  } catch { /* storage blocked: fall through to the default */ }
  return defaultRoadMode();
}

function saveRoadMode(mode: RoadMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private window: not remembered */ }
}

export class RoadModeMenu {
  private mode: RoadMode;
  private readonly menu: HTMLElement;
  private readonly buttons: HTMLButtonElement[];
  private readonly onChange: (mode: RoadMode, button: HTMLButtonElement | null) => void;
  private openFor: HTMLButtonElement | null = null;

  /**
   * `buttons` are the road tool buttons. `onChange` is called when the player
   * picks a mode from the menu, with the button the menu was opened from.
   */
  constructor(
    menu: HTMLElement,
    buttons: HTMLButtonElement[],
    onChange: (mode: RoadMode, button: HTMLButtonElement | null) => void,
  ) {
    this.menu = menu;
    this.buttons = buttons;
    this.onChange = onChange;
    this.mode = loadRoadMode();
    this._mark();

    for (const btn of buttons) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let held = false;
      const clear = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        held = false;
        clear();
        timer = setTimeout(() => { timer = null; held = true; this.open(btn); }, HOLD_MS);
      });
      btn.addEventListener('pointerup', clear);
      btn.addEventListener('pointerleave', () => { clear(); held = false; });   // released elsewhere: no click follows
      btn.addEventListener('pointercancel', clear);
      // The click that ends a hold must not also count as picking the tool
      // (capture phase, so it runs before the toolbar's own click handler).
      btn.addEventListener('click', (e) => {
        if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); }
      }, true);
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); clear(); this.open(btn); });
    }

    document.addEventListener('pointerdown', (e) => {
      if (this.openFor && !this.menu.contains(e.target as Node)) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.openFor) this.close();
    });
  }

  get current(): RoadMode { return this.mode; }
  get isOpen(): boolean { return this.openFor !== null; }

  set(mode: RoadMode): void {
    this.mode = mode;
    saveRoadMode(mode);
    this._mark();
  }

  open(btn: HTMLButtonElement): void {
    this.openFor = btn;
    this.menu.textContent = '';
    const options: Array<[RoadMode, string, string]> = [
      ['manual', t('ui.roadMode.manual'), t('ui.roadMode.manualDesc')],
      ['auto', t('ui.roadMode.auto'), t('ui.roadMode.autoDesc')],
    ];
    for (const [mode, label, desc] of options) {
      const item = document.createElement('button');
      item.type = 'button';
      item.classList.toggle('active', mode === this.mode);
      item.append(label);
      const small = document.createElement('small');
      small.textContent = desc;
      item.append(small);
      item.addEventListener('click', () => {
        const from = this.openFor;
        this.set(mode);
        this.close();
        this.onChange(mode, from);
      });
      this.menu.append(item);
    }
    const rect = btn.getBoundingClientRect();
    this.menu.style.left = (rect.left + rect.width / 2) + 'px';
    this.menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    this.menu.hidden = false;
    document.getElementById('toolbar-tip')?.classList.remove('visible');   // it would sit under the menu
  }

  close(): void {
    this.openFor = null;
    this.menu.hidden = true;
  }

  private _mark(): void {
    for (const b of this.buttons) b.classList.toggle('road-auto', this.mode === 'auto');
  }
}
