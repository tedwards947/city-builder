import type { SaveManager } from '../persistence/SaveManager';
import type { World } from '../sim/World';
import type { SlotInfo } from '../persistence/SaveFormat';

const TOTAL_SLOTS = 5;

function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.floor(n));
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 10_000)    return sign + '$' + (abs / 1_000).toFixed(1) + 'k';
  return sign + '$' + abs;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export class SaveLoadPanel {
  private readonly el: HTMLElement;
  private readonly slotsEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private mode: 'save' | 'load' = 'save';

  constructor(
    private readonly manager: SaveManager,
    private readonly getWorld: () => World,
    private readonly onLoad: (world: World) => void,
  ) {
    this.el       = document.getElementById('save-load-modal')!;
    this.slotsEl  = document.getElementById('sl-slots')!;
    this.titleEl  = document.getElementById('sl-title')!;

    this.el.querySelector('#sl-cancel')!.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
  }

  showSave(): void {
    this.mode = 'save';
    this.titleEl.textContent = 'Save Game';
    this.hide(); // ensure fresh render
    this._render().then(() => this.el.classList.remove('hidden'));
  }

  showLoad(): void {
    this.mode = 'load';
    this.titleEl.textContent = 'Load Game';
    this._render().then(() => this.el.classList.remove('hidden'));
  }

  hide(): void { this.el.classList.add('hidden'); }

  private async _render(): Promise<void> {
    const slots = await this.manager.listSlots();
    const bySlot = new Map(slots.map(s => [s.slot, s]));
    this.slotsEl.innerHTML = '';

    for (let i = 1; i <= TOTAL_SLOTS; i++) {
      const info = bySlot.get(i);
      this.slotsEl.appendChild(this._makeSlot(i, info ?? null));
    }
  }

  private _makeSlot(slot: number, info: SlotInfo | null): HTMLElement {
    const div = document.createElement('div');
    div.className = 'sl-slot' + (info ? '' : ' sl-empty');

    if (info) {
      const ms = info.meta.mapSettings;
      const mapDesc = ms ? `${ms.width}×${ms.height} · ${ms.waterAmount} water` : '';
      div.innerHTML = `
        <div class="sl-slot-main">
          <span class="sl-name">${info.meta.name}</span>
          <span class="sl-detail">${formatDate(info.meta.savedAt)}</span>
          <span class="sl-detail">${info.meta.population.toLocaleString()} pop · ${formatMoney(info.meta.money)}</span>
          ${mapDesc ? `<span class="sl-detail sl-map">${mapDesc}</span>` : ''}
        </div>
        <button class="sl-delete" title="Delete" data-slot="${slot}">✕</button>
      `;
      div.querySelector('.sl-delete')!.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${info.meta.name}"?`)) {
          this.manager.deleteSlot(slot).then(() => this._render());
        }
      });
    } else {
      div.innerHTML = `<span class="sl-name sl-empty-label">— Empty —</span>`;
    }

    div.addEventListener('click', () => this._onSlotClick(slot, info));
    return div;
  }

  private _onSlotClick(slot: number, info: SlotInfo | null): void {
    if (this.mode === 'load') {
      if (!info) return;
      this.manager.loadGame(slot).then(world => {
        if (world) { this.hide(); this.onLoad(world); }
      });
    } else {
      // Save mode: prompt for name (pre-fill existing name or default).
      const defaultName = info?.meta.name ?? `City ${slot}`;
      const name = prompt('Save name:', defaultName);
      if (name === null) return; // cancelled
      this.manager.saveGame(this.getWorld(), slot, name || defaultName)
        .then(() => this.hide());
    }
  }
}
