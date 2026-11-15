import { buildTrack, chords, fromMidi, line, lineBeats, merge, ramp, section as rawSection, toMidi, transpose, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Neon Metropolis',
  label: 'Skyline Trance',
  blurb: 'A driving 140 BPM trance version with rolling 16th bass and arps. A long breakdown slows the hook into a soaring anthem melody, then the track lifts a whole step to F# minor: the anthem rides over the 16th hook, and the original riff returns for the climax.',
};

// ---------------------------------------------------------------- harmony helpers
const VOX: Record<string, string> = {
  Em: 'G3+B3+E4', C: 'G3+C4+E4', D: 'F#3+A3+D4', Am: 'A3+C4+E4', G: 'G3+B3+D4', B: 'F#3+B3+D#4',
  E: 'G#3+B3+E4', 'C#': 'G#3+C#4+F4',
};
const ROOT: Record<string, string> = { Em: 'E2', C: 'C2', D: 'D2', Am: 'A2', G: 'G2', B: 'B2', E: 'E2', 'C#': 'C#2' };

type Seg = [string, number];
function segs(prog: string): Seg[] {
  return prog.trim().split(/\s+/).flatMap((bar): Seg[] => {
    const cs = bar.split('/');
    return cs.map(c => [c, 4 / cs.length] as Seg);
  });
}
const up = (p: string, s: number) => fromMidi(toMidi(p) + s);
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
const aug = (src: string, k = 2) => src.replace(/:([\d.]+)/g, (_, d) => `:${Number(d) * k}`);
function lead(src: string, beats: number, v: number): Voice {
  if (Math.abs(lineBeats(src) - beats) > 1e-6) throw new Error(`lead is ${lineBeats(src)} beats, want ${beats}`);
  return line(src, 0, v);
}

const BASS: Record<string, (r: string, h: string) => string> = {
  long: r => `${r}:2`,
  quarter: r => `${r}:1`, // four-on-the-floor kick feel for builds
  eighth: r => `${r}:.5 ${r}:.5`,
  six: r => `${r}:.25 ${r}:.25 ${r}:.25 ${r}:.25`,
  off: r => `r:.5 ${r}:.5`,
  // trance roll: 16ths anchored on the downbeat (there is no kick drum to fill it), offbeat lifted
  roll: r => `${r}:.25@1 ${r}:.25@.6 ${r}:.25@.85 ${r}:.25@.6`,
  rollOct: (r, h) => `${r}:.25@1 ${r}:.25@.6 ${h}:.25@.85 ${r}:.25@.6`,
};
function bass(prog: string, style: string, start: number, v: number): Voice {
  const cell = BASS[style];
  const unit = lineBeats(cell('E2', 'E3'));
  return vel(line(segs(prog).map(([c, b]) => rep(cell(ROOT[c], up(ROOT[c], 12)), b / unit)).join(' '), start), v);
}
function stabs(prog: string, cell: string, start: number, v: number): Voice[] {
  const unit = lineBeats(cell);
  const src = segs(prog).map(([c, b]) => rep(cell.replace(/x/g, VOX[c]), b / unit)).join(' ');
  return chords(src, 3, start, v);
}
function arpStr(prog: string, pattern: number[], step: number, oct = 12): string {
  return segs(prog).map(([c, b]) => {
    const t = VOX[c].split('+').map(p => toMidi(p) + oct);
    const pool = [...t, ...t.map(x => x + 12)];
    return Array.from({ length: Math.round(b / step) }, (_, i) => `${fromMidi(pool[pattern[i % pattern.length]])}:${step}`).join(' ');
  }).join(' ');
}
/** Sections with every note gated to 96% of its length so back-to-back notes don't overlap. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: e.len * 0.96 }))));
const stack = (...groups: Voice[][]): Voice[] => groups[0].map((_, k) => merge(...groups.map(g => g[k])));
/** Write in E minor, play a whole step up (F# minor). */
const lift = (voices: Voice[]) => voices.map(v => transpose(v, 2));

const TRANCE = [0, 2, 1, 3, 2, 4, 3, 1]; // leaping 16th arp
const UPDN = [0, 1, 2, 3, 4, 3, 2, 1];
const RISE = [0, 1, 2, 3, 4, 5, 4, 3];
const OFF = 'r:.5 x:.25 r:.25';

