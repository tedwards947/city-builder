import { buildTrack, chords, line, lineBeats, ramp, section as rawSection, toMidi, fromMidi, vel, type Voice } from '../compose.ts';

export const meta = {
  song: 'Dusty Roads',
  label: 'Front Porch',
  blurb: 'Faithful extension at the original 110 BPM: the G-major picking roll and the "D–E–D–B–G" chorus lick in their original rhythms, now with a sung second verse, a fiddle break, an E-minor bridge, a hushed breakdown, a double last chorus and a classic three-times tag ending.',
};

// ---------- harmony tables ----------
const V: Record<string, string> = {
  G: 'G3+B3+D4', C: 'G3+C4+E4', D: 'F#3+A3+D4', D7: 'F#3+C4+D4', Em: 'G3+B3+E4', Am: 'A3+C4+E4',
};
const ROOT: Record<string, string> = { G: 'G2', C: 'C3', D: 'D3', D7: 'D3', Em: 'E2', Am: 'A2' };
const FIFTH: Record<string, string> = { G: 'D3', C: 'G2', D: 'A2', D7: 'A2', Em: 'B2', Am: 'E3' };

// ---------- local helpers ----------
/** "G C/D Em" -> one chord per bar, "C/D" splits a bar in two. */
function bars(prog: string, bpb = 4) {
  const out: { chord: string; t: number; len: number }[] = [];
  let t = 0;
  for (const tok of prog.trim().split(/\s+/)) {
    const parts = tok.split('/');
    for (const c of parts) {
      if (!V[c]) throw new Error(`Unknown chord ${c}`);
      out.push({ chord: c, t, len: bpb / parts.length });
      t += bpb / parts.length;
    }
  }
  return out;
}
/** Boom (root on 1, fifth on 3), 'four' (root/fifth every beat), 'eighth' (driving root/fifth eighths), 'whole'. */
function bass(prog: string, style: 'boom' | 'four' | 'eighth' | 'whole', v = 0.65): Voice {
  const ev: Voice = [];
  for (const { chord, t, len } of bars(prog)) {
    const R = ROOT[chord], F = FIFTH[chord];
    if (style === 'whole') ev.push({ t, pitch: R, len, vel: v });
    else if (style === 'boom') for (let k = 0; k < len; k += 2) ev.push({ t: t + k, pitch: k % 4 === 0 ? R : F, len: 1, vel: v });
    else if (style === 'four') for (let k = 0; k < len; k++) ev.push({ t: t + k, pitch: k % 2 === 0 ? R : F, len: 0.9, vel: k % 2 === 0 ? v : v * 0.85 });
    else for (let k = 0; k < len; k += 0.5) ev.push({ t: t + k, pitch: (k * 2) % 2 === 0 ? R : F, len: 0.5, vel: k % 1 === 0 ? v : v * 0.75 });
  }
  return ev;
}
/** Replace the events of `v` in [at, at+len) with a hand-written line (walk-ups etc). */
function splice(v: Voice, at: number, src: string, velo = 0.65): Voice {
  const len = lineBeats(src);
  return [...v.filter(e => e.t < at - 1e-6 || e.t >= at + len - 1e-6), ...line(src, at, velo)].sort((a, b) => a.t - b.t);
}
/** Offbeat chord "chicks" (2 and 4), or a sustained pad re-struck on every chord. */
function chick(prog: string, style: 'two' | 'train' | 'pad', v = 0.22): Voice[] {
  const src: string[] = [];
  for (const { chord, len } of bars(prog)) {
    const c = V[chord];
    if (style === 'pad') src.push(`${c}:${len}`);
    else if (style === 'two') for (let k = 0; k < len; k += 2) src.push(`r:1 ${c}:.3 r:.7`);
    else for (let k = 0; k < len; k++) src.push(k % 2 ? `${c}:.25@${v} r:.25 ${c}:.2@${(v * 0.6).toFixed(3)} r:.3` : `r:.5 ${c}:.2@${(v * 0.6).toFixed(3)} r:.3`);
  }
  return chords(src.join(' '), 3, 0, v);
}
const s16 = (notes: string) => notes.trim().split(/\s+/).map(n => `${n}:.25`).join(' ');
/** Guitar picking roll (the verse figure) on each chord, an octave below the lead. */
function pick(prog: string, v = 0.28): Voice {
  return line(bars(prog).map(({ chord, len }) => {
    const [a, b, c] = V[chord].split('+');
    return Array.from({ length: len / 2 }, () => s16(`${a} ${b} ${c} ${a} ${b} ${c} ${b} ${a}`)).join(' ');
  }).join(' '), 0, v);
}
/** Diatonic shift in G major (harmony a third below = -2). */
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
const lanes = (vs: Voice[], f: (v: Voice) => Voice) => vs.map(f);
/** Section with every note a hair shorter, so legato notes don't overlap their successors. */
const section = (name: string, beats: number, voices: Voice[]) =>
  rawSection(name, beats, voices.map(v => v.map(e => ({ ...e, len: Math.max(0.1, e.len - 0.02) }))));

