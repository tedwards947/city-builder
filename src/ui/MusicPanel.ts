import type { MusicManager } from '../audio/MusicManager';

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
