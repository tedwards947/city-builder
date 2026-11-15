import type { Track } from './types';

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency for a note name like "C4", "F#3" or "Bb2" (equal temperament, A4 = 440 Hz). */
export function noteFrequency(pitch: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(pitch);
  if (!m) return 440;
  const semis = SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Playlist order: songs rotate so the same song never plays twice in a row.
 * Takes of a song are named "Song · Take"; round 1 plays each song's original
 * (alphabetical by song), later rounds play one take of each song in turn.
 */
export function playlistOrder(tracks: Track[]): Track[] {
  const families = new Map<string, Track[]>();
  for (const t of tracks) {
    const song = t.name.split(' · ')[0];
    if (!families.has(song)) families.set(song, []);
    families.get(song)!.push(t);
  }
  const groups = [...families.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, ts]) => ts.sort((a, b) => a.name.localeCompare(b.name)));
  const out: Track[] = [];
  for (let round = 0; out.length < tracks.length; round++) {
    for (const g of groups) if (round < g.length) out.push(g[round]);
  }
  return out;
}

/** Master gain at full volume; the volume slider scales this. */
const BASE_GAIN = 0.12;

export class MusicManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 1;
  private currentTrackIndex = 0;
  private tracks: Track[] = [];
  private isPlaying = false;
  private nextNoteTime = 0;
  private seqIndex = 0; 
  private noteIndex = 0; 
  private timerId: number | null = null;
  private onTrackChange: (trackName: string) => void;
  public ready: Promise<void>;

  constructor(onTrackChange: (trackName: string) => void) {
    this.onTrackChange = onTrackChange;
    this.ready = this.loadTracks();
  }

  private async loadTracks() {
    // In Vite, we can use import.meta.glob to find all tracks
    // In test environment, we might need to handle this differently if import.meta.glob is not available
    try {
      const modules = import.meta.glob('./tracks/*.ts');
      const loadedTracks: Track[] = [];
      
      for (const path in modules) {
        try {
          const mod = await modules[path]() as { track: Track };
          if (mod && mod.track) {
            loadedTracks.push(mod.track);
          }
        } catch (err) {
          console.error(`Failed to load track at ${path}:`, err);
        }
      }
      
      this.tracks = playlistOrder(loadedTracks);
      
      if (this.tracks.length === 0) {
        console.warn("No tracks were successfully loaded.");
      }
    } catch (e) {
      // Handle environment where import.meta.glob is missing (like Node tests)
      console.warn("import.meta.glob not available, tracks must be added manually in this environment.");
    }
  }

  // Helper for tests or manual track addition
  public addTrack(track: Track) {
    this.tracks.push(track);
  }

  private ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx!.createGain();
      this.masterGain.connect(this.ctx!.destination);
      this.masterGain.gain.value = BASE_GAIN * this.volume;
    }
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
  }

  public start() {
    if (this.tracks.length === 0) return;
    this.ensureContext();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx!.currentTime;
    this.scheduler();
    this.onTrackChange(this.tracks[this.currentTrackIndex].name);
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId) { clearTimeout(this.timerId); this.timerId = null; }
  }

  public toggle() {
    if (this.isPlaying) this.stop(); else this.start();
  }

  public next() {
    if (this.tracks.length === 0) return;
    const wasPlaying = this.isPlaying;
    this.stop();
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.noteIndex = 0;
    this.seqIndex = 0;
    if (wasPlaying) this.start(); else this.onTrackChange(this.tracks[this.currentTrackIndex].name);
  }

  /** Every loaded track name, in playlist order. */
  public getTrackNames(): string[] {
    return this.tracks.map(t => t.name);
  }

  /**
   * Jump to a track by name and play it from the top (starting playback if paused).
   * The playlist then carries on in its usual order from that track. Returns false for an unknown name.
   */
  public playTrack(name: string): boolean {
    const index = this.tracks.findIndex(t => t.name === name);
    if (index < 0) return false;
    this.stop();
    this.currentTrackIndex = index;
    this.noteIndex = 0;
    this.seqIndex = 0;
    this.start();
    return true;
  }

  private scheduler() {
    // 0.5s lookahead: large enough that background tab throttling (setTimeout → ~1s) won't cause gaps
    let loopLimit = 0;
    while (this.isPlaying && this.nextNoteTime < this.ctx!.currentTime + 0.5 && loopLimit++ < 50) {
      this.playPatternStep();
    }
    if (this.isPlaying) this.timerId = setTimeout(() => this.scheduler(), 25) as unknown as number;
  }

  private playPatternStep() {
    const track = this.tracks[this.currentTrackIndex];
    if (!track) return;
    
    const patternIdx = track.sequence[this.seqIndex % track.sequence.length];
    const pattern = track.patterns[patternIdx];
    const secondsPerBeat = 60.0 / track.bpm;
    
    pattern.forEach((voice, i) => {
      const note = voice[this.noteIndex % voice.length];
      if (note.pitch !== 'rest') {
        this.playNote(note.pitch, this.nextNoteTime, (note.hold ?? note.length) * secondsPerBeat, track.genre, i, note.vel ?? 1);
      }
    });

    const stepLength = pattern[0][this.noteIndex % pattern[0].length].length * secondsPerBeat;
    this.nextNoteTime += stepLength;
    this.noteIndex++;

    if (this.noteIndex >= pattern[0].length) {
      this.noteIndex = 0;
      this.seqIndex++;
      
      if (this.seqIndex >= track.sequence.length) {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
        this.seqIndex = 0;
        this.onTrackChange(this.tracks[this.currentTrackIndex].name);
      }
    }
  }

  private playNote(pitch: string, time: number, duration: number, genre: string, voiceIndex: number, vel = 1) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.masterGain);
    osc.frequency.setValueAtTime(noteFrequency(pitch), time);
    
    if (genre === 'edm') osc.type = voiceIndex === 0 ? 'sawtooth' : 'square';
    else if (genre === 'country') osc.type = voiceIndex === 0 ? 'triangle' : 'sine';
    else osc.type = 'sine';

    // 50 ms fade-in, shortened for fast notes so 16ths start on time
    const attack = Math.min(0.05, duration * 0.2);
    const release = duration * 0.8;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime((genre === 'ambient' ? 0.6 : 0.8) * vel, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration + release);
    osc.start(time); osc.stop(time + duration + release);
  }

  public getTrackName(): string { 
    if (this.tracks.length === 0) return "Loading...";
    return this.tracks[this.currentTrackIndex].name; 
  }
  
  public isCurrentlyPlaying(): boolean { return this.isPlaying; }

  /** Music volume, 0..1. Takes effect immediately, with a short ramp to avoid clicks. */
  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(BASE_GAIN * this.volume, this.ctx.currentTime, 0.02);
    }
  }

  public getVolume(): number { return this.volume; }
}
