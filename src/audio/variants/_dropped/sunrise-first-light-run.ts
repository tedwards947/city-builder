import { buildTrack, chords, fromMidi, line, ramp, section, shift, toMidi, transpose, type Voice } from '../../compose.ts';

export const meta = {
  song: 'Sunrise',
  label: 'First Light Run',
  blurb: 'A brighter, forward-moving take at 120 BPM: a shimmering eighth-note ostinato and pulsing bass under the theme, with fresh jazz-tinged chords (Em7, Cmaj7, a bright F major). It opens with the motif in slow motion and climbs through Cm7–F into a final chorus in B-flat.',
};

// ---- Harmony -------------------------------------------------------------------------------
// Bars are space separated; "X/Y" splits a bar into two half-bar chords.
const V: Record<string, string> = {
  G: 'G3+B3+D4', C: 'G3+C4+E4', Em7: 'G3+B3+D4', Cmaj7: 'G3+B3+E4', Bm7: 'F#3+A3+D4', Am7: 'G3+C4+E4',
  Am: 'A3+C4+E4', Em: 'G3+B3+E4', D: 'F#3+A3+D4', Dsus: 'G3+A3+D4', F: 'F3+A3+C4', Cm7: 'G3+Bb3+Eb4',
};
const ROOT: Record<string, string> = {
  G: 'G2', C: 'C3', Em7: 'E2', Cmaj7: 'C3', Bm7: 'B2', Am7: 'A2', Am: 'A2', Em: 'E2', D: 'D3', Dsus: 'D3',
  F: 'F2', Cm7: 'C3',
};
// Ostinato tones, low-mid-high, around the melody's register.
const OST: Record<string, string[]> = {
  G: ['G4', 'B4', 'D5'], C: ['G4', 'C5', 'E5'], Em7: ['E4', 'B4', 'D5'], Cmaj7: ['G4', 'B4', 'E5'],
  Bm7: ['F#4', 'A4', 'D5'], Am7: ['E4', 'A4', 'C5'], Am: ['E4', 'A4', 'C5'], Em: ['E4', 'G4', 'B4'],
  D: ['F#4', 'A4', 'D5'], Dsus: ['G4', 'A4', 'D5'], F: ['F4', 'A4', 'C5'], Cm7: ['Eb4', 'G4', 'Bb4'],
};

interface Seg { c: string; t: number; len: number }
function segs(prog: string): Seg[] {
  const out: Seg[] = [];
  prog.split(/\s+/).filter(b => b && b !== '|').forEach((bar, i) => {
    const parts = bar.split('/');
    parts.forEach((c, k) => out.push({ c, t: i * 4 + k * (4 / parts.length), len: 4 / parts.length }));
  });
  return out;
}
/** Eighth notes cycled 3+3+2 through each chord's tones (accents on 1, the and-of-2, and 4). */
const OST_IDX = [0, 1, 2, 0, 1, 2, 0, 1];
const OST_VEL = [0.24, 0.14, 0.16, 0.22, 0.14, 0.16, 0.21, 0.15];
function ost(prog: string, f = 1): Voice {
  const out: Voice = [];
  for (const s of segs(prog)) {
    for (let x = 0; x < s.len; x += 0.5) {
      const k = Math.round(((s.t + x) % 4) / 0.5);
      out.push({ t: s.t + x, pitch: OST[s.c][OST_IDX[k]], len: 0.5, vel: OST_VEL[k] * f });
    }
  }
  return out;
}
/** Thinned ostinato: quarter notes, low-mid-high-mid. */
function ostQ(prog: string, v = 0.14): Voice {
  const out: Voice = [];
  for (const s of segs(prog)) {
    for (let x = 0; x < s.len; x += 1) {
      const k = Math.round((s.t + x) % 4);
      out.push({ t: s.t + x, pitch: OST[s.c][[0, 1, 2, 1][k]], len: 1, vel: v });
    }
  }
  return out;
}
/** Driving eighth-note bass with an octave pop on the and-of-3. */
const PULSE_VEL = [0.62, 0.36, 0.46, 0.36, 0.56, 0.36, 0.5, 0.4];
function pulse(prog: string, f = 1): Voice {
  const out: Voice = [];
  for (const s of segs(prog)) {
    for (let x = 0; x < s.len; x += 0.5) {
      const k = Math.round(((s.t + x) % 4) / 0.5);
      out.push({ t: s.t + x, pitch: k === 5 ? fromMidi(toMidi(ROOT[s.c]) + 12) : ROOT[s.c], len: 0.5, vel: PULSE_VEL[k] * f });
    }
  }
  return out;
}
/** Long bass notes, one per chord. */
function bassHold(prog: string, v = 0.45): Voice {
  return segs(prog).map(s => ({ t: s.t, pitch: ROOT[s.c], len: s.len, vel: v }));
}
/** Pad re-struck on every chord change. */
function pad(prog: string, v = 0.15): Voice[] {
  return chords(segs(prog).map(s => `${V[s.c]}:${s.len}`).join(' '), 3, 0, v);
}

