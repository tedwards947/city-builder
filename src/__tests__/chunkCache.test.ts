// The renderer's static chunk layer is redrawn only when a chunk's visible
// content changes, not on every sim tick or every dirty mark.

import { describe, it, expect, vi } from 'vitest';
import { World } from '../sim/World';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { CHUNK_SIZE } from '../sim/Grid';
import { ZONE_R, ROAD_STREET } from '../sim/constants';

function setup() {
  const world = new World(64, 64, 1);
  const noop = vi.fn();
  const mockCtx = new Proxy({}, {
    get: (_t, prop) => (prop === 'measureText' ? () => ({ width: 10 }) : prop === 'canvas' ? { width: 1, height: 1 } : noop),
    set: () => true,
  }) as any;
  const renderer = new CanvasRenderer({ getContext: () => mockCtx, width: 800, height: 600 } as any);

  // Two chunks wide, one tall, until `view` is changed.
  const view = { x0: 0, y0: 0, x1: CHUNK_SIZE * 2 - 1, y1: CHUNK_SIZE - 1 };
  const camera = {
    visibleTileBounds: () => view,
    worldToScreenX: () => 0,
    worldToScreenY: () => 0,
    zoom: 1, x: 0, y: 0, viewportW: 800, viewportH: 600,
  } as any;

  // No DOM in node: hand out a mock chunk context and count chunk redraws.
  const r = renderer as any;
  r._getOrCreateChunkCtx = () => mockCtx;
  const redraws: string[] = [];
  r._renderChunk = (_c: unknown, _w: unknown, cx: number, cy: number) => { redraws.push(`${cx},${cy}`); };

  const frame = () => {
    redraws.length = 0;
    renderer.render(world, camera, null, 'none', false, false, false, null, 0);
    return [...redraws];
  };
  return { world, camera, view, frame };
}

describe('CanvasRenderer chunk cache', () => {
  it('draws visible chunks once, then not again while nothing changes', () => {
    const { world, frame } = setup();
    expect(frame().sort()).toEqual(['0,0', '1,0']);
    expect(frame()).toEqual([]);

    // A sim tick that marks everything dirty but changes nothing visible.
    world.tick++;
    world.grid.markAllDirty();
    expect(frame()).toEqual([]);
  });

  it('redraws only the chunk whose content changed', () => {
    const { world, frame } = setup();
    frame();
    world.layers.zone[world.grid.idx(CHUNK_SIZE + 2, 3)] = ZONE_R;
    world.grid.markAllDirty();
    expect(frame()).toEqual(['1,0']);
    expect(frame()).toEqual([]);
  });

  it('redraws the neighbour when a road is laid just across a chunk edge', () => {
    const { world, frame } = setup();
    frame();
    const tx = CHUNK_SIZE, ty = 5; // first column of chunk 1,0
    world.layers.roadClass[world.grid.idx(tx, ty)] = ROAD_STREET;
    world.grid.markDirty(tx, ty);  // only chunk 1,0 is marked
    world.grid.markDirty(tx - 1, ty);
    expect(frame().sort()).toEqual(['0,0', '1,0']);
  });

  it('keeps off-screen changes pending until the chunk is visible', () => {
    const { world, view, frame } = setup();
    frame();
    // Scroll down, come back: chunk 0,1 is drawn at first sight.
    const tx = 3, ty = CHUNK_SIZE + 3;
    view.y0 = CHUNK_SIZE; view.y1 = CHUNK_SIZE * 2 - 1;
    expect(frame().sort()).toEqual(['0,1', '1,1']);
    view.y0 = 0; view.y1 = CHUNK_SIZE - 1;
    expect(frame()).toEqual([]);

    // Change chunk 0,1 while it is off screen, with frames in between.
    world.layers.zone[world.grid.idx(tx, ty)] = ZONE_R;
    world.grid.markDirty(tx, ty);
    expect(frame()).toEqual([]);
    expect(frame()).toEqual([]);
    view.y0 = CHUNK_SIZE; view.y1 = CHUNK_SIZE * 2 - 1;
    expect(frame()).toEqual(['0,1']);
  });

  it('redraws everything visible after a significant zoom change', () => {
    const { camera, frame } = setup();
    frame();
    camera.zoom = 1.005;
    expect(frame()).toEqual([]);
    camera.zoom = 1.5;
    expect(frame().sort()).toEqual(['0,0', '1,0']);
  });
});
