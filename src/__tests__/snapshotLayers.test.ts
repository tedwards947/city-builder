// snapshotTile must cover every layer the player's edits change. A new layer has to be
// listed here, as snapshotted or as derived, so it can't be forgotten from undo.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { snapshotTile, type TileSnapshot } from '../commands/Command';

/** Layer -> the TileSnapshot field that holds it. */
const SNAPSHOT: Record<string, keyof TileSnapshot> = {
  zone: 'zone', roadClass: 'road', rail: 'rail', building: 'building', devLevel: 'dev',
  abandoned: 'abandoned', distress: 'distress', vegetation: 'vegetation',
  visualVariant: 'visualVariant', lot: 'lot',
};

/** Layers the sims recompute (coverage, pollution, traffic, vibes…) or that nothing the player edits sets. Not snapshotted on purpose. */
const DERIVED = [
  'terrain', 'power', 'water', 'sewage', 'services', 'landValue', 'roadNet', 'pollution', 'crime',
  'police', 'congestion', 'accessibility', 'fireRisk', 'fire', 'fireStation', 'school', 'education',
  'hospital', 'sickness', 'recentDeath', 'vibeEgalitarian', 'vibeGreen', 'vibePlanned',
];

describe('snapshotTile covers every layer', () => {
  it('every layer is either snapshotted or listed as derived', () => {
    const all = Object.keys(new World(8, 8, 1).layers).sort();
    expect(all).toEqual([...Object.keys(SNAPSHOT), ...DERIVED].sort());
  });

  it('records each snapshotted layer', () => {
    const w = new World(8, 8, 1);
    const i = w.grid.idx(3, 3);
    let v = 7;
    for (const layer of Object.keys(SNAPSHOT)) { (w.layers as unknown as Record<string, Uint8Array>)[layer][i] = v++; }
    const snap = snapshotTile(w, 3, 3);
    v = 7;
    for (const [layer, field] of Object.entries(SNAPSHOT)) expect(snap[field], layer).toBe(v++);
  });
});
