import { buildTrack, chords, line, lineBeats, ramp, section as rawSection, toMidi, fromMidi, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Dusty Roads',
  label: 'Prairie Waltz',
  blurb: 'The tune recast as a lilting 3/4 country waltz: the chorus lick stretched into a long, singable line, the picking roll turned into a rocking guitar arpeggio, and a reharmonization with a sad minor-iv (C minor) turn, a descending C–B–A–G bass and a ritardando ending.',
};

// ---------- harmony tables (3/4: one chord per bar) ----------
const V: Record<string, string> = {
  G: 'G3+B3+D4', GB: 'G3+B3+D4', G7: 'F3+B3+D4', C: 'G3+C4+E4', Cm: 'G3+C4+Eb4', D: 'F#3+A3+D4', D7: 'F#3+C4+D4',
  Em: 'G3+B3+E4', Am: 'A3+C4+E4', A7: 'G3+C#4+E4', B7: 'F#3+A3+D#4',
};
const ROOT: Record<string, string> = {
  G: 'G2', GB: 'B2', G7: 'G2', C: 'C3', Cm: 'C3', D: 'D3', D7: 'D3', Em: 'E2', Am: 'A2', A7: 'A2', B7: 'B2',
};
const FIFTH: Record<string, string> = {
  G: 'D3', GB: 'D3', G7: 'D3', C: 'G2', Cm: 'G2', D: 'A2', D7: 'A2', Em: 'B2', Am: 'E3', A7: 'E3', B7: 'F#2',
};

