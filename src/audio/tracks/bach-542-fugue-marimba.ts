import { arrange, FUGUE } from '../bach542.ts';

/** Bach's Fugue in G minor, BWV 542, as a marimba quartet: one player per voice, spread left to right. */
export const track = arrange({
  name: 'Bach: Fugue in G minor, BWV 542',
  bpm: 84,
  piece: FUGUE,
  parts: {
    soprano: { inst: 'marimba', pan: 0.45 }, alto: { inst: 'marimba', pan: -0.4 },
    tenor: { inst: 'marimba', pan: 0.12 }, extra: { inst: 'marimba', vel: 0.8 },
    pedal: { inst: 'marimba', pan: -0.1 },
  },
});
