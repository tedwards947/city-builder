import { buildTrack, fromMidi, line, lineBeats, section, toMidi, type Section, type Voice } from './compose.ts';
import type { Instrument, Track } from './types';

/**
 * Molam arranger. Molam is the music of Laos and Isan: the khaen (a bamboo mouth organ), the phin lute, ching
 * cymbals and, in modern molam, an electric bass, a kick and a cowbell. A song writes every lane of every
 * part in mini-notation (see compose.ts); each lane's line repeats to fill the part, so a one-bar riff or beat
 * is written once. Drum lanes write `x` for a hit, and `@` velocities in a line multiply the lane's level.
 *
 * Every song has the same lanes, so each keeps one instrument from part to part:
 *   0 lead · 1 riff (a second melodic voice) · 2 bass · 3-4 khaen chords · 5 kick · 6 snare · 7 hat
 *   · 8 ching · 9 cowbell
 */

const LANES = ['lead', 'riff', 'bass', 'd1', 'd2', 'kick', 'snare', 'hat', 'ching', 'bell'] as const;
export type Lane = typeof LANES[number];
const DRUMS = new Set<Lane>(['kick', 'snare', 'hat', 'ching', 'bell']);
/** Each lane's level before a part's own `vel`. */
const LEVEL: Record<Lane, number> = { lead: 0.95, riff: 0.75, bass: 0.7, d1: 0.3, d2: 0.3, kick: 0.75, snare: 0.55, hat: 0.5, ching: 0.55, bell: 0.55 };
/** Lifts the band to sit level with the rest of the soundtrack. */
const GAIN = 1.12;

export type PartSpec = {
  name: string;
  bars: number;
  /** Lane levels for this part, multiplying the arranger's. */
  vel?: Partial<Record<Lane, number>>;
  /** Velocity ramp across the part for every lane, e.g. [0.8, 0.15] to fade out. */
  fade?: [number, number];
} & Partial<Record<Lane, string>>;

function part(p: PartSpec): Section {
  const beats = p.bars * 4;
  const [fa, fb] = p.fade ?? [1, 1];
  return section(p.name, beats, LANES.map(l => {
    let src = p[l];
    if (!src) return [];
    if (DRUMS.has(l)) src = src.replace(/(^|\s)x:/g, '$1C4:');
    const one = lineBeats(src);
    if (Math.abs(beats / one - Math.round(beats / one)) > 1e-6) throw new Error(`${p.name}.${l}: ${one} beats doesn't fill ${beats}`);
    const v = LEVEL[l] * GAIN * (p.vel?.[l] ?? 1);
    const out: Voice = [];
    for (let k = 0; k < beats - 1e-6; k += one) {
      out.push(...line(src, k).map(e => ({ ...e, vel: (e.vel ?? 1) * v * (fa + (fb - fa) * e.t / beats) })));
    }
    return out;
  }));
}

/** A bar of `cell` on each root (R = root, O = octave up, F = fifth); `-` is a bar's rest. */
export function bassline(roots: string, cell: string): string {
  const up = (r: string, s: number) => fromMidi(toMidi(r) + s);
  return roots.trim().split(/\s+/).map(r => r === '-' ? 'r:4'
    : cell.replace(/[ROF]/g, x => x === 'R' ? r : x === 'O' ? up(r, 12) : up(r, 7))).join(' ');
}

/** Transpose every pitch in a mini-notation line by `semis`. */
export const tr = (src: string, semis: number) => src.replace(/[A-G][#b]?-?\d/g, p => fromMidi(toMidi(p) + semis));

/** The first two bars of a line written with `|` bar lines. */
export const firstBars = (src: string, n = 2) => src.split('|').slice(0, n).join('|');

/** The owner's bassline, one bar: "DUMM dum da da" = root (dotted quarter), root (eighth), fifth, fifth (quarters). */
export const DUM = 'R:1.5 R:.5 F:1 F:1';

/**
 * A khaen harmony under a pentatonic line: each note two scale steps down (mostly a fourth below, sometimes
 * a third), the open sound of a khaen's pipes played together. `scale` is the five pitch classes.
 */
export function khaenHarmony(src: string, scale: number[]): string {
  return src.replace(/[A-G][#b]?-?\d/g, p => {
    let m = toMidi(p);
    for (let steps = 0; steps < 2;) { m--; if (scale.includes(((m % 12) + 12) % 12)) steps++; }
    return fromMidi(m);
  });
}

/** Khaen chord breaths, one root a bar: "da DAA da, da DAA da" across the beat. Two lanes: root, then fifth. */
const BREATHS = 'r:.5 R:1 R:.5@.7 r:.5 R:1 R:.5@.7';
export const breaths = (roots: string): { d1: string; d2: string } =>
  ({ d1: bassline(roots, BREATHS), d2: bassline(roots, BREATHS.replace(/R/g, 'F')) });

/** Build a molam song: the parts played in order. */
export function molam(o: {
  song: string; blurb: string; bpm: number;
  inst: { lead: Instrument; riff: Instrument; bass: Instrument };
  parts: PartSpec[];
}): { meta: { song: string; label: string; blurb: string }; track: Track } {
  const track: Track = {
    ...buildTrack({ name: o.song, genre: 'molam', bpm: o.bpm, sections: o.parts.map(part), form: o.parts.map(p => p.name) }),
    instruments: [o.inst.lead, o.inst.riff, o.inst.bass, 'khaen', 'khaen', 'kick', 'snare', 'shaker', 'ching', 'cowbell'],
    pans: [0, 0.3, 0, -0.35, 0.35, 0, 0.1, 0.35, 0.4, -0.3],
  };
  return { meta: { song: o.song, label: 'Molam', blurb: o.blurb }, track };
}
