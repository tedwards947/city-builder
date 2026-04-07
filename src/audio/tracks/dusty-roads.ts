import type { Track } from '../types';

const ctryLeadV1 = [{pitch:'G4',length:0.25},{pitch:'B4',length:0.25},{pitch:'D5',length:0.25},{pitch:'G4',length:0.25},{pitch:'B4',length:0.25},{pitch:'D5',length:0.25},{pitch:'B4',length:0.25},{pitch:'G4',length:0.25}];
const ctryLeadV2 = [{pitch:'C5',length:0.25},{pitch:'E5',length:0.25},{pitch:'G5',length:0.25},{pitch:'E5',length:0.25},{pitch:'D5',length:0.25},{pitch:'B4',length:0.25},{pitch:'G4',length:0.25},{pitch:'B4',length:0.25}];
const ctryLeadC1 = [{pitch:'D5',length:0.5},{pitch:'E5',length:0.25},{pitch:'D5',length:0.25},{pitch:'B4',length:0.5},{pitch:'G4',length:0.5}];
const ctryLeadC2 = [{pitch:'A4',length:0.25},{pitch:'B4',length:0.25},{pitch:'C5',length:0.25},{pitch:'B4',length:0.25},{pitch:'A4',length:0.5},{pitch:'D4',length:0.5}];
const ctryLeadB1 = [{pitch:'E4',length:0.5},{pitch:'G4',length:0.5},{pitch:'A4',length:0.5},{pitch:'B4',length:0.5}];

const ctryBassV = [{pitch:'G2',length:0.5},{pitch:'D3',length:0.5},{pitch:'G2',length:0.5},{pitch:'D3',length:0.5}];
const ctryBassC = [{pitch:'C2',length:0.5},{pitch:'G2',length:0.5},{pitch:'D2',length:0.5},{pitch:'A2',length:0.5}];
const ctryBassB = [{pitch:'E2',length:0.5},{pitch:'B2',length:0.5},{pitch:'A2',length:0.5},{pitch:'E2',length:0.5}];

export const track: Track = {
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
  sequence: [0,0, 0,1,0,1, 2,3,2,3, 0,1,0,1, 2,3,2,3, 4,4,4,4, 2,3,2,3, 0,0, 0,0, 0,1,0,1, 2,3,2,3, 0,1,0,1, 2,3,2,3, 4,4,4,4, 2,3,2,3, 0,0]
};
