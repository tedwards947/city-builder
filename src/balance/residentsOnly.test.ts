import { describe, it, expect, vi } from 'vitest';

let gateway = false;
vi.mock('../sim/leisureTraffic', async (orig) => {
  const real = await orig<typeof import('../sim/leisureTraffic')>();
  return { ...real, hasGateway: () => gateway };
});

import { residentsOnlyWarning } from '../ui/ToastPanel';
import { BUILDING_MUSEUM, BUILDING_POLICE } from '../sim/constants';

describe('residents-only warning', () => {
  const world = {} as never;
  it('fires for the museum with no airport', () => {
    gateway = false;
    expect(residentsOnlyWarning(world, BUILDING_MUSEUM)).toBe(true);
  });
  it('does not fire for a police station', () => {
    gateway = false;
    expect(residentsOnlyWarning(world, BUILDING_POLICE)).toBe(false);
  });
  it('does not fire when a gateway exists', () => {
    gateway = true;
    expect(residentsOnlyWarning(world, BUILDING_MUSEUM)).toBe(false);
  });
});

import { eventDayToast } from '../ui/ToastPanel';
describe('game-day toast', () => {
  it('nothing when nobody wanted to come', () => {
    expect(eventDayToast({ wanted: 0, arrived: 0, stuckResidents: 0, pc: 0, declined: 0 })).toBeNull();
  });
  it('info when it went well', () => {
    const r = eventDayToast({ wanted: 50, arrived: 48, stuckResidents: 0, pc: 0, declined: 0 })!;
    expect(r.type).toBe('info');
    expect(r.text).toBe('48 of 50 fans made kick-off.');
  });
  it('warning with stuck residents and declined homes', () => {
    const r = eventDayToast({ wanted: 50, arrived: 30, stuckResidents: 120, pc: 1.2, declined: 2 })!;
    expect(r.type).toBe('warning');
    expect(r.text).toBe('30 of 50 fans made kick-off. 120 residents were stuck in the traffic (−◆1.2). 2 homes lost a level.');
  });
});

import { seatWords } from '../ui/capacityFormat';
import { unmetKey } from '../ui/requestInfo';
import { BUILDING_FIRE } from '../sim/constants';
describe('police and fire words', () => {
  it('have their own cover strings', () => {
    expect(seatWords(BUILDING_POLICE)).toBe('ui.capacity.police');
    expect(seatWords(BUILDING_FIRE)).toBe('ui.capacity.fire');
  });
  it('give a "full" reason for police and fire requests', () => {
    expect(unmetKey('police', 'full')).toBe('ui.requests.unmet.full.police');
    expect(unmetKey('fire', 'full')).toBe('ui.requests.unmet.full.fire');
  });
});
