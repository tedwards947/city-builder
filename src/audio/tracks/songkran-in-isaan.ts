import { bassline, breaths, DUM, firstBars, khaenHarmony, molam, tr } from '../molam.ts';

// Flowing molam in E minor at 128 BPM. A phin riff that never changes, the owner's "DUMM dum da da" bass,
// cowbell on the beat and ching on the offbeats, no snare. The khaen sings a bright chorus, and under it a
// second khaen breathes chords that follow the bass. Each verse moves up a fourth to A minor, like a khaen
// player changing mode; the second verse plays the tune in two-note khaen harmony. A bar on C# lifts the last
// choruses to F# minor.

const E_PENTA = [4, 7, 9, 11, 2]; // E G A B D: every tune stays inside it

/** The phin's riff, one bar, under nearly everything. */
const RIFF = 'E4:.5 r:.5 G4:.5 A4:.5 r:.5 E4:.5 D4:.5 r:.5';
/** The chorus: the khaen's hook, and the phin's answers for its second time through. */
const HOOK = 'B4:1 B4:.5 A4:.5 B4:1 D5:1 | E5:1 D5:.5 B4:.5 A4:2 | B4:1 B4:.5 A4:.5 B4:1 D5:1 | B4:.5 A4:.5 G4:1 E4:2 |'
  + ' D5:1 D5:.5 B4:.5 D5:1 E5:1 | E5:1 D5:.5 B4:.5 A4:2 | B4:1 B4:.5 A4:.5 B4:1 D5:1 | B4:.5 A4:.5 G4:1 E4:2';
const ANSWERS = 'r:4 | r:2 B4:.5 D5:.5 E5:1 | r:4 | r:2 G4:.5 A4:.5 B4:1 | r:4 | r:2 B4:.5 D5:.5 E5:1 | r:4 | r:2 D4:.5 E4:.5 G4:1';
const HOOK_ROOTS = 'E E D E G D E E';
/** The verse: a long, slow khaen tune (written in E; it plays up a fourth). */
const TUNE = 'E5:1.5 D5:.5 B4:1 A4:1 | B4:4 | E5:1.5 D5:.5 B4:1 D5:1 | E5:4 |'
  + ' G5:1.5 E5:.5 D5:1 B4:1 | A4:2 B4:2 | E5:1.5 D5:.5 B4:1 A4:1 | E4:4';
const TUNE_ROOTS = 'E E E E G D E E';
/** The breakdown: the khaen's long wail. */
const WAIL = 'E5:.5 G5:.5 B5:3 | A5:.5 G5:.5 E5:3';
/** A pickup into the chorus, over a bar on the chorus key's fifth. */
const PICKUP = 'r:2 E4:.5 G4:.5 A4:1';

const at = (roots: string, octave: number) => roots.split(' ').map(r => `${r}${octave}`).join(' ');
const BELL = 'x:1@1.2 x:1@.85 x:1@1.05 x:1@.85'; // on the beat, leaning on 1 and 3
const FLOW = { kick: 'x:2', ching: 'r:.5 x:.5' }; // soft kick on 1 and 3, ching on the offbeats

/** The band in key `k` (semitones above E) over one root a bar: bass, khaen chord breaths, cowbell, kick, ching. */
const band = (roots: string, k: number) => ({
  bass: tr(bassline(at(roots, 2), DUM), k),
  ...(() => { const b = breaths(at(roots, 3)); return { d1: tr(b.d1, k), d2: tr(b.d2, k) }; })(),
  bell: BELL, ...FLOW,
});
const BAND_VEL = { d1: 1.7, d2: 1.5, kick: 0.9, bell: 1.3, ching: 0.7 };

/** A bar on the fifth of key `k`: bass and khaen chords move first, the khaen picks up into the chorus. */
const turn = (name: string, k: number) => ({
  name, bars: 1, lead: tr(PICKUP, k), bass: tr(bassline('B2', DUM), k), kick: 'x:2',
  bell: 'x:1 x:1 x:.5 x:.5 x:.5 x:.5', d1: tr('r:.5 B3:1 B3:.5 r:2', k), d2: tr('r:.5 F#4:1 F#4:.5 r:2', k), vel: { d1: 1.7, d2: 1.5 },
});

