// Economics panel — tax rate controls and demand indicators.
// Toggleable via the "Econ" toolbar button.

import type { World } from '../sim/World';
import { t } from '../i18n';

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
function demandColor(d: number): string {
  if (d >= 1.2) return '#5c5';
  if (d >= 0.7) return '#cc5';
  return '#e55';
}

export class EconPanel {
  private readonly el: HTMLElement;
  private visible = false;

  constructor(private readonly getWorld: () => World) {
    this.el = document.getElementById('econ-panel')!;
    this._wire();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
  }

  /** Call each frame to refresh demand + land value display. */
  update(): void {
    if (!this.visible) return;
    const world = this.getWorld();

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
