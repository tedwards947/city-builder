import { buildTrack, fromMidi, line, lineBeats, section, transpose, type Ev, type Voice } from './compose.ts';
import type { Instrument, Track } from './types';

/**
 * Tropical house arranger. A song names its instruments, writes its melodies in mini-notation (see compose.ts)
 * and describes each part's groove; this file plays the band around them: soft four-on-the-floor kick, claps,
 * shakers, a round sub bass, offbeat chord stabs, a pumping pad and arpeggios, all following the chord chart.
 *
 * Every song has the same lanes, so each lane keeps one instrument from part to part:
 *   0 lead · 1 counter · 2 bass · 3-5 chord stabs · 6-8 pad · 9 arp · 10 kick · 11 clap · 12 shaker · 13 lead double
 */

export interface Groove {
  kick?: 'four' | 'half';
  /** '24' claps on beats 2 and 4; 'roll' does that, then builds to a 16th-note roll over the last two bars. */
  clap?: '24' | 'roll';
  shaker?: '16' | '8' | 'off8';
  /** A rhythm cell tiled across the part: R = chord root, O = root an octave up, F = the fifth. 'hold' = one per chord. */
  bass?: string;
  /** A rhythm cell tiled across the part, `x` = the chord: "r:.5 x:.5" is offbeat stabs. */
  stab?: string;
  /** 'pump' swells into the chord on every beat; 'hold' sustains one per chord. */
  pad?: 'pump' | 'hold';
  /** Arpeggio indexes into the chord voicing and the same an octave up (0-5), one per `step` beats. */
  arp?: { pattern: number[]; step: number };
  /** Velocity for the whole band (default 1). */
  energy?: number;
}

export interface Part {
  name: string;
  bars: number;
  /** One chord per bar; "F/G" splits a bar. A chart shorter than the part repeats. */
  prog: string;
  /** Melodies in mini-notation; shorter than the part, they repeat. */
  lead?: string;
  counter?: string;
  leadVel?: number;
  counterVel?: number;
  /** Double the lead on lane 13. */
  double?: boolean;
  groove: Groove;
  /** Drop the band out for the last two beats: the breath before a drop. */
  breath?: boolean;
  /** Velocity ramp across the part for the whole mix, e.g. [1, 0.2] to fade out. */
  fade?: [number, number];
}

export interface TropicalSong {
  song: string;
  blurb: string;
  bpm: number;
  inst: { lead: Instrument; counter: Instrument; stab: Instrument; arp: Instrument; double?: Instrument };
  /** Semitones the lead double sits from the lead (default +12). */
  doubleShift?: number;
  /** Lane levels that differ from the arranger's MIX (e.g. a loud stab instrument). */
  mix?: Partial<typeof BASE_MIX>;
  /** Lowest MIDI note of each voicing window (each chord is voiced within the octave above). */
  low?: { bass?: number; stab?: number; pad?: number; arp?: number };
  parts: Part[];
  form: string[];
}

