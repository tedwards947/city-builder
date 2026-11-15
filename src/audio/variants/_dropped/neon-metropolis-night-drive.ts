import { buildTrack, chords, fromMidi, line, lineBeats, merge, ramp, section as rawSection, toMidi, vel, type Voice } from '../../compose.ts';

export const meta = {
  song: 'Neon Metropolis',
  label: 'Night Drive',
  blurb: 'A synthwave take at 104 BPM. The hook slows into a singing 8th-note verse melody over a lush Em–Cmaj7–G–D progression, then returns at full speed in choruses where held notes answer each 16th-note burst, over galloping 80s bass and dotted pad stabs.',
};

// ---------------------------------------------------------------- harmony helpers
const VOX: Record<string, string> = {
  Em: 'G3+B3+E4', Cmaj7: 'G3+B3+E4', C: 'G3+C4+E4', D: 'F#3+A3+D4', Am: 'A3+C4+E4', G: 'G3+B3+D4', B: 'F#3+B3+D#4',
};
const ROOT: Record<string, string> = { Em: 'E2', Cmaj7: 'C2', C: 'C2', D: 'D2', Am: 'A2', G: 'G2', B: 'B2' };

type Seg = [string, number];
function segs(prog: string): Seg[] {
  return prog.trim().split(/\s+/).flatMap((bar): Seg[] => {
    const cs = bar.split('/');
    return cs.map(c => [c, 4 / cs.length] as Seg);
  });
}
const up = (p: string, s: number) => fromMidi(toMidi(p) + s);
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
const tr = (src: string, s: number) => src.replace(/([A-G][#b]?-?\d)(?=:)/g, p => up(p, s));
const aug = (src: string, k = 2) => src.replace(/:([\d.]+)/g, (_, d) => `:${Number(d) * k}`);
function lead(src: string, beats: number, v: number): Voice {
  if (Math.abs(lineBeats(src) - beats) > 1e-6) throw new Error(`lead is ${lineBeats(src)} beats, want ${beats}`);
  return line(src, 0, v);
}

const BASS: Record<string, (r: string, h: string) => string> = {
  long: r => `${r}:2`,
  off: r => `r:.5 ${r}:.5`,
  // straight 8ths with a lighter offbeat, the classic synthwave drive
  drive: r => `${r}:.5@1 ${r}:.5@.75`,
  six: r => `${r}:.25 ${r}:.25 ${r}:.25 ${r}:.25`,
  // 8th + two 16ths: the Outrun gallop, with the octave on the last 16th
  gallop: (r, h) => `${r}:.5@1 ${r}:.25@.7 ${h}:.25@.8`,
  pump: (r, h) => `${r}:.5 ${h}:.5`,
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

const UP = [0, 1, 2, 3];
const UPDN = [0, 1, 2, 3, 4, 3, 2, 1];
const DOWN = [5, 4, 3, 2, 1, 0, 1, 2];
const RISE = [0, 1, 2, 3, 4, 5, 4, 3];
const DOTTED = 'x:1.5 x:1.5 x:1'; // 3+3+2 pad rhythm

// ---------------------------------------------------------------- themes
const H = 'E4:.25 G4:.25 A4:.5 E4:.25 G4:.25 B4:.25 A4:.25';
const A = 'A4:.25 C5:.25 D5:.5 A4:.25 C5:.25 E5:.25 D5:.25';

// ---------------------------------------------------------------- sections
const intro = section('intro', 32, [
  ramp(lead(`r:16 ${aug(H)} G4:2 E4:2 ${aug(A)} D5:2 A4:2`, 32, 0.6), 0.85, 1.1),
  merge(bass('Em Cmaj7 G D', 'long', 0, 0.36), ramp(bass('Em Cmaj7 G D', 'drive', 16, 1), 0.36, 0.46)),
  ...stabs('Em Cmaj7 G D Em Cmaj7 G D', DOTTED, 0, 0.09),
  ramp(line(arpStr('Em Cmaj7 G D Em Cmaj7 G D', UPDN, 0.5), 0, 1), 0.07, 0.14),
]);

// Verse: the hook and answer at half speed, as a melody
const verseProg = 'Em Cmaj7 G D Em Cmaj7 G D Em Cmaj7 G D Am Cmaj7 D B';
const verse = section('verse', 64, [
  lead(
    `${aug(H)} | G4:2 E4:1 r:1 | ${aug(A)} | D5:2 A4:1 r:1 | ` +
    `${aug(H)} | G4:1 A4:1 B4:1 C5:1 | D5:1.5 B4:.5 G4:1 B4:1 | A4:4 | ` +
    `${aug(H)} | G4:2 E4:1 r:1 | ${aug(A)} | F#4:2 A4:1 D5:1 | ` +
    'C5:.5 B4:.5 A4:1 E4:1 A4:1 | G4:1 E4:1 G4:1 C5:1 | D5:1.5 C5:.5 A4:2 | B4:2 r:2', 64, 0.78),
  bass(verseProg, 'drive', 0, 0.48),
  ...stabs(verseProg, DOTTED, 0, 0.09),
  ramp(line(arpStr('Em Cmaj7 G D Am Cmaj7 D B', UP, 0.25), 32, 1), 0.08, 0.12),
]);

const build1 = section('build1', 16, [
  ramp(lead(`${rep(H, 2)} ${rep(tr(H, 2), 2)} ${rep(A, 2)} B4:.25 D#5:.25 F#5:.5 B5:1 r:2`, 16, 1), 0.65, 0.9),
  ramp(line(`${rep('C2:.5', 8)} ${rep('D2:.5', 8)} ${rep('A2:.25', 16)} B2:.5 B2:.5 B2:1 r:2`), 0.42, 0.55),
  ...stack(stabs('Cmaj7 D Am', 'x:.5', 0, 0.09), stabs('B', 'x:2 r:2', 12, 0.12)),
  ramp(line(arpStr('Cmaj7 D Am', RISE, 0.25), 0, 1), 0.1, 0.2),
]);

// Chorus: each 16th-note hook burst is answered by a held phrase
const chorusProg = 'Em Cmaj7 G D Em Cmaj7 G D Em Cmaj7 G D C D Em Em';
const chorusTail =
  'G4:.25 C5:.25 E5:.5 G4:.25 C5:.25 E5:.25 D5:.25 E5:1 G5:1 | ' +
  'F#4:.25 A4:.25 D5:.5 F#4:.25 A4:.25 E5:.25 D5:.25 F#5:1 A5:1';
const drop1 = section('drop1', 64, [
  lead(
    `${H} B4:1 A4:.5 G4:.5 | ${H} E5:2 | ${A} D5:1 B4:.5 G4:.5 | ${A} F#5:2 | ` +
    `${H} B4:1 A4:.5 G4:.5 | ${H} G5:1 E5:1 | ${A} D5:1 E5:.5 G5:.5 | F#5:1.5 E5:.5 D5:2 | ` +
    `${H} B4:1 A4:.5 G4:.5 | ${H} E5:2 | ${A} D5:1 B4:.5 G4:.5 | ${A} F#5:2 | ` +
    `${chorusTail} | B5:1 A5:.5 G5:.5 E5:2 | E5:3 r:1`, 64, 0.86),
  bass(chorusProg, 'gallop', 0, 0.5),
  ...stabs(chorusProg, DOTTED, 0, 0.1),
  line(arpStr(chorusProg, UPDN, 0.25), 0, 0.11),
]);

// Breakdown: the motifs at whole-note pace, E–G–A rising and A–C–D answering
const breakProg = 'Cmaj7 G D Em Cmaj7 G Am B Cmaj7 D Em Em';
const breakdown = section('breakdown', 48, [
  lead(
    'E4:1 G4:1 A4:2 | B4:1 A4:1 G4:2 | A4:1 C5:1 D5:2 | E5:3 r:1 | ' +
    'E5:1 D5:1 B4:2 | D5:1 B4:1 G4:2 | A4:1 C5:1 E5:2 | D#5:2 F#5:2 | ' +
    'G5:2 E5:2 | F#5:2 D5:2 | E5:1 B4:1 G4:1 B4:1 | E4:4', 48, 0.66),
  merge(bass('Cmaj7 G D Em Cmaj7 G Am B', 'long', 0, 0.34), bass('Cmaj7 D Em Em', 'off', 32, 0.38)),
  ...stabs(breakProg, 'x:2', 0, 0.09),
  merge(
    line(arpStr('Cmaj7 G Am B', UPDN, 0.5), 16, 0.09),
    ramp(line(rep(H, 8), 32, 1), 0.07, 0.13), // the 16th hook creeping back in underneath
  ),
]);

const build2 = section('build2', 16, [
  ramp(lead(
    `${rep(tr(H, 12), 2)} ${rep('F#5:.25 A5:.25 B5:.5 F#5:.25 A5:.25 B5:.25 A5:.25', 2)} ` +
    `${rep('C5:.25 E5:.25 A5:.5 C5:.25 E5:.25 B5:.25 A5:.25', 2)} B4:.25 D#5:.25 F#5:.25 A5:.25 B5:1 r:2`, 16, 1), 0.68, 0.92),
  ramp(line(`${rep('C2:.5', 8)} ${rep('D2:.25', 16)} ${rep('A2:.25', 16)} B2:.5 B2:.5 B2:1 r:2`), 0.44, 0.58),
  ...stack(stabs('Cmaj7 D Am', 'x:.5', 0, 0.1), stabs('B', 'x:2 r:2', 12, 0.13)),
  ramp(line(arpStr('Cmaj7 D Am', RISE, 0.25), 0, 1), 0.12, 0.22),
]);

// Final chorus: the held answers leap an octave, octave-pumping bass and a second arp layer
const drop2 = section('drop2', 64, [
  lead(
    `${H} B5:1 A5:.5 G5:.5 | ${H} E5:1 G5:1 | ${A} D5:1 G5:.5 B5:.5 | ${A} F#5:1 A5:1 | ` +
    `${H} B5:1 A5:.5 G5:.5 | ${H} G5:1 B5:1 | ${A} D5:.5 E5:.5 G5:.5 B5:.5 | A5:1.5 G5:.5 F#5:2 | ` +
    `${H} B4:1 A4:.5 G4:.5 | ${H} E5:2 | ${A} D5:1 B4:.5 G4:.5 | ${A} F#5:2 | ` +
    `${chorusTail.replace('G4:.25 C5:.25 E5:.5 G4:.25 C5:.25 E5:.25 D5:.25', 'C5:.25 E5:.25 G5:.5 C5:.25 E5:.25 A5:.25 G5:.25')} | ` +
    'B5:1 A5:.5 G5:.5 E5:1 G5:1 | E5:3 r:1', 64, 0.88),
  merge(bass('Em Cmaj7 G D Em Cmaj7 G D', 'pump', 0, 0.5), bass('Em Cmaj7 G D C D Em Em', 'gallop', 32, 0.52)),
  ...stabs(chorusProg, DOTTED, 0, 0.1),
  line(arpStr(chorusProg, UPDN, 0.25), 0, 0.11),
  merge(
    line(arpStr('Em Cmaj7 G D Em Cmaj7 G D', DOWN, 0.5, 0), 0, 0.1),
    line(rep(tr(H, 12), 16), 32, 0.1), // hook ostinato an octave above while the lead drops back down
  ),
]);

const outro = section('outro', 16, [
  ramp(lead(`${aug(H)} G4:2 E4:2 ${aug(A)} E4:4`, 16, 0.7), 1, 0.55),
  merge(ramp(bass('Em Cmaj7', 'drive', 0, 1), 0.44, 0.34), line('G2:4@.32 E2:4@.3', 8)),
  ...stack(stabs('Em Cmaj7 G', 'x:2', 0, 0.08), stabs('Em', 'x:4', 12, 0.08)),
  ramp(line(arpStr('Em Cmaj7 G Em', UPDN, 0.5), 0, 1), 0.11, 0.03),
]);

export const track = buildTrack({
  name: 'Neon Metropolis',
  genre: 'edm',
  bpm: 104,
  sections: [intro, verse, build1, drop1, breakdown, build2, drop2, outro],
  // 32 + 64 + 16 + 64 + 48 + 16 + 64 + 16 = 320 beats at 104 BPM = 3:05
  form: ['intro', 'verse', 'build1', 'drop1', 'breakdown', 'build2', 'drop2', 'outro'],
});
