import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicManager } from '../audio/MusicManager';

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
    });
    // Wait for dynamic imports to finish
    await musicManager.ready;
  });

  it('initializes and can get track name', () => {
    // Tracks are sorted alphabetically: Cloudy Sky, Dusty Roads, Neon Metropolis, Rainy Day, Sunrise
    expect(musicManager.getTrackName()).toBe('Cloudy Sky');
  });

  it('starts playback and updates state', () => {
    musicManager.start();
    expect(musicManager.isCurrentlyPlaying()).toBe(true);
    expect(mockAudioContext.resume).toHaveBeenCalled();
    expect(lastTrackName).toBe('Cloudy Sky');
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
    musicManager.next();
    expect(musicManager.getTrackName()).toBe('Dusty Roads');
    expect(lastTrackName).toBe('Dusty Roads');
  });

  it('plays the originals first, then rotates songs so none repeats back to back', () => {
    const names = [musicManager.getTrackName()];
    for (let i = 1; i < TRACK_COUNT; i++) { musicManager.next(); names.push(musicManager.getTrackName()); }
    expect(names.slice(0, 8)).toEqual([
      'Cloudy Sky', 'Dusty Roads', 'Glass Towers', 'Neon Metropolis · Skyline Trance',
      'Night Shift', 'Rainy Day', 'Rush Hour', 'Sunrise',
    ]);
    expect(new Set(names).size).toBe(TRACK_COUNT);
    const song = (n: string) => n.split(' · ')[0];
    for (let i = 1; i < names.length; i++) {
      // the only allowed repeat is when one song has more takes than all the others
      if (song(names[i]) === song(names[i - 1])) expect(names.slice(i).every(n => song(n) === song(names[i]))).toBe(true);
    }
  });

  it('loops back to first track after the last one', () => {
    for (let i = 0; i < TRACK_COUNT; i++) musicManager.next();
    expect(musicManager.getTrackName()).toBe('Cloudy Sky');
  });

  it('lists every track and jumps to a picked one, starting playback', () => {
    const names = musicManager.getTrackNames();
    expect(names).toHaveLength(TRACK_COUNT);
    expect(musicManager.playTrack('Sunrise · Dawn Waltz')).toBe(true);
    expect(musicManager.getTrackName()).toBe('Sunrise · Dawn Waltz');
    expect(musicManager.isCurrentlyPlaying()).toBe(true);
    expect(lastTrackName).toBe('Sunrise · Dawn Waltz');
    // the playlist carries on from the picked track
    musicManager.next();
    expect(musicManager.getTrackName()).toBe(names[names.indexOf('Sunrise · Dawn Waltz') + 1]);
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
