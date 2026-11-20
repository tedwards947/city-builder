import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOOPS, SOUNDS } from '../audio/sfx/sounds';
import type { SfxName } from '../audio/sfx/sounds';
import { SoundEffects } from '../audio/SoundEffects';
import { World } from '../sim/World';
import { Camera } from '../render/Camera';
import { RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY } from '../sim/constants';

// Trains in view come from the renderer (render/clay/trains.ts); here a test sets them directly.
const rail = vi.hoisted(() => ({ trains: [] as { x: number; y: number; a: number; phase: string; key: string }[], levels: [] as number[] }));
vi.mock('../render/clay/trains', () => ({
  TRAIN_MIN_TILE: 6,
  trainsInView: (_w: unknown, _now: number, _x0: number, _y0: number, _x1: number, _y1: number, level: number) => {
    rail.levels.push(level);
    return level === 1 ? rail.trains : [];
  },
}));

// ── A minimal stand-in for an AudioContext: enough to schedule every sound ───

function param() {
  return {
    value: 0,
    setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
  };
}
function node(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), ...extra };
}
function mockContext() {
  const made = { oscillators: 0, sources: 0 };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: node(),
    createGain: () => node({ gain: param() }),
    createOscillator: () => { made.oscillators++; return node({ type: 'sine', frequency: param(), detune: param() }); },
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(), Q: param() }),
    createBufferSource: () => { made.sources++; return node({ buffer: null, loop: false }); },
    createBuffer: (_ch: number, len: number) => { const data = [new Float32Array(len), new Float32Array(len)]; return { getChannelData: (c: number) => data[c] }; },
    createStereoPanner: () => node({ pan: param() }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

describe('sound recipes', () => {
  it('every one-shot schedules nodes on a context without errors', () => {
    for (const [name, sound] of Object.entries(SOUNDS)) {
      const { ctx, made } = mockContext();
      sound.play(ctx, ctx.destination as unknown as AudioNode, 0, 2);
      expect(made.oscillators + made.sources, name).toBeGreaterThan(0);
      expect(sound.len, name).toBeGreaterThan(0);
      expect(sound.len, name).toBeLessThan(name === 'railRumble' ? 10 : 3);   // a far-off train is a long swell
    }
  });

  it('every loop starts, follows its parameter, schedules events and stops', () => {
    for (const [name, loop] of Object.entries(LOOPS)) {
      const { ctx, made } = mockContext();
      const out = ctx.destination as unknown as AudioNode;
      const h = loop.start(ctx, out, 0.5);
      h.set(0.8);
      loop.events(ctx, out, 0, 10, 1);
      h.stop(1);
      expect(made.sources, name).toBeGreaterThan(0);
    }
  });
});

// ── The manager: which sound each event plays, without audio ────────────────

class Recorder extends SoundEffects {
  played: { name: SfxName; gain: number; pan?: number; arg?: number }[] = [];
  protected override output(name: SfxName, gain: number, pan: number | undefined, arg: number | undefined): void {
    this.played.push({ name, gain, pan, arg });
  }
  names(): SfxName[] { return this.played.map(p => p.name); }
}

describe('SoundEffects', () => {
  let world: World, camera: Camera, speed: number, fx: Recorder;
  beforeEach(() => {
    world = new World(64, 64, 7);
    camera = new Camera(800, 600);
    camera.centerOnTile(32, 32);
    speed = 1;
    fx = new Recorder({ camera, getWorld: () => world, getSpeed: () => speed });
    (fx as any).tick();   // attaches to the world
  });

  it('plays the kalimba up for PC won and down for PC spent', () => {
    world.events.emit('pcAction', { delta: 2, undo: false });
    world.events.emit('pcAction', { delta: -1.5, undo: false });
    world.events.emit('pcAction', { delta: -1.5, undo: false });   // too soon after the last: throttled
    expect(fx.names()).toEqual(['pcGain', 'pcSpend']);
  });

  it('plays the fanfare for a milestone and ducks the music', () => {
    const duck = vi.fn();
    fx.setMusic({ duck });
    world.events.emit('populationMilestone', { population: 1000, reward: 5 });
    expect(fx.names()).toEqual(['milestone']);
    expect(duck).toHaveBeenCalledOnce();
  });

  it('throttles frequent sounds such as growth', () => {
    world.events.emit('tileDeveloped', { tx: 32, ty: 32, zone: 1, level: 1 });
    world.events.emit('tileDeveloped', { tx: 33, ty: 32, zone: 1, level: 2 });
    expect(fx.names()).toEqual(['grows']);
  });

  it('skips minor sounds off screen and plays important ones quieter and to the side', () => {
    world.events.emit('tileDeveloped', { tx: 0, ty: 0, zone: 1, level: 1 });
    expect(fx.names()).toEqual([]);
    world.events.emit('fireIgnition', { tx: 63, ty: 32, zone: 1, devLevel: 1 });
    const fire = fx.played[0];
    expect(fire.name).toBe('fireStart');
    expect(fire.gain).toBeLessThan(1);
    expect(fire.pan).toBeGreaterThan(0);
  });

  it('places a sound from the middle of the screen at full volume', () => {
    const s = fx.spatial(32, 32);
    expect(s.onScreen).toBe(true);
    expect(s.gain).toBe(1);
    expect(Math.abs(s.pan)).toBeLessThan(0.1);
  });

  it('uses Clay tap for build tools and Soft tick for view tools', () => {
    fx.toolPicked('road');
    (fx as any).lastPlayed.clear();
    fx.toolPicked('inspect');
    expect(fx.names()).toEqual(['clayTap', 'softTick']);
  });

  it('winds down on pause and winds up at the pace of the speed picked', () => {
    speed = 0; (fx as any).tick();
    speed = 2; (fx as any).tick();
    speed = 3; (fx as any).tick();
    speed = 1; (fx as any).tick();
    expect(fx.played.map(p => [p.name, p.arg])).toEqual([['pause', undefined], ['resume', 2], ['resume', 3], ['resume', 1]]);
  });

  it('plays a road built in one go as a roll ending in the heavier press', async () => {
    for (let i = 0; i < 5; i++) world.events.emit('roadBuilt', { tx: i, ty: 0, cost: 10 });
    await new Promise(r => setTimeout(r, 0));
    expect(fx.names().filter(n => n === 'roadTile')).toHaveLength(5);
    expect(fx.names().at(-1)).toBe('roadDone');
  });

  it('keeps build sounds quiet right after an undo', () => {
    fx.undo(true);
    world.events.emit('buildingPlaced', { tx: 32, ty: 32, kind: 1, cost: 100 });
    expect(fx.names()).toEqual(['undo']);
  });

  it('a passing multiplier (the title screen) quietens the effects without touching the player\'s FX setting', () => {
    fx.setVolume(0.5);
    expect(fx.level).toBeCloseTo(0.5);
    fx.setScale(0.4);
    expect(fx.level).toBeCloseTo(0.2);
    expect(fx.getVolume()).toBe(0.5);                       // the slider's value is as the player left it
    fx.setVolume(1);                                        // moving the slider while it is on still works
    expect(fx.level).toBeCloseTo(0.4);
    fx.setScale(1);
    expect(fx.level).toBe(1);
    expect(fx.getVolume()).toBe(1);
  });

  it('follows a new or loaded world and lets go of the old one', () => {
    const old = world;
    world = new World(64, 64, 8);
    (fx as any).tick();
    old.events.emit('requestOpened', { id: 1, kind: 'park', x0: 0, y0: 0, x1: 1, y1: 1, deadlineTick: 10 });
    expect(fx.names()).toEqual([]);
    world.events.emit('requestOpened', { id: 1, kind: 'park', x0: 0, y0: 0, x1: 1, y1: 1, deadlineTick: 10 });
    expect(fx.names()).toEqual(['requestOpened']);
  });

  describe('trains', () => {
    const train = (key: string, phase: string, x = 32.5, y = 32.5) => ({ x, y, a: 1, phase, key });
    const listen = (now: number) => (fx as any).listenTrains(world, now);
    beforeEach(() => { rail.trains = []; rail.levels = []; camera.zoom = 2; camera.centerOnTile(32, 32); });

    it('hears a train coming into view as a distant rumble, once, on the ambience', () => {
      expect(RAIL_GROUND).toBe(1);
      rail.trains = [train('a', 'run')];
      listen(0); listen(250); listen(500);
      expect(fx.names().filter(n => n === 'railRumble')).toEqual(['railRumble']);
      expect(fx.played.find(p => p.name === 'railRumble')!.gain).toBe(1);
    });

    it('rumbles again every 25 s for a train that keeps running on screen', () => {
      const clock = vi.spyOn(performance, 'now');
      try {
        rail.trains = [train('t1', 'run')];
        for (let t = 0; t <= 60_000; t += 250) { clock.mockReturnValue(t); listen(t); }
        expect(fx.names().filter(n => n === 'railRumble')).toHaveLength(3);   // at 0, 25 and 50 s
      } finally { clock.mockRestore(); }
    });

    it('sighs as a station train slows in and rings the bell as it stops', () => {
      rail.trains = [train('s', 'in')];
      listen(10_000); listen(11_000);
      expect(fx.names()).not.toContain('trainSigh');
      listen(11_600);
      expect(fx.names()).toContain('trainSigh');
      rail.trains = [train('s', 'dwell')];
      listen(12_000); listen(12_250);
      expect(fx.names().filter(n => n === 'trainBell')).toEqual(['trainBell']);
      expect(fx.names().filter(n => n === 'trainSigh')).toEqual(['trainSigh']);
    });

    it('stays silent for trains off screen, and when zoomed out too far to draw them', () => {
      rail.trains = [train('far', 'run', 2, 2)];
      listen(0);
      expect(fx.names()).not.toContain('railRumble');
      camera.zoom = 0.05;
      rail.trains = [train('b', 'run')];
      listen(5000);
      expect(fx.names()).not.toContain('railRumble');
    });

    it('listens to ground and elevated track, not the subway', () => {
      listen(0);
      expect(rail.levels).toEqual([RAIL_GROUND, RAIL_ELEVATED]);
      expect(rail.levels).not.toContain(RAIL_SUBWAY);
    });
  });
});
