// The chunk layer is redrawn only when `chunkSignature` changes, so the
// signature must take in every layer `paintChunk` reads. If someone draws from
// a new layer and forgets the signature, tiles go stale on screen; this test
// fails instead.

import { describe, it, expect } from 'vitest';
import type { World } from '../sim/World';
import { CHUNK_SIZE } from '../sim/Grid';
import { chunkSignature, paintChunk } from '../render/chunkPainter';
import { buildLivingCity } from './fixtures/testCity';

/** The world, plus a record of which tile layers were read through it. */
function spyOn(world: World): { world: World; seen: Set<string> } {
  const seen = new Set<string>();
  const layers = new Proxy(world.layers, {
    get: (target, name) => { if (typeof name === 'string') seen.add(name); return Reflect.get(target, name); },
  });
  const spy = Object.create(world) as World;
  Object.defineProperty(spy, 'layers', { value: layers });
  return { world: spy, seen };
}

/** A canvas context that accepts anything and draws nothing. */
function blankCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return new Proxy({}, {
    get: (_t, name) => (name === 'canvas' ? { width: 300, height: 300 } : name === 'measureText' ? () => ({ width: 10 }) : noop),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

function variedCity(): World {
  const { world } = buildLivingCity();
  const L = world.layers;
  // Make sure every branch of the painter has something to draw.
  for (let i = 0; i < L.zone.length; i++) {
    if (L.zone[i] === 0) { if (i % 7 === 0) L.vegetation[i] = 1 + (i % 5); continue; }
    if (i % 11 === 0) L.abandoned[i] = 1;
    if (i % 5 === 0) L.pollution[i] = 60;
    L.power[i] = i % 3 === 0 ? 0 : 1;
    L.water[i] = i % 4 === 0 ? 0 : 1;
    L.sewage[i] = i % 6 === 0 ? 0 : 1;
    L.services[i] = i % 2;
  }
  return world;
}

describe('chunk painter', () => {
  it('the signature reads every layer the painter reads', () => {
    const base = variedCity();
    const painted = spyOn(base), signed = spyOn(base);
    const ctx = blankCtx();
    for (let cy = 0; cy < base.grid.chunkRows; cy++) {
      for (let cx = 0; cx < base.grid.chunkCols; cx++) {
        paintChunk(ctx, painted.world, cx, cy, 4);     // small: flat trees
        paintChunk(ctx, painted.world, cx, cy, 24);    // large
        chunkSignature(signed.world, cx, cy);
      }
    }
    expect(painted.seen.size).toBeGreaterThan(8);      // the spy is working
    const missing = [...painted.seen].filter((name) => !signed.seen.has(name));
    expect(missing).toEqual([]);
  });

  it('the signature changes when a drawn layer changes, and not for sim noise', () => {
    const world = variedCity();
    const tile = world.grid.idx(60, 60);               // downtown, in chunk (3, 3)
    const cx = (60 / CHUNK_SIZE) | 0, cy = (60 / CHUNK_SIZE) | 0;
    const before = chunkSignature(world, cx, cy);

    world.layers.crime[tile] = 200;                    // shown as badges, not in the chunk
    world.layers.congestion[tile] = 99;
    expect(chunkSignature(world, cx, cy)).toBe(before);

    world.layers.devLevel[tile] = (world.layers.devLevel[tile] % 3) + 1;
    expect(chunkSignature(world, cx, cy)).not.toBe(before);
  });
});
