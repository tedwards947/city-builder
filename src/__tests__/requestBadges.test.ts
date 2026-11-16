import { describe, it, expect } from 'vitest';
import { layoutRequestBadges, timeLeft, REQUEST_BADGE_R } from '../render/clay/requestBadges';
import { daysLeft, requestText } from '../ui/RequestFeedback';
import type { OpenRequest } from '../sim/requests';
import { requestConfig } from '../sim/requests';
import { BALANCE } from '../data/balance';

const req = (id: number, x0: number, y0: number, deadlineTick: number, kind = 'park'): OpenRequest =>
  ({ id, kind, x0, y0, x1: x0 + 11, y1: y0 + 11, openedTick: 0, deadlineTick });
const at = (ts: number) => (tx: number, ty: number) => ({ x: tx * ts, y: ty * ts });

describe('resident request badges', () => {
  it('puts a badge at the centre of each asking area', () => {
    const [b] = layoutRequestBadges([req(1, 0, 12, 80)], 20, at(10));
    expect([b.x, b.y]).toEqual([60, 180]);
    expect(b.count).toBe(1);
    expect(b.r).toBe(REQUEST_BADGE_R);
    expect(b.left).toBeCloseTo(0.75);
  });

  it('merges badges that would overlap, showing the one that runs out first', () => {
    const far = layoutRequestBadges([req(1, 0, 0, 80), req(2, 12, 0, 40)], 0, at(10));
    expect(far).toHaveLength(2);
    // Zoomed out, the two neighbouring areas are a few pixels apart.
    const near = layoutRequestBadges([req(1, 0, 0, 80, 'park'), req(2, 12, 0, 40, 'utilities')], 0, at(1));
    expect(near).toHaveLength(1);
    expect(near[0].count).toBe(2);
    expect(near[0].request.id).toBe(2);
    expect(near[0].request.kind).toBe('utilities');
  });

  it('counts time left from 1 down to 0 and no further', () => {
    const r = req(1, 0, 0, 80);
    expect(timeLeft(r, 0)).toBe(1);
    expect(timeLeft(r, 80)).toBe(0);
    expect(timeLeft(r, 200)).toBe(0);
  });

  it('words a request: what, how long, what is at stake', () => {
    expect(daysLeft(80, 0)).toBe(80 / BALANCE.ticksPerDay);
    expect(daysLeft(80, 79)).toBe(1);
    expect(daysLeft(80, 500)).toBe(0);
    const park = requestConfig().kinds.park, was = { ...park };
    Object.assign(park, { days: 10, reward: 12, penalty: 4 });
    try {
      const text = requestText({ kind: 'park', deadlineTick: 80 }, 0);
      expect(text.title).toBe('Residents want: a park');
      expect(text.stakes).toBe('10 days left · met: +◆ 12 · missed: −◆ 4');
    } finally { Object.assign(park, was); }
    // With no numbers set there is nothing at stake to list.
    expect(requestText({ kind: 'park', deadlineTick: 80 }, 0).stakes).toBe('10 days left');
  });
});
