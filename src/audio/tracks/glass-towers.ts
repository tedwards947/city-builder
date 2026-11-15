import { buildTrack, chords, fromMidi, line, lineBeats, merge, ramp, section as rawSection, toMidi, transpose, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Glass Towers',
  label: 'Extended Mix',
  blurb: 'Bright 124 BPM progressive house in A minor. The bouncing 3+3+2 hook is previewed low, then fully launched in the first drop; the breakdown slows it into a soaring half-speed melody, and the second drop adds a higher climb, answering phrases and a lift to B minor for the final chorus.',
};

// ---------------------------------------------------------------- harmony helpers
const VOX: Record<string, string> = {
  Am: 'A3+C4+E4', F: 'A3+C4+F4', C: 'G3+C4+E4', G: 'G3+B3+D4', Dm: 'A3+D4+F4',
  E: 'G#3+B3+E4', 'F#': 'A#3+C#4+F#4',
};
const ROOT: Record<string, string> = { Am: 'A2', F: 'F2', C: 'C3', G: 'G2', Dm: 'D3', E: 'E2', 'F#': 'F#2' };

type Seg = [string, number];
/** "Am F C G" = one chord per bar; "F/G" = two chords, 2 beats each. */
function segs(prog: string): Seg[] {
  return prog.trim().split(/\s+/).flatMap((bar): Seg[] => {
    const cs = bar.split('/');
    return cs.map(c => [c, 4 / cs.length] as Seg);
  });
}
const up = (p: string, s: number) => fromMidi(toMidi(p) + s);
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
function lead(src: string, beats: number, v: number): Voice {
  if (Math.abs(lineBeats(src) - beats) > 1e-6) throw new Error(`lead is ${lineBeats(src)} beats, want ${beats}`);
  return line(src, 0, v);
}

// Every bass cell lands on the downbeat: there is no kick drum, the bass carries the pulse.
const BASS: Record<string, (r: string, h: string) => string> = {
  quarter: r => `${r}:1`,
  half: r => `${r}:2`,
  eighth: r => `${r}:.5@1 ${r}:.5@.75`,
  pump: (r, h) => `${r}:.5@1 ${h}:.5@.7`, // the sketch's octave pump
  gallop: (r, h) => `${r}:.5@1 ${h}:.25@.7 ${h}:.25@.55`,
  six: r => `${r}:.25@1 ${r}:.25@.6 ${r}:.25@.85 ${r}:.25@.6`,
};
/** Bass across a progression; style 'hold' rings one note per chord. */
function bass(prog: string, style: string, start: number, v: number): Voice {
  const src = segs(prog).map(([c, b]) => {
    if (style === 'hold') return `${ROOT[c]}:${b}`;
    const cell = BASS[style](ROOT[c], up(ROOT[c], 12));
    return rep(cell, b / lineBeats(cell));
  }).join(' ');
  return vel(line(src, start), v);
}
/** Chord stabs across 3 lanes; `x` in the cell = the chord. */
function stabs(prog: string, cell: string, start: number, v: number): Voice[] {
  const unit = lineBeats(cell);
  return chords(segs(prog).map(([c, b]) => rep(cell.replace(/x/g, VOX[c]), b / unit)).join(' '), 3, start, v);
}
/** Arpeggio over the voicing (+1 octave); pattern indexes into [voicing, voicing + 12]. */
function arp(prog: string, pattern: number[], step: number, start: number, v: number): Voice {
  return line(segs(prog).map(([c, b]) => {
    const t = VOX[c].split('+').map(p => toMidi(p) + 12);
    const pool = [...t, ...t.map(x => x + 12)];
    return Array.from({ length: Math.round(b / step) }, (_, i) => `${fromMidi(pool[pattern[i % pattern.length]])}:${step}`).join(' ');
  }).join(' '), start, v);
}
/** Sections with every note gated to 96% of its length so back-to-back notes don't overlap. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: e.len * 0.96 }))));
const stack = (...groups: Voice[][]): Voice[] => groups[0].map((_, k) => merge(...groups.map(g => g[k])));
/** Write in A minor, play a whole step up (B minor) for the final chorus. */
const lift = (voices: Voice[]) => voices.map(v => transpose(v, 2));

