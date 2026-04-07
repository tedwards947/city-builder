import type { Track } from '../types';

const edmLeadA = [{pitch:'E4',length:0.25},{pitch:'G4',length:0.25},{pitch:'A4',length:0.5},{pitch:'E4',length:0.25},{pitch:'G4',length:0.25},{pitch:'B4',length:0.25},{pitch:'A4',length:0.25}];
const edmLeadB = [{pitch:'A4',length:0.25},{pitch:'C5',length:0.25},{pitch:'D5',length:0.5},{pitch:'A4',length:0.25},{pitch:'C5',length:0.25},{pitch:'E5',length:0.25},{pitch:'D5',length:0.25}];
const edmBassA = [{pitch:'E2',length:0.5},{pitch:'E2',length:0.5},{pitch:'E2',length:0.5},{pitch:'E2',length:0.5}];
const edmBassB = [{pitch:'A2',length:0.5},{pitch:'A2',length:0.5},{pitch:'G2',length:0.5},{pitch:'G2',length:0.5}];

export const track: Track = {
  name: "Neon Metropolis",
  genre: 'edm',
  bpm: 128,
  patterns: [
    [edmLeadA, edmBassA], 
    [edmLeadB, edmBassB], 
  ],
  sequence: [0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1]
};
