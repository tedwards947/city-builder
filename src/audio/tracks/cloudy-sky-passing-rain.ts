import { buildTrack, chords, line, ramp, section as rawSection, shift, transpose, vel, type Ev, type Voice } from '../compose.ts';

export const meta = {
  song: 'Cloudy Sky',
  label: 'Passing Rain',
  blurb: 'A lusher, slightly brisker take (80 BPM): the theme floats over new chords (Dm7, B♭maj7, Csus) and a constant shimmer of triplet "raindrop" arpeggios. A lydian-tinged bridge builds into a lift that modulates up a whole step to D for the last two choruses.',
};

/** Section with every note released a hair early, so back-to-back notes in a lane don't stack. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: Math.max(0.1, e.len - 0.04) }))));

// chord: [pad voicing (3 lanes), bass root, raindrop arpeggio notes (4, rising)]
const CH: Record<string, [string, string, string]> = {
  Dm7: ['F3+A3+C4', 'D3', 'F4 A4 C5 D5'],
  Am7: ['G3+C4+E4', 'A2', 'A4 C5 E5 G5'],
  Bbmaj7: ['F3+A3+D4', 'Bb2', 'F4 Bb4 D5 F5'],
  Csus: ['G3+C4+F4', 'C3', 'G4 C5 F5 G5'],
  Fmaj7: ['A3+C4+E4', 'F2', 'A4 C5 E5 G5'],
  G7: ['F3+B3+D4', 'G2', 'G4 B4 D5 G5'],
  Am9: ['G3+C4+E4', 'A2', 'A4 B4 E5 G5'],
  Fmaj9: ['A3+C4+E4', 'F2', 'G4 A4 E5 G5'],
  Dm9: ['F3+A3+C4', 'D3', 'D4 F4 A4 C5'],
  Em7: ['G3+B3+D4', 'E2', 'E4 G4 B4 D5'],
  Gsus: ['G3+C4+D4', 'G2', 'G4 C5 D5 G5'],
  Asus: ['A3+D4+E4', 'A2', 'A4 D5 E5 A5'],
  A7: ['G3+C#4+E4', 'A2', 'A4 C#5 E5 G5'],
  Cadd9: ['E3+G3+D4', 'C3', 'G4 C5 D5 E5'],
  G: ['G3+B3+D4', 'G2', 'G4 B4 D5 G5'],
};
const bars = (prog: string) => prog.trim().split(/\s+/);

function pad(prog: string, v = 0.2): Voice[] {
  return chords(bars(prog).map(c => `${CH[c][0]}:4`).join(' '), 3, 0, v);
}
function bass(prog: string, style: 'whole' | 'pulse', v = 0.58): Voice {
  return line(bars(prog).map(c => {
    const r = CH[c][1];
    return style === 'whole' ? `${r}:4` : `${r}:3 ${r}:1@${(v * 0.7).toFixed(2)}`;
  }).join(' '), 0, v);
}
/** Triplet-eighth "raindrops": up and back down the chord, twice per bar, each bar slightly accented on the downbeat. */
function rain(prog: string, v = 0.15): Voice {
  const out: Ev[] = [];
  bars(prog).forEach((c, b) => {
    const [n1, n2, n3, n4] = CH[c][2].split(' ');
    [n1, n2, n3, n4, n3, n2, n1, n2, n3, n4, n3, n2].forEach((p, i) => {
      out.push({ t: Math.round((b * 4 + i / 3) * 1e6) / 1e6, pitch: p, len: 1 / 3, vel: i % 6 === 0 ? v * 1.2 : v });
    });
  });
  return out;
}
const up = (v: Voice[], semis: number) => v.map(x => transpose(x, semis));

// The original two-bar riff, stated twice, then a new answering phrase that falls and rises home
const THEME = 'C4:2 F4:2 | G4:2 C5:2 | C4:2 F4:2 | G4:2 C5:2';
const ANSWER = 'A4:3 G4:1 | F4:2 C5:2 | D5:2 E5:1 D5:1 | C5:4';
// Bridge: the theme's rising fourth (E–A) in A minor, with a lydian B over F
const BRIDGE = 'E4:2 A4:2 | C5:3 B4:1 | E4:2 A4:2 | C5:2 D5:2 | F5:3 E5:1 | D5:2 B4:2 | C5:2 A4:2 | G4:2 D5:2';
const COUNTER = 'r:1 A4:3 | r:1 E5:3 | r:1 D5:3 | r:1 F5:1 G5:2 | r:1 C5:3 | r:1 A4:1 D5:2 | r:1 B4:3 | r:1 G4:1 E5:2';

const progA = 'Dm7 Am7 Bbmaj7 Csus Fmaj7 Dm7 G7 Cadd9';
const progB = 'Am9 Fmaj9 Am9 Fmaj9 Dm9 Em7 Fmaj9 Gsus';