const UPDN = [0, 1, 2, 3, 4, 3, 2, 1];
const RISE = [0, 1, 2, 3, 4, 5, 4, 3];
const OFF = 'r:.5 x:.5'; // the sketch's offbeat stab

// ---------------------------------------------------------------- the hook (Am F C G, one bar each)
const H1 = 'E5:.75 E5:.75 C5:.5 D5:.75 C5:.75 A4:.5';
const H2 = 'C5:.75 C5:.75 A4:.5 C5:1 D5:1';
const H2b = 'C5:.75 C5:.75 A4:.5 F5:.75 E5:.75 C5:.5';
const H3 = 'E5:.75 E5:.75 G5:.5 E5:.75 D5:.75 C5:.5';
const H3b = 'E5:.75 E5:.75 G5:.5 A5:.75 G5:.75 E5:.5';
const H4 = 'D5:1.5 B4:.5 G4:2';
const H4b = 'D5:1.5 E5:.5 G5:2'; // answers upward instead of falling
const H6 = 'C5:.75 C5:.75 A4:.5 F5:1 E5:1';
const H7 = 'E5:.75 G5:.75 A5:.5 G5:.75 E5:.75 D5:.5'; // the climb to high A
const H7b = 'E5:.75 G5:.75 A5:.5 C6:.75 B5:.75 G5:.5'; // ...and one step further
const H8 = 'D5:1 E5:.5 D5:.5 B4:2';
const H8b = 'D5:.75 E5:.75 G5:.5 A5:2'; // lands on the high A
const H8lift = 'D5:1 B4:1 A#4:.5 C#5:.5 E5:.5 F#5:.5'; // over G/F#, pivots to B minor
const HOOK = [H1, H2, H3, H4, H1, H6, H7, H8].join(' ');
const HOOK_PROG = 'Am F C G Am F C G';

// Short square answers that fill the bars where the lead holds a long note
const ANS_UP = 'r:2.5 B4:.5 D5:.5 G5:.5';
const ANS_HI = 'r:2.5 D5:.5 G5:.5 B5:.5';
const ANS_DN = 'r:2.5 D5:.5 B4:.5 G4:.5';
const ANS_HOME = 'r:2.5 B4:.5 D5:.5 E5:.5';

// ---------------------------------------------------------------- sections
// Intro: arp and a quarter-note pulse, then the pump and stabs; the hook's first cells tease in
const intro = section('intro', 32, [
  ramp(lead('r:16 | E5:.75 E5:.75 C5:.5 r:2 | r:4 | E5:.75 E5:.75 G5:.5 r:2 | r:4', 32, 0.55), 0.85, 1.1),
  merge(bass('Am F C G', 'quarter', 0, 0.36), ramp(bass('Am F C G', 'pump', 16, 1), 0.4, 0.45)),
  ...stabs('Am F C G', OFF, 16, 0.08),
  ramp(arp(HOOK_PROG, UPDN, 0.25, 0, 1), 0.05, 0.1),
]);

// Verse: the whole hook previewed an octave low, over a lighter 8th arp
const verse = section('verse', 32, [
  transpose(lead(HOOK, 32, 0.7), -12),
  bass(HOOK_PROG, 'pump', 0, 0.46),
  ...stabs(HOOK_PROG, OFF, 0, 0.09),
  arp(HOOK_PROG, UPDN, 0.5, 0, 0.08),
]);