// ---------- local helpers ----------
const BPB = 3;
function bars(prog: string) {
  return prog.trim().split(/\s+/).filter(c => c !== '|').map((chord, i) => {
    if (!V[chord]) throw new Error(`Unknown chord ${chord}`);
    return { chord, t: i * BPB, prev: '' };
  }).map((b, i, a) => ({ ...b, prev: i ? a[i - 1].chord : '' }));
}
/** Waltz "oom": bass on beat 1, root, or the fifth when the chord carries over from the previous bar. */
function bass(prog: string, v = 0.6, style: 'oom' | 'long' = 'oom'): Voice {
  return bars(prog).map(({ chord, t, prev }) => ({
    t, pitch: prev === chord ? FIFTH[chord] : ROOT[chord], len: style === 'oom' ? 1.2 : 3, vel: v,
  }));
}
/** Waltz "pah-pah": chord on beats 2 and 3, or a pad struck once per bar. */
function pah(prog: string, v = 0.2, style: 'pah' | 'pad' = 'pah'): Voice[] {
  const src = bars(prog).map(({ chord }) => style === 'pad'
    ? `${V[chord]}:3`
    : `r:1 ${V[chord]}:.45 r:.55 ${V[chord]}:.4@${(v * 0.75).toFixed(3)} r:.6`).join(' ');
  return chords(src, 3, 0, v);
}
const up = (p: string) => fromMidi(toMidi(p) + 12);
/** The verse picking roll as a rocking eighth-note guitar arpeggio: a b c a' c b. */
function arp(prog: string, v = 0.24): Voice {
  return line(bars(prog).map(({ chord }) => {
    const [a, b, c] = V[chord].split('+');
    return `${a}:.5 ${b}:.5 ${c}:.5 ${up(a)}:.5 ${c}:.5 ${b}:.5`;
  }).join(' '), 0, v);
}
/** Diatonic shift in G major (harmony a third below = -2); chromatic notes stay put. */
const SCALE = [0, 2, 4, 5, 7, 9, 11];
function dia(v: Voice, steps: number): Voice {
  return v.map(e => {
    const m = toMidi(e.pitch) - 7;
    const d = SCALE.indexOf(((m % 12) + 12) % 12);
    if (d < 0) return e;
    const nd = d + steps + Math.floor(m / 12) * 7;
    return { ...e, pitch: fromMidi(7 + Math.floor(nd / 7) * 12 + SCALE[((nd % 7) + 7) % 7]) };
  });
}
function L(src: string, beats: number, v: number): Voice {
  if (Math.abs(lineBeats(src) - beats) > 1e-6) throw new Error(`Line is ${lineBeats(src)} beats, expected ${beats}: ${src.slice(0, 40)}`);
  return line(src, 0, v);
}
/** Section with every note a hair shorter, so legato notes don't overlap their successors. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: Math.max(0.1, e.len - 0.02) }))));

// ---------- material ----------
// Verse: the picking roll's contour (G-B-D, C-E-G-E-D-B) sung slowly
const progVerse = 'G G C G Em C Am D | G G7 C Cm G Em Am D7';
const verseLead =
  'G4:1 B4:1 D5:1 | D5:1.5 B4:.5 G4:1 | C5:1 E5:1 G5:1 | E5:1 D5:1 B4:1 | ' +
  'G4:1 B4:1 E5:1 | E5:1.5 D5:.5 C5:1 | C5:1 B4:1 A4:1 | A4:3 | ' +
  'G4:1 B4:1 D5:1 | G5:1.5 F5:.5 D5:1 | C5:1 E5:1 G5:1 | G5:1.5 Eb5:.5 C5:1 | ' +
  'D5:1 B4:1 G4:1 | B4:1.5 C5:.5 B4:1 | C5:1 B4:1 A4:1 | A4:1 B4:.5 A4:.5 F#4:1';
// Second verse leaves holes for a fiddle to answer
const verse2Lead =
  'G4:1 B4:1 D5:1 | B4:3 | C5:1 E5:1 G5:1 | D5:3 | ' +
  'G4:1 B4:1 E5:1 | E5:2 C5:1 | C5:1 B4:1 A4:1 | A4:3 | ' +
  'G4:1 B4:1 D5:1 | G5:1.5 F5:.5 D5:1 | E5:3 | Eb5:2 C5:1 | ' +
  'D5:1 B4:1 G4:1 | B4:2 E5:1 | C5:1 B4:1 A4:1 | A4:3';
const verse2Fiddle =
  'r:3 | r:1 D5:1 G5:1 | r:3 | r:1 B4:.5 C5:.5 D5:1 | ' +
  'r:3 | r:3 | r:3 | r:1 F#5:1 E5:.5 D5:.5 | ' +
  'r:3 | r:3 | r:1 G5:1 E5:1 | r:3 | ' +
  'r:3 | r:3 | r:3 | r:1 C5:1 D5:1';

// Chorus: the D-E-D-B-G / A-B-C-B-A-D lick, each 2-beat cell stretched over two waltz bars
const progChorus = 'G Em Am D7 G Em A7 D | C GB Am G C Cm D7 G';
const chorusLead =
  'D5:1.5 E5:.5 D5:1 | B4:2 G4:1 | A4:1 B4:.5 C5:.5 B4:1 | A4:2 D4:1 | ' +
  'D5:1.5 E5:.5 D5:1 | B4:2 G4:1 | A4:1 B4:.5 C#5:.5 B4:1 | A4:3 | ' +
  'E5:1.5 G5:.5 E5:1 | D5:2 B4:1 | C5:1 D5:.5 C5:.5 A4:1 | B4:2 G4:1 | ' +
  'E5:1 D5:1 C5:1 | Eb5:1.5 D5:.5 C5:1 | A4:1 B4:.5 C5:.5 B4:.5 A4:.5 | G4:3';
const chorusCounter =
  'G5:3 | E5:3 | E5:3 | F#5:3 | G5:3 | E5:3 | E5:3 | F#5:3 | ' +
  'C5:3 | B4:3 | C5:3 | B4:3 | C5:3 | Eb5:3 | D5:3 | D5:3';

// Bridge: the rising E-G-A-B figure, in E minor with a dark B7 turn
const progBridge = 'Em Em C C G G D D | Em B7 Em Em C Am A7 D7';
const bridgeLead =
  'E4:1 G4:1 A4:1 | B4:3 | E4:1 G4:1 A4:1 | C5:2 A4:1 | ' +
  'D4:1 G4:1 A4:1 | B4:2 D5:1 | A4:1.5 B4:.5 A4:1 | F#4:3 | ' +
  'E4:1 G4:1 A4:1 | B4:1.5 A4:.5 F#4:1 | E4:1 G4:1 A4:1 | B4:1 D5:1 E5:1 | ' +
  'G5:2 E5:1 | E5:1 D5:1 C5:1 | C#5:1.5 B4:.5 A4:1 | A4:2 C5:1';
// Echo of the rising figure in the held bars
const bridgeEcho =
  'r:3 | r:1 E4:.5 G4:.5 A4:1 | r:3 | r:3 | r:3 | r:3 | r:3 | r:1 D4:.5 E4:.5 F#4:1 | ' +
  'r:3 | r:3 | r:3 | r:3 | r:3 | r:3 | r:3 | r:3';

// ---------- sections ----------
const intro = section('intro', 24, [
  L('r:12 | E5:1 D5:1 C5:1 | Eb5:1.5 D5:.5 C5:1 | A4:1 B4:.5 C5:.5 B4:.5 A4:.5 | G4:3', 24, 0.75),
  line('r:12 C3:1.2 r:1.8 C3:1.2 r:1.8 D3:1.2 r:1.8 G2:1.2 r:1.8', 0, 0.55),
  ...chords('r:12 r:1 G3+C4+E4:.45 r:1.55 r:1 G3+C4+Eb4:.45 r:1.55 r:1 F#3+C4+D4:.45 r:1.55 r:1 G3+B3+D4:.45 r:1.55', 3, 0, 0.18),
  ramp(arp('G C G D C Cm D7 G', 0.3), 0.6, 1),
]);

const verse1 = section('verse1', 48, [
  L(verseLead, 48, 0.8),
  bass(progVerse, 0.56),
  arp(progVerse, 0.24),
]);

const chorus1 = section('chorus1', 48, [
  L(chorusLead, 48, 0.88),
  bass(progChorus, 0.62),
  ...pah(progChorus, 0.2),
]);

const verse2 = section('verse2', 48, [
  L(verse2Lead, 48, 0.82),
  bass(progVerse, 0.6),
  ...pah(progVerse, 0.17),
  arp(progVerse, 0.18),
  vel(line(verse2Fiddle), 0.36),
]);

const chorus2 = section('chorus2', 48, [
  L(chorusLead, 48, 0.88),
  bass(progChorus, 0.64),
  ...pah(progChorus, 0.2),
  vel(dia(line(chorusLead), -2), 0.28),
]);

const bridge = section('bridge', 48, [
  L(bridgeLead, 48, 0.84),
  ramp(bass(progBridge, 0.6, 'long'), 0.8, 1.05),
  ...pah(progBridge, 0.19, 'pad'),
  vel(line(bridgeEcho), 0.34),
  ramp(arp(progBridge, 0.22), 0.4, 1),
]);

const chorus3 = section('chorus3', 48, [
  L(chorusLead, 48, 0.92),
  bass(progChorus, 0.66),
  ...pah(progChorus, 0.2),
  arp(progChorus, 0.18),
  vel(line(chorusCounter), 0.24),
]);

// Ritardando ending: the last line in long notes, then a slow strum home
const outro = section('outro', 24, [
  L('E5:2 D5:1 | C5:3 | Eb5:2 D5:1 | C5:3 | A4:1.5 B4:.5 C5:1 | A4:2 D4:1 | G4:6', 24, 0.8),
  line('C3:3 G2:3 C3:3 G2:3 D3:3 A2:3 G2:6', 0, 0.55),
  ...chords('G3+C4+E4:6 G3+C4+Eb4:6 F#3+C4+D4:6 G3+B3+D4:6', 3, 0, 0.17),
  line('r:18 G3:.75 B3:.75 D4:.75 G4:2.75', 0, 0.26),
  line('r:6 r:6 r:6 r:2.25 D5:3.75', 0, 0.18),
]);

export const track = buildTrack({
  name: 'Dusty Roads · Prairie Waltz',
  genre: 'country',
  bpm: 112,
  sections: [intro, verse1, chorus1, verse2, chorus2, bridge, chorus3, outro],
  // 24 + 48*6 + 24 = 336 beats = 3:00
  form: ['intro', 'verse1', 'chorus1', 'verse2', 'chorus2', 'bridge', 'chorus3', 'outro'],
});
