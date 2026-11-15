import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicManager, shufflePlaylist } from '../audio/MusicManager';
import type { Track } from '../audio/types';

const TRACK_COUNT = Object.keys(import.meta.glob('../audio/tracks/*.ts')).length;

// Mock AudioContext
const mockOscillator = {
  connect: vi.fn(),
  frequency: { setValueAtTime: vi.fn() },
  start: vi.fn(),
  stop: vi.fn(),
  type: 'sine',
};

const mockGain = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    value: 0,
  },
};

const mockAudioContext = {
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGain),
  destination: {},
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  state: 'suspended',
};

// Must be a regular function to be used as a constructor
const MockAudioContext = vi.fn(function() {
  return mockAudioContext;
});

(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).window = {
  AudioContext: MockAudioContext,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
};

/** Small seeded PRNG (mulberry32) so shuffles are reproducible in tests. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const song = (n: string) => n.split(' · ')[0];

/** True if no song plays twice in a row (unless one song has more takes than the rest combined). */
function songsKeptApart(names: string[]): boolean {
  for (let i = 1; i < names.length; i++) {
    if (song(names[i]) === song(names[i - 1]) && !names.slice(i).every(n => song(n) === song(names[i]))) return false;
  }
  return true;
}

describe('shufflePlaylist', () => {
  const fake = (name: string): Track => ({ name, genre: 'ambient', bpm: 100, patterns: [], sequence: [] });

  it('never puts takes of one song side by side when that is possible', () => {
    const rand = seeded(7);
    for (let trial = 0; trial < 500; trial++) {
      // random song families, including tight ones where a song holds about half the tracks
      const tracks: Track[] = [];
      const songs = 1 + Math.floor(rand() * 5);
      for (let s = 0; s < songs; s++) {
        const takes = 1 + Math.floor(rand() * 6);
        for (let k = 0; k < takes; k++) tracks.push(fake(k === 0 ? `S${s}` : `S${s} · T${k}`));
      }
      const counts = new Map<string, number>();
      for (const t of tracks) counts.set(song(t.name), (counts.get(song(t.name)) ?? 0) + 1);
      const most = Math.max(...counts.values());
      const out = shufflePlaylist(tracks, rand).map(t => t.name);
      expect(out.slice().sort()).toEqual(tracks.map(t => t.name).sort());
      if (most * 2 <= tracks.length + 1) {
        for (let i = 1; i < out.length; i++) expect(song(out[i])).not.toBe(song(out[i - 1]));
      }
    }
  });

  it('does not open with the song that ended the previous pass', () => {
    const tracks = ['A', 'A · 2', 'B', 'C', 'C · 2'].map(fake);
    for (let seed = 0; seed < 50; seed++) {
      expect(song(shufflePlaylist(tracks, seeded(seed), 'A')[0].name)).not.toBe('A');
    }
  });
});

describe('MusicManager', () => {
  let musicManager: MusicManager;
  let lastTrackName = '';

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAudioContext.currentTime = 0;
    mockAudioContext.state = 'suspended';
    lastTrackName = '';
    musicManager = new MusicManager((name) => {
      lastTrackName = name;
    }, seeded(42));
    // Wait for dynamic imports to finish
    await musicManager.ready;
  });

  it('initializes on the first track of the shuffle', () => {
    expect(musicManager.getTrackName()).toBe(musicManager.getTrackNames()[0]);
  });

  it('shuffles the very first track too', async () => {
    const firsts = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const m = new MusicManager(() => {}, seeded(seed));
      await m.ready;
      firsts.add(m.getTrackName());
    }
    expect(firsts.size).toBeGreaterThanOrEqual(6);
  });

  it('starts playback and updates state', () => {
    const first = musicManager.getTrackName();
    musicManager.start();
    expect(musicManager.isCurrentlyPlaying()).toBe(true);
    expect(mockAudioContext.resume).toHaveBeenCalled();
    expect(lastTrackName).toBe(first);
  });

  it('stops playback', () => {
    musicManager.start();
    musicManager.stop();
    expect(musicManager.isCurrentlyPlaying()).toBe(false);
  });

  it('toggles playback', () => {
    musicManager.toggle();
    expect(musicManager.isCurrentlyPlaying()).toBe(true);
    musicManager.toggle();
    expect(musicManager.isCurrentlyPlaying()).toBe(false);
  });

  it('advances to next track manually', () => {
    const second = musicManager.getTrackNames()[1];
    musicManager.next();
    expect(musicManager.getTrackName()).toBe(second);
    expect(lastTrackName).toBe(second);
  });

  it('plays every track once per pass, keeping takes of one song apart', () => {
    const names = [musicManager.getTrackName()];
    for (let i = 1; i < TRACK_COUNT; i++) { musicManager.next(); names.push(musicManager.getTrackName()); }
    expect(new Set(names).size).toBe(TRACK_COUNT);
    expect(songsKeptApart(names)).toBe(true);
  });

  it('reshuffles after each pass without repeating a song across the seam', () => {
    const passes: string[][] = [];
    for (let p = 0; p < 4; p++) {
      const pass: string[] = [];
      for (let i = 0; i < TRACK_COUNT; i++) { pass.push(musicManager.getTrackName()); musicManager.next(); }
      expect(new Set(pass).size).toBe(TRACK_COUNT);
      passes.push(pass);
    }
    expect(songsKeptApart(passes.flat())).toBe(true);
    expect(new Set(passes.map(p => p.join('|'))).size).toBeGreaterThan(1);
  });

  it('reports each track with its style for the picker', () => {
    const list = musicManager.getTrackList();
    expect(list).toHaveLength(TRACK_COUNT);
    expect(list.find(t => t.name === 'Glass Towers')?.genre).toBe('edm');
    expect(list.find(t => t.name === 'Dusty Roads · Prairie Waltz')?.genre).toBe('country');
    expect(new Set(list.map(t => t.genre))).toEqual(new Set(['ambient', 'country', 'edm']));
  });

  it('lists every track and jumps to a picked one, starting playback', () => {
    expect(musicManager.getTrackNames()).toHaveLength(TRACK_COUNT);
    expect(musicManager.playTrack('Sunrise · Dawn Waltz')).toBe(true);
    expect(musicManager.getTrackName()).toBe('Sunrise · Dawn Waltz');
    expect(musicManager.isCurrentlyPlaying()).toBe(true);
    expect(lastTrackName).toBe('Sunrise · Dawn Waltz');
    // a fresh shuffle of everything else follows the picked track
    const after: string[] = [];
    for (let i = 1; i < TRACK_COUNT; i++) { musicManager.next(); after.push(musicManager.getTrackName()); }
    expect(new Set(after).size).toBe(TRACK_COUNT - 1);
    expect(after).not.toContain('Sunrise · Dawn Waltz');
    expect(songsKeptApart(['Sunrise · Dawn Waltz', ...after])).toBe(true);
    expect(musicManager.playTrack('No Such Song')).toBe(false);
  });

  it('applies and clamps the volume', () => {
    musicManager.setVolume(0.5);
    musicManager.start(); // context created after setVolume: starts at the chosen level
    expect(mockGain.gain.value).toBeCloseTo(0.06);
    musicManager.setVolume(2);
    expect(musicManager.getVolume()).toBe(1);
    expect(mockGain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.12, 0, 0.02);
    musicManager.setVolume(-1);
    expect(musicManager.getVolume()).toBe(0);
  });

  it('plays notes through AudioContext when started', () => {
    musicManager.start();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });
});