// Build 1: the 3+3+2 rhythm chanted on rising chord tones; bass tightens quarters -> 8ths -> 16ths;
// the sketch's pickup run launches the drop
const build1 = section('build1', 32, [
  ramp(lead([
    rep('C5:.75 C5:.75 A4:.5', 4), rep('D5:.75 D5:.75 B4:.5', 4), rep('E5:.75 E5:.75 C5:.5', 4),
    rep('D5:.75 D5:.75 G5:.5', 2), 'E4:.5 G4:.5 A4:.5 B4:.5 C5:.5 D5:.5 E5:1',
  ].join(' '), 32, 1), 0.58, 0.9),
  merge(bass('F F G G', 'quarter', 0, 0.48), bass('Am Am', 'eighth', 16, 0.5), bass('G', 'six', 24, 0.52), bass('G/G', 'six', 28, 0.52).slice(0, 8), line('G2:.5@.54', 30)),
  ...stack(stabs('F F G G', 'x:.25 r:.75', 0, 0.1), stabs('Am Am G', 'x:.25 r:.25', 16, 0.11), stabs('G', 'x:.5 r:3.5', 28, 0.13)),
  ramp(arp('F F G G Am Am G G', RISE, 0.25, 0, 1), 0.08, 0.17),
]);

// Drop 1: the hook, twice; the second pass answers upward, gains a low octave double and lands on the high A
const drop1Lead = `${HOOK} ${[H1, H2, H3, H4b, H1, H6, H7, H8b].join(' ')}`;
const drop1 = section('drop1', 64, [
  lead(drop1Lead, 64, 0.86),
  bass(`${HOOK_PROG} ${HOOK_PROG}`, 'pump', 0, 0.5),
  ...stabs(`${HOOK_PROG} ${HOOK_PROG}`, OFF, 0, 0.1),
  arp(`${HOOK_PROG} ${HOOK_PROG}`, UPDN, 0.25, 0, 0.11),
  vel(transpose(line([H1, H2, H3, H4b, H1, H6, H7, H8b].join(' '), 32), -12), 0.13),
]);

// Breakdown: the hook at half speed as a soaring line over a new progression (F Dm Am ...),
// pads and an 8th arp at first, the pulse and 16ths returning in the second half
const bdProg1 = 'F Dm Am F/G C Am G G';
const bdProg2 = 'F Dm Am F/C Am C G F/E';
const ANTHEM1 =
  'E5:1.5 E5:1.5 C5:1 | D5:1.5 C5:1.5 A4:1 | C5:1.5 C5:1.5 A4:1 | C5:2 D5:2 | ' +
  'E5:1.5 E5:1.5 G5:1 | E5:1.5 D5:1.5 C5:1 | D5:3 B4:1 | G4:2 B4:1 D5:1';
const ANTHEM2 =
  'E5:1.5 E5:1.5 A5:1 | G5:1.5 F5:1.5 D5:1 | E5:1.5 E5:1.5 C5:1 | F5:2 E5:2 | ' +
  'E5:1.5 G5:1.5 A5:1 | G5:1.5 E5:1.5 D5:1 | D5:2 E5:1 G5:1 | A5:2 G#5:2';
const breakdown = section('breakdown', 64, [
  merge(lead(ANTHEM1, 32, 0.64), ramp(line(ANTHEM2, 32, 1), 0.7, 0.8)),
  merge(bass(bdProg1, 'hold', 0, 0.3), bass('F Dm Am F/C', 'half', 32, 0.34), bass('Am C G F/E', 'quarter', 48, 0.38)),
  ...stack(stabs(bdProg1, 'x:2', 0, 0.07), stabs(bdProg2, OFF, 32, 0.08)),
  merge(arp(bdProg1, UPDN, 0.5, 0, 0.07), ramp(arp(bdProg2, UPDN, 0.25, 32, 1), 0.07, 0.13)),
]);

