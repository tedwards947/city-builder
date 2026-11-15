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
  private trackBoxEl: HTMLElement;
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
        <span class="mp-track-name" id="mp-track-box"><span class="mp-marquee" id="mp-track-name">None</span></span>
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
    this.trackBoxEl = document.getElementById('mp-track-box')!;
    // The title box narrows with the window; re-check whether the title still fits
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.refreshMarquee()).observe(this.trackBoxEl);
    }
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
    this.setTrackName(this.musicManager.getTrackName());
    this.playPauseBtn.textContent = this.musicManager.isCurrentlyPlaying() ? '⏸' : '▶';
  }

  public onTrackChange(name: string) {
    this.setTrackName(name);
    this.updateUI();
  }

  private setTrackName(name: string) {
    if (this.trackNameEl.textContent === name) return; // don't restart the scroll on every UI refresh
    this.trackNameEl.textContent = name;
    this.trackBoxEl.title = name;
    this.refreshMarquee();
  }

  /** Scroll the title back and forth when it is wider than its box. */
  private refreshMarquee() {
    const text = this.trackNameEl;
    const overflow = text.scrollWidth - this.trackBoxEl.clientWidth;
    const scrolling = overflow > 2;
    if (scrolling) {
      text.style.setProperty('--mp-shift', `${-overflow}px`);
      // ~30 px/s for the moving part, plus the pauses at each end
      text.style.setProperty('--mp-duration', `${(overflow / 30 / 0.6).toFixed(2)}s`);
    }
    text.classList.toggle('scrolling', scrolling);
  }
}
