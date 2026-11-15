import { buildTrack, chords, fromMidi, line, lineBeats, merge, ramp, section as rawSection, toMidi, transpose, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Rush Hour',
  label: 'Extended Mix',
  blurb: 'The hook is teased in the intro and a lower verse melody leads into the first drop. A breakdown stretches the hook\'s peak into a slow anthem, the second drop adds stacked harmony, answering phrases and 16th arps, and the last chorus lifts a half step to F major before the outro winds down.',
};

// ---------------------------------------------------------------- harmony helpers
const VOX: Record<string, string> = {
  E: 'G#3+B3+E4', B: 'F#3+B3+D#4', 'C#m': 'G#3+C#4+E4', A: 'A3+C#4+E4', 'G#m': 'G#3+B3+D#4', C: 'G3+C4+E4',
};
const ROOT: Record<string, string> = { E: 'E2', B: 'B2', 'C#m': 'C#3', A: 'A2', 'G#m': 'G#2', C: 'C3' };

type Seg = [string, number];
/** "E B C#m A/B" = one chord per bar; "A/B" = two chords, 2 beats each. */
function segs(prog: string): Seg[] {
  return prog.trim().split(/\s+/).flatMap((bar): Seg[] => {
    const cs = bar.split('/');
    return cs.map(c => [c, 4 / cs.length] as Seg);
  });
}
const up = (p: string, s: number) => fromMidi(toMidi(p) + s);
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
function lead(src: string, beats: number, v: number, start = 0): Voice {
  if (Math.abs(lineBeats(src) - beats) > 1e-6) throw new Error(`lead is ${lineBeats(src)} beats, want ${beats}`);
  return line(src, start, v);
}
/** Fill each chord's span with a repeating cell; `R` = root, `O` = the root's other octave (down from C3 up, to stay in octaves 2-3). */
function bass(prog: string, cell: string, v: number, start = 0): Voice {
  const unit = lineBeats(cell);
  return vel(line(segs(prog).map(([c, b]) => {
    const r = ROOT[c];
    const o = up(r, toMidi(r) >= toMidi('C3') ? -12 : 12);
    return rep(cell.replace(/R/g, r).replace(/O/g, o), Math.round(b / unit));
  }).join(' '), start), v);
}
/** Chord stabs across 3 lanes; `x` in the cell = the chord. */
function stabs(prog: string, cell: string, v: number, start = 0): Voice[] {
  const unit = lineBeats(cell);
  return chords(segs(prog).map(([c, b]) => rep(cell.replace(/x/g, VOX[c]), Math.round(b / unit))).join(' '), 3, start, v);
}
/** Arpeggio over the voicing (+1 octave); pattern indexes into [voicing, voicing + 12]. */
function arp(prog: string, pattern: number[], step: number, v: number, start = 0): Voice {
  return line(segs(prog).map(([c, b]) => {
    const t = VOX[c].split('+').map(p => toMidi(p) + 12);
    const pool = [...t, ...t.map(x => x + 12)];
    return Array.from({ length: Math.round(b / step) }, (_, i) => `${fromMidi(pool[pattern[i % pattern.length]])}:${step}`).join(' ');
  }).join(' '), start, v);
}
/** A harmony line under the lead: for each note, the nearest chord tone at least a minor third below. */
function harmony(leadV: Voice, prog: string, v: number, start = 0): Voice {
  const spans: { t0: number; t1: number; pcs: number[] }[] = [];
  let t = start;
  for (const [c, b] of segs(prog)) {
    spans.push({ t0: t, t1: t + b, pcs: VOX[c].split('+').map(p => toMidi(p) % 12) });
    t += b;
  }
  return leadV.map(e => {
    const span = spans.find(s => e.t >= s.t0 - 1e-6 && e.t < s.t1 - 1e-6);
    if (!span) throw new Error(`no chord at beat ${e.t}`);
    let m = toMidi(e.pitch) - 3;
    while (!span.pcs.includes(m % 12)) m--;
    return { ...e, pitch: fromMidi(m), vel: v };
  });
}
/** Sections with every note gated to 96% of its length so back-to-back notes don't overlap. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: e.len * 0.96 }))));
const stack = (...groups: Voice[][]): Voice[] => groups[0].map((_, k) => merge(...groups.map(g => g[k])));
/** Write in E major, play a half step up (F major) for the last chorus. */
const lift = (voices: Voice[]) => voices.map(v => transpose(v, 1));

