import { buildTrack, chords, line, ramp, section, transpose, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Sunrise',
  label: 'Morning Light',
  blurb: 'Faithful extension at the original 80 BPM. The rising G–A–B / C–D–G theme gets an answering phrase, an E-minor B section, a countermelody, a quiet breakdown and a full last chorus.',
};

// Chord voicings (bass is a separate lane)
const V: Record<string, string> = {
  G: 'G3+B3+D4', C: 'G3+C4+E4', Em: 'G3+B3+E4', D: 'F#3+A3+D4', Am: 'A3+C4+E4', Cmaj7: 'G3+B3+E4', Dsus: 'G3+A3+D4',
};
const ROOT: Record<string, string> = { G: 'G2', C: 'C3', Em: 'E2', D: 'D2', Am: 'A2', Cmaj7: 'C3', Dsus: 'D2' };

/** One chord per bar (or "Am/D" = two chords, 2 beats each). */
function pad(prog: string, v = 0.28): Voice[] {
  const src = prog.split(' ').map(b => b.includes('/') ? b.split('/').map(c => `${V[c]}:2`).join(' ') : `${V[b]}:4`).join(' ');
  return chords(src, 3, 0, v);
}
function bass(prog: string, style: 'whole' | 'walk', v = 0.65): Voice {
  return line(prog.split(' ').map(b => {
    if (b.includes('/')) return b.split('/').map(c => `${ROOT[c]}:2`).join(' ');
    return style === 'whole' ? `${ROOT[b]}:4` : `${ROOT[b]}:3 ${ROOT[b]}:1`;
  }).join(' '), 0, v);
}
/** Gentle eighth-note arpeggio up through the chord voicing, one bar per chord. */
function arp(prog: string, v = 0.22): Voice {
  return line(prog.split(' ').map(b => {
    const [a, b2, c] = V[b.split('/')[0]].split('+');
    const up = (p: string) => p.replace(/\d/, d => String(Number(d) + 1));
    return [a, b2, c, up(a), up(b2), c, b2, a].map(p => `${up(p)}:.5`).join(' ');
  }).join(' '), 0, v);
}

const progA = 'G C Em D G C Am/D G';
const progB = 'Em C G D Em C Am Dsus';

const themeA =
  'G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 G5:2 | E5:1.5 D5:.5 B4:2 | A4:1.5 B4:.5 D5:2 | ' +
  'G4:1.5 A4:.5 B4:2 | C5:1.5 D5:.5 G5:2 | E5:1 D5:1 C5:1 A4:1 | G4:3 r:1';
const themeB =
  'B4:1.5 C5:.5 E5:2 | E5:1.5 D5:.5 C5:2 | D5:1.5 B4:.5 G4:2 | A4:1.5 B4:.5 A4:2 | ' +
  'B4:1.5 C5:.5 E5:2 | G5:1.5 F#5:.5 E5:2 | C5:1 D5:1 E5:1 C5:1 | D5:3 r:1';
// Countermelody that answers the theme in the gaps (lands on beats 3-4 of each bar)
const counterA =
  'r:2 D5:1 E5:1 | r:2 E5:1 C5:1 | r:2 G5:1 E5:1 | r:2 F#5:1 D5:1 | ' +
  'r:2 D5:1 E5:1 | r:2 E5:1 C5:1 | r:2 C5:1 D5:1 | r:2 D5:2';

const intro = section('intro', 16, [
  line('r:8 G5:4@.35 D5:4@.3'),
  bass('G C G C', 'whole', 0.5),
  ...pad('G C G C', 0.22),
]);

const verse = section('verse', 32, [
  line(themeA, 0, 0.85),
  bass(progA, 'whole'),
  ...pad(progA),
]);

const verse2 = section('verse2', 32, [
  line(themeA, 0, 0.85),
  bass(progA, 'walk'),
  ...pad(progA, 0.24),
  arp(progA),
]);

const bridge = section('bridge', 32, [
  line(themeB, 0, 0.85),
  bass(progB, 'walk'),
  ...pad(progB),
  arp(progB, 0.18),
]);

const chorus = section('chorus', 32, [
  line(themeA, 0, 0.9),
  bass(progA, 'walk', 0.7),
  ...pad(progA, 0.26),
  vel(line(counterA), 0.45),
]);

const breakdown = section('breakdown', 16, [
  line('G4:4@.5 r:4 C5:4@.45 r:4'),
  line('G2:8@.5 C3:8@.45'),
  ...pad('Cmaj7 Cmaj7 G G', 0.2),
  line('r:2 D5:1@.3 B4:1@.3 r:2 E5:1@.3 C5:1@.3 r:2 D5:1@.3 B4:1@.3 r:4'),
]);

const bridgeHigh = section('bridge-high', 32, [
  line(themeB, 0, 0.8),
  bass(progB, 'walk', 0.7),
  ...pad(progB, 0.27),
  // echo of the theme, an eighth late and an octave down
  transpose(vel(line('r:.5 ' + themeB.replace(/r:1$/, 'r:.5')), 0.25), -12),
]);

const finale = section('finale', 32, [
  line(themeA.replace('G4:3 r:1', 'G4:4'), 0, 0.95),
  bass(progA, 'walk', 0.72),
  ...pad(progA, 0.28),
  vel(line(counterA), 0.4),
  arp(progA, 0.2),
]);

const outro = section('outro', 16, [
  ramp(line('G4:1.5 A4:.5 B4:2 C5:1.5 D5:.5 G5:6 r:2'), 0.6, 0.35),
  line('G2:4@.5 C3:4@.45 G2:8@.4'),
  ...pad('G C G G', 0.2),
]);

export const track = buildTrack({
  name: 'Sunrise · Morning Light',
  genre: 'ambient',
  bpm: 80,
  sections: [intro, verse, verse2, bridge, chorus, breakdown, bridgeHigh, finale, outro],
  // 16 + 32*2 + 32 + 32 + 16 + 32 + 32 + 16 = 240 beats = 3:00
  form: ['intro', 'verse', 'verse2', 'bridge', 'chorus', 'breakdown', 'bridge-high', 'finale', 'outro'],
});