export const { meta, track } = molam({
  song: 'Songkran in Isaan',
  blurb: '128 BPM flowing molam in E minor. A hypnotic phin riff, a "DUMM dum da da" bass, cowbell and ching; the khaen sings the chorus over khaen chord breaths, the verses move up to A minor (the second in khaen harmony), and the last choruses lift to F# minor.',
  bpm: 128,
  inst: { lead: 'khaen', riff: 'phin', bass: 'bass' },
  parts: [
    // Intro: the phin alone, then the bass and cowbell, then the groove with the hook teased.
    { name: 'riff', bars: 2, riff: RIFF },
    { name: 'bass-in', bars: 2, riff: RIFF, bass: bassline('E2', DUM), bell: BELL, vel: { bell: 1.1 } },
    { name: 'groove-in', bars: 4, lead: `r:8 ${firstBars(HOOK)}`, riff: RIFF, ...band('E', 0), vel: { ...BAND_VEL, lead: 0.65, d1: 1.3, d2: 1.1 } },
    { name: 'chorus', bars: 8, lead: HOOK, riff: RIFF, ...band(HOOK_ROOTS, 0), vel: BAND_VEL },
    // Verse 1, up a fourth: the slow tune, the band a little lighter.
    { name: 'verse', bars: 8, lead: tr(TUNE, 5), riff: tr(RIFF, 5), ...band(TUNE_ROOTS, 5), bell: 'x:1', vel: { ...BAND_VEL, kick: 0.8, bell: 0.9 } },
    turn('turn', 0),
    { name: 'chorus-2', bars: 8, lead: HOOK, riff: RIFF, ...band(HOOK_ROOTS, 0), vel: BAND_VEL },
    { name: 'chorus-2-answers', bars: 8, lead: HOOK, riff: ANSWERS, ...band(HOOK_ROOTS, 0), vel: { ...BAND_VEL, riff: 1.2, bell: 1.4, ching: 0.8 } },
    // Breakdown: no kick or cowbell, the bass holding long notes, the khaen wailing; then the hook builds back.
    { name: 'breakdown', bars: 4, lead: WAIL, riff: RIFF, bass: bassline('E2 E2 G2 E2', 'R:4'), ...breaths(at('E E G E', 3)), ching: 'r:.5 x:.5',
      vel: { lead: 0.85, riff: 0.7, bass: 0.8, d1: 1, d2: 0.9, ching: 0.6 } },
    { name: 'rebuild', bars: 4, lead: `${firstBars(HOOK)} | ${firstBars(HOOK)}`, riff: RIFF, ...band('E', 0), vel: { ...BAND_VEL, lead: 0.75, d1: 1.3, d2: 1.1 } },
    // Verse 2, up a fourth: the tune in two-note khaen harmony, in place of the chord breaths.
    { name: 'verse-2', bars: 8, lead: tr(TUNE, 5), riff: tr(RIFF, 5), ...band(TUNE_ROOTS, 5), d1: tr(khaenHarmony(TUNE, E_PENTA), 5), d2: undefined, bell: 'x:1',
      vel: { kick: 0.8, bell: 0.9, ching: 0.7, d1: 2.4 } },
    { name: 'verse-2-again', bars: 8, lead: tr(TUNE, 5), riff: tr(RIFF, 5), ...band(TUNE_ROOTS, 5), d1: tr(khaenHarmony(TUNE, E_PENTA), 5), d2: undefined,
      vel: { kick: 0.9, bell: 1.2, ching: 0.8, d1: 2.4 } },
    // A bar on C# lifts the last choruses to F# minor.
    turn('lift', 2),
    { name: 'chorus-3', bars: 8, lead: tr(HOOK, 2), riff: tr(RIFF, 2), ...band(HOOK_ROOTS, 2), vel: BAND_VEL },
    { name: 'chorus-3-answers', bars: 8, lead: tr(HOOK, 2), riff: tr(ANSWERS, 2), ...band(HOOK_ROOTS, 2), vel: { ...BAND_VEL, riff: 1.2, bell: 1.4, ching: 0.8 } },
    // Outro: the hook's opening once more, then the groove fades on the riff.
    { name: 'outro', bars: 4, lead: tr(`${firstBars(HOOK)} | r:8`, 2), riff: tr(RIFF, 2), ...band('E', 2), vel: { ...BAND_VEL, lead: 0.8 } },
    { name: 'fade', bars: 4, lead: tr('r:12 E4:4', 2), riff: tr(RIFF, 2), ...band('E', 2), fade: [0.85, 0.2], vel: { ...BAND_VEL, lead: 0.7 } },
  ],
});