// Bass cells: every one lands on the downbeat (there are no drums to carry the pulse)
const QUARTER = 'R:1';
const EIGHTH = 'R:.5@1 R:.5@.75';
const SIX = 'R:.25@1 R:.25@.7 R:.25@.85 R:.25@.7';
const RUSH = 'R:.75@1 R:.25@.6 O:.5@.8 R:.5@.7'; // the sketch's octave bounce
const RUSH2 = 'R:.5@1 O:.25@.6 R:.25@.7 O:.5@.85 R:.25@.7 O:.25@.6'; // busier bounce for the second drop
const HALF = 'R:2';
const WHOLE = 'R:4';

const OFF = 'r:.5 x:.5';
const OFF_SHORT = 'r:.5 x:.25 r:.25';
const BACK = 'r:1 x:.5 r:.5'; // stabs on 2 and 4, a clap feel for the verse
const ARP8 = [0, 1, 2, 3, 2, 1];
const ARP16 = [0, 1, 2, 3, 4, 3, 2, 1];
const RISE = [0, 1, 2, 3, 4, 5, 4, 3];

// ---------------------------------------------------------------- the hook (8 bars, from the sketch)
const HOOK = [
  'B4:.5 E5:.5 G#5:1 F#5:.5 E5:.5 F#5:1',
  'D#5:.5 F#5:.5 B5:1.5 A5:.5 G#5:.5 F#5:.5',
  'G#5:.5 E5:.5 C#5:1 B4:.5 C#5:.5 E5:1',
  'C#5:1.5 B4:.5 A4:1 B4:1',
  'B4:.5 E5:.5 G#5:1 F#5:.5 E5:.5 F#5:1',
  'D#5:.5 F#5:.5 B5:1 A5:.5 G#5:.5 F#5:1',
  'G#5:.75 G#5:.75 A5:.5 G#5:.5 F#5:.5 E5:1',
  'F#5:1.5 E5:.5 D#5:2',
];
const hook = (alt: Record<number, string> = {}) => HOOK.map((b, i) => alt[i] ?? b).join(' | ');
const HP = 'E B C#m A E B C#m A/B';
const PICKUP = 'B4:1 C#5:1 D#5:1 F#5:1';
const HOLD4 = 'C#5:1.5 B4:.5 A4:2'; // bar 4 held, leaving room for an answer

// ---------------------------------------------------------------- sections
// Intro: bass and arp alone, then stabs and the hook's opening fragments teased
const intro = section('intro', 32, [
  lead('r:16 B4:.5 E5:.5 G#5:1 r:2 | D#5:.5 F#5:.5 B5:1 r:2 | G#5:.5 E5:.5 C#5:1 r:2 | C#5:1.5 B4:.5 A4:2', 32, 0.7),
  merge(ramp(bass('E B C#m A', QUARTER, 1), 0.36, 0.44), bass('E B C#m A', RUSH, 0.46, 16)),
  ...stabs('E B C#m A', OFF, 0.08, 16),
  ramp(arp('E B C#m A E B C#m A', ARP8, 0.5, 1), 0.04, 0.1),
]);

// Verse: the hook's rhythm moved down onto the relative minor, a lower call-and-answer melody
const verseProg = 'C#m A E B C#m A E B';
const verse = section('verse', 32, [
  lead(
    'G#4:.5 C#5:.5 E5:1 D#5:.5 C#5:.5 B4:1 | C#5:1.5 B4:.5 A4:2 | G#4:.5 B4:.5 E5:1 D#5:.5 C#5:.5 B4:1 | D#5:1.5 C#5:.5 B4:2 | ' +
    'G#4:.5 C#5:.5 E5:1 D#5:.5 E5:.5 G#5:1 | F#5:1 E5:.5 C#5:.5 E5:2 | B4:.5 E5:.5 G#5:1 F#5:.5 E5:.5 F#5:1 | D#5:1.5 C#5:.5 B4:2',
    32, 0.76),
  bass(verseProg, RUSH, 0.46),
  ...stabs(verseProg, BACK, 0.09),
  ramp(arp(verseProg, ARP8, 0.5, 1, 0), 0.05, 0.08),
]);

