import { buildTrack, chords, line, ramp, section as rawSection, shift, transpose, vel, type Voice } from '../compose.ts';

/** Section with every note released a hair before its full length, so back-to-back notes in a lane don't stack. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: Math.max(0.1, e.len - 0.04) }))));

export const meta = {
  song: 'Cloudy Sky',
  label: 'Drifting Over',
  blurb: 'Faithful extension at the original 70 BPM, keeping the slow E–A drone pulse under the rising C–F / G–C theme. Adds an answering phrase, a falling-fourths bridge, a high countermelody and a final cadence where the clouds part on C major.',
};

// Pad voicings (3 lanes), bass roots, and the original's drone note (voice 1 of the source track)
const V: Record<string, string> = {
  CE: 'E3+G3+C4', Am7: 'G3+C4+E4', Dm7: 'F3+A3+C4', G: 'G3+B3+D4', Em7: 'G3+B3+D4', Am: 'E3+A3+C4',
  F: 'F3+A3+C4', Gsus: 'G3+C4+D4', C: 'E3+G3+C4', Cadd9: 'E3+G3+D4',
};
const ROOT: Record<string, string> = {
  CE: 'C3', Am7: 'A2', Dm7: 'D3', G: 'G2', Em7: 'E2', Am: 'A2', F: 'F2', Gsus: 'G2', C: 'C3', Cadd9: 'C3',
};
const DRONE: Record<string, string> = {
  CE: 'E3', Am7: 'A3', Dm7: 'A3', G: 'G3', Em7: 'E3', Am: 'A3', F: 'A3', Gsus: 'G3', C: 'E3', Cadd9: 'E3',
};

const bars = (prog: string) => prog.trim().split(/\s+/);

/** One pad chord per bar, re-struck every bar (the synth has no sustain). */
function pad(prog: string, v = 0.2): Voice[] {
  return chords(bars(prog).map(c => `${V[c]}:4`).join(' '), 3, 0, v);
}
/** The original's drone: struck every 2 beats, ringing 4 (overlapping), exactly like the source track. */
function drone(prog: string, v = 0.42): Voice {
  return bars(prog).flatMap((c, i) => [
    { t: i * 4, pitch: DRONE[c], len: 4, vel: v },
    { t: i * 4 + 2, pitch: DRONE[c], len: 4, vel: v * 0.8 },
  ]);
}
function bass(prog: string, style: 'whole' | 'pulse', v = 0.6): Voice {
  return line(bars(prog).map(c => style === 'whole' ? `${ROOT[c]}:4` : `${ROOT[c]}:2 ${ROOT[c]}:2@${(v * 0.75).toFixed(2)}`).join(' '), 0, v);
}
// Arpeggio voicings (the theme bar over E is really C-sus: keep E out of the arp so it can't rub against the F)
const ARP: Record<string, string> = { ...V, CE: 'G3+C4+G4', F: 'A3+C4+F4' };
/** Gentle eighth-note arpeggio an octave above the voicing. */
function arp(prog: string, v = 0.17): Voice {
  const up = (p: string) => transpose([{ t: 0, pitch: p, len: 1 }], 12)[0].pitch;
  return line(bars(prog).map(c => {
    const [a, b, d] = ARP[c].split('+').map(up);
    return [a, b, d, b, a, b, d, b].map(p => `${p}:.5`).join(' ');
  }).join(' '), 0, v);
}
/** Drop events that start at or after `beats` (for shifted echoes). */
const clip = (v: Voice, beats: number) => v.filter(e => e.t < beats - 1e-6);

