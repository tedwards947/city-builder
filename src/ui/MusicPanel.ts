import type { MusicManager } from '../audio/MusicManager';
import type { Track } from '../audio/types';

const VOLUME_KEY = 'city-builder.musicVolume';

/**
 * Name shown to the player: a take's own name ("Cloudy Sky · Drifting Over" -> "Drifting Over").
 * The full "Song · Take" name stays internal; the shuffle uses it to keep related takes apart.
 */
function displayName(trackName: string): string {
  return trackName.split(' · ').pop()!;
}

/** Song picker sections, in display order. */
const STYLES: [Track['genre'], string][] = [['ambient', 'Ambient'], ['classical', 'Classical'], ['country', 'Country'], ['edm', 'Electronic'], ['tropical', 'Tropical House']];

/** The effects volume the panel's FX slider controls (SoundEffects implements this). */
export interface EffectsSettings {
  getVolume(): number;
  setVolume(v: number): void;
}

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
  private listBtn: HTMLButtonElement;
  private marqueeAnim: Animation | null = null;
  private marqueeKey = '';
  private menuEl: HTMLElement;
  private musicManager: MusicManager;

  constructor(musicManager: MusicManager, effects: EffectsSettings | null = null) {
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
        <button class="mp-btn" id="mp-list" title="Pick a song" aria-label="Pick a song"
                aria-haspopup="true" aria-expanded="false" aria-controls="mp-menu">☰</button>
      </div>
      <div class="mp-levels">
        <div class="mp-level">
          <span class="mp-level-ico" aria-hidden="true">♪</span>
          <input class="mp-volume" id="mp-volume" type="range" min="0" max="100" step="1"
                 aria-label="Music volume" title="Music volume">
        </div>
        ${effects ? `<div class="mp-level">
          <span class="mp-level-ico" aria-hidden="true">FX</span>
          <input class="mp-volume" id="mp-sfx-volume" type="range" min="0" max="100" step="1"
                 aria-label="Effects volume" title="Effects volume">
        </div>` : ''}
      </div>
      <div class="mp-menu" id="mp-menu" role="menu" aria-label="Songs" hidden></div>
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

    if (effects) this.wireEffects(effects);

    // Song picker
    this.listBtn = document.getElementById('mp-list') as HTMLButtonElement;
    this.menuEl = document.getElementById('mp-menu')!;
    this.listBtn.addEventListener('click', () => (this.menuEl.hidden ? this.openMenu() : this.closeMenu()));
    this.menuEl.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-track]');
      if (!item) return;
      this.musicManager.playTrack(item.dataset.track!);
      this.closeMenu();
      this.updateUI();
    });
    // Close on a click anywhere else, or Escape
    document.addEventListener('pointerdown', (e) => {
      if (!this.menuEl.hidden && !this.el.contains(e.target as Node)) this.closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.menuEl.hidden) this.closeMenu();
    });

    this.updateUI();
  }

  /** Tracks grouped by style (Ambient, Classical, Country, Electronic), alphabetical within each; the current track is marked. */
  private openMenu() {
    const tracks = this.musicManager.getTrackList();
    const current = this.musicManager.getTrackName();
    this.menuEl.replaceChildren();
    if (tracks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'mp-menu-empty';
      empty.textContent = 'Songs are still loading…';
      this.menuEl.append(empty);
    }
    for (const [genre, label] of STYLES) {
      const names = tracks.filter(t => t.genre === genre).map(t => t.name)
        .sort((a, b) => displayName(a).localeCompare(displayName(b)));
      if (names.length === 0) continue;
      const head = document.createElement('div');
      head.className = 'mp-menu-song';
      head.textContent = label;
      this.menuEl.append(head);
      for (const name of names) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'mp-menu-item';
        item.setAttribute('role', 'menuitem');
        item.dataset.track = name;
        item.textContent = displayName(name);
        if (name === current) { item.classList.add('current'); item.setAttribute('aria-current', 'true'); }
        this.menuEl.append(item);
      }
    }
    this.menuEl.hidden = false;
    this.listBtn.setAttribute('aria-expanded', 'true');
    this.menuEl.querySelector<HTMLElement>('.current')?.scrollIntoView({ block: 'nearest' });
  }

  /** The effects slider, under the music slider. City ambience follows it. */
  private wireEffects(fx: EffectsSettings) {
    const vol = document.getElementById('mp-sfx-volume') as HTMLInputElement;
    vol.value = String(Math.round(fx.getVolume() * 100));
    vol.addEventListener('input', () => fx.setVolume(Number(vol.value) / 100));
    vol.addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow')) e.preventDefault(); });
    vol.addEventListener('change', () => vol.blur());
  }

  private closeMenu() {
    this.menuEl.hidden = true;
    this.listBtn.setAttribute('aria-expanded', 'false');
    // Don't leave focus on the panel: Space is the game's pause key
    (document.activeElement as HTMLElement | null)?.blur();
  }

  public updateUI() {
    this.setTrackName(this.musicManager.getTrackName());
    this.playPauseBtn.textContent = this.musicManager.isCurrentlyPlaying() ? '⏸' : '▶';
  }

  public onTrackChange(name: string) {
    this.setTrackName(name);
    this.updateUI();
  }

  private setTrackName(trackName: string) {
    const name = displayName(trackName);
    if (this.trackNameEl.textContent === name) return; // don't restart the scroll on every UI refresh
    this.trackNameEl.textContent = name;
    this.trackBoxEl.title = name;
    this.refreshMarquee();
  }

  /**
   * Marquee for titles wider than their box: hold at the start, scroll to the end once,
   * hold there, then fade back to the start (no scrolling backwards) and repeat.
   */
  private refreshMarquee() {
    const text = this.trackNameEl;
    const overflow = Math.round(text.scrollWidth - this.trackBoxEl.clientWidth);
    const key = `${text.textContent}|${overflow}`;
    if (key === this.marqueeKey) return; // same title, same fit: let the running loop continue
    this.marqueeKey = key;
    this.marqueeAnim?.cancel();
    this.marqueeAnim = null;

    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (overflow <= 2 || reducedMotion || typeof text.animate !== 'function') return; // CSS shows an ellipsis

    const HOLD_START = 3000, HOLD_END = 2500, FADE = 300; // ms
    const scroll = (overflow / 30) * 1000; // ~30 px/s
    const total = HOLD_START + scroll + HOLD_END + 2 * FADE;
    const at = (ms: number) => ms / total;
    const start = 'translateX(0)', end = `translateX(${-overflow}px)`;
    this.marqueeAnim = text.animate([
      { transform: start, opacity: 1, offset: 0 },
      { transform: start, opacity: 1, offset: at(HOLD_START), easing: 'ease-in-out' },
      { transform: end, opacity: 1, offset: at(HOLD_START + scroll) },
      { transform: end, opacity: 1, offset: at(HOLD_START + scroll + HOLD_END) },
      { transform: end, opacity: 0, offset: at(HOLD_START + scroll + HOLD_END + FADE) },
      { transform: start, opacity: 0, offset: at(HOLD_START + scroll + HOLD_END + FADE) },
      { transform: start, opacity: 1, offset: 1 },
    ], { duration: total, iterations: Infinity });
  }
}
