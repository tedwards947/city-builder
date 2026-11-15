import { buildTrack, chords, fromMidi, line, ramp, section, shift, toMidi, transpose, vel, type Voice } from '../../compose.ts';

export const meta = {
  song: 'Rainy Day',
  label: 'Café Rain',
  blurb: 'A lo-fi, jazzier take at 80 BPM: the theme is sung lazily behind the beat over Am9, Fmaj7, Dm9 and E7sus, with off-beat chord stabs, a lilting bass and a C-major bridge (Cmaj9, A7, G13) built from the same falling motif.',
};

// ---- chords: rootless 4-note voicings + bass root. Bar = 4 beats; "X/Y" splits a bar in half.
const CH: Record<string, { v: string; r: string }> = {
  Am9: { v: 'G3+B3+C4+E4', r: 'A2' },
  Fmaj7: { v: 'E3+G3+A3+C4', r: 'F2' }, // Fmaj9
  Dm9: { v: 'F3+A3+C4+E4', r: 'D3' },
  E7sus: { v: 'D3+A3+B3+E4', r: 'E2' },
  E7: { v: 'D3+G#3+B3+E4', r: 'E2' },
  Cmaj9: { v: 'E3+G3+B3+D4', r: 'C3' },
  Am7: { v: 'G3+C4+E4', r: 'A2' },
  G13: { v: 'F3+A3+B3+E4', r: 'G2' },
  G9sus: { v: 'F3+A3+C4+D4', r: 'G2' },
  A7: { v: 'G3+C#4+E4+F#4', r: 'A2' }, // A13
  Bm7b5: { v: 'A3+D4+F4', r: 'B2' },
};

const expand = (prog: string): [string, number][] =>
  prog.trim().split(/\s+/).flatMap(b => (b.includes('/') ? b.split('/').map(c => [c, 2] as [string, number]) : [[b, 4] as [string, number]]));
const up = (p: string, semis: number) => fromMidi(toMidi(p) + semis);
const clip = (v: Voice, beats: number) => v.filter(e => e.t < beats - 1e-6);

/** Off-beat comping: a soft chord on beat 1, then a stab on the "and" of 2 that rings through the bar. */
function comp(prog: string, v = 0.19, style: 'push' | 'hold' = 'push'): Voice[] {
  const src = expand(prog).map(([c, b]) => {
    const ch = CH[c].v;
    if (style === 'hold' || b < 4) return `${ch}:${b}`;
    return `${ch}:1.5 ${ch}:2.5`;
  }).join(' ');
  return chords(src, 4, 0, v);
}

/** Lazy lo-fi bass: root, a ghosted pickup and the fifth on beat 4. */
function bass(prog: string, style: 'lofi' | 'whole' = 'lofi', v = 0.62): Voice {
  return line(expand(prog).map(([c, b]) => {
    const r = CH[c].r;
    if (style === 'whole') return `${r}:${b}`;
    if (b < 4) return `${r}:1.5 ${r}:.5@${(v * 0.7).toFixed(2)}`;
    return `${r}:2 r:.5 ${r}:.5@${(v * 0.7).toFixed(2)} ${up(r, 7)}:1`;
  }).join(' '), 0, v);
}

/** Rolling arpeggio through the voicing an octave up (vibraphone-ish shimmer). */
function arp(prog: string, v = 0.14): Voice {
  return line(expand(prog).map(([c, b]) => {
    const ts = CH[c].v.split('+').map(p => up(p, 12));
    const pat = [ts[0], ts[1], ts[2], ts[ts.length - 1], ts[2], ts[1], ts[0], ts[1]];
    return pat.slice(0, b * 2).map(p => `${p}:.5`).join(' ');
  }).join(' '), 0, v);
}

