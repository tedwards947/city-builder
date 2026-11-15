import { buildTrack, chords, fromMidi, line, ramp, section, toMidi, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Rainy Day',
  label: 'Storm Passing',
  blurb: 'A weather story at 64 BPM: a drizzle thickens into a storm (rolling sixteenth arpeggios, pulsing bass, the theme an octave up over Dm and Bb), then the clouds part. The theme turns major in A, and finally the original melody returns note for note over sunny C major chords.',
};

// ---- chords: pad voicing (3 lanes) + bass root. Bar = 4 beats; "X/Y" splits a bar in half.
const CH: Record<string, { v: string; r: string }> = {
  Am: { v: 'E3+A3+C4', r: 'A2' },
  F: { v: 'F3+A3+C4', r: 'F2' },
  Fmaj7: { v: 'E3+A3+C4', r: 'F2' },
  Dm: { v: 'F3+A3+D4', r: 'D3' },
  Dm7: { v: 'F3+A3+C4', r: 'D3' },
  Bb: { v: 'F3+Bb3+D4', r: 'Bb2' },
  C: { v: 'E3+G3+C4', r: 'C3' },
  Cadd9: { v: 'E3+G3+D4', r: 'C3' },
  G: { v: 'D3+G3+B3', r: 'G2' },
  Em7: { v: 'D3+G3+B3', r: 'E2' },
  E: { v: 'E3+G#3+B3', r: 'E2' },
  E7: { v: 'D3+G#3+B3', r: 'E2' },
  E7sus: { v: 'D3+A3+B3', r: 'E2' },
  A: { v: 'E3+A3+C#4', r: 'A2' },
  Fsm: { v: 'F#3+A3+C#4', r: 'F#2' },
  D: { v: 'F#3+A3+D4', r: 'D3' },
};

const expand = (prog: string): [string, number][] =>
  prog.trim().split(/\s+/).flatMap(b => (b.includes('/') ? b.split('/').map(c => [c, 2] as [string, number]) : [[b, 4] as [string, number]]));
const up = (p: string, semis: number) => fromMidi(toMidi(p) + semis);

function pad(prog: string, v = 0.22): Voice[] {
  return chords(expand(prog).map(([c, b]) => `${CH[c].v}:${b}`).join(' '), 3, 0, v);
}

/** 'whole': one strike per chord; 'half': every 2 beats; 'pulse': quarter notes; 'storm': driving eighths. */
function bass(prog: string, style: 'whole' | 'half' | 'pulse' | 'storm', v = 0.6): Voice {
  return line(expand(prog).map(([c, b]) => {
    const r = CH[c].r;
    if (style === 'whole') return `${r}:${b}`;
    if (style === 'half') return Array(b / 2).fill(`${r}:2`).join(' ');
    if (style === 'pulse') return Array(b).fill(`${r}:1`).join(' ');
    // eighths, accent on the beat, octave lift on the last eighth
    return Array.from({ length: b * 2 }, (_, i) =>
      i === b * 2 - 1 ? `${up(r, 12)}:.5@${(v * 0.8).toFixed(2)}` : `${r}:.5@${(i % 2 ? v * 0.7 : v).toFixed(2)}`).join(' ');
  }).join(' '), 0, v);
}

/** Arpeggio an octave above the pad: eighths (rain) or sixteenths (downpour). */
function arp(prog: string, v = 0.15, rate: 8 | 16 = 8): Voice {
  return line(expand(prog).map(([c, b]) => {
    const [a, m, t] = CH[c].v.split('+').map(p => up(p, 12));
    const cyc = rate === 8 ? [a, m, t, up(a, 12), t, m, a, m] : [a, m, t, up(a, 12), up(m, 12), up(a, 12), t, m];
    const n = (b * rate) / 4;
    const len = rate === 8 ? '.5' : '.25';
    return Array.from({ length: n }, (_, i) => `${cyc[i % cyc.length]}:${len}`).join(' ');
  }).join(' '), 0, v);
}

/** Raindrops: short quiet chord tones in octave 5 at irregular (seeded) sixteenth positions. */
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
      if (rnd() < 0.25 && toMidi(p) + 12 <= toMidi('E6')) p = up(p, 12);
      out.push({ t: t0 + sl, pitch: p, len: 0.5, vel: Math.round(v * (0.6 + 0.6 * rnd()) * 1000) / 1000 });
    }
    t0 += beats;
  }
  return out;
}

const theme = 'A4:1 G4:1 E4:2 | F4:1 E4:1 C4:2';

// 1. drizzle: just drops and a grey A-minor wash
const drizzle = section('drizzle', 12, [
  line('r:8 E5:.5@.22 r:.5 C5:.5@.2 r:2.5'),
  line('A2:8@.42 F2:4@.42'),
  ...pad('Am Am F', 0.15).map(l => ramp(l, 0.8, 1.2)),
  drops('Am Am F', 5, 1.6, 0.16),
]);

// 2. the theme, quiet and close
const progA = 'Am F Am F Dm Am F E';
const verse1 = section('verse1', 32, [
  line(`${theme} | ${theme} | D4:1 E4:1 F4:2 | E4:1 C4:1 A3:2 | C4:1 D4:1 E4:1 F4:1 | E4:4`, 0, 0.8),
  bass(progA, 'whole', 0.55),
  ...pad(progA, 0.2),
  drops(progA, 17, 1, 0.15),
]);