// ---------- themes (original) ----------
const VA = s16('G4 B4 D5 G4 B4 D5 B4 G4');
const VB = s16('C5 E5 G5 E5 D5 B4 G4 B4');
const CA = 'D5:.5 E5:.25 D5:.25 B4:.5 G4:.5';
const CB = 'A4:.25 B4:.25 C5:.25 B4:.25 A4:.5 D4:.5';
const BR = 'E4:.5 G4:.5 A4:.5 B4:.5';

// ---------- extended material ----------
const progVerse = 'G G C G D/D7 C/G G/D G';
const verseLead = [
  VA, VB, VA, VB,
  s16('G4 C5 E5 G4 C5 E5 C5 G4'), s16('C5 E5 G5 E5 C5 G4 E4 G4'),
  VA, VB,
  s16('A4 D5 F#5 A4 D5 F#5 D5 A4'), s16('C5 D5 F#5 D5 C5 A4 F#4 A4'),
  s16('G4 C5 E5 G4 C5 E5 C5 G4'), VB,
  VA, s16('A4 C5 D5 F#5 D5 C5 A4 F#4'),
  s16('G4 B4 D5 G5 D5 B4 G4 B4'), 'G4:1 r:1',
].join(' ');

// Sung second verse, built from the chorus lick's contour
const verse2Lead =
  'D5:1.5 E5:.5 D5:1 B4:1 | G4:2 r:1 G4:.5 A4:.5 | E5:1.5 G5:.5 E5:1 C5:1 | D5:2 r:1 B4:.5 C5:.5 | ' +
  'D5:1.5 C5:.5 A4:1 F#4:1 | G4:1 A4:.5 B4:.5 C5:1 E5:1 | D5:1.5 B4:.5 C5:1 A4:1 | G4:3 r:1';

const progChorus = 'G/D G/D C/G Am/D G/D G/D C/D G';
const C3 = 'E5:.5 G5:.25 E5:.25 D5:.5 C5:.5 B4:.25 C5:.25 D5:.25 C5:.25 B4:.5 G4:.5';
const C4 = 'C5:.5 D5:.25 C5:.25 A4:.5 E4:.5 F#4:.25 G4:.25 A4:.25 G4:.25 F#4:.5 D4:.5';
const C6 = CA + ' A4:.25 B4:.25 C5:.25 B4:.25 A4:.5 D5:.5';
const C7 = 'E5:.5 G5:.25 E5:.25 D5:.5 C5:.5 B4:.25 A4:.25 G4:.25 A4:.25 F#4:.5 A4:.5';
const chorusLead = [CA, CB, CA, CB, C3, C4, CA, CB, C6, C7, 'G4:3 r:1'].join(' ');
// Fiddle counterline, long notes above the lick
const chorusCounter = 'G5:2 F#5:2 | G5:2 A5:2 | G5:2 D5:2 | E5:2 F#5:2 | G5:2 F#5:2 | D5:2 C5:2 | E5:2 F#5:2 | G5:4';

