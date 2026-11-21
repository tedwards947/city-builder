// Inspect on an outside connection point: joined or not, then what travels through it.

import { describe, it, expect } from 'vitest';
import { connectionRows } from '../ui/TileInfoPanel';
import { resetConnections } from '../sim/connections';
import { ROAD_HIGHWAY, ROAD_NONE } from '../sim/constants';
import { landWorld } from './pcTestWorld';

const SIZE = 128, ROW = 64, POINT = ROW * SIZE;

describe('connection point rows', () => {
  it('says to build a highway when the point is not joined, and shows trade once it is', () => {
    const w = landWorld(SIZE);
    for (let x = 0; x <= 8; x++) w.setRoad(x, ROW, ROAD_HIGHWAY);
    resetConnections(w);
    const joined = connectionRows(w, POINT);
    expect(joined).toContain('Joined to the outside');
    expect(joined).toContain('Visitors arriving');
    expect(joined).toContain('Export trucks out');
    expect(joined).toContain('Residents travelling out');
    expect(joined).not.toContain('Build a highway');

    w.setRoad(0, ROW, ROAD_NONE);
    const open = connectionRows(w, POINT);
    expect(open).toContain('Build a highway onto this tile to join it');
    expect(open).not.toContain('Visitors arriving');
  });

  it('shows nothing on an ordinary tile', () => {
    expect(connectionRows(landWorld(SIZE), POINT + 1)).toBe('');
  });
});