// Build 1: long rising saw notes over a bass that tightens quarter -> 8th -> 16th -> silence
const build1 = section('build1', 32, [
  ramp(lead(`E5:2 C#5:2 | E5:2 A5:2 | F#5:2 D#5:2 | F#5:2 B5:2 | G#5:2 E5:2 | G#5:1 A5:1 B5:2 | B5:2 A5:1 F#5:1 | ${PICKUP}`, 32, 1), 0.62, 0.9),
  merge(bass('A A B B', QUARTER, 0.48), bass('C#m C#m', EIGHTH, 0.5, 16), bass('B', SIX, 0.52, 24), line('B2:.5@.54', 28)),
  ...stack(stabs('A A B B', 'x:.25 r:.75', 0.1), stabs('C#m C#m B', 'x:.25 r:.25', 0.11, 16), stabs('B', 'x:.5 r:3.5', 0.13, 28)),
  ramp(arp('A A B B C#m C#m B', RISE, 0.25, 1), 0.07, 0.18),
]);

// Drop 1: the hook twice; the second pass adds the arp and a low octave double, with new endings
const drop1Pass2 = hook({ 2: 'G#5:.5 E5:.5 C#5:1 B4:.5 C#5:.5 E5:.5 F#5:.5', 7: 'F#5:1.5 E5:.5 D#5:1 B4:1' });
const drop1 = section('drop1', 64, [
  merge(lead(hook(), 32, 0.86), lead(drop1Pass2, 32, 0.88, 32)),
  bass(`${HP} ${HP}`, RUSH, 0.5),
  ...stabs(`${HP} ${HP}`, OFF, 0.1),
  arp(HP, ARP8, 0.5, 0.12, 32),
  vel(transpose(line(drop1Pass2, 32), -12), 0.15),
]);

// Breakdown: the hook's peak (D#-F#-B, then the fall from B5) stretched into a slow anthem over new chords
const bdA = 'A B G#m C#m A B E E';
const bdB = 'A B G#m C#m A B C#m B';
const breakdown = section('breakdown', 64, [
  merge(
    lead('E5:1 F#5:1 A5:2 | A5:1 G#5:1 F#5:2 | D#5:1 F#5:1 B5:2 | B5:1 A5:.5 G#5:.5 G#5:2 | ' +
      'E5:1 F#5:1 A5:2 | A5:1.5 G#5:.5 F#5:1 D#5:1 | E5:1.5 F#5:.5 G#5:2 | B4:1 E5:1 G#5:2', 32, 0.74),
    lead('E5:1 F#5:1 A5:2 | A5:1 B5:1 F#5:2 | D#5:1 F#5:1 B5:2 | B5:1.5 A5:.5 G#5:1 E5:1 | ' +
      'C#5:1 E5:1 A5:2 | G#5:1 F#5:1 D#5:2 | E5:1 G#5:1 B5:2 | A5:1 G#5:1 F#5:2', 32, 0.82, 32),
  ),
  merge(bass(bdA, WHOLE, 0.3), ramp(bass(bdB, QUARTER, 1, 32), 0.3, 0.42)),
  ...stack(stabs(bdA, 'x:2', 0.08), stabs(bdB, 'x:1', 0.08, 32)),
  merge(ramp(arp('A B E E', ARP8, 0.5, 1, 16), 0.05, 0.08), ramp(arp(bdB, ARP8, 0.5, 1, 32), 0.08, 0.12)),
]);

