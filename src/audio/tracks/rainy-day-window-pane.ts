import { buildTrack, chords, fromMidi, line, ramp, section, shift, toMidi, transpose, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Rainy Day',
  label: 'Window Pane',
  blurb: 'Faithful extension at the original 60 BPM. The A–G–E / F–E–C theme gains a falling answer, a hopeful C-major middle where the motif returns, a hushed breakdown and a last chorus with the theme echoing an octave up, before settling on a quiet A minor.',
};

// ---- chords: pad voicing (3 lanes) + bass root. Bar = 4 beats; "X/Y" splits a bar in half.
const CH: Record<string, { v: string; r: string }> = {
  Am: { v: 'E3+A3+C4', r: 'A2' },
  F: { v: 'F3+A3+C4', r: 'F2' },
  Dm: { v: 'F3+A3+D4', r: 'D3' },
  C: { v: 'E3+G3+C4', r: 'C3' },
  CE: { v: 'E3+G3+C4', r: 'E2' },
  G: { v: 'D3+G3+B3', r: 'G2' },
  GB: { v: 'D3+G3+B3', r: 'B2' },
  EmG: { v: 'E3+G3+B3', r: 'G2' },
  E: { v: 'E3+G#3+B3', r: 'E2' },
  Esus: { v: 'E3+A3+B3', r: 'E2' },
};

const expand = (prog: string): [string, number][] =>
  prog.trim().split(/\s+/).flatMap(b => (b.includes('/') ? b.split('/').map(c => [c, 2] as [string, number]) : [[b, 4] as [string, number]]));
const up = (p: string, semis: number) => fromMidi(toMidi(p) + semis);
const clip = (v: Voice, beats: number) => v.filter(e => e.t < beats - 1e-6);

function pad(prog: string, v = 0.24): Voice[] {
  return chords(expand(prog).map(([c, b]) => `${CH[c].v}:${b}`).join(' '), 3, 0, v);
}

/** 'whole': one strike per chord; 'half': re-strike every 2 beats (like the original's pulsing bass); 'lean': root + fifth pickup. */
function bass(prog: string, style: 'whole' | 'half' | 'lean', v = 0.62): Voice {
  return line(expand(prog).map(([c, b]) => {
    const r = CH[c].r;
    if (style === 'whole' || b < 4) return `${r}:${b}`;
    if (style === 'half') return `${r}:2 ${r}:2`;
    return `${r}:3 ${up(r, 7)}:1`;
  }).join(' '), 0, v);
}

/** Slow eighth-note arpeggio an octave above the pad voicing. */
function arp(prog: string, v = 0.16): Voice {
  return line(expand(prog).map(([c, b]) => {
    const [a, m, t] = CH[c].v.split('+').map(p => up(p, 12));
    const pat = [a, m, t, up(a, 12), t, m, a, m];
    return pat.slice(0, b * 2).map(p => `${p}:.5`).join(' ');
  }).join(' '), 0, v);
}

/** Raindrops: short, quiet chord tones in octave 5 at irregular (seeded) sixteenth positions. */
function drops(prog: string, seed: number, perBar: number, v = 0.17): Voice {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out: Voice = [];
  let t0 = 0;
  for (const [c, beats] of expand(prog)) {
    const tones = CH[c].v.split('+').map(p => up(p, 24));
    const n = Math.floor((perBar * beats) / 4 + rnd());
    const slots = new Set<number>();
    for (let k = 0; k < n * 4 && slots.size < n; k++) slots.add(Math.floor(rnd() * beats * 4) / 4);
    for (const sl of [...slots].sort((a, b) => a - b)) {
      let p = tones[Math.floor(rnd() * tones.length)];
      if (rnd() < 0.3 && toMidi(p) + 12 <= toMidi('E6')) p = up(p, 12);
      out.push({ t: t0 + sl, pitch: p, len: 0.5, vel: Math.round(v * (0.6 + 0.6 * rnd()) * 1000) / 1000 });
    }
    t0 += beats;
  }
  return out;
}

// ---- melody
const theme = 'A4:1 G4:1 E4:2 | F4:1 E4:1 C4:2';
// falling answer (the motif's step-then-third shape, sequenced down) ending on the dominant
const answerToE = 'F4:1 E4:1 D4:2 | E4:1 D4:1 C4:2 | D4:1 C4:1 A3:2 | B3:1 C4:1 D4:1 E4:1';
const answerToG = 'F4:1 E4:1 D4:2 | E4:1 D4:1 C4:2 | D4:1 C4:1 A3:2 | B3:1 D4:1 G4:2';
const progA = 'Am F Am F Dm Am F Esus/E';
const progA2 = 'Am F Am F Dm Am F G';

