import type { Note, Track } from './types';

/**
 * Composition helpers: write music as independent voices with their own rhythms,
 * then compile to the step-locked `Track` format MusicManager plays.
 *
 * MusicManager advances by voice 0's note lengths and, on every step, plays note[i]
 * of every voice. `compileSection` merges all voices' onsets into one step grid so each
 * voice can have its own rhythm; `hold` keeps notes ringing across steps.
 *
 * Voice 0 is the lead and picks up the genre's lead timbre
 * (edm: sawtooth, country: triangle, ambient: sine). Other voices get the accompaniment
 * timbre (edm: square, country/ambient: sine).
 *
 * Mini-notation for `line()`: space-separated tokens `PITCH:BEATS[@VEL]`.
 *   PITCH  C4, F#3, Bb2 ... or `r` for a rest
 *   BEATS  duration in beats (1 = quarter note); decimals ok (.5, 0.25, 1.5)
 *   VEL    optional velocity 0..1
 *   `|` tokens are ignored, use them as bar lines for readability.
 * Example: line("G4:1.5 A4:.5 B4:2 | r:1 D5:1@.6 G5:2")
 */

export interface Ev { t: number; pitch: string; len: number; vel?: number }
export type Voice = Ev[];

export interface Section {
  name: string;
  beats: number;
  /** voices[0] is the lead. Every voice is a lane; events in one lane may not start together. */
  voices: Voice[];
}

