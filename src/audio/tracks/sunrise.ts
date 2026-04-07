import type { Track } from '../types';

export const track: Track = {
  name: "Sunrise",
  genre: 'ambient',
  bpm: 80,
  patterns: [
    [[{pitch:'G4',length:1.5},{pitch:'A4',length:0.5},{pitch:'B4',length:2.0}], [{pitch:'G3',length:4.0}]],
    [[{pitch:'C5',length:1.5},{pitch:'D5',length:0.5},{pitch:'G5',length:2.0}], [{pitch:'C4',length:4.0}]],
  ],
  sequence: new Array(30).fill(0).flatMap(() => [0, 1])
};