// C-major middle: a descending bass under a rising, brighter line; the motif reappears in bar 3 and in bar 7 (D–C–A)
const progB = 'C GB Am EmG F CE Dm G';
const melB = 'E4:1 G4:1 C5:2 | B4:1 A4:1 G4:2 | A4:1 G4:1 E4:2 | B4:1 G4:1 E4:2 | F4:1 A4:1 C5:2 | E5:1 D5:1 C5:2 | D5:1 C5:1 A4:2 | B4:2 G4:2';

const intro = section('intro', 16, [
  // the motif, faint and high, hidden in the rain
  line('r:6 A5:.5@.24 G5:.5@.22 E5:3@.24 r:6'),
  bass('Am F Am F', 'whole', 0.5),
  ...pad('Am F Am F', 0.2),
  drops('Am F Am F', 11, 1.4),
]);

const verse1 = section('verse1', 32, [
  line(`${theme} | ${theme} | ${answerToE}`, 0, 0.85),
  bass(progA, 'half', 0.6),
  ...pad(progA, 0.22),
  drops(progA, 23, 0.6, 0.15),
]);

const verse2 = section('verse2', 32, [
  line(`${theme} | A4:1 B4:1 C5:2 | C5:1 A4:1 F4:2 | ${answerToG}`, 0, 0.87),
  bass(progA2, 'lean', 0.62),
  ...pad(progA2, 0.22),
  vel(line('r:2 C5:1 E5:1 | r:2 C5:2 | r:2 E5:1 G5:1 | r:2 F5:2 | r:2 A4:1 D5:1 | r:2 E5:2 | r:2 C5:1 F5:1 | r:2 D5:2'), 0.28),
  ramp(arp(progA2), 0.5, 1),
]);

const middle = section('middle', 32, [
  ramp(line(melB, 0, 0.9), 0.92, 1),
  bass(progB, 'lean', 0.64),
  ...pad(progB, 0.25),
  arp(progB, 0.17),
  drops(progB, 37, 0.5, 0.14),
]);

const breakdown = section('breakdown', 16, [
  line('A4:1@.55 G4:1@.5 E4:2@.5 | r:4 | F4:1@.5 E4:1@.45 C4:2@.45 | r:2 B3:1@.5 E4:1@.55'),
  bass('Am Am F E', 'whole', 0.5),
  ...pad('Am Am F Esus/E', 0.17),
  drops('Am Am F E', 41, 2.2, 0.18),
]);

const finalTheme = `${theme} | ${theme} | ${answerToE}`;
const verse3 = section('verse3', 32, [
  ramp(line(finalTheme, 0, 0.9), 0.95, 1.05),
  bass(progA, 'half', 0.7),
  ...pad(progA, 0.26),
  // the theme echoed an octave up, two beats behind, like drips off the eaves
  clip(shift(transpose(line(finalTheme, 0, 0.2), 12), 2), 32),
  arp(progA, 0.14),
  drops(progA, 53, 0.8, 0.15),
]);

const outro = section('outro', 24, [
  line('A4:1@.75 G4:1@.7 E4:2@.7 | F4:1@.65 E4:1@.6 C4:2@.6 | A4:2@.55 G4:2@.5 | F4:2@.48 E4:2@.45 | D4:1@.45 C4:1@.42 B3:2@.42 | A3:4@.45'),
  line('A2:4@.6 F2:4@.55 A2:4@.5 F2:4@.48 E2:4@.45 A2:4@.45'),
  ...pad('Am F Am F Esus Am', 0.22).map(l => ramp(l, 1, 0.65)),
  drops('Am F Am F Esus Am', 67, 1.2, 0.15),
]);

export const track = buildTrack({
  name: 'Rainy Day · Window Pane',
  genre: 'ambient',
  bpm: 60,
  sections: [intro, verse1, verse2, middle, breakdown, verse3, outro],
  // 16 + 32 + 32 + 32 + 16 + 32 + 24 = 184 beats = 3:04
  form: ['intro', 'verse1', 'verse2', 'middle', 'breakdown', 'verse3', 'outro'],
});