/** Raindrops on the café window: quiet chord tones in octave 5 at irregular sixteenth positions. */
function drops(prog: string, seed: number, perBar: number, v = 0.15): Voice {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out: Voice = [];
  let t0 = 0;
  for (const [c, beats] of expand(prog)) {
    const tones = CH[c].v.split('+').map(p => up(p, 24)).filter(p => toMidi(p) <= toMidi('E6'));
    const n = Math.floor((perBar * beats) / 4 + rnd());
    const slots = new Set<number>();
    for (let k = 0; k < n * 4 && slots.size < n; k++) slots.add(Math.floor(rnd() * beats * 4) / 4);
    for (const sl of [...slots].sort((a, b) => a - b)) {
      const p = tones[Math.floor(rnd() * tones.length)];
      out.push({ t: t0 + sl, pitch: p, len: 0.5, vel: Math.round(v * (0.6 + 0.6 * rnd()) * 1000) / 1000 });
    }
    t0 += beats;
  }
  return out;
}

// ---- melody: the theme laid back by an eighth, with a quick lean on the passing note
const theme = 'r:.5 A4:1 G4:.5 E4:2 | r:.5 F4:1 E4:.5 C4:2';
const themeTurn = 'r:.5 A4:1 G4:.5 E4:1 G4:.5 A4:.5 | C5:1 B4:.5 A4:.5 E4:2';
const answer = 'r:.5 F4:1 E4:.5 D4:2 | r:.5 E4:1 D4:.5 C4:2';
const toE = 'r:.5 C4:1 D4:.5 E4:2 | r:.5 D4:1 E4:.5 G#4:1 B4:1';
const toC = 'r:.5 C4:1 D4:.5 E4:2 | D4:1 F4:1 A4:1 B4:1';
const progA = 'Am9 Fmaj7 Am9 Fmaj7 Dm9 Am9 Fmaj7 E7sus/E7';
const progA2 = 'Am9 Fmaj7 Am9 Fmaj7 Dm9 Am9 Fmaj7 G13';

// Bridge in C: the motif's step-then-third fall, now landing on major sevenths and ninths
const progB = 'Cmaj9 Am7 Dm9 G13 Cmaj9 A7 Dm9 G9sus/G13';
const melB =
  'r:.5 E5:1 D5:.5 B4:2 | r:.5 C5:1 B4:.5 G4:2 | r:.5 A4:1 G4:.5 F4:.5 E4:.5 F4:1 | E4:1 D4:1 F4:1 E4:1 | ' +
  'r:.5 E5:1 D5:.5 B4:1 C5:1 | r:.5 C#5:1 B4:.5 A4:1 G4:1 | F4:1 A4:.5 C5:.5 E5:1 D5:1 | D5:2 r:1 B4:.5 G4:.5';
// second bridge turns back toward A minor
const progB2 = 'Cmaj9 Am7 Dm9 G13 Fmaj7 E7sus Dm9 E7';
const melB2 =
  'r:.5 E5:1 D5:.5 B4:2 | r:.5 C5:1 B4:.5 G4:2 | r:.5 A4:1 G4:.5 F4:2 | r:.5 E4:1 F4:.5 G4:2 | ' +
  'r:.5 A4:1 G4:.5 E4:2 | r:.5 D4:1 E4:.5 B3:2 | r:.5 F4:1 E4:.5 D4:2 | r:.5 B3:1 D4:.5 G#4:2';

const intro = section('intro', 16, [
  line('r:8 r:2.5 E5:.5@.3 C5:1@.28 | r:.5 B4:1@.3 A4:.5@.28 E4:2@.3'),
  line('r:8 A2:4@.5 A2:4@.5'),
  ...comp('Fmaj7 E7sus Am9 Am9', 0.17),
  drops('Fmaj7 E7sus Am9 Am9', 7, 1.5),
]);

const verse1 = section('verse1', 32, [
  line(`${theme} | ${theme} | ${answer} | ${toE}`, 0, 0.85),
  bass(progA),
  ...comp(progA, 0.18),
  drops(progA, 19, 0.6, 0.13),
]);

