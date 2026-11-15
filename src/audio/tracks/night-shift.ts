import { buildTrack, chords, fromMidi, line, lineBeats, merge, ramp, section as rawSection, toMidi, transpose, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Night Shift',
  label: 'Extended Mix',
  blurb: 'Dark electro at 120 BPM in D minor. A galloping bass teases the riff in pieces, a build stacks its octave leaps until the first drop lands, then a breakdown slows the riff into a singing line before a rising build lifts the key to E minor for a bigger second drop.',
};

// ---------------------------------------------------------------- harmony helpers
const VOX: Record<string, string> = {
  Dm: 'A3+D4+F4', Bb: 'Bb3+D4+F4', C: 'G3+C4+E4', A7: 'G3+C#4+E4', A: 'A3+C#4+E4',
  Gm: 'G3+Bb3+D4', F: 'A3+C4+F4', D: 'A3+D4+F#4', B7: 'A3+D#4+F#4',
};
const ROOT: Record<string, string> = {
  Dm: 'D2', Bb: 'Bb2', C: 'C3', A7: 'A2', A: 'A2', Gm: 'G2', F: 'F2', D: 'D2', B7: 'B2',
};
// Roots for the lifted drop: low enough that the octave bounce stays in octaves 2-3 after +2.
const ROOT_LO: Record<string, string> = { ...ROOT, Bb: 'Bb1', C: 'C2' };

type Seg = [string, number];
/** "Dm Bb/C" -> one chord per bar, or two half-bar chords. */
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

// Bass cells: `R` = root, `O` = root an octave up. All land on the downbeat (no drums in the synth).
const GALLOP = 'R:.25@1 r:.25 R:.25@.7 R:.25@.7';
const GALLOP_OCT = 'R:.25@1 r:.25 O:.25@.75 R:.25@.7';
const QUARTER = 'R:1';
const EIGHTH = 'R:.5@1 R:.5@.8';
const SIXTEENTH = 'R:.25@1 R:.25@.7 R:.25@.85 R:.25@.7';
const HALF = 'R:2';
function bass(prog: string, cell: string, start: number, v: number, roots = ROOT): Voice {
  const unit = lineBeats(cell);
  const src = segs(prog).map(([c, b]) => rep(cell.replace(/R/g, roots[c]).replace(/O/g, up(roots[c], 12)), Math.round(b / unit))).join(' ');
  return vel(line(src, start), v);
}
/** Chord stabs across 3 lanes; `x` in the cell = the chord. */
function stabs(prog: string, cell: string, start: number, v: number): Voice[] {
  const unit = lineBeats(cell);
  return chords(segs(prog).map(([c, b]) => rep(cell.replace(/x/g, VOX[c]), Math.round(b / unit))).join(' '), 3, start, v);
}
/** Arpeggio over the voicing (+oct); pattern indexes into [voicing, voicing + 12]. */
function arp(prog: string, pattern: number[], step: number, oct: number, start: number, v: number): Voice {
  const src = segs(prog).map(([c, b]) => {
    const t = VOX[c].split('+').map(p => toMidi(p) + oct);
    const pool = [...t, ...t.map(x => x + 12)];
    return Array.from({ length: Math.round(b / step) }, (_, i) => `${fromMidi(pool[pattern[i % pattern.length]])}:${step}`).join(' ');
  }).join(' ');
  return line(src, start, v);
}
/** Sections with every note gated to 96% of its length so back-to-back notes don't smear. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: e.len * 0.96 }))));
const stack = (...groups: Voice[][]): Voice[] => groups[0].map((_, k) => merge(...groups.map(g => g[k])));
/** Write in D minor, play a whole step up (E minor). */
const lift = (voices: Voice[]) => voices.map(v => transpose(v, 2));

const SKETCH_ARP = [0, 2, 4, 2, 1, 3, 5, 3];
const WIDE_ARP = [0, 2, 4, 5, 3, 1, 2, 4];
const RISE = [0, 1, 2, 3, 4, 5, 4, 3];
const UPDN = [0, 1, 2, 1];
const STAB = 'r:.75 x:.25 r:1'; // the sketch's syncopated stab
const STAB_FULL = 'r:.75 x:.25 r:.5 x:.5';

