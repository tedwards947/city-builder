import type { Track } from '../types';

export const track: Track = {
  name: "Rainy Day",
  genre: 'ambient',
  bpm: 60,
  patterns: [
    [[{pitch:'A4',length:1.0},{pitch:'G4',length:1.0},{pitch:'E4',length:2.0}], [{pitch:'A2',length:4.0}]],
    [[{pitch:'F4',length:1.0},{pitch:'E4',length:1.0},{pitch:'C4',length:2.0}], [{pitch:'F2',length:4.0}]],
  ],
  sequence: new Array(23).fill(0).flatMap(() => [0, 1])
};
