import { describe, it, expect } from 'vitest';
import type { SfxName } from '../audio/sfx/sounds';
import { SoundEffects } from '../audio/SoundEffects';
import { Camera } from '../render/Camera';
import { BUILDING_STATION } from '../sim/constants';
import { landWorld } from './pcTestWorld';

// The rail sounds against the real trains (render/clay/trains.ts): a line with a station on it.

class Recorder extends SoundEffects {
  played: { name: SfxName; at: number }[] = [];
  now = 0;
  protected override output(name: SfxName): void { this.played.push({ name, at: this.now }); }
}

describe('rail sounds with real trains', () => {
  it('rumbles as trains come into view, then sighs and rings the bell as one stops at the platform', () => {
    const w = landWorld(40); w.budget.money = 1_000_000;
    for (let x = 2; x <= 30; x++) if (x < 14 || x > 17) expect(w.layTrack(x, 10)).toBe(true);
    expect(w.placeBuilding(14, 9, BUILDING_STATION, 0)).toBe(true);
    const camera = new Camera(800, 600);
    camera.zoom = 2;
    camera.centerOnTile(16, 10);
    const fx = new Recorder({ camera, getWorld: () => w, getSpeed: () => 1 });
    for (let t = 0; t < 180_000; t += 250) { fx.now = t; (fx as any).listenTrains(w, t); }
    const names = fx.played.map(p => p.name);
    expect(names).toContain('railRumble');
    expect(names).toContain('trainSigh');
    expect(names).toContain('trainBell');
    // Each bell follows a sigh by a few seconds: the train slows in, then stops.
    for (const bell of fx.played.filter(p => p.name === 'trainBell')) {
      const sigh = fx.played.filter(p => p.name === 'trainSigh' && p.at <= bell.at).pop();
      expect(sigh).toBeDefined();
      expect(bell.at - sigh!.at).toBeLessThan(6000);
    }
    // Throttled: never two bells within 5 s, however busy the station.
    const bells = fx.played.filter(p => p.name === 'trainBell').map(p => p.at);
    for (let i = 1; i < bells.length; i++) expect(bells[i] - bells[i - 1]).toBeGreaterThanOrEqual(5000);
  });
});
