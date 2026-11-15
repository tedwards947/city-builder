import { buildTrack, chords, fromMidi, line, lineBeats, merge, ramp, section as rawSection, toMidi, transpose, type Voice } from '../../compose.ts';

export const meta = {
  song: 'Neon Metropolis',
  label: 'Full Circuit',
  blurb: 'Faithful extension at the original 128 BPM in E minor. The E–G–A hook and A–C–D answer keep the original rattling bass, framed by a slow-hook intro, two risers, a melodic breakdown and a second drop with octave bass, 16th arps and the hook lifted an octave.',
};

// ---------------------------------------------------------------- harmony helpers
const VOX: Record<string, string> = {
  Em: 'G3+B3+E4', C: 'G3+C4+E4', D: 'F#3+A3+D4', Am: 'A3+C4+E4', G: 'G3+B3+D4', B: 'F#3+B3+D#4',
};
const ROOT: Record<string, string> = { Em: 'E2', C: 'C2', D: 'D2', Am: 'A2', G: 'G2', B: 'B2' };

type Seg = [string, number];
/** "Em Am/G" -> one chord per bar, or two half-bar chords. */
function segs(prog: string): Seg[] {
  return prog.trim().split(/\s+/).flatMap((bar): Seg[] => {
    const cs = bar.split('/');
    return cs.map(c => [c, 4 / cs.length] as Seg);
  });
}
const up = (p: string, s: number) => fromMidi(toMidi(p) + s);
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
/** Transpose every pitch in a mini-notation string. */
const tr = (src: string, s: number) => src.replace(/([A-G][#b]?-?\d)(?=:)/g, p => up(p, s));
/** Stretch every duration in a mini-notation string. */
const aug = (src: string, k = 2) => src.replace(/:([\d.]+)/g, (_, d) => `:${Number(d) * k}`);
/** Lead line whose length must equal `beats`. */
function lead(src: string, beats: number, v: number): Voice {
  if (Math.abs(lineBeats(src) - beats) > 1e-6) throw new Error(`lead is ${lineBeats(src)} beats, want ${beats}`);
  return line(src, 0, v);
}

const BASS: Record<string, (r: string, h: string) => string> = {
  long: r => `${r}:2`,
  off: r => `r:.5 ${r}:.5`,
  eighth: r => `${r}:.5 ${r}:.5`,
  six: r => `${r}:.25 ${r}:.25 ${r}:.25 ${r}:.25`,
  pump: (r, h) => `${r}:.5 ${h}:.5`,
  // the original track re-struck the bass on every lead step: the hook's own rhythm
  hook: r => `${r}:.25 ${r}:.25 ${r}:.5 ${r}:.25 ${r}:.25 ${r}:.25 ${r}:.25`,
};
function bassStr(prog: string, style: string): string {
  const cell = BASS[style];
  const unit = lineBeats(cell('E2', 'E3'));
  return segs(prog).map(([c, b]) => rep(cell(ROOT[c], up(ROOT[c], 12)), b / unit)).join(' ');
}
/** Chord-stab rhythm: `cell` uses `x` for the chord, e.g. "r:.5 x:.25 r:.25". */
function stabs(prog: string, cell: string, start: number, v: number): Voice[] {
  const unit = lineBeats(cell);
  const src = segs(prog).map(([c, b]) => rep(cell.replace(/x/g, VOX[c]), b / unit)).join(' ');
  return chords(src, 3, start, v);
}
/** Arpeggio through the chord voicing (raised `oct` semitones), `pattern` indexes 2 octaves of chord tones. */
function arpStr(prog: string, pattern: number[], step: number, oct = 12): string {
  return segs(prog).map(([c, b]) => {
    const t = VOX[c].split('+').map(p => toMidi(p) + oct);
    const pool = [...t, ...t.map(x => x + 12)];
    return Array.from({ length: Math.round(b / step) }, (_, i) => `${fromMidi(pool[pattern[i % pattern.length]])}:${step}`).join(' ');
  }).join(' ');
}
/** Sections with every note gated to 96% of its length: a hair of staccato so back-to-back notes don't overlap. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: e.len * 0.96 }))));
const stack = (...groups: Voice[][]): Voice[] => groups[0].map((_, k) => merge(...groups.map(g => g[k])));

const UP = [0, 1, 2, 3];
const UPDN = [0, 1, 2, 3, 4, 3, 2, 1];
const RISE = [0, 1, 2, 3, 4, 5, 4, 3];

// ---------------------------------------------------------------- themes (2-beat cells)
const H = 'E4:.25 G4:.25 A4:.5 E4:.25 G4:.25 B4:.25 A4:.25'; // the hook
const A = 'A4:.25 C5:.25 D5:.5 A4:.25 C5:.25 E5:.25 D5:.25'; // the answer
const H_UP = 'E4:.25 G4:.25 B4:.5 E5:.25 D5:.25 B4:.25 A4:.25';
const H_DN = 'E5:.25 D5:.25 B4:.5 G4:.25 A4:.25 B4:.25 D5:.25';
const A_TURN = 'A4:.25 C5:.25 D5:.5 E5:.25 F#5:.25 E5:.25 D5:.25';
const A_C = 'C5:.25 E5:.25 G5:.5 C5:.25 E5:.25 A5:.25 G5:.25';
const A_D = 'D5:.25 F#5:.25 A5:.5 D5:.25 F#5:.25 B5:.25 A5:.25';
/** Hook-shaped riser figure on three pitches (2 beats). */
const fig = (a: string, b: string, c: string) => `${a}:.25 ${b}:.25 ${c}:.5 ${a}:.25 ${b}:.25 ${c}:.25 ${b}:.25`;
// hook / answer broken up with gaps, for teasing in the intro
const T1 = 'E4:.25 G4:.25 A4:.5 r:1 E4:.25 G4:.25 B4:.25 A4:.25 r:1';
const T2 = 'A4:.25 C5:.25 D5:.5 r:1 A4:.25 C5:.25 E5:.25 D5:.25 r:1';

// ---------------------------------------------------------------- sections
const introProg = 'Em Em Am G Em Em C D Em Em Am G Em Em Am G';
const intro = section('intro', 64, [
  ramp(lead(`r:16 ${aug(H)} ${aug(H)} ${aug(A)} ${aug(A)} ${T1} ${T1} ${T2} ${T2} ${T1} ${T1} ${T2} ${T2}`, 64, 0.62), 0.8, 1.2),
  merge(line(bassStr('Em Em C D', 'long'), 16, 0.4), line(bassStr('Em Em Am G Em Em Am G', 'off'), 32, 0.5)),
  ...stack(stabs('Em Em Am G Em Em C D', 'x:2', 0, 0.09), stabs('Em Em Am G Em Em Am G', 'r:.5 x:.25 r:.25', 32, 0.12)),
  ramp(line(arpStr(introProg, UP, 0.25), 0, 1), 0.07, 0.18),
]);

const build1 = section('build1', 32, [
  ramp(lead(`${rep(fig('E4', 'G4', 'A4'), 4)} ${rep(fig('F#4', 'A4', 'B4'), 4)} ${rep(fig('A4', 'C5', 'D5'), 4)} ` +
    `${rep('B4:.25 D#5:.25 F#5:.25 D#5:.25', 4)} B4:.25 D#5:.25 F#5:.25 B5:.25 r:3`, 32, 1), 0.6, 0.9),
  ramp(line(`${bassStr('C C D D', 'eighth')} ${bassStr('Am Am B', 'six')} B2:.5`, 0, 1), 0.42, 0.56),
  ...stack(stabs('C C D D', 'x:.25 r:.75', 0, 0.1), stabs('Am Am B', 'x:.25 r:.25', 16, 0.12), stabs('B', 'x:.5 r:3.5', 28, 0.14)),
  ramp(line(arpStr('C C D D Am Am B', RISE, 0.25), 0, 1), 0.08, 0.22),
]);

const dropProg = 'Em Em Am G Em Em C D Em Em Am G Em Em C D';
const drop1 = section('drop1', 64, [
  lead([
    `${rep(H, 4)} ${rep(A, 4)}`,
    `${rep(H, 3)} ${H_UP} ${rep(A, 3)} ${A_TURN}`,
    `${rep(H, 4)} ${rep(A, 4)}`,
    `${rep(H, 3)} ${H_UP} ${rep(A, 2)} A4:.25 C5:.25 D5:.5 E5:.25 F#5:.25 A5:.5 F#5:.5 E5:.5 D5:.5 B4:.5`,
  ].join(' '), 64, 0.85),
  line(bassStr(dropProg, 'hook'), 0, 0.5),
  ...stabs(dropProg, 'r:.5 x:.25 r:.25', 0, 0.12),
]);

// Breakdown: the hook and answer slowed into a singing line over VI–III–VII–i
const breakProg = 'C G D Em C G D Em Am C G D C D Em B';
const breakdown = section('breakdown', 64, [
  lead(
    'E4:1 G4:1 A4:2 | B4:1 G4:1 D4:2 | A4:1 C5:1 D5:2 | B4:3 r:1 | ' +
    'E4:1 G4:1 A4:1 B4:1 | D5:2 B4:1 G4:1 | A4:1 C5:1 D5:1 E5:1 | E5:4 | ' +
    'C5:1 E5:1 D5:2 | C5:1 B4:1 G4:2 | B4:1 D5:1 E5:1 D5:1 | A4:4 | ' +
    'E4:1 G4:1 A4:2 | A4:1 C5:1 D5:2 | E5:2 G5:1 F#5:1 | D#5:2 B4:2', 64, 0.72),
  merge(line(bassStr('C G D Em C G D Em', 'long'), 0, 0.36), line(bassStr('Am C G D C D Em B', 'off'), 32, 0.42)),
  ...stabs(breakProg, 'x:2', 0, 0.09),
  merge(
    line(arpStr('C G D Em C G D Em', UPDN, 0.5), 0, 0.1),
    ramp(line(`${rep(H, 14)} ${rep('B4:.25 D#5:.25 F#5:.5 B4:.25 D#5:.25 F#5:.25 D#5:.25', 2)}`, 32, 1), 0.08, 0.14),
  ),
]);

const build2 = section('build2', 32, [
  ramp(lead(`${rep(fig('G4', 'C5', 'E5'), 4)} ${rep(fig('A4', 'D5', 'F#5'), 4)} ${rep(fig('B4', 'E5', 'G5'), 4)} ` +
    `${rep('B4:.25 D#5:.25 F#5:.25 B5:.25', 4)} B5:1 r:3`, 32, 1), 0.62, 0.92),
  ramp(line(`${bassStr('C C D D', 'pump')} ${bassStr('Em Em B', 'six')} B2:.5`, 0, 1), 0.44, 0.58),
  ...stack(stabs('C C D D Em Em B', 'x:.25 r:.25', 0, 0.12), stabs('B', 'x:.5 r:3.5', 28, 0.15)),
  ramp(line(arpStr('C C D D Em Em B', RISE, 0.25), 0, 1), 0.1, 0.24),
]);

const drop2Prog = 'Em Em Am G Em Em C D Em Em Am C Em Em C B';
const drop2 = section('drop2', 64, [
  lead([
    `${rep(H, 4)} ${rep(A, 4)}`,
    `${rep(H, 2)} ${H_UP} ${H_DN} ${rep(A, 3)} ${A_TURN}`,
    `${rep(H, 4)} ${rep(A, 2)} ${rep(A_C, 2)}`,
    `${rep(H, 3)} ${H_UP} ${rep(A, 2)} B4:.25 D#5:.25 F#5:.5 B4:.25 D#5:.25 F#5:.25 A5:.25 B5:1 A5:.5 F#5:.5`,
  ].join(' '), 64, 0.87),
  line(bassStr(drop2Prog, 'pump'), 0, 0.52),
  ...stabs(drop2Prog, 'r:.5 x:.25 r:.25', 0, 0.12),
  line(arpStr(drop2Prog, UPDN, 0.25), 0, 0.14),
]);

// Final drop: the hook an octave up, the answer climbing over C and D, square doubling below
const finaleLead =
  `${rep(tr(H, 12), 4)} ${rep(A_C, 2)} ${rep(A_D, 2)} ` +
  `${rep(tr(H, 12), 3)} ${H_DN} ${rep(A_C, 2)} D5:.25 F#5:.25 A5:.5 B5:.5 A5:.5 F#5:.5 E5:.5 D5:.5 B4:.5`;
const finale = section('finale', 32, [
  lead(finaleLead, 32, 0.88),
  line(bassStr('Em Em C D Em Em C D', 'pump'), 0, 0.55),
  ...stabs('Em Em C D Em Em C D', 'r:.5 x:.25 r:.25', 0, 0.12),
  line(arpStr('Em Em C D Em Em C D', UPDN, 0.25), 0, 0.15),
  transpose(line(finaleLead, 0, 0.14), -12),
]);

const outro = section('outro', 32, [
  ramp(lead(`${rep(H, 4)} ${rep(A, 4)} ${T1} ${T1} ${aug(H)} E4:4`, 32, 0.8), 1, 0.5),
  ramp(line(`${bassStr('Em Em Am G', 'off')} ${bassStr('Em Em Em', 'long')} E2:4`, 0, 0.48), 1, 0.75),
  ...stack(stabs('Em Em Am G', 'r:.5 x:.25 r:.25', 0, 0.1), stabs('Em Em Em', 'x:2', 16, 0.08), stabs('Em', 'x:4', 28, 0.08)),
  ramp(line(arpStr('Em Em Am G Em Em Em', UP, 0.25), 0, 1), 0.16, 0.04),
]);

export const track = buildTrack({
  name: 'Neon Metropolis',
  genre: 'edm',
  bpm: 128,
  sections: [intro, build1, drop1, breakdown, build2, drop2, finale, outro],
  // 64 + 32 + 64 + 64 + 32 + 64 + 32 + 32 = 384 beats at 128 BPM = 3:00
  form: ['intro', 'build1', 'drop1', 'breakdown', 'build2', 'drop2', 'finale', 'outro'],
});
