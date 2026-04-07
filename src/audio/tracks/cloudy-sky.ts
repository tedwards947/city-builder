import type { Track } from '../types';

export const track: Track = {
  name: "Cloudy Sky",
  genre: 'ambient',
  bpm: 70,
  patterns: [
    [[{pitch:'C4',length:2.0},{pitch:'F4',length:2.0}], [{pitch:'E3',length:4.0}]],
    [[{pitch:'G4',length:2.0},{pitch:'C5',length:2.0}], [{pitch:'A3',length:4.0}]],
  ],
  sequence: new Array(26).fill(0).flatMap(() => [0, 1])
};