// ---------------------------------------------------------------- chords
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 10], maj7: [4, 7, 11], m7: [3, 7, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [2, 4, 7],
};
function parseChord(c: string): { root: number; ivs: number[] } {
  const m = /^([A-G])([#b]?)(.*)$/.exec(c);
  if (!m || !(m[3] in QUALITY)) throw new Error(`Unknown chord "${c}"`);
  return { root: (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, ivs: QUALITY[m[3]] };
}
const place = (pc: number, low: number) => low + (((pc - low) % 12) + 12) % 12;
/** The chord's notes (MIDI), each placed in the octave [low, low + 12), low to high. Three notes for every chord. */
export function voicing(c: string, low: number): number[] {
  const { root, ivs } = parseChord(c);
  return ivs.map(i => place(root + i, low)).sort((a, b) => a - b);
}
const rootOf = (c: string, low: number) => place(parseChord(c).root, low);

interface Seg { c: string; t: number; len: number }
function chart(prog: string, beats: number, part: string): Seg[] {
  const once: Seg[] = [];
  let t = 0;
  for (const bar of prog.trim().split(/\s+/)) {
    const cs = bar.split('/');
    for (const c of cs) { parseChord(c); once.push({ c, t, len: 4 / cs.length }); t += 4 / cs.length; }
  }
  if (beats % t) throw new Error(`${part}: chord chart of ${t} beats doesn't fit ${beats}`);
  const out: Seg[] = [];
  for (let k = 0; k < beats; k += t) out.push(...once.map(s => ({ ...s, t: s.t + k })));
  return out;
}
function chordAt(segs: Seg[], t: number): string {
  let c = segs[0].c;
  for (const s of segs) if (s.t <= t + 1e-6) c = s.c;
  return c;
}

// ---------------------------------------------------------------- rhythm cells
interface Hit { t: number; sym: string; len: number; vel: number }
/** Tile a cell of `SYM:BEATS[@VEL]` tokens across `beats` (r = rest). */
function tile(cell: string, beats: number): Hit[] {
  const one: Hit[] = [];
  let t = 0;
  for (const tok of cell.trim().split(/\s+/)) {
    const m = /^([^:@]+):([\d.]+)(?:@([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`Bad cell token "${tok}"`);
    const len = Number(m[2]);
    if (m[1] !== 'r') one.push({ t, sym: m[1], len, vel: m[3] ? Number(m[3]) : 1 });
    t += len;
  }
  const out: Hit[] = [];
  for (let k = 0; k < beats - 1e-6; k += t) for (const h of one) if (k + h.t < beats - 1e-6) out.push({ ...h, t: k + h.t });
  return out;
}
const ev = (t: number, midi: number, len: number, vel: number): Ev => ({ t: Math.round(t * 1e6) / 1e6, pitch: fromMidi(midi), len, vel });

/** A melody repeated to fill the part. */
function melody(src: string | undefined, beats: number, v: number, part: string): Voice {
  if (!src) return [];
  const one = lineBeats(src);
  if (beats % one) throw new Error(`${part}: melody of ${one} beats doesn't fit ${beats}`);
  const out: Voice = [];
  for (let k = 0; k < beats; k += one) out.push(...line(src, k, v));
  return out;
}

// Lane levels: the balance of the band before a part's own energy.
const BASE_MIX = { lead: 0.9, counter: 0.7, bass: 0.85, stab: 0.5, pad: 0.6, arp: 0.45, kick: 0.9, clap: 0.9, double: 0.4 };
const SHAKE: Record<string, [string, number[]]> = {
  '16': ['x:.25', [0.45, 0.2, 0.75, 0.25]],
  '8': ['x:.5', [0.4, 0.8]],
  off8: ['r:.5 x:.5', [0.8]],
};

function arrangePart(song: TropicalSong, p: Part): ReturnType<typeof section> {
  const beats = p.bars * 4, g = p.groove, e = g.energy ?? 1, MIX = { ...BASE_MIX, ...song.mix };
  const low = { bass: 38, stab: 57, pad: 52, arp: 64, ...song.low };
  const segs = chart(p.prog, beats, p.name);
  const lead = melody(p.lead, beats, (p.leadVel ?? 1) * MIX.lead, p.name);
  const counter = melody(p.counter, beats, (p.counterVel ?? 1) * MIX.counter, p.name);

  const bass: Voice = !g.bass ? [] : g.bass === 'hold'
    ? segs.map(s => ev(s.t, rootOf(s.c, low.bass), s.len, MIX.bass * e))
    : tile(g.bass, beats).map(h => ev(h.t, rootOf(chordAt(segs, h.t), low.bass) + ({ R: 0, O: 12, F: 7 } as Record<string, number>)[h.sym], h.len, h.vel * MIX.bass * e));

  const stabs: Voice[] = [[], [], []];
  if (g.stab) for (const h of tile(g.stab, beats)) {
    voicing(chordAt(segs, h.t), low.stab).forEach((m, k) => stabs[k].push(ev(h.t, m, h.len, h.vel * MIX.stab * e)));
  }
  const pad: Voice[] = [[], [], []];
  if (g.pad) {
    const hits = g.pad === 'hold' ? segs.map(s => ({ t: s.t, len: s.len, c: s.c }))
      : Array.from({ length: beats }, (_, t) => ({ t, len: 1, c: chordAt(segs, t) }));
    for (const h of hits) voicing(h.c, low.pad).forEach((m, k) => pad[k].push(ev(h.t, m, h.len, MIX.pad * e)));
  }
  const arp: Voice = [];
  if (g.arp) {
    const { pattern, step } = g.arp;
    for (let i = 0, t = 0; t < beats - 1e-6; i++, t += step) {
      const v = voicing(chordAt(segs, t), low.arp);
      arp.push(ev(t, [...v, ...v.map(x => x + 12)][pattern[i % pattern.length]], step, MIX.arp * e * (i % 2 ? 0.75 : 1)));
    }
  }

  const kick: Voice = !g.kick ? [] : Array.from({ length: beats }, (_, t) => t)
    .filter(t => g.kick === 'four' || t % 2 === 0).map(t => ev(t, 36, 0.5, MIX.kick * e));
  const clap: Voice = [];
  if (g.clap) {
    const rollFrom = g.clap === 'roll' ? beats - 8 : beats;
    for (let t = 1; t < rollFrom; t += 2) clap.push(ev(t, 50, 0.5, MIX.clap * e));
    for (let t = rollFrom; t < beats - 1e-6; t += t < beats - 4 ? 0.5 : 0.25) {
      clap.push(ev(t, 50, 0.25, MIX.clap * e * (0.3 + 0.6 * (t - rollFrom) / 8)));
    }
  }
  const shaker: Voice = [];
  if (g.shaker) {
    const [cell, accents] = SHAKE[g.shaker];
    tile(cell, beats).forEach((h, i) => shaker.push(ev(h.t, 80, h.len, accents[i % accents.length] * e)));
  }
  const double = p.double && p.lead ? transpose(melody(p.lead, beats, MIX.double * (p.leadVel ?? 1), p.name), song.doubleShift ?? 12) : [];

  let voices: Voice[] = [lead, counter, bass, ...stabs, ...pad, arp, kick, clap, shaker, double];
  if (p.breath) {
    const cut = beats - 2, band = new Set([2, 3, 4, 5, 9, 10, 11, 12]);
    voices = voices.map((v, i) => band.has(i) ? v.filter(n => n.t < cut - 1e-6).map(n => ({ ...n, len: Math.min(n.len, cut - n.t) })) : v);
  }
  if (p.fade) {
    const [a, b] = p.fade;
    voices = voices.map(v => v.map(n => ({ ...n, vel: (n.vel ?? 1) * (a + (b - a) * n.t / beats) })));
  }
  return section(p.name, beats, voices);
}

/** Build a tropical house song: the arranged parts played in `form` order. */
export function tropical(song: TropicalSong): { meta: { song: string; label: string; blurb: string }; track: Track } {
  const { lead, counter, stab, arp, double = lead } = song.inst;
  const track: Track = {
    ...buildTrack({ name: song.song, genre: 'tropical', bpm: song.bpm, sections: song.parts.map(p => arrangePart(song, p)), form: song.form }),
    instruments: [lead, counter, 'sub', stab, stab, stab, 'pad', 'pad', 'pad', arp, 'kick', 'clap', 'shaker', double],
    pans: [0, 0.3, 0, -0.25, 0.05, 0.3, -0.5, 0, 0.5, -0.35, 0, 0.1, 0.4, -0.15],
  };
  return { meta: { song: song.song, label: 'Tropical House', blurb: song.blurb }, track };
}