// ---------------------------------------------------------------- themes
const H = 'E4:.25 G4:.25 A4:.5 E4:.25 G4:.25 B4:.25 A4:.25';
const A = 'A4:.25 C5:.25 D5:.5 A4:.25 C5:.25 E5:.25 D5:.25';
const H_UP = 'E4:.25 G4:.25 B4:.5 E5:.25 D5:.25 B4:.25 A4:.25';
const H_DN = 'E5:.25 D5:.25 B4:.5 G4:.25 A4:.25 B4:.25 D5:.25';
const A_TURN = 'A4:.25 C5:.25 D5:.5 E5:.25 F#5:.25 E5:.25 D5:.25';
const A_C = 'C5:.25 E5:.25 G5:.5 C5:.25 E5:.25 A5:.25 G5:.25';
const B_CELL = 'B4:.25 D#5:.25 F#5:.5 B4:.25 D#5:.25 F#5:.25 D#5:.25';
const T1 = 'E4:.25 G4:.25 A4:.5 r:1 E4:.25 G4:.25 B4:.25 A4:.25 r:1';
const T2 = 'A4:.25 C5:.25 D5:.5 r:1 A4:.25 C5:.25 E5:.25 D5:.25 r:1';
/** The 16th hook as a square ostinato, swapped for a B-major cell on B bars. */
const ostinato = (prog: string) => segs(prog).map(([c]) => rep(c === 'B' ? B_CELL : H, 2)).join(' ');

// The anthem: the hook and answer at half speed, opening up into long notes (max A5, so it survives the key change)
const anthemProg = 'Em C G D Em C Am B Em C G D Em C D Em';
const ANTHEM =
  `${aug(H)} | E5:1.5 D5:.5 B4:1 G4:1 | ${aug(A)} | D5:1.5 C5:.5 A4:2 | ` +
  `${aug(H)} | G4:1 A4:1 B4:1 E5:1 | E5:1.5 D5:.5 C5:1 A4:1 | B4:2 D#5:1 F#5:1 | ` +
  'E5:.5 G5:.5 A5:1 E5:.5 G5:.5 A5:.5 G5:.5 | G5:1.5 E5:.5 E5:1 G5:1 | D5:.5 G5:.5 A5:1 D5:.5 G5:.5 A5:.5 G5:.5 | A5:1.5 G5:.5 F#5:2 | ' +
  'E5:.5 G5:.5 A5:1 E5:.5 G5:.5 A5:.5 G5:.5 | G5:1 A5:1 G5:1 E5:1 | A5:1.5 G5:.5 F#5:1 D5:1 | E5:4';

// ---------------------------------------------------------------- sections
const introProg = 'Em Em C D Em Em C D Em Em C D Em Em Am B';
const intro = section('intro', 64, [
  ramp(lead(`r:32 ${T1} ${T1} ${T2} ${T2} ${T1} ${T1} ${T2} B4:.25 D#5:.25 F#5:.5 r:1 B4:.25 D#5:.25 F#5:.25 A5:.25 r:1`, 64, 0.62), 0.8, 1.15),
  ramp(bass(introProg, 'roll', 0, 1), 0.36, 0.46),
  ...stabs('Em Em C D Em Em Am B', OFF, 32, 0.1),
  ramp(line(arpStr(introProg, TRANCE, 0.25), 0, 1), 0.05, 0.13),
]);

// Build: long rising saw notes over a kick-roll bass (quarters, 8ths, 16ths, silence)
const build1 = section('build1', 32, [
  ramp(lead('E5:2 D5:2 | E5:2 G5:2 | F#5:2 E5:2 | F#5:2 A5:2 | A5:2 G5:2 | A5:1 B5:1 C6:2 | B5:2 A5:1 F#5:1 | D#5:.5 r:3.5', 32, 1), 0.6, 0.9),
  merge(bass('C C D D', 'quarter', 0, 0.5), bass('Am Am', 'eighth', 16, 0.5), bass('B', 'six', 24, 0.52), line('B2:.5@.55', 28)),
  ...stack(stabs('C C D D', 'x:.25 r:.75', 0, 0.1), stabs('Am Am B', 'x:.25 r:.25', 16, 0.12), stabs('B', 'x:.5 r:3.5', 28, 0.14)),
  ramp(line(arpStr('C C D D Am Am B', RISE, 0.25), 0, 1), 0.08, 0.22),
]);

const drop1Prog = 'Em Em C D Em Em Am G Em Em C D Em Em C B';
const drop1 = section('drop1', 64, [
  lead([
    `${rep(H, 4)} ${rep(A, 4)}`,
    `${rep(H, 3)} ${H_UP} ${rep(A, 3)} ${A_TURN}`,
    `${rep(H, 4)} ${rep(A, 4)}`,
    `${rep(H, 3)} ${H_UP} ${rep(A, 2)} ${B_CELL.replace('F#5:.25 D#5:.25', 'F#5:.25 A5:.25')} B5:1 A5:.5 F#5:.5`,
  ].join(' '), 64, 0.86),
  bass(drop1Prog, 'roll', 0, 0.48),
  ...stabs(drop1Prog, OFF, 0, 0.1),
  line(arpStr(drop1Prog, TRANCE, 0.25), 0, 0.12),
]);

