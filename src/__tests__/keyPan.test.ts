import { describe, it, expect } from 'vitest';
import { KeyPan, panDirection, panStep, panKeyOf, PAN_SPEED, TAP_MS, type PanKey } from '../input/keyPan';

const set = (...k: PanKey[]) => new Set<PanKey>(k);

describe('arrow-key panning', () => {
  it('maps arrows to directions; opposite keys cancel; diagonals keep the speed', () => {
    expect(panKeyOf('ArrowLeft')).toBe('left');
    expect(panKeyOf('a')).toBeUndefined();
    expect(panDirection(set())).toEqual({ x: 0, y: 0 });
    expect(panDirection(set('right'))).toEqual({ x: 1, y: 0 });
    expect(panDirection(set('left', 'right'))).toEqual({ x: 0, y: 0 });
    const d = panDirection(set('right', 'up'));
    expect(d.x).toBeCloseTo(Math.SQRT1_2); expect(d.y).toBeCloseTo(-Math.SQRT1_2);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  });
  it('steps by frame time at a steady screen speed, and a stalled frame is capped', () => {
    expect(panStep({ x: 1, y: 0 }, 0.5).x).toBeCloseTo(PAN_SPEED * 0.1);   // capped at 0.1 s
    expect(panStep({ x: 1, y: 0 }, 0.016).x).toBeCloseTo(PAN_SPEED * 0.016);
    expect(panStep({ x: 0, y: 1 }, 0.016).y).toBeCloseTo(PAN_SPEED * 0.016);
    expect(panStep({ x: 1, y: 0 }, -1).x).toBe(0);
  });
  it('a quick tap nudges on release; a hold pans smoothly and does not nudge', () => {
    const k = new KeyPan();
    k.press('left', 1000);
    expect(k.direction(1000 + TAP_MS - 1)).toEqual({ x: 0, y: 0 });   // not panning yet
    expect(k.release('left', 1000 + TAP_MS - 1)).toEqual({ x: -1, y: 0 });
    k.press('down', 0); k.press('right', 0);
    expect(k.direction(TAP_MS + 1).y).toBeGreaterThan(0);
    expect(k.direction(TAP_MS + 1).x).toBeGreaterThan(0);
    expect(k.release('down', TAP_MS + 1)).toBeNull();
    k.clear();
    expect(k.direction(10_000)).toEqual({ x: 0, y: 0 });
  });
});