// 3. rain thickens: arpeggios fade in, bass starts to pulse, the answer climbs higher
const progA2 = 'Am F Am F Dm C F E';
const verse2 = section('verse2', 32, [
  ramp(line(`${theme} | ${theme} | D4:1 E4:1 F4:1 A4:1 | G4:1 E4:1 C4:2 | F4:1 G4:1 A4:1 C5:1 | B4:2 G#4:2`, 0, 0.84), 0.95, 1.08),
  ramp(bass(progA2, 'pulse', 0.6), 0.85, 1.1),
  ...pad(progA2, 0.22),
  ramp(arp(progA2, 0.18), 0.4, 1.1),
  vel(line('r:2 E5:2 | r:2 C5:2 | r:2 E5:2 | r:2 F5:2 | r:2 A4:2 | r:2 G4:2 | r:2 C5:2 | r:2 D5:2'), 0.24),
  drops(progA2, 29, 2, 0.16),
]);

// 4. storm: the motif sequenced through Dm and Bb, then the theme an octave up at full strength
const progS = 'Dm Bb Dm Bb Am F E7 E';
const storm = section('storm', 32, [
  line('D5:1 C5:1 A4:2 | Bb4:1 A4:1 F4:2 | D5:1 E5:1 F5:2 | F5:1 D5:1 Bb4:2 | A5:1 G5:1 E5:2 | F5:1 E5:1 C5:2 | B4:1 C5:1 D5:1 E5:1 | G#4:3 r:1', 0, 0.92),
  bass(progS, 'storm', 0.62),
  ...pad(progS, 0.24),
  ramp(arp(progS, 0.17, 16), 0.9, 1.15),
  drops(progS, 41, 3.5, 0.18),
]);

// 5. clearing: everything thins, the last drops fall, a long dominant
const clearing = section('clearing', 12, [
  line('A4:4@.6 F4:4@.5 | E4:2@.45 G#4:1@.5 B4:1@.55'),
  line('F2:4@.5 F2:4@.45 E2:4@.45'),
  ...pad('Fmaj7 Fmaj7 E7sus/E7', 0.2).map(l => ramp(l, 1, 0.75)),
  ramp(arp('Fmaj7 Fmaj7', 0.13), 1, 0.2),
  drops('Fmaj7 Fmaj7 E7', 53, 1.5, 0.15),
]);

// 6. sun breaks through: the theme in A major (A–G#–E / F#–E–C#), turning toward C at the end
const progSun = 'A Fsm D E A Fsm D G';
const sun = section('sun', 32, [
  ramp(line('A4:1 G#4:1 E4:2 | F#4:1 E4:1 C#4:2 | D4:1 F#4:1 A4:2 | G#4:1 A4:1 B4:2 | C#5:1 B4:1 A4:2 | A4:1 G#4:1 F#4:2 | F#4:1 A4:1 D5:2 | D5:1 C5:1 B4:2', 0, 0.85), 0.92, 1.05),
  bass(progSun, 'half', 0.6),
  ...pad(progSun, 0.22),
  arp(progSun, 0.15),
  drops(progSun, 67, 0.5, 0.13),
]);

// 7. home in C: the ORIGINAL melody note for note, now over C and Fmaj7, with birdsong answers
const progC = 'C Fmaj7 C Fmaj7 Dm7 Em7 F G';
const homeC = section('homeC', 32, [
  line(`${theme} | A4:1 G4:1 E4:2 | F4:1 A4:1 C5:2 | D5:1 C5:1 A4:2 | B4:1 A4:1 G4:2 | A4:1 B4:1 C5:2 | D5:2 B4:1 G4:1`, 0, 0.9),
  bass(progC, 'half', 0.64),
  ...pad(progC, 0.24),
  vel(line('r:2 C5:1 E5:1 | r:2 A4:1 C5:1 | r:2 G5:1 E5:1 | r:2 E5:2 | r:2 F5:1 E5:1 | r:2 D5:1 E5:1 | r:2 E5:1 F5:1 | r:2 G5:2'), 0.3),
  arp(progC, 0.14),
]);

// 8. outro: a last cadence and the rain motif, now in sunlight
const outro = section('outro', 16, [
  line('A4:1@.75 G4:1@.7 E4:2@.7 | F4:1@.65 E4:1@.6 D4:2@.6 | C4:4@.6 | r:1 A5:.5@.2 G5:.5@.18 E5:2@.2'),
  line('F2:4@.6 G2:4@.55 C3:4@.55 C3:4@.4'),
  ...pad('Fmaj7 G C Cadd9', 0.22).map(l => ramp(l, 1, 0.7)),
  drops('Fmaj7 G C Cadd9', 79, 0.8, 0.13),
]);

export const track = buildTrack({
  name: 'Rainy Day · Storm Passing',
  genre: 'ambient',
  bpm: 64,
  sections: [drizzle, verse1, verse2, storm, clearing, sun, homeC, outro],
  // 12 + 32 + 32 + 32 + 12 + 32 + 32 + 16 = 200 beats @ 64 = 3:08
  form: ['drizzle', 'verse1', 'verse2', 'storm', 'clearing', 'sun', 'homeC', 'outro'],
});