// Breakdown: no bass at first, the anthem revealed over pads, arps filling back in
const breakdown = section('breakdown', 64, [
  lead(ANTHEM, 64, 0.72),
  merge(bass('Em C G D Em C D Em', 'long', 32, 0.32)),
  ...stabs(anthemProg, 'x:2', 0, 0.09),
  merge(
    line(arpStr('Em C Am B', UPDN, 0.5), 16, 0.08),
    ramp(line(arpStr('Em C G D Em C D Em', TRANCE, 0.25), 32, 1), 0.07, 0.15),
  ),
]);

// Build 2 climbs C – D – E – C#, the dominant of F# minor
const build2 = section('build2', 32, [
  ramp(lead('E5:2 D5:2 | E5:2 G5:2 | F#5:2 E5:2 | F#5:2 A5:2 | G#5:2 F#5:2 | G#5:2 B5:2 | F5:2 G#5:2 | G#4:.25 C#5:.25 F5:.25 G#5:.25 r:3', 32, 1), 0.62, 0.92),
  merge(bass('C C D D', 'quarter', 0, 0.5), bass('E E', 'eighth', 16, 0.52), bass('C#', 'six', 24, 0.54), line('C#2:.5@.56', 28)),
  ...stack(stabs('C C D D E E C#', 'x:.25 r:.25', 0, 0.11), stabs('C#', 'x:.5 r:3.5', 28, 0.14)),
  ramp(line(arpStr('C C D D E E C#', RISE, 0.25), 0, 1), 0.1, 0.24),
]);

// Drop 2a (F# minor): the anthem on the saw, the original 16th hook as a square ostinato beneath
const drop2a = section('drop2a', 64, lift([
  lead(ANTHEM, 64, 0.88),
  bass(anthemProg, 'roll', 0, 0.48),
  ...stabs(anthemProg, OFF, 0, 0.1),
  line(ostinato(anthemProg), 0, 0.12),
]));

// Drop 2b (F# minor): the original riff back on top, octave-rolling bass, full arp
const drop2bProg = 'Em Em C D Em Em Am G Em Em Am C Em Em C D';
const drop2b = section('drop2b', 64, lift([
  lead([
    `${rep(H, 4)} ${rep(A, 4)}`,
    `${rep(H, 2)} ${H_UP} ${H_DN} ${rep(A, 3)} ${A_TURN}`,
    `${rep(H, 4)} ${rep(A, 2)} ${rep(A_C, 2)}`,
    `${rep(H, 3)} ${H_UP} ${rep(A, 2)} A4:.25 C5:.25 D5:.5 E5:.25 F#5:.25 A5:.5 F#5:.5 E5:.5 D5:.5 B4:.5`,
  ].join(' '), 64, 0.9),
  bass(drop2bProg, 'rollOct', 0, 0.5),
  ...stabs(drop2bProg, OFF, 0, 0.1),
  line(arpStr(drop2bProg, TRANCE, 0.25), 0, 0.13),
]));

const outro = section('outro', 32, lift([
  ramp(lead(`${T1} ${T1} ${T2} ${T2} ${aug(H)} G4:2 E4:2 E4:4 r:4`, 32, 0.68), 1, 0.55),
  merge(ramp(bass('Em Em C D', 'roll', 0, 1), 0.45, 0.36), line('E2:2@.34 E2:2@.32 E2:2@.3 E2:2@.28 E2:2@.26 E2:2@.24 E2:4@.24', 16)),
  ...stack(stabs('Em Em C D', OFF, 0, 0.1), stabs('Em Em Em Em', 'x:2', 16, 0.08)),
  ramp(line(arpStr('Em Em C D Em Em Em Em', TRANCE, 0.25), 0, 1), 0.12, 0.03),
]));

export const track = buildTrack({
  name: 'Neon Metropolis · Skyline Trance',
  genre: 'edm',
  bpm: 140,
  sections: [intro, build1, drop1, breakdown, build2, drop2a, drop2b, outro],
  // 64 + 32 + 64 + 64 + 32 + 64 + 64 + 32 = 416 beats at 140 BPM = 2:58
  form: ['intro', 'build1', 'drop1', 'breakdown', 'build2', 'drop2a', 'drop2b', 'outro'],
});
