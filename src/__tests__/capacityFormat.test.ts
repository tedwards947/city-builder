import { describe, it, expect } from 'vitest';
import { seatWords, seatsView, homeSeatState } from '../ui/capacityFormat';
import { BUILDING_SCHOOL, BUILDING_HOSPITAL } from '../sim/constants';

describe('capacity words', () => {
  it('gives schools seats and hospitals beds', () => {
    expect(seatWords(BUILDING_SCHOOL)).toBe('ui.capacity.seat');
    expect(seatWords(BUILDING_HOSPITAL)).toBe('ui.capacity.bed');
  });
});

describe('seatsView', () => {
  it('is null for a kind with no limit', () => {
    expect(seatsView({ capacity: 0, seated: 300, inReachUnseated: 0 })).toBeNull();
  });
  it('shows the places taken and free', () => {
    expect(seatsView({ capacity: 2000, seated: 1640, inReachUnseated: 0 })).toEqual({ figure: '1,640 / 2,000', fill: 0.82, full: false, free: 360, leftOut: 0 });
  });
  it('is full at capacity, and when a home is turned away with a few places left', () => {
    expect(seatsView({ capacity: 2000, seated: 2000, inReachUnseated: 310 })).toMatchObject({ full: true, free: 0, leftOut: 310 });
    expect(seatsView({ capacity: 60, seated: 58, inReachUnseated: 24 })).toMatchObject({ full: true, free: 2, leftOut: 24 });
  });
});

describe('homeSeatState', () => {
  it('tells full from out of reach', () => {
    expect(homeSeatState({ seatedAt: { tx: 1, ty: 2 }, reason: null })).toBe('has');
    expect(homeSeatState({ seatedAt: null, reason: 'full' })).toBe('full');
    expect(homeSeatState({ seatedAt: null, reason: 'outOfReach' })).toBe('outOfReach');
  });
});
