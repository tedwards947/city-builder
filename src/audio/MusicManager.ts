import type { Track } from './types';

const NOTES: Record<string, number> = {
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
  'C6': 1046.50,
};

export class MusicManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
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
      
      // Sort tracks by name for consistent order
      this.tracks = loadedTracks.sort((a, b) => a.name.localeCompare(b.name));
      
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
      this.masterGain.gain.value = 0.12; 
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
        this.playNote(note.pitch, this.nextNoteTime, note.length * secondsPerBeat, track.genre, i);
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

  private playNote(pitch: string, time: number, duration: number, genre: string, voiceIndex: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.masterGain);
    osc.frequency.setValueAtTime(NOTES[pitch] || 440, time);
    
    if (genre === 'edm') osc.type = voiceIndex === 0 ? 'sawtooth' : 'square';
    else if (genre === 'country') osc.type = voiceIndex === 0 ? 'triangle' : 'sine';
    else osc.type = 'sine';

    const attack = 0.05;
    const release = duration * 0.8;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(genre === 'ambient' ? 0.6 : 0.8, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration + release);
    osc.start(time); osc.stop(time + duration + release);
  }

  public getTrackName(): string { 
    if (this.tracks.length === 0) return "Loading...";
    return this.tracks[this.currentTrackIndex].name; 
  }
  
  public isCurrentlyPlaying(): boolean { return this.isPlaying; }
}