// The original two-bar riff, stated twice (as in the source loop)
const THEME = 'C4:2 F4:2 | G4:2 C5:2 | C4:2 F4:2 | G4:2 C5:2';
// Answering phrases
const ANS1 = 'D5:2 C5:1 A4:1 | G4:3 F4:1 | E4:2 F4:1 G4:1 | A4:3 r:1';
const ANS2 = 'D5:2 C5:1 A4:1 | G4:2 C5:2 | D5:2 E5:1 D5:1 | C5:4';
const FIN = 'F5:2 E5:1 D5:1 | E5:2 D5:1 C5:1 | D5:3 B4:1 | C5:4';
// Bridge: the theme's fourths turned upside down (falling), then rising again to the opening C–F an octave up
const BRIDGE = 'A4:2 E4:2 | G4:2 D4:2 | F4:2 C4:2 | E4:3 G4:1 | A4:2 D5:2 | B4:2 E5:2 | C5:2 F5:2 | G5:2 E5:1 D5:1';
// High countermelody, offset a beat so it fills the theme's gaps
const COUNTER =
  'r:1 E5:3 | r:1 E5:1 D5:2 | r:1 E5:3 | r:1 G5:1 E5:2 | r:1 A4:3 | r:1 C5:1 A4:2 | r:1 B4:1 G4:2 | r:1 E4:1 G4:2';

const progV1 = 'CE Am7 CE Am7 Dm7 G Em7 Am';
const progV2 = 'CE Am7 CE Am7 Dm7 Am7 G Cadd9';
const progB = 'F Em7 Dm7 Am7 Dm7 Em7 F G';
const progF = 'CE Am7 CE Am7 F Am7 G C';

const intro = section('intro', 16, [
  line('r:8 C5:2@.32 F5:2@.32 | G5:4@.3'),
  ramp(drone('CE Am7 CE Am7'), 0.6, 1),
  ...pad('CE Am7 CE Am7', 0.16).map(l => l.filter(e => e.t >= 8)),
]);

const verse = section('verse', 32, [
  line(THEME + ' | ' + ANS1, 0, 0.85),
  drone(progV1),
  ...pad(progV1, 0.19),
]);

const bridge = section('bridge', 32, [
  line(BRIDGE, 0, 0.82),
  bass(progB, 'whole', 0.58),
  ...pad(progB, 0.21),
  // canon-like echo of the rising half, a beat late and an octave down
  clip(vel(transpose(shift(line(BRIDGE).filter(e => e.t >= 16), 1), -12), 0.26), 32),
]);

const verse2 = section('verse2', 32, [
  line(THEME + ' | ' + ANS2, 0, 0.87),
  drone(progV2, 0.32),
  bass(progV2, 'whole', 0.58),
  ...pad(progV2, 0.19),
  arp(progV2, 0.16),
]);

// The source loop laid bare, then the low voice answers with the theme
const breakdown = section('breakdown', 16, [
  line('C4:2@.6 F4:2@.6 | G4:2@.58 C5:2@.55 | E5:4@.3 | D5:2@.28 C5:2@.25'),
  drone('CE Am7 F Am7', 0.45),
  line('r:8 C3:2@.5 F3:2@.5 | G3:2@.48 C4:2@.42'),
]);

const bridge2 = section('bridge2', 32, [
  line(BRIDGE, 0, 0.88),
  bass(progB, 'pulse', 0.62),
  ...pad(progB, 0.23),
  arp(progB, 0.15),
  line('C5:4@.3 B4:4@.3 A4:4@.28 C5:4@.28'),
  clip(vel(transpose(shift(line(BRIDGE).filter(e => e.t >= 16), 1), -12), 0.28), 32),
]);

const finale = section('finale', 32, [
  line(THEME + ' | ' + FIN, 0, 0.92),
  bass(progF, 'pulse', 0.64),
  ...pad(progF, 0.23),
  vel(line(COUNTER), 0.36),
  arp(progF, 0.14),
]);

const outro = section('outro', 16, [
  ramp(line('C4:2 F4:2 | G4:2 C5:6 | r:4'), 0.62, 0.42),
  line('F2:4@.5 G2:4@.45 C3:8@.42'),
  ...pad('F Gsus Cadd9 Cadd9', 0.18).map(l => l.filter(e => e.t < 12)),
  line('r:8 E5:4@.22 G5:4@.18'),
]);

export const track = buildTrack({
  name: 'Cloudy Sky · Drifting Over',
  genre: 'ambient',
  bpm: 70,
  sections: [intro, verse, bridge, verse2, breakdown, bridge2, finale, outro],
  // 16 + 32 + 32 + 32 + 16 + 32 + 32 + 16 = 208 beats at 70 BPM = 2:58
  form: ['intro', 'verse', 'bridge', 'verse2', 'breakdown', 'bridge2', 'finale', 'outro'],
});
