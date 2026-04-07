import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicManager } from '../audio/MusicManager';

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

(global as any).AudioContext = MockAudioContext;
(global as any).window = {
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

  it('loops back to first track after the last one', () => {
    // 5 tracks total
    musicManager.next(); // 2: Dusty Roads
    musicManager.next(); // 3: Neon Metropolis
    musicManager.next(); // 4: Rainy Day
    musicManager.next(); // 5: Sunrise
    musicManager.next(); // 1: Cloudy Sky
    expect(musicManager.getTrackName()).toBe('Cloudy Sky');
  });

  it('plays notes through AudioContext when started', () => {
    musicManager.start();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });
});
