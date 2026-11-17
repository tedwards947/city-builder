// Economics panel — tax rate controls and demand indicators.
// Toggleable via the "Econ" toolbar button.

import type { World } from '../sim/World';
import { t } from '../i18n';
import { BALANCE } from '../data/balance';
import { taxLevelRange, setTaxLevel, taxEffect } from '../sim/tax';
import { pcCap } from '../sim/politics';

const STEP = 0.1;
const MIN_RATE = 0.1;
const MAX_RATE = 3.0;

function fmt(n: number): string { return n.toFixed(1); }
function demandLabel(d: number): string {
  if (d >= 1.8) return t('ui.econ.veryHigh');
  if (d >= 1.2) return t('ui.econ.high');
  if (d >= 0.8) return t('ui.econ.normal');
  if (d >= 0.4) return t('ui.econ.low');
  return t('ui.econ.veryLow');
}
/** "+$1,240/day"; the sign is always shown. */
function perDay(perTick: number): string {
  const n = Math.round(perTick * BALANCE.ticksPerDay);
  return t('ui.econ.perDay', { amount: (n < 0 ? '−$' : '+$') + Math.abs(n).toLocaleString() });
}
function demandColor(d: number): string {
  if (d >= 1.2) return '#5c5';
  if (d >= 0.7) return '#cc5';
  return '#e55';
}

export class EconPanel {
  private readonly el: HTMLElement;
  private visible = false;
  private readonly getWorld: () => World;

  constructor(getWorld: () => World) {
    this.getWorld = getWorld;
    this.el = document.getElementById('econ-panel')!;
    this._wire();
  }

  get isOpen(): boolean { return this.visible; }

  toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
  }

  private _updateTax(world: World): void {
    const range = taxLevelRange(), slider = document.getElementById('econ-tax-slider') as HTMLInputElement;
    slider.min = String(range.min); slider.max = String(range.max); slider.step = String(range.step);
    if (document.activeElement !== slider || Number(slider.value) !== world.budget.taxLevel) slider.value = String(world.budget.taxLevel);
    const e = taxEffect(world);
    const set = (id: string, text: string, sign = 0) => { const el = document.getElementById(id)!; el.textContent = text; el.className = sign > 0 ? 'pos' : sign < 0 ? 'neg' : ''; };
    set('econ-tax-pct', String(world.budget.taxLevel));
    set('econ-tax-min', range.min + '%'); set('econ-tax-max', range.max + '%');
    set('econ-tax-income', perDay(e.income));
    set('econ-tax-net', perDay(e.net), e.net);
    // Satisfaction is 0–1; shown as percentage points gained or lost to the tax level.
    const sat = Math.round(e.satisfactionDelta * 100);
    set('econ-tax-sat', sat === 0 ? t('ui.econ.noChange') : (sat > 0 ? '+' : '−') + Math.abs(sat) + '%', sat);
    const g = e.demandMult;
    set('econ-tax-growth', g === 1 ? t('ui.econ.noChange') : Number.isFinite(g) ? '×' + g.toFixed(2) : t('ui.econ.growthMax'), g > 1 ? 1 : g < 1 ? -1 : 0);
    // Political capital stops regenerating at its cap, so the figure would mislead there.
    const pcLine = document.getElementById('econ-tax-pc-line')!, atCap = world.budget.politicalCapital >= pcCap(world) && e.pcRegenPerDay > 0;
    pcLine.hidden = atCap;
    if (!atCap) set('econ-tax-pc', t('ui.econ.perDay', { amount: (e.pcRegenPerDay < 0 ? '−' : '+') + Math.abs(e.pcRegenPerDay).toFixed(1) }), e.pcRegenPerDay);
  }

  /** Call each frame to refresh demand + land value display. */
  update(): void {
    if (!this.visible) return;
    const world = this.getWorld();
    this._updateTax(world);

    (document.getElementById('econ-rate-r')!).textContent = fmt(world.budget.taxRates.R);
    (document.getElementById('econ-rate-c')!).textContent = fmt(world.budget.taxRates.C);
    (document.getElementById('econ-rate-i')!).textContent = fmt(world.budget.taxRates.I);

    this._setDemand('econ-dem-r', world.stats.rDemand);
    this._setDemand('econ-dem-c', world.stats.cDemand);
    this._setDemand('econ-dem-i', world.stats.iDemand);

    (document.getElementById('econ-lv')!).textContent = String(world.stats.avgLandValue);
  }

  private _setDemand(id: string, d: number): void {
    const el = document.getElementById(id)!;
    el.textContent = `${d.toFixed(2)}× (${demandLabel(d)})`;
    el.style.color = demandColor(d);
  }

  private _wire(): void {
    const slider = document.getElementById('econ-tax-slider') as HTMLInputElement;
    slider.addEventListener('input', () => { setTaxLevel(this.getWorld(), Number(slider.value)); });
    const adj = (zone: 'R' | 'C' | 'I', dir: 1 | -1) => () => {
      const rates = this.getWorld().budget.taxRates;
      rates[zone] = Math.max(MIN_RATE, Math.min(MAX_RATE,
        Math.round((rates[zone] + dir * STEP) * 10) / 10));
    };

    document.getElementById('econ-r-down')!.addEventListener('click', adj('R', -1));
    document.getElementById('econ-r-up')!.addEventListener('click',   adj('R',  1));
    document.getElementById('econ-c-down')!.addEventListener('click', adj('C', -1));
    document.getElementById('econ-c-up')!.addEventListener('click',   adj('C',  1));
    document.getElementById('econ-i-down')!.addEventListener('click', adj('I', -1));
    document.getElementById('econ-i-up')!.addEventListener('click',   adj('I',  1));
  }
}