// Build 2: the 3+3+2 rhythm stretched to double length, climbing to the dominant (E) and tightening
// back to hook speed
const build2 = section('build2', 32, [
  ramp(lead(
    'A4:1.5 C5:1.5 F5:1 | E5:1.5 C5:1.5 A4:1 | B4:1.5 D5:1.5 G5:1 | F5:1.5 D5:1.5 B4:1 | ' +
    'C5:1.5 E5:1.5 A5:1 | G5:1.5 E5:1.5 C5:1 | B4:.75 B4:.75 E5:.5 G#5:.75 G#5:.75 B5:.5 | B5:1 G#5:.5 E5:.5 D5:.5 E5:.5 r:1',
    32, 1), 0.62, 0.92),
  merge(bass('F F', 'quarter', 0, 0.48), bass('G G', 'eighth', 8, 0.5), bass('Am Am', 'pump', 16, 0.52), bass('E', 'six', 24, 0.54),
    bass('E', 'six', 28, 0.54).slice(0, 8), line('E2:.5@.56', 30)),
  ...stack(stabs('F F G G', 'x:.25 r:.75', 0, 0.1), stabs('Am Am E', 'x:.25 r:.25', 16, 0.12), stabs('E', 'x:.5 r:3.5', 28, 0.14)),
  ramp(arp('F F G G Am Am E E', RISE, 0.25, 0, 1), 0.1, 0.2),
]);

// Drop 2a: the hook with a higher climb, galloping octave bass, a low double from the start,
// square answers in the held bars and a wider arp; the last bar pivots to B minor
const drop2aProg = `${HOOK_PROG} Am F C G Am F C G/F#`;
const drop2aLead = [H1, H2, H3, H4, H1, H6, H7b, H8, H1, H2b, H3b, H4b, H1, H6, H7, H8lift].join(' ');
const drop2a = section('drop2a', 64, [
  lead(drop2aLead, 64, 0.88),
  bass(drop2aProg, 'gallop', 0, 0.48),
  ...stabs(drop2aProg, OFF, 0, 0.1),
  arp(drop2aProg, RISE, 0.25, 0, 0.12),
  vel(transpose(line(drop2aLead), -12), 0.13),
  line(`r:12 ${ANS_UP} r:12 ${ANS_HI} r:12 ${ANS_DN} r:16`, 0, 0.11),
]);

// Drop 2b (B minor): the final chorus a whole step up, ending on the high note
const drop2bLead = [H1, H2, H3, H4, H1, H6, H7, H8b].join(' ');
const drop2b = section('drop2b', 32, lift([
  lead(drop2bLead, 32, 0.9),
  bass(HOOK_PROG, 'gallop', 0, 0.5),
  ...stabs(HOOK_PROG, OFF, 0, 0.1),
  arp(HOOK_PROG, RISE, 0.25, 0, 0.12),
  vel(transpose(line(drop2bLead), -12), 0.14),
  line(`r:12 ${ANS_UP} r:12 ${ANS_HOME}`, 0, 0.11),
]));

// Outro (B minor): the hook thins to its first cells, a V–i cadence, and the bass settles on the tonic
const outro = section('outro', 32, lift([
  ramp(lead(
    `${H1} | ${H2} | E5:.75 E5:.75 G5:.5 E5:2 | ${H4} | ` +
    'E5:.75 E5:.75 C5:.5 r:2 | C5:.75 C5:.75 A4:.5 r:2 | E5:.75 D5:.75 B4:.5 G#4:2 | A4:4',
    32, 0.82), 1, 0.62),
  merge(ramp(bass('Am F C G', 'pump', 0, 1), 0.48, 0.4), ramp(bass('Am F E', 'quarter', 16, 1), 0.36, 0.3), bass('Am', 'hold', 28, 0.3)),
  ...stack(stabs('Am F C G', OFF, 0, 0.09), stabs('Am F E', 'x:2', 16, 0.07), stabs('Am', 'x:4', 28, 0.07)),
  merge(ramp(arp('Am F C G Am F E', UPDN, 0.25, 0, 1), 0.1, 0.04), line('A4:1@.05 C5:1@.045 E5:1@.04 A5:1@.035', 28)),
]));

export const track = buildTrack({
  name: 'Glass Towers',
  genre: 'edm',
  bpm: 124,
  sections: [intro, verse, build1, drop1, breakdown, build2, drop2a, drop2b, outro],
  // 32 + 32 + 32 + 64 + 64 + 32 + 64 + 32 + 32 = 384 beats at 124 BPM = 3:06
  form: ['intro', 'verse', 'build1', 'drop1', 'breakdown', 'build2', 'drop2a', 'drop2b', 'outro'],
});
