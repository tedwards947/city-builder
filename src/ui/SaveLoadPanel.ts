import { AUTOSAVE_BACKUP_SLOT } from '../persistence/Autosave';
import type { SaveManager } from '../persistence/SaveManager';
import type { World } from '../sim/World';
import type { SlotInfo } from '../persistence/SaveFormat';
import { t } from '../i18n';
import { SAVE_FILE_EXTENSION, saveFileName } from '../persistence/SaveFile';

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
  private readonly exportBtn: HTMLButtonElement;
  private readonly importBtn: HTMLButtonElement;
  private readonly fileInput: HTMLInputElement;

  private readonly manager: SaveManager;
  private readonly getWorld: () => World;
  private readonly onLoad: (world: World) => void;

  constructor(
    manager: SaveManager,
    getWorld: () => World,
    onLoad: (world: World) => void,
  ) {
    this.manager = manager;
    this.getWorld = getWorld;
    this.onLoad = onLoad;
    this.el       = document.getElementById('save-load-modal')!;
    this.slotsEl  = document.getElementById('sl-slots')!;
    this.titleEl  = document.getElementById('sl-title')!;

    const cancel = this.el.querySelector('#sl-cancel')!;
    cancel.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });

    // Save to / load from a file, next to Cancel: Export in save mode,
    // Import in load mode.
    this.exportBtn = document.createElement('button');
    this.exportBtn.className = 'btn';
    this.exportBtn.textContent = t('ui.saveLoad.exportFile');
    this.exportBtn.addEventListener('click', () => this._export());

    this.importBtn = document.createElement('button');
    this.importBtn.className = 'btn';
    this.importBtn.textContent = t('ui.saveLoad.importFile');
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = `${SAVE_FILE_EXTENSION},.json,application/json`;
    this.fileInput.style.display = 'none';
    this.importBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      this.fileInput.value = ''; // so picking the same file again still fires
      if (file) void this._import(file);
    });

    cancel.before(this.exportBtn, this.importBtn, this.fileInput);
    this._syncFileButtons();
  }

  private _syncFileButtons(): void {
    this.exportBtn.style.display = this.mode === 'save' ? '' : 'none';
    this.importBtn.style.display = this.mode === 'load' ? '' : 'none';
  }

  /** Download the current city as a save file. */
  private _export(): void {
    const name = prompt(t('ui.saveLoad.exportNamePrompt'), 'My City');
    if (name === null) return; // cancelled
    const text = this.manager.exportGame(this.getWorld(), name || 'My City');
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = saveFileName(name || 'My City');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.hide();
  }

  /** Load a city from a save file the player picked. */
  private async _import(file: File): Promise<void> {
    try {
      const world = this.manager.importGame(await file.text());
      this.hide();
      this.onLoad(world);
    } catch (err) {
      alert(t('ui.saveLoad.importFailed', { reason: err instanceof Error ? err.message : String(err) }));
    }
  }

  showSave(): void {
    this.mode = 'save';
    this._syncFileButtons();
    this.titleEl.textContent = t('ui.saveLoad.saveGame');
    this.hide(); // ensure fresh render
    this._render().then(() => this.el.classList.remove('hidden'));
  }

  showLoad(): void {
    this.mode = 'load';
    this._syncFileButtons();
    this.titleEl.textContent = t('ui.saveLoad.loadGame');
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
    // The autosave as it was before an update rebuilt it (SaveManager.loadGame): to load, never to save over.
    const backup = bySlot.get(AUTOSAVE_BACKUP_SLOT);
    if (backup && this.mode === 'load') {
      this.slotsEl.appendChild(this._makeSlot(AUTOSAVE_BACKUP_SLOT, { ...backup, meta: { ...backup.meta, name: t('ui.saveLoad.backupName') } }));
    }
  }

  private _makeSlot(slot: number, info: SlotInfo | null): HTMLElement {
    const div = document.createElement('div');
    div.className = 'sl-slot' + (info ? '' : ' sl-empty');

    if (info) {
      const ms = info.meta.mapSettings;
      const mapDesc = ms ? `${ms.width}×${ms.height} · ${ms.waterAmount} ${t('ui.saveLoad.water')}` : '';
      div.innerHTML = `
        <div class="sl-slot-main">
          <span class="sl-name"></span>
          <span class="sl-detail">${formatDate(info.meta.savedAt)}</span>
          <span class="sl-detail">${info.meta.population.toLocaleString()} ${t('ui.saveLoad.pop')} · ${formatMoney(info.meta.money)}</span>
          ${mapDesc ? `<span class="sl-detail sl-map">${mapDesc}</span>` : ''}
        </div>
        <button class="sl-delete" title="${t('common.delete')}" data-slot="${slot}">✕</button>
      `;
      div.querySelector('.sl-name')!.textContent = info.meta.name;
      div.querySelector('.sl-delete')!.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(t('ui.saveLoad.deleteConfirm', { name: info.meta.name }))) {
          this.manager.deleteSlot(slot).then(() => this._render());
        }
      });
    } else {
      div.innerHTML = `<span class="sl-name sl-empty-label">${t('common.empty')}</span>`;
    }

    div.addEventListener('click', () => this._onSlotClick(slot, info));
    return div;
  }

  private _onSlotClick(slot: number, info: SlotInfo | null): void {
    if (this.mode === 'load') {
      if (!info) return;
      this.manager.loadGame(slot).then(world => {
        if (world) { this.hide(); this.onLoad(world); }
      }).catch((err) => {
        alert(t('ui.saveLoad.loadFailed', { reason: err instanceof Error ? err.message : String(err) }));
      });
    } else {
      // Save mode: prompt for name (pre-fill existing name or default).
      const defaultName = info?.meta.name ?? `City ${slot}`;
      const name = prompt(t('ui.saveLoad.saveNamePrompt'), defaultName);
      if (name === null) return; // cancelled
      this.manager.saveGame(this.getWorld(), slot, name || defaultName)
        .then(() => this.hide());
    }
  }
}
