import './pcOffBaseline';
import { describe, it, expect } from 'vitest';
import { areaName, progressPercents, unmetKey } from '../ui/requestInfo';
import { t } from '../i18n';
import { requestLogShown, requestLogState } from '../ui/RequestLog';
import { Camera } from '../render/Camera';
import { TILE_SIZE } from '../render/Projection';
import { landWorld } from './pcTestWorld';

describe('quest log', () => {
  it('names where an area is by thirds of the map', () => {
    const w = landWorld(36);
    const at = (x: number, y: number) => areaName(w, { x0: x, y0: y, x1: x + 5, y1: y + 5 });
    expect(at(0, 0)).toBe('nw');
    expect(at(15, 0)).toBe('n');
    expect(at(30, 15)).toBe('e');
    expect(at(15, 15)).toBe('centre');
    expect(at(0, 30)).toBe('sw');
    expect(at(30, 30)).toBe('se');
  });

  it('never shows an open request as having reached its target', () => {
    expect(progressPercents({ covered: 0.6, coveredNeeded: 0.75, met: false })).toEqual({ covered: 60, needed: 75 });
    expect(progressPercents({ covered: 0.7499, coveredNeeded: 0.75, met: false })).toEqual({ covered: 74, needed: 75 });
    // The engine's rule can lag the raw figure by a hair: until it says met, stay one short.
    expect(progressPercents({ covered: 0.75, coveredNeeded: 0.75, met: false })).toEqual({ covered: 74, needed: 75 });
    expect(progressPercents({ covered: 0.8, coveredNeeded: 0.75, met: true })).toEqual({ covered: 80, needed: 75 });
  });

  it('says why the asking homes still lack the service', () => {
    expect(t(unmetKey('school', 'full')!)).toBe('nearby schools are full');
    expect(t(unmetKey('hospital', 'outOfReach')!)).toBe('no hospital in reach');
    expect(unmetKey('school', null)).toBeNull();
    expect(unmetKey('park', 'full')).toBeNull();          // parks have no seats
    // Every kind the engine can give a reason for has a string.
    for (const k of ['park', 'police', 'fire', 'school', 'hospital']) expect(t(unmetKey(k, 'outOfReach')!)).not.toContain('ui.');
  });

  it('shows its tile only when requests can happen or one is open', () => {
    requestLogState.open = 0;
    expect(requestLogShown()).toBe(false);      // shipped: spawning is off
    requestLogState.open = 1;
    expect(requestLogShown()).toBe(true);       // one opened by hand from the debug panel
    requestLogState.open = 0;
  });
});

describe('camera focus', () => {
  const centre = (c: Camera) => [(c.x + c.viewportW / (2 * c.zoom)) / TILE_SIZE, (c.y + c.viewportH / (2 * c.zoom)) / TILE_SIZE];

  it('centres on an area and keeps the zoom when it fits', () => {
    const c = new Camera(1200, 800);
    c.zoom = 2;
    c.focusOn(24, 36, 35, 47);
    expect(c.zoom).toBe(2);
    expect(centre(c)[0]).toBeCloseTo(30);
    expect(centre(c)[1]).toBeCloseTo(42);
  });

  it('zooms out just enough for an area that would not fit', () => {
    const c = new Camera(600, 400);
    c.zoom = 4;
    c.focusOn(0, 0, 11, 11);                    // 12 tiles = 192 world px; 70% of 400 px high → zoom ≈ 1.46
    expect(c.zoom).toBeCloseTo(400 * 0.7 / (12 * TILE_SIZE));
    expect(centre(c)[0]).toBeCloseTo(6);
  });

  it('centres on a single tile', () => {
    const c = new Camera(1200, 800);
    c.focusOn(10, 20, 10, 20);
    expect(centre(c)[0]).toBeCloseTo(10.5);
    expect(centre(c)[1]).toBeCloseTo(20.5);
  });
});