// ---- Themes --------------------------------------------------------------------------------
// The original rising cell G-A-B / C-D-G kept intact in its dotted rhythm, now reharmonized
// (G, Cadd9, Em7, Cmaj7) and continued with a descending answer.
const progA = 'G C Em7 Cmaj7 Bm7 Am7 C Dsus/D';
const phraseA = 'G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 G5:2 | G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 E5:2 | ' +
  'D5:1.5 C5:.5 B4:2 | C5:1.5 B4:.5 A4:2 | B4:1.5 C5:.5 D5:1 E5:1 | D5:4';
const progA2 = 'G C Em7 Cmaj7 Am7 C D G';
const phraseA2 = 'G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 G5:2 | G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 G5:2 | ' +
  'A5:1.5 G5:.5 E5:2 | G5:1.5 E5:.5 D5:2 | C5:1.5 D5:.5 E5:1 D5:1 | G4:4';
// Climax version keeps the top at G5 (B-flat after the key change) instead of reaching A5.
const phraseA2top = phraseA2.replace('A5:1.5 G5:.5 E5:2', 'C5:1.5 E5:.5 G5:2');
const progAA = `${progA} ${progA2}`;

// Sustained "horn" line in the middle register.
const counterAA =
  'B3:4 | C4:4 | B3:2 D4:2 | E4:4 | F#4:2 D4:2 | E4:2 C4:2 | E4:2 G4:2 | F#4:4 | ' +
  'D4:4 | E4:4 | G4:2 E4:2 | E4:2 B3:2 | C4:2 E4:2 | E4:2 G4:2 | F#4:2 A4:2 | B3:4';

// B section: the motif turned downward over a mixolydian F major (the flat-seven chord).
const progB = 'F C F G Am Em F Dsus/D';
const themeB = 'D5:1.5 C5:.5 A4:2 | C5:1.5 B4:.5 G4:2 | D5:1.5 C5:.5 A4:2 | B4:1.5 A4:.5 G4:2 | ' +
  'E5:1.5 D5:.5 C5:2 | D5:1.5 C5:.5 B4:2 | C5:1.5 A4:.5 F4:1 A4:1 | D5:4';
// Build version: last two bars swing through Cm7 - F, the ii-V of B-flat.
const progBuild = 'F C F G Am Em Cm7 F';
const themeBuild = themeB.replace('C5:1.5 A4:.5 F4:1 A4:1 | D5:4', 'Eb5:1.5 D5:.5 C5:1 Bb4:1 | A4:2 C5:1 A4:1');

// ---- Sections (4/4) ------------------------------------------------------------------------

// 8 bars: the ostinato fades in alone, then the motif enters in slow motion (augmented 2x).
const introProg = 'G C G C G G C C';
const intro = section('intro', 32, [
  line('r:16 G4:3 A4:1 B4:4 C5:3 D5:1 G5:4', 0, 0.62),
  ramp(ost(introProg), 0.5, 1),
  line('r:16 G2:8@.45 C3:8@.45'),
  ...pad(introProg, 0.14).map(l => l.filter(e => e.t >= 16)),
]);

