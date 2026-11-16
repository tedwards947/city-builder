// Explains a map badge (crime, sickness, no power, long commute…) when the
// pointer rests on it with the inspect tool: what it means and what to do.

import { t } from '../i18n';
import { PROBLEM_COLOUR, type BadgeKind } from '../render/clay/problemPins';

export class BadgeTooltip {
  private el: HTMLDivElement;
  private x = 0;
  private y = 0;
  private inside = false;
  private shown = '';
  private canvas: HTMLCanvasElement;
  private badgeAt: (x: number, y: number) => { kind: BadgeKind; count: number } | null;
  private extraAt: (x: number, y: number) => { key: string; html: string } | null;

  /** `badgeAt` answers which badge is under a point of the canvas (CSS pixels from its top-left). */
  constructor(
    canvas: HTMLCanvasElement,
    badgeAt: (x: number, y: number) => { kind: BadgeKind; count: number } | null,
    /** Anything else on the map that explains itself on hover (resident requests): a key and ready HTML. */
    extraAt: (x: number, y: number) => { key: string; html: string } | null = () => null,
  ) {
    this.extraAt = extraAt;
    this.canvas = canvas;
    this.badgeAt = badgeAt;
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:fixed;z-index:30;display:none;max-width:250px;padding:8px 10px;border-radius:8px;'
      + 'background:rgba(18,20,26,0.94);border:1px solid rgba(255,255,255,0.16);color:#cfd3dc;font-size:12px;line-height:1.45;pointer-events:none;';
    document.body.appendChild(this.el);
    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.x = e.clientX - rect.left; this.y = e.clientY - rect.top;
      this.inside = e.pointerType !== 'touch';
    });
    canvas.addEventListener('pointerleave', () => { this.inside = false; });
  }

  /** Call once per frame, after the map is drawn. `active`: the inspect tool is selected. */
  update(active: boolean): void {
    const badge = active && this.inside ? this.badgeAt(this.x, this.y) : null;
    const extra = !badge && active && this.inside ? this.extraAt(this.x, this.y) : null;
    if (!badge && !extra) {
      if (this.shown) { this.el.style.display = 'none'; this.shown = ''; }
      return;
    }
    const key = badge ? `${badge.kind}:${badge.count}` : extra!.key;
    if (!badge) {
      if (key !== this.shown) { this.shown = key; this.el.innerHTML = extra!.html; this.el.style.display = 'block'; }
    } else if (key !== this.shown) {
      this.shown = key;
      const count = badge.count > 1 ? ` <span style="color:#98a2b0;font-weight:400">· ${t('ui.badge.lots', { count: badge.count })}</span>` : '';
      this.el.innerHTML = `<div style="font-weight:700;color:#fff;margin-bottom:2px">`
        + `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:${PROBLEM_COLOUR[badge.kind]}"></span>`
        + `${t(`ui.badge.${badge.kind}.name`)}${count}</div>${t(`ui.badge.${badge.kind}.tip`)}`;
      this.el.style.display = 'block';
    }
    const rect = this.canvas.getBoundingClientRect();
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let left = rect.left + this.x + 16, top = rect.top + this.y + 16;
    if (left + w > window.innerWidth - 8) left = rect.left + this.x - w - 12;
    if (top + h > window.innerHeight - 8) top = rect.top + this.y - h - 12;
    this.el.style.left = `${Math.max(8, left)}px`;
    this.el.style.top = `${Math.max(8, top)}px`;
  }
}
