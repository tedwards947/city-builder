import { buildTrack, chords, fromMidi, line, lineBeats, section, toMidi, transpose, vel, type Voice } from '../compose.ts';
import type { Track } from '../types';

/**
 * Melody sketches for a new EDM track. Each is ~40 s: a 4-bar intro, then an 8-bar hook
 * played twice (second time with an arp and a low octave double). The favourite gets
 * developed into a full three-minute track.
 *
 * No drums exist in the synth, so every bass pattern lands on the downbeat to carry the beat.
 */

interface Kit {
  vox: Record<string, string>; // chord -> 3-note voicing for the stab lanes
  root: Record<string, string>; // chord -> bass root
}

/** "Am F C G" = one chord per bar; "A/B" = two chords, 2 beats each. */
function segs(prog: string): [string, number][] {
  return prog.trim().split(/\s+/).flatMap(bar => {
    const cs = bar.split('/');
    return cs.map(c => [c, 4 / cs.length] as [string, number]);
  });
}
const up = (p: string, s: number) => fromMidi(toMidi(p) + s);
/** Fill each chord's span with a repeating cell; `R` = root, `O` = root an octave up. */
function bass(kit: Kit, prog: string, cell: string, v: number): Voice {
  const unit = lineBeats(cell);
  return vel(line(segs(prog).map(([c, b]) => {
    const r = kit.root[c];
    return Array(Math.round(b / unit)).fill(cell.replace(/R/g, r).replace(/O/g, up(r, 12))).join(' ');
  }).join(' ')), v);
}
/** Chord stabs across 3 lanes; `x` in the cell = the chord. */
function stabs(kit: Kit, prog: string, cell: string, v: number): Voice[] {
  const unit = lineBeats(cell);
  return chords(segs(prog).map(([c, b]) => Array(Math.round(b / unit)).fill(cell.replace(/x/g, kit.vox[c])).join(' ')).join(' '), 3, 0, v);
}
/** Arpeggio over the voicing (+1 octave); pattern indexes into [voicing, voicing + 12]. */
function arp(kit: Kit, prog: string, pattern: number[], step: number, v: number): Voice {
  return line(segs(prog).map(([c, b]) => {
    const t = kit.vox[c].split('+').map(p => toMidi(p) + 12);
    const pool = [...t, ...t.map(x => x + 12)];
    return Array.from({ length: Math.round(b / step) }, (_, i) => `${fromMidi(pool[pattern[i % pattern.length]])}:${step}`).join(' ');
  }).join(' '), 0, v);
}
function check(src: string, beats: number) {
  if (Math.abs(lineBeats(src) - beats) > 1e-6) throw new Error(`melody is ${lineBeats(src)} beats, expected ${beats}`);
  return src;
}

function sketch(opts: {
  label: string; blurb: string; bpm: number; kit: Kit;
  introProg: string; hookProg: string; pickup: string; hook: string;
  bassCell: string; stabCell: string; arpPattern: number[]; arpStep: number;
}): { meta: { song: string; label: string; blurb: string }; track: Track } {
  const { kit } = opts;
  const intro = section('intro', 16, [
    line(check(opts.pickup, 16), 0, 0.8),
    bass(kit, opts.introProg, opts.bassCell, 0.42),
    ...stabs(kit, opts.introProg, opts.stabCell, 0.08),
    vel(arp(kit, opts.introProg, opts.arpPattern, opts.arpStep, 1), 0.07),
  ]);
  const hook = check(opts.hook, 32);
  const hookA = section('hook', 32, [
    line(hook, 0, 0.85),
    bass(kit, opts.hookProg, opts.bassCell, 0.5),
    ...stabs(kit, opts.hookProg, opts.stabCell, 0.1),
  ]);
  const hookB = section('hook-full', 32, [
    line(hook, 0, 0.88),
    bass(kit, opts.hookProg, opts.bassCell, 0.52),
    ...stabs(kit, opts.hookProg, opts.stabCell, 0.1),
    arp(kit, opts.hookProg, opts.arpPattern, opts.arpStep, 0.12),
    vel(transpose(line(hook), -12), 0.16),
  ]);
  const name = `New EDM · ${opts.label}`;
  return {
    meta: { song: 'New EDM', label: opts.label, blurb: opts.blurb },
    track: buildTrack({ name, genre: 'edm', bpm: opts.bpm, sections: [intro, hookA, hookB], form: ['intro', 'hook', 'hook-full'] }),
  };
}