// 16 bars: theme at speed over the pulse.
const verse = section('verse', 64, [
  line(`${phraseA} | ${phraseA2}`, 0, 0.88),
  pulse(progAA, 0.9),
  ost(progAA, 0.85),
  ...pad(progAA, 0.14),
]);

// 8 bars: B section.
const bsec = section('b', 32, [
  line(themeB, 0, 0.85),
  pulse(progB, 0.9),
  ost(progB, 0.85),
  ...pad(progB, 0.18),
]);

// 16 bars: theme again with the horn countermelody in place of the pad.
const verse2 = section('verse2', 64, [
  line(`${phraseA} | ${phraseA2}`, 0, 0.9),
  pulse(progAA, 0.95),
  ost(progAA, 0.9),
  line(counterAA, 0, 0.3),
]);

// 8 bars: breakdown. Pulse drops out; the motif returns in slow motion over Em7 and Cmaj7.
const breakProg = 'Em7 Em7 Cmaj7 Cmaj7 Am7 Am7 Dsus D';
const breakdown = section('breakdown', 32, [
  ramp(line('G4:3 A4:1 B4:4 | C5:3 B4:1 G4:4 | A4:3 B4:1 C5:4 | D5:8'), 0.62, 0.78),
  bassHold(breakProg, 0.45),
  ostQ(breakProg, 0.14),
  ...pad(breakProg, 0.2),
]);

// 8 bars: build. B melody returns with a crescendo and pivots to B-flat through Cm7 - F.
const build = section('build', 32, [
  ramp(line(themeBuild), 0.78, 0.92),
  ramp(pulse(progBuild), 0.55, 1.05),
  ramp(ost(progBuild), 0.6, 1.1),
  ...pad(progBuild, 0.16),
  ramp(line('A3:4 | G3:4 | A3:4 | B3:4 | C4:4 | E4:4 | Eb4:4 | F4:2 A4:2'), 0.2, 0.32),
]);

// 16 bars: final chorus in B-flat (up a minor third), everything playing.
const finale = section('finale', 64, [
  line(`${phraseA} | ${phraseA2top}`, 0, 0.92),
  pulse(progAA, 1.05),
  ost(progAA, 0.9),
  line(counterAA, 0, 0.28),
  ...pad(progAA, 0.13),
].map(v => transpose(v, 3)));

// 12 bars (B-flat): the pulse winds down, the motif rises one last time and hangs in the air.
const outroProg = 'G C G C Em7 Cmaj7 Am7 Dsus/D G C G G';
const outro = section('outro', 48, [
  ramp(line('G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 G5:2 | r:4 | C5:1.5 D5:.5 E5:2 | D5:4 | B4:4 | ' +
    'C5:1.5 B4:.5 A4:2 | B4:1.5 C5:.5 D5:2 | G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 G5:6 | r:4'), 0.85, 0.5),
  [...ramp(pulse('G C G C'), 1, 0.55), ...shift(bassHold('Em7 Cmaj7 Am7 Dsus/D G C G', 0.42), 16)],
  [...ramp(ost('G C G C'), 1, 0.6), ...shift(ostQ('Em7 Cmaj7 Am7 Dsus/D', 0.13), 16), ...line('D5:1@.12 G5:3@.1', 44)],
  ...pad(outroProg, 0.17).map(l => l.filter(e => e.t >= 16)),
].map(v => transpose(v, 3)));

export const track = buildTrack({
  name: 'Sunrise',
  genre: 'ambient',
  bpm: 120,
  sections: [intro, verse, bsec, verse2, breakdown, build, finale, outro],
  // 32 + 64 + 32 + 64 + 32 + 32 + 64 + 48 = 368 beats @120 = 3:04
  form: ['intro', 'verse', 'b', 'verse2', 'breakdown', 'build', 'finale', 'outro'],
});
