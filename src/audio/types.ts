export interface Note {
  pitch: string; // e.g. "C4", "rest"
  length: number; // in beats
  /** Sounding duration in beats, when it differs from the step length (lets a note ring past the next step). */
  hold?: number;
  /** Velocity multiplier, 0..1 (default 1). */
  vel?: number;
}

/** Instruments for tracks that name one per voice (see instruments.ts). marimba: long notes are rolled. */
export type Instrument = 'marimba';

export interface Track {
  name: string;
  genre: 'edm' | 'country' | 'ambient' | 'classical';
  bpm: number;
  patterns: Note[][][]; // patterns[patternIndex][voiceIndex][noteIndex]
  sequence: number[]; // order of pattern indices to play
  /** Instrument for each voice; a track with these plays through instruments.ts instead of the genre synth. */
  instruments?: Instrument[];
  /** Stereo position for each voice, -1..1. */
  pans?: number[];
}
