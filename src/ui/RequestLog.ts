// The quest log: a panel listing the resident requests that are open, opened
// from its own toolbar tile (which carries a count). Each row says what is
// wanted, roughly where, how long is left, what it is worth, and how far
// along it is, and has a button that moves the camera there.

import type { World } from '../sim/World';
import type { OpenRequest } from '../sim/requests';
import { requestConfig } from '../sim/requests';
import { drawRequestBadge, timeLeft, REQUEST_BADGE_R } from '../render/clay/requestBadges';
import { t } from '../i18n';
import { pcDelta } from './pcFormat';
import { daysLeft } from './RequestFeedback';
import { progressView, areaName } from './requestInfo';
import type { ProgressView } from './requestInfo';

/** Kept up to date by main.ts each frame, so the toolbar can show the tile and its count. */
export const requestLogState = { open: 0 };

/** The tile shows once requests can happen, or while any are open (the debug panel can open one by hand). */
export function requestLogShown(): boolean {
  return requestConfig().spawnEveryDays > 0 || requestLogState.open > 0;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** What a kind is called at the start of a row: "A park". */
const kindName = (kind: string): string => t(`requests.${kind}.name`);

export class RequestLog {
  private readonly root: HTMLElement;
  private readonly getWorld: () => World;
  private readonly onShow: (req: OpenRequest) => void;
  private visible = false;
  private drawn = '';

  /** `onShow` is called when the player asks to see a request on the map. */
  constructor(parent: HTMLElement, getWorld: () => World, onShow: (req: OpenRequest) => void) {
    this.getWorld = getWorld;
    this.onShow = onShow;
    this.root = el('div', 'hidden');
    this.root.id = 'request-log';
    parent.append(this.root);
  }

  get isOpen(): boolean { return this.visible; }

  /** Show or hide the panel, `right` px in from the window's right edge. */
  toggle(right: number): void {
    this.visible = !this.visible;
    this.root.style.right = right + 'px';
    this.root.classList.toggle('hidden', !this.visible);
    this.drawn = '';
    this.update();
  }

  close(): boolean {
    if (!this.visible) return false;
    this.visible = false;
    this.root.classList.add('hidden');
    return true;
  }

  /** Call every frame: redraws when a request opens or closes, a day passes or progress moves. */
  update(): void {
    if (!this.visible) return;
    const world = this.getWorld();
    const rows = world.politics.requests.map(req => {
      return { req, days: daysLeft(req.deadlineTick, world.tick), view: progressView(world, req) };
    });
    const sig = rows.map(r => `${r.req.id}:${r.days}:${r.view.text}`).join('|');
    if (sig === this.drawn) return;
    this.drawn = sig;

    this.root.textContent = '';
    const head = el('div', 'ord-head', t('ui.requests.title'));
    head.append(el('span', 'ord-upkeep', rows.length ? t('ui.requests.open', { n: rows.length }) : ''));
    this.root.append(head);
    if (rows.length === 0) {
      const empty = el('div', 'rq-empty', t('ui.requests.none'));
      empty.append(el('small', '', t('ui.requests.noneNote')));
      this.root.append(empty);
      return;
    }
    const list = el('div', 'ord-list');
    for (const { req, days, view } of rows) list.append(this.row(world, req, days, view));
    this.root.append(list);
  }

  private row(world: World, req: OpenRequest, days: number, view: ProgressView): HTMLElement {
    const row = el('div', 'rq-row');

    // The same badge as on the map, countdown ring included.
    const size = (REQUEST_BADGE_R + 6) * 2, dpr = window.devicePixelRatio || 1;
    const icon = el('canvas', 'rq-icon');
    icon.width = size * dpr; icon.height = size * dpr;
    icon.style.width = icon.style.height = size + 'px';
    const ctx = icon.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawRequestBadge(ctx, { x: size / 2, y: size / 2, r: REQUEST_BADGE_R, request: req, left: timeLeft(req, world.tick), count: 1 });
    }

    const text = el('div', 'rq-text');
    text.append(el('b', '', kindName(req.kind)));
    const where = t('ui.requests.where.' + areaName(world, req));
    text.append(el('small', '', where + ' · ' + view.text));
    const pct = view.bar;
    if (pct) {
      const bar = el('div', 'rq-bar');
      const fill = el('i', '');
      fill.style.width = Math.min(100, pct.covered) + '%';
      const mark = el('u', '');
      mark.style.left = Math.min(100, pct.needed) + '%';
      bar.append(fill, mark);
      text.append(bar);
    }

    const right = el('div', 'rq-right');
    right.append(el('span', 'rq-days' + (timeLeft(req, world.tick) < 0.25 ? ' soon' : ''), t('ui.requests.daysLeft', { n: days })));
    const numbers = requestConfig().kinds[req.kind];
    const stakes: string[] = [];
    if (numbers?.reward > 0) stakes.push(pcDelta(numbers.reward));
    if (numbers?.penalty > 0) stakes.push(pcDelta(-numbers.penalty));
    if (stakes.length) right.append(el('small', '', stakes.join(' / ')));
    const show = el('button', 'rq-show', t('ui.requests.show'));
    show.type = 'button';
    show.addEventListener('click', () => this.onShow(req));
    right.append(show);

    row.append(icon, text, right);
    return row;
  }
}