const progBridge = 'Em C G D Em C Am D';
const bridgeLead = [
  BR, 'B4:2', BR, 'C5:1 A4:1',
  'D4:.5 G4:.5 A4:.5 B4:.5 D5:1.5 B4:.5', 'A4:1 B4:.5 A4:.5 F#4:1 D4:1',
  BR, 'E5:1.5 D5:.5', 'E5:.5 D5:.5 C5:.5 B4:.5 A4:1 G4:1',
  'A4:.5 C5:.5 E5:.5 C5:.5 B4:1 A4:1', 'D5:2 F#4:.5 G4:.5 A4:.5 C5:.5',
].join(' ');
// Echo of the rising bridge figure, answering in the held beats
const bridgeEcho = 'r:2 E4:.5 G4:.5 B4:1 | r:2 E4:.5 G4:.5 C5:1 | r:4 | r:2 F#4:1 A4:1 | r:2 G4:.5 B4:.5 E5:1 | r:4 | r:4 | r:2 D4:1 F#4:1';

const soloLead = [
  s16('G4 A4 B4 D5 E5 D5 B4 D5'), 'G5:.5 E5:.25 D5:.25 B4:.5 G4:.5',
  s16('B4 D5 G5 D5 B4 G4 A4 B4'), 'D5:1 B4:.5 G4:.5',
  s16('C5 E5 G5 E5 C5 E5 G5 A5'), 'G5:.5 E5:.5 C5:.5 E5:.5',
  s16('D5 B4 G4 B4 D5 G5 D5 B4'), 'G4:.5 A4:.25 B4:.25 D5:1',
  s16('F#5 E5 D5 C5 A4 F#4 A4 C5'), 'D5:.5 F#5:.25 E5:.25 D5:.5 A4:.5',
  s16('E5 D5 C5 E5 G5 E5 C5 E5'), 'G5:1 E5:1',
  CA, s16('A4 B4 C5 D5 C5 B4 A4 F#4'),
  'G4:.5 B4:.25 D5:.25 G5:1 D5:.5 B4:.5 G4:1',
].join(' ');

// ---------- sections ----------
const intro = section('intro', 16, [
  L([VA, VA, VA, VB, C7, 'G4:2 r:2'].join(' '), 16, 0.82),
  line('r:8 C3:1 r:1 D3:1 r:1 G2:1 r:1 D3:1 r:1', 0, 0.6),
  ...chords('r:8 r:1 G3+C4+E4:.3 r:1.7 F#3+A3+D4:.3 r:.7 r:1 G3+B3+D4:.3 r:1.7 G3+B3+D4:.3 r:.7', 3, 0, 0.2),
]);

const verse1 = section('verse1', 32, [
  L(verseLead, 32, 0.85),
  splice(bass(progVerse, 'boom'), 28, 'G2:1 r:1 G2:.5 A2:.5 B2:1', 0.65),
  ...chick(progVerse, 'two', 0.22),
]);

const chorus1 = section('chorus1', 32, [
  L(chorusLead, 32, 0.9),
  bass(progChorus, 'boom', 0.68),
  ...chick(progChorus, 'two', 0.22),
]);

const turn = section('turn', 8, [
  L([VA, VB, VA, 'G4:1 r:1'].join(' '), 8, 0.8),
  line('G2:1 r:1 D3:1 r:1 G2:1 r:1 D3:.5 B2:.5 A2:1', 0, 0.62),
  ...chick('G G', 'two', 0.2),
]);

const verse2 = section('verse2', 32, [
  L(verse2Lead, 32, 0.85),
  splice(bass(progVerse, 'boom', 0.62), 28, 'G2:1 r:1 G2:.5 A2:.5 B2:1', 0.62),
  ...chick(progVerse, 'two', 0.18),
  pick(progVerse, 0.26),
]);

const chorus2 = section('chorus2', 32, [
  L(chorusLead, 32, 0.9),
  bass(progChorus, 'boom', 0.7),
  ...chick(progChorus, 'two', 0.22),
  vel(dia(line(chorusLead), -2), 0.3),
]);