const EPS = 1e-6;
const round = (x: number) => Math.round(x * 1e6) / 1e6;
const PITCH_RE = /^([A-G])([#b]?)(-?\d)$/;
const SEMIS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function toMidi(pitch: string): number {
  const m = PITCH_RE.exec(pitch);
  if (!m) throw new Error(`Bad pitch "${pitch}"`);
  return (Number(m[3]) + 1) * 12 + SEMIS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export function fromMidi(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Parse mini-notation into events starting at beat `start`. `vel` is the default velocity. */
export function line(src: string, start = 0, vel?: number): Voice {
  const out: Voice = [];
  let t = start;
  for (const tok of src.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = /^([^:@]+):([\d.]+)(?:@([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`Bad token "${tok}" in "${src}"`);
    const len = Number(m[2]);
    if (!(len > 0)) throw new Error(`Bad length in "${tok}"`);
    if (m[1] !== 'r') {
      toMidi(m[1]);
      const v = m[3] !== undefined ? Number(m[3]) : vel;
      out.push(v === undefined ? { t: round(t), pitch: m[1], len } : { t: round(t), pitch: m[1], len, vel: v });
    }
    t += len;
  }
  return out;
}

/**
 * Decode a transcribed lane: space-separated "gap/length/midi" tokens in ticks (`perBeat` ticks per beat),
 * each gap counted from the previous note's start. Every onset comes straight from integer ticks, so
 * lanes share one exact grid however fine the rhythms (decimal lengths added up would drift apart).
 */
export function ticks(src: string, perBeat: number, vel?: number): Voice {
  const out: Voice = [];
  let t = 0;
  for (const tok of src.trim().split(/\s+/)) {
    if (!tok) continue;
    const [gap, len, midi] = tok.split('/').map(Number);
    if (![gap, len, midi].every(Number.isInteger) || gap < 0 || len <= 0) throw new Error(`Bad tick token "${tok}"`);
    t += gap;
    const e: Ev = { t: round(t / perBeat), pitch: fromMidi(midi), len: round(len / perBeat) };
    if (vel !== undefined) e.vel = vel;
    out.push(e);
  }
  return out;
}

/** Total length in beats of a mini-notation string (rests included). */
export function lineBeats(src: string): number {
  return src.trim().split(/\s+/).filter(t => t && t !== '|')
    .reduce((s, tok) => s + Number(tok.split(':')[1].split('@')[0]), 0);
}

/**
 * Chord lanes: "C3+E3+G3:4 A2+C3+E3:4" -> `n` voices, lane k holding the k-th note of each chord
 * (chords with fewer notes leave the upper lanes silent). Use `r:4` for a rest.
 */
export function chords(src: string, n: number, start = 0, vel?: number): Voice[] {
  const lanes: Voice[] = Array.from({ length: n }, () => []);
  let t = start;
  for (const tok of src.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = /^([^:@]+):([\d.]+)(?:@([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`Bad chord token "${tok}"`);
    const len = Number(m[2]);
    const v = m[3] !== undefined ? Number(m[3]) : vel;
    if (m[1] !== 'r') {
      m[1].split('+').forEach((p, k) => {
        if (k >= n) throw new Error(`Chord "${tok}" has more than ${n} notes`);
        toMidi(p);
        lanes[k].push(v === undefined ? { t: round(t), pitch: p, len } : { t: round(t), pitch: p, len, vel: v });
      });
    }
    t += len;
  }
  return lanes;
}

/** Repeat a voice `times` times, each copy `every` beats after the previous. */
export function repeat(v: Voice, times: number, every: number): Voice {
  const out: Voice = [];
  for (let i = 0; i < times; i++) out.push(...shift(v, i * every));
  return out;
}

export function shift(v: Voice, beats: number): Voice {
  return v.map(e => ({ ...e, t: round(e.t + beats) }));
}

export function transpose(v: Voice, semis: number): Voice {
  return v.map(e => ({ ...e, pitch: fromMidi(toMidi(e.pitch) + semis) }));
}

/** Scale velocities (or set them, for events without one) by `factor`. */
export function vel(v: Voice, factor: number): Voice {
  return v.map(e => ({ ...e, vel: Math.min(1, (e.vel ?? 1) * factor) }));
}

/** Linear velocity ramp across the voice (crescendo/decrescendo), multiplying existing velocity. */
export function ramp(v: Voice, from: number, to: number): Voice {
  if (v.length === 0) return v;
  const t0 = v[0].t, t1 = v[v.length - 1].t;
  return v.map(e => {
    const k = t1 > t0 ? (e.t - t0) / (t1 - t0) : 0;
    return { ...e, vel: Math.min(1, (e.vel ?? 1) * (from + (to - from) * k)) };
  });
}

/** Merge voices into a single lane (caller must make sure no two events start together). */
export function merge(...vs: Voice[]): Voice {
  return vs.flat().sort((a, b) => a.t - b.t);
}

export function section(name: string, beats: number, voices: Voice[]): Section {
  return { name, beats, voices };
}

/** Compile one section into a MusicManager pattern (one Note[] per voice, all on a shared step grid). */
export function compileSection(sec: Section): Note[][] {
  const onsetSet = new Set<number>([0]);
  sec.voices.forEach((voice, vi) => {
    const seen = new Set<number>();
    for (const e of voice) {
      if (e.t < -EPS || e.t >= sec.beats - EPS) {
        throw new Error(`Section "${sec.name}": voice ${vi} event at beat ${e.t} is outside 0..${sec.beats}`);
      }
      const t = round(e.t);
      if (seen.has(t)) throw new Error(`Section "${sec.name}": voice ${vi} has two notes starting at beat ${t}`);
      seen.add(t);
      onsetSet.add(t);
    }
  });
  const onsets = [...onsetSet].sort((a, b) => a - b);
  const steps = onsets.map((t, i) => round((i + 1 < onsets.length ? onsets[i + 1] : sec.beats) - t));
  const voices = sec.voices.length ? sec.voices : [[]];
  return voices.map(voice => {
    const byT = new Map(voice.map(e => [round(e.t), e]));
    return onsets.map((t, i): Note => {
      const e = byT.get(t);
      if (!e) return { pitch: 'rest', length: steps[i] };
      const n: Note = { pitch: e.pitch, length: steps[i] };
      if (Math.abs(e.len - steps[i]) > EPS) n.hold = e.len;
      if (e.vel !== undefined && e.vel !== 1) n.vel = Math.max(0.02, Math.min(1, e.vel));
      return n;
    });
  });
}

/** Build a Track from named sections and a form (list of section names, repeats allowed). */
export function buildTrack(opts: {
  name: string;
  genre: Track['genre'];
  bpm: number;
  sections: Section[];
  form: string[];
}): Track & { sectionNames: string[] } {
  const index = new Map<string, number>();
  const patterns: Note[][][] = [];
  for (const s of opts.sections) {
    if (index.has(s.name)) throw new Error(`Duplicate section "${s.name}"`);
    index.set(s.name, patterns.length);
    patterns.push(compileSection(s));
  }
  const sequence = opts.form.map(n => {
    const i = index.get(n);
    if (i === undefined) throw new Error(`Form references unknown section "${n}"`);
    return i;
  });
  return { name: opts.name, genre: opts.genre, bpm: opts.bpm, patterns, sequence, sectionNames: opts.sections.map(s => s.name) };
}

/** Beats in a pattern (sum of voice 0's step lengths). */
export function patternBeats(p: Note[][]): number {
  return p[0].reduce((s, n) => s + n.length, 0);
}

/** Track length in seconds as MusicManager plays it. */
export function trackSeconds(track: Track): number {
  const beats = track.sequence.reduce((s, i) => s + patternBeats(track.patterns[i]), 0);
  return (beats * 60) / track.bpm;
}

export interface FlatNote { t: number; d: number; f: number; v: number; vel: number }

/**
 * Flatten a track into absolute-time notes (seconds), reproducing MusicManager's playback
 * exactly (including its voice[i % voice.length] indexing). Used by the review page.
 */
export function flatten(track: Track): { notes: FlatNote[]; seconds: number; marks: { t: number; pattern: number }[] } {
  const spb = 60 / track.bpm;
  const notes: FlatNote[] = [];
  const marks: { t: number; pattern: number }[] = [];
  let time = 0;
  for (const pi of track.sequence) {
    const pattern = track.patterns[pi];
    marks.push({ t: round(time), pattern: pi });
    for (let i = 0; i < pattern[0].length; i++) {
      pattern.forEach((voice, v) => {
        const n = voice[i % voice.length];
        if (n.pitch !== 'rest') {
          notes.push({ t: round(time), d: round((n.hold ?? n.length) * spb), f: round(440 * Math.pow(2, (toMidi(n.pitch) - 69) / 12)), v, vel: n.vel ?? 1 });
        }
      });
      time += pattern[0][i].length * spb;
    }
  }
  return { notes, seconds: round(time), marks };
}