const intro = section('intro', 16, [
  line('r:8 F5:4@.28 G5:4@.26'),
  ramp(rain('Dm7 Am7 Bbmaj7 Csus', 0.16), 0.45, 1),
  ...pad('Dm7 Am7 Bbmaj7 Csus', 0.17).map(l => l.filter(e => e.t >= 8)),
  line('r:8 Bb2:4@.45 C3:4@.5'),
]);

const verse = section('verse', 32, [
  line(THEME + ' | ' + ANSWER, 0, 0.85),
  bass(progA, 'whole', 0.55),
  ...pad(progA, 0.19),
  rain(progA, 0.13),
]);

// Second verse: the lead gains a soft octave-below shadow, bass starts to pulse
const verse2 = section('verse2', 32, [
  line(THEME + ' | ' + ANSWER, 0, 0.86),
  bass(progA, 'pulse', 0.58),
  ...pad(progA, 0.2),
  rain(progA, 0.15),
  vel(transpose(line(THEME + ' | ' + ANSWER), -12), 0.26),
]);

const bridge = section('bridge', 32, [
  line(BRIDGE, 0, 0.84),
  bass(progB, 'whole', 0.58),
  ...pad(progB, 0.21),
  rain(progB, 0.14),
  // echo of each rising fourth, two beats late and an octave down
  vel(transpose(shift(line('E4:2 A4:2 | r:4 | E4:2 A4:2 | r:4 | r:16'), 2), -12), 0.3),
]);

// The rain thins out; the theme drips in fragments, echoed high
const breakdown = section('breakdown', 16, [
  line('C4:2@.6 F4:2@.6 | r:4 | G4:2@.58 C5:2@.55 | r:4'),
  line('r:4 C5:2@.26 F5:2@.24 | r:4 G5:4@.22'),
  ...pad('Dm7 Dm7 Am7 Am7', 0.16),
  ramp(rain('Dm7 Dm7 Am7 Am7', 0.12), 1, 0.5).filter((_, i) => i % 2 === 0),
]);

// Lift: rising fourths climb through B-flat and C to A, the dominant of the new key
const lift = section('lift', 16, [
  line('F4:2 Bb4:2 | C5:2 F5:2 | E5:3 D5:1 | C#5:2 E5:2', 0, 0.84),
  line('Bb2:4 C3:4 A2:3 A2:1@.45 | A2:2 A2:1@.45 A2:1@.5', 0, 0.58),
  ...pad('Bbmaj7 Csus Asus A7', 0.21),
  ramp(rain('Bbmaj7 Csus Asus A7', 0.15), 0.8, 1.2),
]);

// Up a whole step to D
const verseD = section('verse-d', 32, up([
  line(THEME + ' | ' + ANSWER, 0, 0.88),
  bass(progA, 'pulse', 0.6),
  ...pad(progA, 0.21),
  rain(progA, 0.15),
  vel(transpose(line(THEME + ' | ' + ANSWER), -12), 0.24),
], 2));

const climax = section('climax', 32, up([
  line(THEME + ' | ' + ANSWER.replace('C5:4', 'C5:2 E5:2'), 0, 0.92),
  bass(progA, 'pulse', 0.62),
  ...pad(progA, 0.22),
  rain(progA, 0.15),
  vel(line(COUNTER), 0.34),
], 2));

// Outro in D: the theme twice more, then a last fall to the home chord as the rain stops
const outro = section('outro', 32, up([
  ramp(line('C4:2 F4:2 | G4:2 C5:2 | C4:2 F4:2 | G4:2 C5:2 | A4:3 G4:1 | F4:2 D5:2 | C5:8'), 0.85, 0.45),
  line('D3:4 A2:4 Bb2:4 C3:4 F2:4 G2:4 C3:8', 0, 0.55),
  ...pad('Dm7 Am7 Bbmaj7 Csus Fmaj7 G Cadd9 Cadd9', 0.19).map(l => l.filter(e => e.t < 28)),
  ramp(rain('Dm7 Am7 Bbmaj7 Csus Fmaj7 G', 0.14), 1, 0.35),
  line('r:24 E5:4@.2 G5:4@.16'),
], 2));

export const track = buildTrack({
  name: 'Cloudy Sky · Passing Rain',
  genre: 'ambient',
  bpm: 80,
  sections: [intro, verse, verse2, bridge, breakdown, lift, verseD, climax, outro],
  // 16 + 32 + 32 + 32 + 16 + 16 + 32 + 32 + 32 = 240 beats at 80 BPM = 3:00
  form: ['intro', 'verse', 'verse2', 'bridge', 'breakdown', 'lift', 'verse-d', 'climax', 'outro'],
});
