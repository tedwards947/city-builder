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
