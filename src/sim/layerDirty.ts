// Telling the renderer what a system changed in a layer it rewrites whole.
//
// Power, water, sewage and service coverage are worked out afresh for the
// whole map, usually to the same answer. They used to mark every chunk dirty
// on every tick, which made the renderer check every visible chunk every
// frame and sent `world.grid.edits` up every tick, so nothing that remembers
// the map by `edits` was ever kept (outside code review, 2026-11-21, P1).
// Now each keeps the layer as it last left it and marks only the chunks that
// hold a tile that changed: none, on most ticks.

import type { World } from './World';

interface Kept { bytes: Uint8Array; words: Uint32Array; now: Uint32Array }
const before = new WeakMap<Uint8Array, Kept>();

/**
 * Mark dirty each chunk that holds a tile of `layer` that changed since this
 * was last called for that layer. The first call for a layer marks every
 * chunk. The layers are compared four tiles at a time, so a tick on which
 * nothing changed costs a quarter of a pass over the map.
 */
export function markLayerChanges(world: World, layer: Uint8Array): void {
  let kept = before.get(layer);
  if (!kept || kept.bytes.length !== layer.length) {
    const bytes = layer.slice();
    const whole = layer.length >> 2;
    kept = { bytes, words: new Uint32Array(bytes.buffer, bytes.byteOffset, whole), now: new Uint32Array(layer.buffer, layer.byteOffset, whole) };
    before.set(layer, kept);
    world.grid.markAllDirty();
    return;
  }
  const { bytes, words, now } = kept;
  const width = world.grid.width;
  for (let w = 0, n = words.length; w < n; w++) {
    if (now[w] === words[w]) continue;
    // Some tile of these four changed: mark each that did (they may straddle a chunk).
    for (let i = w << 2, end = i + 4; i < end; i++) {
      if (layer[i] !== bytes[i]) { bytes[i] = layer[i]; const x = i % width; world.grid.markDirty(x, (i - x) / width); }
    }
  }
  for (let i = words.length << 2; i < layer.length; i++) {
    if (layer[i] !== bytes[i]) { bytes[i] = layer[i]; const x = i % width; world.grid.markDirty(x, (i - x) / width); }
  }
}
