import type { WaterAmount, VegAmount } from '../sim/World';
import { DEBUG } from '../debug';
import { TUTORIAL_MAP_SIZE } from '../gen/tutorialMap';

export interface NewGameOptions {
  width: number;
  height: number;
  seed: number;
  waterAmount: WaterAmount;
  vegAmount:   VegAmount;
  /** Bare land: no water, no trees (the map for a hand-built tutorial city; ?debug=true only). */
  blank?: boolean;
}

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  small:  { width: 128, height: 128 },
  medium: { width: 256, height: 256 },
  large:  { width: 512, height: 512 },
  tutorial: { width: TUTORIAL_MAP_SIZE, height: TUTORIAL_MAP_SIZE },
};

export class NewGameDialog {
  private readonly el: HTMLElement;
  private selectedSize = 'medium';
  private selectedWater: WaterAmount = 'medium';
  private selectedVeg: VegAmount = 'low';

  private readonly onStart: (opts: NewGameOptions) => void;

  constructor(onStart: (opts: NewGameOptions) => void) {
    this.onStart = onStart;
    this.el = document.getElementById('new-game-modal')!;
    if (DEBUG) {
      // For hand-building the tutorial's map (gen/tutorialMap.ts): a small map of bare land.
      const last = this.el.querySelector('[data-size="large"]');
      const b = document.createElement('button');
      b.className = 'opt';
      b.dataset.size = 'tutorial';
      b.innerHTML = `Tutorial<br><span style="font-size:10px;opacity:.6">${TUTORIAL_MAP_SIZE}×${TUTORIAL_MAP_SIZE}, blank</span>`;
      last?.after(b);
    }
    this._wire();
  }

  show(): void { this.el.classList.remove('hidden'); }
  hide(): void { this.el.classList.add('hidden'); }

  private _wire(): void {
    // Size options
    this.el.querySelectorAll<HTMLButtonElement>('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedSize = btn.dataset.size!;
        this.el.querySelectorAll('[data-size]').forEach(b =>
          b.classList.toggle('active', b === btn));
      });
    });

    // Water options
    this.el.querySelectorAll<HTMLButtonElement>('[data-water]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedWater = btn.dataset.water as WaterAmount;
        this.el.querySelectorAll('[data-water]').forEach(b =>
          b.classList.toggle('active', b === btn));
      });
    });

    // Veg options
    this.el.querySelectorAll<HTMLButtonElement>('[data-veg]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedVeg = btn.dataset.veg as VegAmount;
        this.el.querySelectorAll('[data-veg]').forEach(b =>
          b.classList.toggle('active', b === btn));
      });
    });

    // Cancel
    this.el.querySelector('#ng-cancel')!.addEventListener('click', () => this.hide());

    // Backdrop click
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });

    // Start
    this.el.querySelector('#ng-start')!.addEventListener('click', () => {
      const seedInput = (this.el.querySelector('#ng-seed') as HTMLInputElement).value.trim();
      const seed = seedInput ? (parseInt(seedInput, 10) >>> 0) : (Math.random() * 0xFFFFFFFF) >>> 0;
      const { width, height } = SIZE_MAP[this.selectedSize];
      this.hide();
      this.onStart({ width, height, seed, waterAmount: this.selectedWater, vegAmount: this.selectedVeg, ...(this.selectedSize === 'tutorial' ? { blank: true } : {}) });
    });
  }
}