const verse2 = section('verse2', 32, [
  line(`${theme} | ${themeTurn} | ${answer} | ${toC}`, 0, 0.86),
  bass(progA2, 'lofi', 0.64),
  ...comp(progA2, 0.18),
  // call-and-response fills in the gaps after each phrase
  vel(line('r:3 E5:.5 G5:.5 | r:3 C5:.5 E5:.5 | r:4 | r:3 B4:.5 C5:.5 | r:3 A4:.5 C5:.5 | r:3 G4:.5 A4:.5 | r:4 | r:4'), 0.3),
]);

const bridge = section('bridge', 32, [
  line(melB, 0, 0.88),
  bass(progB, 'lofi', 0.64),
  ...comp(progB, 0.19),
  ramp(arp(progB), 0.6, 1),
]);

// halfway pause: the band drops out to rain on the window, then the lead creeps back in
const progBrk = 'Fmaj7 Fmaj7 Am9 Am9 Dm9 Dm9 E7sus E7';
const breakdown = section('breakdown', 32, [
  line('r:2.5 C5:.5@.38 A4:1@.38 | r:.5 G4:1@.36 E4:2.5@.36 | r:4 | r:2.5 E5:.5@.32 C5:1@.32 | ' +
    'r:.5 F4:1@.6 E4:.5@.55 D4:2@.55 | r:4 | r:.5 D4:1@.55 E4:.5@.5 B3:2@.5 | r:2 G#4:1@.6 B4:1@.65'),
  bass(progBrk, 'whole', 0.5),
  ...comp(progBrk, 0.15, 'hold'),
  drops(progBrk, 31, 2.4, 0.17),
]);

const verse3Lead = `${theme} | ${themeTurn} | ${answer} | ${toC}`;
const verse3 = section('verse3', 32, [
  ramp(line(verse3Lead, 0, 0.88), 0.95, 1.05),
  bass(progA2, 'lofi', 0.68),
  ...comp(progA2, 0.2),
  // a ghost of the lead an octave up, a beat behind
  clip(shift(transpose(line(verse3Lead, 0, 0.18), 12), 1), 32).filter(e => toMidi(e.pitch) <= toMidi('C6')),
  arp(progA2, 0.12),
  drops(progA2, 43, 0.7, 0.13),
]);

const bridge2 = section('bridge2', 32, [
  ramp(line(melB2, 0, 0.88), 1, 0.9),
  bass(progB2, 'lofi', 0.64),
  ...comp(progB2, 0.19),
  vel(line('r:3 G5:.5 E5:.5 | r:3 E5:.5 C5:.5 | r:3 C5:.5 A4:.5 | r:3 B4:.5 D5:.5 | r:3 C5:.5 E5:.5 | r:4 | r:3 A4:.5 C5:.5 | r:4'), 0.28),
  drops(progB2, 59, 0.5, 0.13),
]);

const outroProg = 'Am9 Fmaj7 Am9 Fmaj7 Dm9 E7sus Am9 Am9';
const outro = section('outro', 32, [
  ramp(line(`${theme} | ${themeTurn} | r:.5 F4:1 E4:.5 D4:2 | r:.5 D4:1 C4:.5 B3:2 | r:.5 C4:1 B3:.5 A3:2.5 | r:1.5 E5:.5 C5:.5 A4:1.5`, 0, 0.8), 1, 0.4),
  line('A2:4@.6 F2:4@.56 A2:4@.54 F2:4@.5 D3:4@.48 E2:4@.45 A2:4@.45 A2:4@.32'),
  ...comp(outroProg, 0.18, 'hold').map(l => ramp(l, 1, 0.6)),
  drops(outroProg, 71, 1.4, 0.14),
]);

export const track = buildTrack({
  name: 'Rainy Day',
  genre: 'ambient',
  bpm: 80,
  sections: [intro, verse1, verse2, bridge, breakdown, verse3, bridge2, outro],
  // 16 + 32 + 32 + 32 + 32 + 32 + 32 + 32 = 240 beats @ 80 = 3:00
  form: ['intro', 'verse1', 'verse2', 'bridge', 'breakdown', 'verse3', 'bridge2', 'outro'],
});
