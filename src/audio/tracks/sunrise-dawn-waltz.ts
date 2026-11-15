import { buildTrack, chords, fromMidi, line, ramp, section, shift, toMidi, transpose, type Voice } from '../compose.ts';

export const meta = {
  song: 'Sunrise',
  label: 'Dawn Waltz',
  blurb: 'The theme recast as a lilting 3/4 waltz at 120 BPM, with an oom-pah-pah accompaniment and a tinkling music box. It adds an E-minor middle, a verse where the theme sinks to a low voice under a new descant, and a lift to A major for the last chorus.',
};

// ---- Harmony -------------------------------------------------------------------------------
// One chord per 3/4 bar. Pad/stab voicings sit in octave 3-4; bass is its own lane.
const V: Record<string, string> = {
  G: 'G3+B3+D4', C: 'G3+C4+E4', Am: 'A3+C4+E4', Em: 'G3+B3+E4', D: 'F#3+A3+D4', D7: 'F#3+A3+C4',
  B7: 'F#3+A3+D#4', Bm: 'F#3+B3+D4', E7: 'G#3+B3+D4', Cmaj7: 'G3+B3+E4', Cm: 'G3+C4+Eb4',
};
const ROOT: Record<string, string> = {
  G: 'G2', C: 'C3', Am: 'A2', Em: 'E2', D: 'D3', D7: 'D3', B7: 'B2', Bm: 'B2', E7: 'E3', Cmaj7: 'C3', Cm: 'C3',
};
// Classic waltz bass: when a chord carries over into the next bar, the bass drops to its fifth.
const FIFTH: Record<string, string> = {
  G: 'D3', C: 'G2', Am: 'E3', Em: 'B2', D: 'A2', D7: 'A2', B7: 'F#3', Bm: 'F#3', E7: 'B2', Cmaj7: 'G2', Cm: 'G2',
};
const BAR = 3;
const bars = (prog: string) => prog.split(/\s+/).filter(b => b && b !== '|');
const f3 = (x: number) => x.toFixed(3);

/** "Oom": bass on the downbeat of every bar, root then fifth when the chord repeats. */
function waltzBass(prog: string, v = 0.6): Voice {
  const bs = bars(prog);
  return bs.map((c, i) => ({ t: i * BAR, pitch: i > 0 && bs[i - 1] === c ? FIFTH[c] : ROOT[c], len: BAR, vel: v }));
}
/** "Pah-pah": short chord stabs on beats 2 and 3 (the third a touch softer). */
function stabs(prog: string, v = 0.18): Voice[] {
  return chords(bars(prog).map(c => `r:1 ${V[c]}:1@${f3(v)} ${V[c]}:1@${f3(v * 0.8)}`).join(' '), 3);
}
/** Held chord, re-struck each bar. */
function padHold(prog: string, v = 0.18): Voice[] {
  return chords(bars(prog).map(c => `${V[c]}:${BAR}`).join(' '), 3, 0, v);
}
/** Music box: six quick eighths per bar, high above the melody. */
function musicBox(prog: string, v = 0.14): Voice {
  const out: Voice = [];
  bars(prog).forEach((c, i) => {
    const [a, b, d] = V[c].split('+').map(toMidi);
    [d + 12, a + 24, b + 24, a + 24, d + 12, b + 12].forEach((m, k) => {
      out.push({ t: i * BAR + k * 0.5, pitch: fromMidi(m), len: 0.5, vel: k === 0 ? v * 1.2 : v });
    });
  });
  return out;
}

// ---- Themes --------------------------------------------------------------------------------
// The original's long-short-long rise (G-A-B / C-D-G) as a waltz: half + quarter, then a dotted half.
const progA = 'G G C C Am G D7 D';
const themeA = 'G4:2 A4:1 | B4:3 | C5:2 D5:1 | G5:3 | E5:2 D5:1 | B4:2 G4:1 | A4:2 B4:1 | D5:3';
const progA2 = 'G G C C Em G D7 G';
const themeA2 = 'G4:2 A4:1 | B4:3 | C5:2 D5:1 | G5:3 | E5:1 F#5:1 G5:1 | D5:2 B4:1 | C5:2 A4:1 | G4:3';
const progAA = `${progA} ${progA2}`;
const themeAA = `${themeA} | ${themeA2}`;

// Low "cello" countermelody, moving while the theme holds.
const counterAA =
  'D4:3 | B3:2 C4:1 | E4:3 | G4:2 E4:1 | C4:3 | B3:2 D4:1 | C4:2 A3:1 | F#3:3 | ' +
  'G3:3 | B3:2 D4:1 | C4:3 | E4:2 C4:1 | B3:3 | D4:2 B3:1 | C4:2 F#3:1 | G3:3';

// New descant for the verse where the theme drops an octave into the low voice.
const descantAA =
  'B4:2 C5:1 | D5:3 | E5:2 D5:1 | C5:3 | E5:2 C5:1 | D5:2 B4:1 | C5:2 A4:1 | F#4:2 A4:1 | ' +
  'B4:2 C5:1 | D5:3 | E5:2 F#5:1 | G5:3 | G5:2 F#5:1 | D5:3 | C5:2 A4:1 | B4:3';