// ---------------------------------------------------------------- the riff
// Each bar: a 2-beat "call" with the octave leap, then a 2-beat "response".
const CALL = {
  Dm: 'D4:.5 D5:.5 r:.25 D4:.25 C5:.5',
  Bb: 'F4:.5 F5:.5 r:.25 F4:.25 D5:.5',
  C: 'E4:.5 E5:.5 r:.25 E4:.25 D5:.5',
  // higher calls for the second drop
  C_hi: 'G4:.5 G5:.5 r:.25 G4:.25 E5:.5',
  A7: 'A4:.5 A5:.5 r:.25 A4:.25 G5:.5',
};
const RESP = {
  Dm: 'r:.5 A4:.5 F4:.5 G4:.5',
  Bb: 'r:.5 Bb4:.5 A4:.5 F4:.5',
  C: 'r:.5 C5:.5 G4:.5 E4:.5',
  // alternate answers
  DmUp: 'r:.5 A4:.5 D5:.5 F5:.5',
  DmDn: 'r:.5 F5:.5 E5:.5 D5:.5',
  BbUp: 'r:.5 Bb4:.5 D5:.5 F5:.5',
  BbArc: 'r:.5 D5:.5 F5:.5 D5:.5',
  BbDn: 'r:.5 D5:.5 C5:.5 Bb4:.5',
  CUp: 'r:.5 C5:.5 E5:.5 G5:.5',
  CArc: 'r:.5 G5:.5 E5:.5 C5:.5',
  CTop: 'r:.5 E5:.5 G5:.5 E5:.5',
};
const TURN = 'A4:1.5 G4:.5 E4:1 C#5:1'; // bar 4 answer
const END = 'E5:.5 D5:.5 C#5:.5 A4:.5 E4:1 A4:1'; // bar 8 answer
const CLIMB = 'A4:.5 C#5:.5 E5:.5 G5:.5 A5:1 E5:1';
const PICKUP = 'A4:.5 r:.5 A4:.5 r:.5 C#5:.5 r:.5 E5:1';
const HOOK =
  `${CALL.Dm} ${RESP.Dm} ${CALL.Bb} ${RESP.Bb} ${CALL.C} ${RESP.C} ${TURN} ` +
  `${CALL.Dm} ${RESP.Dm} ${CALL.Bb} ${RESP.Bb} ${CALL.C} ${RESP.C} ${END}`;
/** The calls alone, with the two turnaround answers: the riff's skeleton. */
const TEASE = `${CALL.Dm} r:2 ${CALL.Bb} r:2 ${CALL.C} r:2 ${TURN} ${CALL.Dm} r:2 ${CALL.Bb} r:2 ${CALL.C} r:2 ${END}`;

const LOOP = 'Dm Bb C A7';
const LOOP4 = rep(LOOP, 4);

// ---------------------------------------------------------------- sections
// Intro (0:00): gallop and a low 8th arp; stabs at bar 5; the riff's calls alone from bar 9.
const intro = section('intro', 64, [
  ramp(lead(`r:32 ${TEASE}`, 64, 0.62), 0.9, 1.2),
  merge(bass(LOOP, EIGHTH, 0, 0.38), ramp(bass(rep(LOOP, 3), GALLOP, 16, 1), 0.4, 0.48)),
  ...stabs(rep(LOOP, 3), STAB, 16, 0.075),
  merge(
    ramp(arp(rep(LOOP, 2), UPDN, 0.5, 0, 0, 1), 0.05, 0.08),
    ramp(arp(rep(LOOP, 2), SKETCH_ARP, 0.25, 12, 32, 1), 0.06, 0.1),
  ),
]);

// Build 1 (0:32): the octave-leap call stacks up (once a bar, twice a bar, 16th octave flicks), bass goes
// quarters -> 8ths -> 16ths, then everything hits together on the sketch's pickup.
const build1 = section('build1', 32, [
  ramp(lead(
    `${CALL.Bb} r:2 ${CALL.Bb} r:2 ${CALL.C} r:2 ${CALL.C} r:2 | ` +
    `${rep(CALL.Dm, 4)} | ` +
    `${rep('A4:.25 A5:.25', 2)} ${rep('G4:.25 G5:.25', 2)} ${rep('E4:.25 E5:.25', 2)} ${rep('C#4:.25 C#5:.25', 2)} | ${PICKUP}`,
    32, 1), 0.62, 0.92),
  merge(
    bass('Bb Bb C C', QUARTER, 0, 0.48),
    bass('Dm Dm', EIGHTH, 16, 0.5),
    bass('A7', SIXTEENTH, 24, 0.5),
    line('A2:.5@.55 r:.5 A2:.5@.55 r:.5 A2:.5@.58 r:.5 A2:1@.6', 28),
  ),
  ...stack(
    stabs('Bb Bb C C', 'x:.25 r:.75', 0, 0.085),
    stabs('Dm Dm A7', 'x:.25 r:.25', 16, 0.095),
    stabs('A7', 'x:.5 r:.5 x:.5 r:.5 x:.5 r:.5 x:1', 28, 0.11),
  ),
  ramp(arp('Bb Bb C C Dm Dm A7', RISE, 0.25, 12, 0, 1), 0.06, 0.14),
]);