const turn2 = section('turn2', 8, [
  L(C7 + ' G4:2 r:2', 8, 0.85),
  line('C3:1 r:1 D3:1 r:1 G2:1 r:1 F#2:1 r:1', 0, 0.65),
  ...chick('C/D G', 'two', 0.2),
]);

const bridge = section('bridge', 32, [
  L(bridgeLead, 32, 0.86),
  bass(progBridge, 'eighth', 0.6),
  ...chick(progBridge, 'pad', 0.2),
  vel(line(bridgeEcho), 0.32),
]);

const solo = section('solo', 32, [
  L(soloLead, 32, 0.88),
  splice(bass(progVerse, 'four', 0.66), 28, 'G2:1 D3:1 G2:.5 A2:.5 B2:1', 0.66),
  ...chick(progVerse, 'train', 0.22),
]);

const breakdown = section('breakdown', 16, [
  L('D5:2 E5:1 D5:1 | B4:2 G4:2 | A4:1 B4:1 C5:1 B4:1 | A4:2 D4:2', 16, 0.72),
  line('G2:4 E2:4 A2:4 D3:4', 0, 0.48),
  pick('G Em Am D', 0.24),
]);

const chorus3 = section('chorus3', 32, [
  ramp(L(chorusLead, 32, 0.9), 0.82, 1),
  ramp(bass(progChorus, 'boom', 0.68), 0.75, 1),
  pick(progChorus, 0.24),
  ...lanes(chick(progChorus, 'two', 0.22), v => ramp(v, 0.3, 1)),
]);

const chorus4 = section('chorus4', 32, [
  L(chorusLead.replace(/G4:3 r:1$/, 'G4:2 r:2'), 32, 0.93),
  splice(bass(progChorus, 'four', 0.68), 28, 'G2:1 D3:1 G2:.5 A2:.5 B2:1', 0.68),
  ...chick(progChorus, 'two', 0.22),
  vel(line(chorusCounter), 0.24),
  vel(dia(line(chorusLead), -2), 0.26),
]);

// Classic tag: the last line three times, then a picking run home
const tagLine3 = 'C5:.5 D5:.25 C5:.25 A4:.5 E4:.5 F#4:.25 G4:.25 A4:.25 B4:.25 C5:.5 D5:.5';
const tag = section('tag', 20, [
  L([C7, C7, tagLine3, s16('G5 D5 B4 G4 B4 D5 G5 D5'), 'G4:.5 r:1 D4:.5', 'G4:4'].join(' '), 20, 0.92),
  line('C3:1 r:1 D3:1 r:1 | C3:1 r:1 D3:1 r:1 | A2:1 r:1 D3:1 r:1 | G2:1 r:1 G2:.5 r:1 D3:.5 | G2:4', 0, 0.68),
  ...chords(
    'r:1 G3+C4+E4:.3 r:1.7 F#3+A3+D4:.3 r:.7 | r:1 G3+C4+E4:.3 r:1.7 F#3+A3+D4:.3 r:.7 | ' +
    'r:1 A3+C4+E4:.3 r:1.7 F#3+C4+D4:.3 r:.7 | r:1 G3+B3+D4:.3 r:.7 G3+B3+D4:.3 r:1.2 F#3+A3+D4:.3 r:.2 | G3+B3+D4:4', 3, 0, 0.22),
  line('r:16 G5:4', 0, 0.2),
]);

export const track = buildTrack({
  name: 'Dusty Roads · Front Porch',
  genre: 'country',
  bpm: 110,
  sections: [intro, verse1, chorus1, turn, verse2, chorus2, turn2, bridge, solo, breakdown, chorus3, chorus4, tag],
  // 16+32+32+8+32+32+8+32+32+16+32+32+20 = 324 beats = 2:57
  form: ['intro', 'verse1', 'chorus1', 'turn', 'verse2', 'chorus2', 'turn2', 'bridge', 'solo', 'breakdown', 'chorus3', 'chorus4', 'tag'],
});
