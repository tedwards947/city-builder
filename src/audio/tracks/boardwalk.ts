import { tropical } from '../tropical.ts';

// A dotted synth-pluck hook over lush sevenths; marimba sings the verses, steel pan chords on the offbeat.
const VERSE = 'Bb F Gm Eb';
const DROP = 'Gm7 Ebmaj7 Bb F';
const VERSE_TUNE = 'F4:1 Bb4:1 D5:1.5 C5:.5 | C5:2 A4:2 | Bb4:1 G4:1 D5:1.5 Bb4:.5 | G4:3 r:1 | F4:1 Bb4:1 D5:1.5 F5:.5 | F5:1.5 C5:.5 A4:2 | G4:1 Bb4:1 D5:1 C5:1 | Bb4:2 G4:2';
const HOOK = 'G4:.75 Bb4:.75 D5:.5 F5:.75 D5:.75 C5:.5 | Bb4:.75 G4:.75 Bb4:.5 r:.5 D5:.5 C5:1 | D5:.75 F5:.75 G5:.5 F5:.75 D5:.75 Bb4:.5 | C5:1.5 A4:.5 F4:1 r:1 |'
  + ' G4:.75 Bb4:.75 D5:.5 F5:.75 D5:.75 C5:.5 | Bb4:.75 D5:.75 Eb5:.5 r:.5 G5:.5 F5:1 | D5:.75 F5:.75 Bb5:.5 A5:.75 F5:.75 C5:.5 | C5:1.5 D5:.5 C5:2';
const SING = 'D5:4 | G5:4 | F5:4 | F5:2 A5:2 | D5:4 | G5:4 | F5:2 D5:2 | C5:4';
const SKIP = 'R:.75 R:.75 R:.5 R:.75 O:.75 F:.5';
const BAND = { kick: 'four', clap: '24', shaker: '16', bass: SKIP, stab: 'r:.5 x:.5', pad: 'pump' } as const;
const DRIFT = { pattern: [0, 2, 4, 5, 4, 2], step: 0.5 };
const run = (a: string, b: string, c: string) => Array(4).fill(`${a}:.25 ${b}:.25 ${c}:.25 ${b}:.25`).join(' ');

export const { meta, track } = tropical({
  song: 'Boardwalk',
  blurb: '105 BPM tropical house in G minor. A dotted synth-pluck hook over Gm7-Ebmaj7-Bb-F, marimba verses, steel pan offbeats and a kalimba drift.',
  bpm: 105,
  inst: { lead: 'pluck', counter: 'marimba', stab: 'steelpan', arp: 'kalimba' },
  mix: { lead: 1, stab: 0.38 },
  low: { stab: 60, arp: 67 },
  parts: [
    { name: 'intro', bars: 4, prog: DROP, groove: { pad: 'hold', arp: DRIFT, energy: 0.7 } },
    { name: 'intro-beat', bars: 4, prog: DROP, groove: { kick: 'four', shaker: '8', bass: 'hold', pad: 'hold', arp: DRIFT, stab: 'r:.5 x:.5', energy: 0.75 } },
    { name: 'verse', bars: 8, prog: VERSE, counter: VERSE_TUNE, counterVel: 0.95, groove: { kick: 'four', clap: '24', shaker: '8', bass: SKIP, stab: 'r:.5 x:.5', energy: 0.75 } },
    {
      name: 'verse-2', bars: 8, prog: VERSE, counter: VERSE_TUNE, counterVel: 0.95, leadVel: 0.7,
      lead: 'r:2 D5:.5 F5:.5 Bb5:1 | r:2 C5:.5 F5:.5 A5:1 | r:2 D5:.5 G5:.5 Bb5:1 | r:2 Eb5:.5 G5:.5 Bb5:1',
      groove: { kick: 'four', clap: '24', shaker: '16', bass: SKIP, stab: 'r:.5 x:.5', pad: 'hold', energy: 0.8 },
    },
    {
      name: 'build', bars: 8, prog: 'Cm Dm Eb F', breath: true, leadVel: 0.7, counterVel: 0.8,
      lead: [run('C5', 'Eb5', 'G5'), run('D5', 'F5', 'A5'), run('Eb5', 'G5', 'Bb5'), run('F5', 'A5', 'C6')].join(' '),
      counter: 'G4:4 | A4:4 | Bb4:4 | C5:4',
      groove: { kick: 'four', clap: 'roll', shaker: '16', bass: 'R:.5 R:.5@.7', pad: 'hold', energy: 0.85 },
    },
    { name: 'drop', bars: 8, prog: DROP, lead: HOOK, groove: BAND },
    { name: 'drop-sing', bars: 8, prog: DROP, lead: HOOK, counter: SING, counterVel: 0.7, groove: BAND },
    {
      name: 'break', bars: 8, prog: DROP, breath: true, counterVel: 1,
      counter: 'G4:1.5 Bb4:1.5 D5:1 | Bb4:2 G4:2 | D5:1.5 F5:1.5 G5:1 | C5:4 | G4:1.5 Bb4:1.5 D5:1 | Bb4:1.5 Eb5:1.5 G5:1 | F5:2 D5:2 | C5:4',
      groove: { bass: 'hold', pad: 'hold', arp: DRIFT, energy: 0.65 },
    },
    { name: 'drop-2', bars: 8, prog: DROP, lead: HOOK, double: true, groove: { ...BAND, arp: DRIFT } },
    { name: 'drop-2-sing', bars: 8, prog: DROP, lead: HOOK, double: true, counter: SING, counterVel: 0.7, groove: { ...BAND, arp: DRIFT } },
    { name: 'outro', bars: 4, prog: VERSE, counter: VERSE_TUNE.split('|').slice(0, 4).join('|'), counterVel: 0.8, groove: { kick: 'four', shaker: '8', bass: 'hold', pad: 'pump', energy: 0.75 } },
    { name: 'tail', bars: 4, prog: DROP, fade: [0.8, 0.15], groove: { pad: 'hold', arp: DRIFT } },
  ],
  form: ['intro', 'intro-beat', 'verse', 'verse-2', 'build', 'drop', 'drop-sing', 'break', 'drop-2', 'drop-2-sing', 'outro', 'tail'],
});
