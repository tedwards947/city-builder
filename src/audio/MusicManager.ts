export interface Note {
  pitch: string; // e.g. "C4", "rest"
  length: number; // in beats
}

export interface Track {
  name: string;
  genre: 'edm' | 'country' | 'ambient';
  bpm: number;
  patterns: Note[][][]; // patterns[patternIndex][voiceIndex][noteIndex]
  sequence: number[]; // order of pattern indices to play
}

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
  private seqIndex = 0; // index in the sequence
  private noteIndex = 0; // index in the current pattern
  private timerId: number | null = null;
  private onTrackChange: (trackName: string) => void;

  constructor(onTrackChange: (trackName: string) => void) {
    this.onTrackChange = onTrackChange;
    this.initTracks();
  }

  private initTracks() {
    // 1. EDM: Neon Metropolis (128 BPM)
    // 1 bar = 4 beats = 1.875s. 3 mins = ~96 bars.
    const edmLeadA = [{pitch:'E4',length:0.25},{pitch:'G4',length:0.25},{pitch:'A4',length:0.5},{pitch:'E4',length:0.25},{pitch:'G4',length:0.25},{pitch:'B4',length:0.25},{pitch:'A4',length:0.25}];
    const edmLeadB = [{pitch:'A4',length:0.25},{pitch:'C5',length:0.25},{pitch:'D5',length:0.5},{pitch:'A4',length:0.25},{pitch:'C5',length:0.25},{pitch:'E5',length:0.25},{pitch:'D5',length:0.25}];
    const edmBassA = [{pitch:'E2',length:0.5},{pitch:'E2',length:0.5},{pitch:'E2',length:0.5},{pitch:'E2',length:0.5}];
    const edmBassB = [{pitch:'A2',length:0.5},{pitch:'A2',length:0.5},{pitch:'G2',length:0.5},{pitch:'G2',length:0.5}];
    
    this.tracks.push({
      name: "Neon Metropolis",
      genre: 'edm',
      bpm: 128,
      patterns: [
        [edmLeadA, edmBassA], // Pattern 0 (Intro/Verse)
        [edmLeadB, edmBassB], // Pattern 1 (Chorus)
      ],
      // Sequence to reach ~3 mins (96 bars)
      sequence: [0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1]
    });

    // 2. Country: Dusty Roads (110 BPM)
    const ctryLeadV1 = [{pitch:'G4',length:0.25},{pitch:'B4',length:0.25},{pitch:'D5',length:0.25},{pitch:'G4',length:0.25},{pitch:'B4',length:0.25},{pitch:'D5',length:0.25},{pitch:'B4',length:0.25},{pitch:'G4',length:0.25}];
    const ctryLeadV2 = [{pitch:'C5',length:0.25},{pitch:'E5',length:0.25},{pitch:'G5',length:0.25},{pitch:'E5',length:0.25},{pitch:'D5',length:0.25},{pitch:'B4',length:0.25},{pitch:'G4',length:0.25},{pitch:'B4',length:0.25}];
    const ctryLeadC1 = [{pitch:'D5',length:0.5},{pitch:'E5',length:0.25},{pitch:'D5',length:0.25},{pitch:'B4',length:0.5},{pitch:'G4',length:0.5}];
    const ctryLeadC2 = [{pitch:'A4',length:0.25},{pitch:'B4',length:0.25},{pitch:'C5',length:0.25},{pitch:'B4',length:0.25},{pitch:'A4',length:0.5},{pitch:'D4',length:0.5}];
    const ctryLeadB1 = [{pitch:'E4',length:0.5},{pitch:'G4',length:0.5},{pitch:'A4',length:0.5},{pitch:'B4',length:0.5}];
    
    const ctryBassV = [{pitch:'G2',length:0.5},{pitch:'D3',length:0.5},{pitch:'G2',length:0.5},{pitch:'D3',length:0.5}];
    const ctryBassC = [{pitch:'C2',length:0.5},{pitch:'G2',length:0.5},{pitch:'D2',length:0.5},{pitch:'A2',length:0.5}];
    const ctryBassB = [{pitch:'E2',length:0.5},{pitch:'B2',length:0.5},{pitch:'A2',length:0.5},{pitch:'E2',length:0.5}];
    
    this.tracks.push({
      name: "Dusty Roads",
      genre: 'country',
      bpm: 110,
      patterns: [
        [ctryLeadV1, ctryBassV], // 0: Verse A
        [ctryLeadV2, ctryBassV], // 1: Verse B
        [ctryLeadC1, ctryBassC], // 2: Chorus A
        [ctryLeadC2, ctryBassC], // 3: Chorus B
        [ctryLeadB1, ctryBassB], // 4: Bridge
      ],
      // Sequence: Intro(0,0), V1(0,1,0,1), C1(2,3,2,3), V2(0,1,0,1), C2(2,3,2,3), Bridge(4,4,4,4), C3(2,3,2,3), Outro(0,0)
      sequence: [0,0, 0,1,0,1, 2,3,2,3, 0,1,0,1, 2,3,2,3, 4,4,4,4, 2,3,2,3, 0,0, 0,0, 0,1,0,1, 2,3,2,3, 0,1,0,1, 2,3,2,3, 4,4,4,4, 2,3,2,3, 0,0]
    });

    // 3. Ambient: Cloudy Sky (70 BPM)
    // 1 bar = 4 beats = 3.43s. 3 mins = ~52 bars.
    this.tracks.push({
      name: "Cloudy Sky",
      genre: 'ambient',
      bpm: 70,
      patterns: [
        [[{pitch:'C4',length:2.0},{pitch:'F4',length:2.0}], [{pitch:'E3',length:4.0}]],
        [[{pitch:'G4',length:2.0},{pitch:'C5',length:2.0}], [{pitch:'A3',length:4.0}]],
      ],
      sequence: new Array(26).fill(0).flatMap(() => [0, 1]) // 52 bars
    });

    // 4. Ambient: Rainy Day (60 BPM)
    // 1 bar = 4 beats = 4s. 3 mins = 45 bars.
    this.tracks.push({
      name: "Rainy Day",
      genre: 'ambient',
      bpm: 60,
      patterns: [
        [[{pitch:'A4',length:1.0},{pitch:'G4',length:1.0},{pitch:'E4',length:2.0}], [{pitch:'A2',length:4.0}]],
        [[{pitch:'F4',length:1.0},{pitch:'E4',length:1.0},{pitch:'C4',length:2.0}], [{pitch:'F2',length:4.0}]],
      ],
      sequence: new Array(23).fill(0).flatMap(() => [0, 1])
    });

    // 5. Ambient: Sunrise (80 BPM)
    // 1 bar = 4 beats = 3s. 3 mins = 60 bars.
    this.tracks.push({
      name: "Sunrise",
      genre: 'ambient',
      bpm: 80,
      patterns: [
        [[{pitch:'G4',length:1.5},{pitch:'A4',length:0.5},{pitch:'B4',length:2.0}], [{pitch:'G3',length:4.0}]],
        [[{pitch:'C5',length:1.5},{pitch:'D5',length:0.5},{pitch:'G5',length:2.0}], [{pitch:'C4',length:4.0}]],
      ],
      sequence: new Array(30).fill(0).flatMap(() => [0, 1])
    });
  }

  private ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.12; 
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  public start() {
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
    const wasPlaying = this.isPlaying;
    this.stop();
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.noteIndex = 0;
    this.seqIndex = 0;
    if (wasPlaying) this.start(); else this.onTrackChange(this.tracks[this.currentTrackIndex].name);
  }

  private scheduler() {
    while (this.isPlaying && this.nextNoteTime < this.ctx!.currentTime + 0.1) {
      this.playPatternStep();
    }
    if (this.isPlaying) this.timerId = setTimeout(() => this.scheduler(), 25) as unknown as number;
  }

  private playPatternStep() {
    const track = this.tracks[this.currentTrackIndex];
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

    // If we finished the first voice's pattern, move to next sequence part
    if (this.noteIndex >= pattern[0].length) {
      this.noteIndex = 0;
      this.seqIndex++;
      
      // If we finished the whole song sequence, move to the next track
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

  public getTrackName(): string { return this.tracks[this.currentTrackIndex].name; }
  public isCurrentlyPlaying(): boolean { return this.isPlaying; }
}
