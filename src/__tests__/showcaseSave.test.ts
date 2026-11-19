// The title screen's showcase city (public/showcase/showcase.citysave.json) is
// the owner's hand-built city, with focus markers for the camera tour. It
// loads as an ordinary save and the tour can frame every marker. If the save
// format changes so that this fails, open the file in the game, save it again
// and replace it. (`npm run gen-showcase` builds a generated city instead; it
// is no longer what ships.)

import { describe, it, expect } from 'vitest';
import text from '../../public/showcase/showcase.citysave.json?raw';
import { decodeSaveFile } from '../persistence/SaveFile';
import { SAVE_VERSION } from '../persistence/SaveFormat';
import { deserialize } from '../persistence/Serializer';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { focusMarkers } from '../sim/markers';
import { findTourSpots } from '../title/tourSpots';

describe('the showcase city', () => {
  const file = decodeSaveFile(text);
  const w = deserialize(file.snapshot, { bootstrapVibes: (x) => new VibeSystem().bootstrapVibes(x) });

  it('loads at the current save version with money in the bank', () => {
    expect(file.version).toBe(SAVE_VERSION);
    expect(w.budget.money).toBeGreaterThan(0);
  });

  it('has focus markers, all on the map, and the tour visits them', () => {
    const marks = focusMarkers(w);
    expect(marks.length).toBeGreaterThanOrEqual(1);
    for (const m of marks) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x).toBeLessThan(w.grid.width);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeLessThan(w.grid.height);
    }
    const spots = findTourSpots(w);
    for (const m of marks) expect(spots.some(s => s.kind === 'focus' && s.tx === m.x && s.ty === m.y)).toBe(true);
  });

  it('stays a reasonable size to ship', () => {
    expect(text.length).toBeLessThan(4_000_000);
  });
});