// 1 ─ Glass Towers: bright progressive house in A minor, a syncopated 3+3+2 hook
const glassTowers = sketch({
  label: 'Glass Towers',
  blurb: 'Bright progressive house at 124 BPM in A minor (Am–F–C–G). The hook bounces in a syncopated 3+3+2 rhythm and climbs to a high A before settling.',
  bpm: 124,
  kit: {
    vox: { Am: 'A3+C4+E4', F: 'A3+C4+F4', C: 'G3+C4+E4', G: 'G3+B3+D4' },
    root: { Am: 'A2', F: 'F2', C: 'C3', G: 'G2' },
  },
  introProg: 'Am F C G',
  hookProg: 'Am F C G Am F C G',
  pickup: 'r:12 E4:.5 G4:.5 A4:.5 B4:.5 C5:.5 D5:.5 E5:1',
  hook:
    'E5:.75 E5:.75 C5:.5 D5:.75 C5:.75 A4:.5 | C5:.75 C5:.75 A4:.5 C5:1 D5:1 | ' +
    'E5:.75 E5:.75 G5:.5 E5:.75 D5:.75 C5:.5 | D5:1.5 B4:.5 G4:2 | ' +
    'E5:.75 E5:.75 C5:.5 D5:.75 C5:.75 A4:.5 | C5:.75 C5:.75 A4:.5 F5:1 E5:1 | ' +
    'E5:.75 G5:.75 A5:.5 G5:.75 E5:.75 D5:.5 | D5:1 E5:.5 D5:.5 B4:2',
  bassCell: 'R:.5@1 O:.5@.7',
  stabCell: 'r:.5 x:.5',
  arpPattern: [0, 1, 2, 3, 4, 3, 2, 1],
  arpStep: 0.25,
});

// 2 ─ Night Shift: darker electro in D minor, call-and-response with octave leaps
const nightShift = sketch({
  label: 'Night Shift',
  blurb: 'Dark electro at 120 BPM in D minor (Dm–B♭–C–A7). A punchy call-and-response riff leaps an octave on every bar, over a galloping 16th bass.',
  bpm: 120,
  kit: {
    vox: { Dm: 'A3+D4+F4', Bb: 'Bb3+D4+F4', C: 'G3+C4+E4', A7: 'G3+C#4+E4' },
    root: { Dm: 'D2', Bb: 'Bb2', C: 'C3', A7: 'A2' },
  },
  introProg: 'Dm Bb C A7',
  hookProg: 'Dm Bb C A7 Dm Bb C A7',
  pickup: 'r:12 A4:.5 r:.5 A4:.5 r:.5 C#5:.5 r:.5 E5:1',
  hook:
    'D4:.5 D5:.5 r:.25 D4:.25 C5:.5 r:.5 A4:.5 F4:.5 G4:.5 | F4:.5 F5:.5 r:.25 F4:.25 D5:.5 r:.5 Bb4:.5 A4:.5 F4:.5 | ' +
    'E4:.5 E5:.5 r:.25 E4:.25 D5:.5 r:.5 C5:.5 G4:.5 E4:.5 | A4:1.5 G4:.5 E4:1 C#5:1 | ' +
    'D4:.5 D5:.5 r:.25 D4:.25 C5:.5 r:.5 A4:.5 F4:.5 G4:.5 | F4:.5 F5:.5 r:.25 F4:.25 D5:.5 r:.5 Bb4:.5 A4:.5 F4:.5 | ' +
    'E4:.5 E5:.5 r:.25 E4:.25 D5:.5 r:.5 C5:.5 G4:.5 E4:.5 | E5:.5 D5:.5 C#5:.5 A4:.5 E4:1 A4:1',
  bassCell: 'R:.25@1 r:.25 R:.25@.7 R:.25@.7',
  stabCell: 'r:.75 x:.25 r:1',
  arpPattern: [0, 2, 4, 2, 1, 3, 5, 3],
  arpStep: 0.25,
});

// 3 ─ Rush Hour: euphoric big-room pop in E major, a sing-along hook with long notes
const rushHour = sketch({
  label: 'Rush Hour',
  blurb: 'Euphoric big-room pop at 128 BPM in E major (E–B–C♯m–A). A sing-along hook with long held peaks, built for hands-in-the-air moments.',
  bpm: 128,
  kit: {
    vox: { E: 'G#3+B3+E4', B: 'F#3+B3+D#4', 'C#m': 'G#3+C#4+E4', A: 'A3+C#4+E4' },
    root: { E: 'E2', B: 'B2', 'C#m': 'C#3', A: 'A2' },
  },
  introProg: 'E B C#m A',
  hookProg: 'E B C#m A E B C#m A/B',
  pickup: 'r:12 B4:1 C#5:1 D#5:1 F#5:1',
  hook:
    'B4:.5 E5:.5 G#5:1 F#5:.5 E5:.5 F#5:1 | D#5:.5 F#5:.5 B5:1.5 A5:.5 G#5:.5 F#5:.5 | ' +
    'G#5:.5 E5:.5 C#5:1 B4:.5 C#5:.5 E5:1 | C#5:1.5 B4:.5 A4:1 B4:1 | ' +
    'B4:.5 E5:.5 G#5:1 F#5:.5 E5:.5 F#5:1 | D#5:.5 F#5:.5 B5:1 A5:.5 G#5:.5 F#5:1 | ' +
    'G#5:.75 G#5:.75 A5:.5 G#5:.5 F#5:.5 E5:1 | F#5:1.5 E5:.5 D#5:2',
  bassCell: 'R:.75@1 R:.25@.6 O:.5@.8 R:.5@.7',
  stabCell: 'r:.5 x:.5',
  arpPattern: [0, 1, 2, 3, 2, 1],
  arpStep: 0.5,
});

export const sketches = [glassTowers, nightShift, rushHour];