// Drop 1 (0:48): the full riff twice; the second pass varies its answers and adds a low square double.
const DROP1_B =
  `${CALL.Dm} ${RESP.Dm} ${CALL.Bb} ${RESP.BbArc} ${CALL.C} ${RESP.CArc} ${CLIMB} ` +
  `${CALL.Dm} ${RESP.DmUp} ${CALL.Bb} ${RESP.Bb} ${CALL.C} ${RESP.CUp} E5:.5 D5:.5 C#5:.5 A4:.5 E4:.5 G4:.5 A4:.5 C#5:.5`;
const drop1 = section('drop1', 64, [
  lead(`${HOOK} ${DROP1_B}`, 64, 0.86),
  bass(LOOP4, GALLOP, 0, 0.5),
  ...stabs(LOOP4, STAB, 0, 0.1),
  merge(arp(rep(LOOP, 2), SKETCH_ARP, 0.25, 12, 0, 0.085), arp(rep(LOOP, 2), SKETCH_ARP, 0.25, 12, 32, 0.11)),
  vel(transpose(line(DROP1_B, 32), -12), 0.14),
]);

// Breakdown (1:20): the riff slowed into a singing line. Each phrase keeps the octave leap
// (F4->F5, D4->D5, G4->G5) and the A7 turnaround is stretched into a climbing arpeggio.
const bdProg = 'Bb C Dm Dm Gm Bb A A Bb C Dm F Gm Bb A7 A7';
const SING =
  'F4:1 F5:2 D5:1 | E5:1.5 D5:.5 C5:2 | D4:1 D5:2 C5:1 | A4:2 F4:1 A4:1 | ' +
  'G4:1 G5:2 F5:1 | F5:1.5 D5:.5 Bb4:2 | A4:1 C#5:1 E5:1 G5:1 | A5:2 G5:1 E5:1 | ' +
  'F4:1 F5:2 D5:1 | E5:1 G5:1 E5:1 C5:1 | D5:1 A5:2 F5:1 | F5:1.5 E5:.5 C5:2 | ' +
  'D5:1 G5:2 F5:1 | F5:1.5 D5:.5 Bb4:1 D5:1 | C#5:1 E5:1 G5:1 Bb5:1 | A5:2 G5:1 E5:1';
const breakdown = section('breakdown', 64, [
  ramp(lead(SING, 64, 0.7), 0.95, 1.1),
  merge(bass('Bb C Dm F Gm Bb', HALF, 32, 0.32), ramp(bass('A7 A7', EIGHTH, 56, 1), 0.34, 0.42)),
  ...stabs(bdProg, 'x:2', 0, 0.065),
  merge(
    arp('Gm Bb A A', UPDN, 0.5, 0, 16, 0.06),
    ramp(arp('Bb C Dm F Gm Bb A7 A7', SKETCH_ARP, 0.25, 12, 32, 1), 0.06, 0.12),
  ),
  vel(transpose(line(SING.split('|').slice(8).join(' '), 32), -12), 0.12),
]);