// E-minor middle: the motif turned upside down (B-A-G falling instead of G-A-B rising).
const progB = 'Em C Am Em Am D Em B7 Em C Am C D Em C D';
const themeB =
  'B4:2 A4:1 | G4:3 | A4:2 B4:1 | E4:3 | C5:2 B4:1 | A4:3 | B4:2 A4:1 | F#4:3 | ' +
  'B4:2 A4:1 | G4:3 | A4:2 B4:1 | C5:3 | D5:2 C5:1 | B4:2 A4:1 | G4:2 A4:1 | A4:2 F#4:1';
// High string-like pedal under the second half of B (re-struck every bar).
const pedalB = 'r:24 E5:3 E5:3 E5:3 E5:3 F#5:3 G5:3 E5:3 F#5:3';

// ---- Sections (bars of 3 beats) ------------------------------------------------------------

// 8 bars: music box alone, then the waltz accompaniment wakes up; a D4 pickup into the theme.
const intro = section('intro', 24, [
  line('r:23 D4:1@.6'),
  ramp(musicBox('G C G C G C Am D', 0.2), 1, 0.75),
  shift(waltzBass('G C Am D', 0.5), 12),
  ...stabs('G C Am D', 0.14).map(l => shift(l, 12)),
]);

// 16 bars: first statement, plain waltz.
const verse1 = section('verse1', 48, [
  line(themeAA, 0, 0.85),
  waltzBass(progAA, 0.6),
  ...stabs(progAA, 0.18),
]);

// 16 bars: music box and the low countermelody join.
const verse2 = section('verse2', 48, [
  line(themeAA, 0, 0.86),
  waltzBass(progAA, 0.62),
  ...stabs(progAA, 0.16),
  musicBox(progAA, 0.13),
  line(counterAA, 0, 0.28),
]);

// 16 bars: E-minor middle.
const middle = section('middle', 48, [
  line(themeB, 0, 0.82),
  waltzBass(progB, 0.6),
  ...stabs(progB, 0.18),
  line(pedalB, 0, 0.2),
]);

// 16 bars: roles swap. The theme sings low, a new descant floats on top, the "pah-pah" goes up an octave.
const verse3 = section('verse3', 48, [
  line(descantAA, 0, 0.72),
  transpose(line(themeAA, 0, 0.55), -12),
  waltzBass(progAA, 0.58),
  ...stabs(progAA, 0.12).map(l => transpose(l, 12)),
]);

// 12 bars: the waltz stops; held chords and the theme in its ORIGINAL 4/4 rhythm, floating over 3/4.
const interludeProg = 'Cmaj7 Cmaj7 Em Em Am Am C C Am Bm Am D';
const interlude = section('interlude', 36, [
  line('r:3 | r:1 G4:1.5 A4:.5 | B4:6 | r:3 | r:1 C5:1.5 D5:.5 | G5:6 | E5:3 | D5:3 | C5:3 | A4:3', 0, 0.6),
  waltzBass(interludeProg, 0.45),
  ...padHold(interludeProg, 0.18),
  musicBox(interludeProg, 0.12),
]);

// 8 bars: the minor tune again, now swinging through Bm and E7 to set up the key change.
const liftProg = 'Em C Am C D Bm E7 E7';
const lift = section('lift', 24, [
  ramp(line('B4:2 A4:1 | G4:3 | A4:2 B4:1 | C5:3 | D5:2 C#5:1 | B4:3 | E5:2 D5:1 | G#4:3'), 0.75, 0.92),
  ramp(waltzBass(liftProg), 0.55, 0.72),
  ...stabs(liftProg).map(l => ramp(l, 0.14, 0.22)),
  ramp(line('E5:3 E5:3 E5:3 E5:3 F#5:3 F#5:3 G#5:3 B5:3'), 0.16, 0.26),
]);

// 16 bars: last chorus up a whole step in A major, everything playing.
const finale = section('finale', 48, [
  line(themeAA, 0, 0.92),
  waltzBass(progAA, 0.7),
  ...stabs(progAA, 0.2),
  musicBox(progAA, 0.15),
  line(counterAA, 0, 0.3),
].map(v => transpose(v, 2)));

// 12 bars (A major): the theme once more, a borrowed minor iv for a plagal sigh, then home.
const outroProg = 'G G C C Am G Cm Cm G G';
const outro = section('outro', 36, [
  ramp(line('G4:2 A4:1 | B4:3 | C5:2 D5:1 | G5:3 | E5:3 | D5:3 | C5:3 | Eb5:2 D5:1 | B4:3 | A4:2 B4:1 | G4:6'), 0.82, 0.55),
  [...ramp(waltzBass(outroProg), 0.62, 0.45), ...line('G2:6@.45', 30)],
  ...stabs(outroProg).map(l => ramp(l, 0.18, 0.1)),
  ...chords(`${V.G}:6`, 3, 30, 0.18),
  [...ramp(musicBox('G G C C Am G'), 0.14, 0.09), ...line('D5:.5@.12 G5:.5@.12 B5:2@.1', 30)],
].map(v => transpose(v, 2)));

export const track = buildTrack({
  name: 'Sunrise · Dawn Waltz',
  genre: 'ambient',
  bpm: 120,
  sections: [intro, verse1, verse2, middle, verse3, interlude, lift, finale, outro],
  // 24 + 48*4 + 36 + 24 + 48 + 36 = 360 beats @120 = 3:00
  form: ['intro', 'verse1', 'verse2', 'middle', 'verse3', 'interlude', 'lift', 'finale', 'outro'],
});