// Build 2: higher and busier than build 1, 16th stabs in the last bar before the pickup
const build2 = section('build2', 32, [
  ramp(lead(`C#5:1 E5:1 A5:2 | A5:1 G#5:1 E5:2 | D#5:1 F#5:1 B5:2 | B5:1 A5:1 F#5:2 | E5:1 G#5:1 B5:2 | G#5:1 A5:1 B5:2 | ` +
    `C#5:.5 E5:.5 A5:.5 E5:.5 C#5:.5 E5:.5 A5:.5 B5:.5 | ${PICKUP}`, 32, 1), 0.66, 0.92),
  merge(bass('A A', QUARTER, 0.5), bass('B B C#m C#m', EIGHTH, 0.5, 8), bass('A', SIX, 0.54, 24), line('B2:.5@.56', 28)),
  ...stack(stabs('A A B B C#m C#m', 'x:.25 r:.25', 0.1), stabs('A', 'x:.25', 0.11, 24), stabs('B', 'x:.5 r:3.5', 0.14, 28)),
  ramp(arp('A A B B C#m C#m A', RISE, 0.25, 1), 0.08, 0.2),
]);

// Drop 2: stacked chord-tone harmony, answering phrases, 16th arp, busier bass; the last bar turns to C
const d2Prog2 = 'E B C#m A E B C#m A/C';
const d2Lead1 = lead(hook({ 3: HOLD4 }), 32, 0.9);
const d2Lead2 = lead(hook({ 3: HOLD4, 7: 'F#5:1 E5:1 G5:.5 F5:.5 E5:.5 D5:.5' }), 32, 0.9, 32);
const drop2a = section('drop2a', 64, [
  merge(d2Lead1, d2Lead2),
  bass(`${HP} ${d2Prog2}`, RUSH2, 0.5),
  ...stabs(`${HP} ${d2Prog2}`, OFF_SHORT, 0.1),
  merge(ramp(arp(HP, ARP8, 0.5, 1), 0.11, 0.12), arp(d2Prog2, ARP16, 0.25, 0.1, 32)),
  merge(harmony(d2Lead1, HP, 0.13), harmony(d2Lead2.filter(e => e.t < 62), d2Prog2, 0.14, 32)),
  merge(
    line('A5:.5 G#5:.5 E5:.5 C#5:.5', 14, 0.12), line('F#5:.5 G#5:.5 A5:.5 B5:.5', 30, 0.12),
    line('E5:.5 F#5:.5 G#5:.5 A5:.5', 46, 0.12),
  ),
]);

// Final chorus, a half step up in F major: everything at once, the hook ending on its high peak
const d3Lead = lead(hook({ 3: HOLD4, 7: 'F#5:1 A5:1 B5:2' }), 32, 0.92);
const drop2b = section('drop2b', 32, lift([
  d3Lead,
  bass(HP, RUSH2, 0.52),
  ...stabs(HP, OFF_SHORT, 0.1),
  arp(HP, ARP16, 0.25, 0.1),
  harmony(d3Lead, HP, 0.15),
  merge(line('A5:.5 G#5:.5 E5:.5 C#5:.5', 14, 0.12), line('F#5:.5 D#5:.5 B4:.5 F#4:.5', 30, 0.12)),
]));

// Outro (F major): the hook once more, thinning out to a last held chord
const outroProg = 'E B C#m A E A E E';
const outro = section('outro', 32, lift([
  ramp(lead(`${HOOK[0]} | ${HOOK[1]} | ${HOOK[2]} | ${HOLD4} | B4:1 E5:1 G#5:2 | F#5:2 E5:2 | E5:4 | r:4`, 32, 1), 0.84, 0.5),
  merge(ramp(bass('E B C#m A', RUSH, 1), 0.48, 0.38), ramp(bass('E A E', HALF, 1, 16), 0.34, 0.26), bass('E', WHOLE, 0.24, 28)),
  ...stack(stabs('E B C#m A', OFF, 0.1), stabs('E A E E', 'x:2', 0.07, 16)),
  ramp(arp(outroProg, ARP8, 0.5, 1), 0.11, 0.03),
]));

export const track = buildTrack({
  name: 'Rush Hour',
  genre: 'edm',
  bpm: 128,
  sections: [intro, verse, build1, drop1, breakdown, build2, drop2a, drop2b, outro],
  // 32 + 32 + 32 + 64 + 64 + 32 + 64 + 32 + 32 = 384 beats at 128 BPM = 3:00
  form: ['intro', 'verse', 'build1', 'drop1', 'breakdown', 'build2', 'drop2a', 'drop2b', 'outro'],
});
