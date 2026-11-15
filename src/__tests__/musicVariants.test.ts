import { describe, it, expect } from 'vitest';
import { flatten, trackSeconds, compileSection, section, line, chords } from '../audio/compose';
import type { Track } from '../audio/types';

// _dropped/ holds takes the user cut; they are kept for reference but not maintained
const modules = import.meta.glob(['../audio/variants/*/*.ts', '!../audio/variants/_dropped/*.ts'], { eager: true }) as Record<
  string,
  { track: Track; meta: { song: string; label: string; blurb: string } }
>;

describe('compose', () => {
  it('merges independent voice rhythms onto one step grid with holds', () => {
    const p = compileSection(section('s', 4, [line('C4:3 D4:1'), line('C3:1 E3:1 G3:2')]));
    expect(p[0].map(n => n.length)).toEqual([1, 1, 1, 1]);
    expect(p[0][0]).toEqual({ pitch: 'C4', length: 1, hold: 3 });
    expect(p[0][1].pitch).toBe('rest');
    expect(p[1][2]).toEqual({ pitch: 'G3', length: 1, hold: 2 });
  });

  it('splits chords into lanes', () => {
    const lanes = chords('C3+E3+G3:4 A2+C3:4', 3);
    expect(lanes[2]).toHaveLength(1);
    expect(lanes[0].map(e => e.t)).toEqual([0, 4]);
  });

  it('rejects events outside the section', () => {
    expect(() => compileSection(section('s', 4, [line('C4:4 D4:1')]))).toThrow();
  });
});

const sketchModules = import.meta.glob('../audio/sketches/*.ts', { eager: true }) as Record<
  string,
  { sketches: { track: Track; meta: { label: string } }[] }
>;

describe('melody sketches', () => {
  for (const [path, mod] of Object.entries(sketchModules)) {
    for (const s of mod.sketches) {
      it(`${path} ${s.meta.label} is a 30-60 s demo`, () => {
        const secs = trackSeconds(s.track);
        expect(secs).toBeGreaterThanOrEqual(30);
        expect(secs).toBeLessThanOrEqual(60);
        expect(flatten(s.track).notes.length).toBeGreaterThan(50);
      });
    }
  }
});

describe('game tracks', () => {
  const tracks = import.meta.glob('../audio/tracks/*.ts', { eager: true }) as Record<string, { track: Track }>;
  it('have unique names', () => {
    const names = Object.values(tracks).map(m => m.track.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// Takes promoted into the game keep their `meta`; they get the same checks as takes under review.
const promoted = Object.entries(
  import.meta.glob('../audio/tracks/*.ts', { eager: true }) as Record<string, { track: Track; meta?: { song: string; label: string; blurb: string } }>,
).filter((e): e is [string, { track: Track; meta: { song: string; label: string; blurb: string } }] => !!e[1].meta);

describe('music variants', () => {
  const entries = [...Object.entries(modules), ...promoted];
  for (const [path, mod] of entries) {
    describe(path, () => {
      it('has metadata', () => {
        expect(mod.meta.song).toBeTruthy();
        expect(mod.meta.label).toBeTruthy();
      });
      it('runs about three minutes', () => {
        const s = trackSeconds(mod.track);
        expect(s).toBeGreaterThanOrEqual(160);
        expect(s).toBeLessThanOrEqual(215);
      });
      it('has consistent patterns and plays notes', () => {
        for (const p of mod.track.patterns) {
          for (const v of p) expect(v.length).toBe(p[0].length);
          for (const n of p[0]) expect(n.length).toBeGreaterThan(0);
        }
        const f = flatten(mod.track);
        expect(f.notes.length).toBeGreaterThan(100);
        expect(Math.abs(f.seconds - trackSeconds(mod.track))).toBeLessThan(0.01);
      });
    });
  }
});
