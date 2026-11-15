import type { MusicManager } from '../audio/MusicManager';

const VOLUME_KEY = 'city-builder.musicVolume';

function loadVolume(): number | null {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
  } catch { return null; }
}

function saveVolume(v: number): void {
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* storage unavailable */ }
}

export class MusicPanel {
  private el: HTMLElement;
  private trackNameEl: HTMLElement;
  private playPauseBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private musicManager: MusicManager;

  constructor(musicManager: MusicManager) {
    this.musicManager = musicManager;
    
    this.el = document.createElement('div');
    this.el.id = 'music-panel';
    this.el.innerHTML = `
      <div class="mp-track-info">
        <span class="mp-label">Now Playing</span>
        <span class="mp-track-name" id="mp-track-name">None</span>
      </div>
      <div class="mp-controls">
        <button class="mp-btn" id="mp-play-pause">▶</button>
        <button class="mp-btn" id="mp-next">⏭</button>
      </div>
      <input class="mp-volume" id="mp-volume" type="range" min="0" max="100" step="1"
             aria-label="Music volume" title="Music volume">
    `;

    document.body.appendChild(this.el);

    this.trackNameEl = document.getElementById('mp-track-name')!;
    this.playPauseBtn = document.getElementById('mp-play-pause') as HTMLButtonElement;
    this.nextBtn = document.getElementById('mp-next') as HTMLButtonElement;

    this.playPauseBtn.addEventListener('click', () => {
      this.musicManager.toggle();
      this.updateUI();
    });

    this.nextBtn.addEventListener('click', () => {
      this.musicManager.next();
      this.updateUI();
    });

    // Volume: remembered across sessions (storage can be unavailable, e.g. private windows)
    const volumeEl = document.getElementById('mp-volume') as HTMLInputElement;
    const saved = loadVolume();
    if (saved !== null) this.musicManager.setVolume(saved);
    volumeEl.value = String(Math.round(this.musicManager.getVolume() * 100));
    volumeEl.addEventListener('input', () => {
      const v = Number(volumeEl.value) / 100;
      this.musicManager.setVolume(v);
      saveVolume(v);
    });
    // Mouse/touch only: no arrow-key volume changes
    volumeEl.addEventListener('keydown', (e) => {
      if (e.key.startsWith('Arrow')) e.preventDefault();
    });
    // Release focus after a drag; the game ignores its shortcuts while an input has focus
    volumeEl.addEventListener('change', () => volumeEl.blur());

    this.updateUI();
  }

  public updateUI() {
    this.trackNameEl.textContent = this.musicManager.getTrackName();
    this.playPauseBtn.textContent = this.musicManager.isCurrentlyPlaying() ? '⏸' : '▶';
  }

  public onTrackChange(name: string) {
    this.trackNameEl.textContent = name;
    this.updateUI();
  }
}