// Build 2 (1:52): rising long notes over Bb - C - D, then B7 (the dominant of E minor) with the
// octave flicks and the pickup a whole step up.
const build2 = section('build2', 32, [
  ramp(lead(
    'D5:2 F5:2 | Bb4:2 D5:1 F5:1 | E5:2 G5:2 | C5:2 E5:1 G5:1 | F#5:2 A5:2 | ' +
    'D5:.5 F#5:.5 A5:.5 F#5:.5 D5:.5 F#5:.5 A5:.5 B5:.5 | ' +
    `${rep('B4:.25 B5:.25', 2)} ${rep('A4:.25 A5:.25', 2)} ${rep('F#4:.25 F#5:.25', 2)} ${rep('D#4:.25 D#5:.25', 2)} | ` +
    'B4:.5 r:.5 B4:.5 r:.5 D#5:.5 r:.5 F#5:1',
    32, 1), 0.64, 0.94),
  merge(
    bass('Bb Bb C C', QUARTER, 0, 0.5),
    bass('D D', EIGHTH, 16, 0.52),
    bass('B7', SIXTEENTH, 24, 0.52),
    line('B2:.5@.56 r:.5 B2:.5@.56 r:.5 B2:.5@.6 r:.5 B2:1@.62', 28),
  ),
  ...stack(
    stabs('Bb Bb C C', 'x:.25 r:.75', 0, 0.09),
    stabs('D D B7', 'x:.25 r:.25', 16, 0.1),
    stabs('B7', 'x:.5 r:.5 x:.5 r:.5 x:.5 r:.5 x:1', 28, 0.115),
  ),
  ramp(arp('Bb Bb C C D D B7', RISE, 0.25, 12, 0, 1), 0.07, 0.15),
]);

// Drop 2 (2:08, E minor): rising answers, then higher calls on C and A7; octave-bouncing gallop,
// fuller stabs, a wider arp and the low double throughout.
const DROP2 =
  `${CALL.Dm} ${RESP.Dm} ${CALL.Bb} ${RESP.BbUp} ${CALL.C} ${RESP.CUp} ${CLIMB} ` +
  `${CALL.Dm} ${RESP.DmDn} ${CALL.Bb} ${RESP.BbDn} ${CALL.C} ${RESP.CTop} ${END} ` +
  `${CALL.Dm} ${RESP.DmUp} ${CALL.Bb} ${RESP.BbArc} ${CALL.C_hi} ${RESP.CArc} ${CALL.A7} r:.5 E5:.5 C#5:.5 E5:.5 ` +
  `${CALL.Dm} ${RESP.Dm} ${CALL.Bb} ${RESP.BbUp} ${CALL.C} ${RESP.CUp} A5:.5 G5:.5 E5:.5 C#5:.5 E5:.5 D5:.5 C#5:.5 A4:.5`;
const drop2 = section('drop2', 64, lift([
  lead(DROP2, 64, 0.88),
  bass(LOOP4, GALLOP_OCT, 0, 0.5, ROOT_LO),
  ...stabs(LOOP4, STAB_FULL, 0, 0.095),
  merge(arp(rep(LOOP, 2), SKETCH_ARP, 0.25, 12, 0, 0.11), arp(rep(LOOP, 2), WIDE_ARP, 0.25, 12, 32, 0.12)),
  vel(transpose(line(DROP2), -12), 0.14),
]));

// Outro (2:40, E minor): the calls alone again over a thinning groove, ending on a held octave leap.
const outro = section('outro', 48, lift([
  ramp(lead(`${TEASE} ${CALL.Dm} A4:2 | D4:.5 D5:.5 r:3 | D4:.5 D5:3.5 | r:4`, 48, 0.75), 1, 0.7),
  merge(
    ramp(bass(rep(LOOP, 2), GALLOP, 0, 1), 0.48, 0.38),
    line('D2:1@.34 D2:1@.3 D2:1@.3 D2:1@.28 D2:1@.28 D2:1@.26 D2:1@.26 D2:1@.24 D2:2@.24 r:2 D2:2@.2 r:2', 32),
  ),
  ...stack(stabs(rep(LOOP, 2), STAB, 0, 0.09), stabs('Dm Dm Dm', 'x:2', 32, 0.06)),
  merge(
    ramp(arp(rep(LOOP, 2), SKETCH_ARP, 0.25, 12, 0, 1), 0.1, 0.05),
    ramp(arp('Dm Dm Dm', UPDN, 0.5, 0, 32, 1), 0.05, 0.02),
  ),
]));

export const track = buildTrack({
  name: 'Night Shift',
  genre: 'edm',
  bpm: 120,
  sections: [intro, build1, drop1, breakdown, build2, drop2, outro],
  // 64 + 32 + 64 + 64 + 32 + 64 + 48 = 368 beats at 120 BPM = 3:04
  form: ['intro', 'build1', 'drop1', 'breakdown', 'build2', 'drop2', 'outro'],
});
