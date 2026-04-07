import type { WaterAmount, VegAmount } from '../sim/World';

export interface NewGameOptions {
  width: number;
  height: number;
  seed: number;
  waterAmount: WaterAmount;
  vegAmount:   VegAmount;
}

const SIZE_MAP: Record<string, { width: number; height: number }> = {
  small:  { width: 128, height: 128 },
  medium: { width: 256, height: 256 },
  large:  { width: 512, height: 512 },
};

export class NewGameDialog {
  private readonly el: HTMLElement;
  private selectedSize = 'medium';
  private selectedWater: WaterAmount = 'medium';
  private selectedVeg: VegAmount = 'low';

  constructor(private readonly onStart: (opts: NewGameOptions) => void) {
    this.el = document.getElementById('new-game-modal')!;
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
      this.onStart({ width, height, seed, waterAmount: this.selectedWater, vegAmount: this.selectedVeg });
    });
  }
}
