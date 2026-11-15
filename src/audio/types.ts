export interface Note {
  pitch: string; // e.g. "C4", "rest"
  length: number; // in beats
  /** Sounding duration in beats, when it differs from the step length (lets a note ring past the next step). */
  hold?: number;
  /** Velocity multiplier, 0..1 (default 1). */
  vel?: number;
}

export interface Track {
  name: string;
  genre: 'edm' | 'country' | 'ambient';
  bpm: number;
  patterns: Note[][][]; // patterns[patternIndex][voiceIndex][noteIndex]
  sequence: number[]; // order of pattern indices to play
}
