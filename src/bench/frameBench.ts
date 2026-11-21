// How long a frame takes to draw, and a sim tick in the browser. This is the
// script of bench/frame.html, opened in headless Chrome by `npm run bench`
// (scripts/bench.mjs), which serves the city and collects the result.

import { Camera } from '../render/Camera';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { setClayLoadListener } from '../render/clay/ClaySprites';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { loadBenchCity, summary } from './city';
import { runTickBench } from './tickBench';

const VIEW_W = 1600, VIEW_H = 900;

/** Resolves once no sprite has finished loading for a little while. */
function spritesLoaded(): Promise<void> {
  return new Promise((resolve) => {
    let timer = setTimeout(done, 3000);
    function done() { setClayLoadListener(null); resolve(); }
    setClayLoadListener(() => { clearTimeout(timer); timer = setTimeout(done, 1000); });
  });
}

async function main(): Promise<unknown> {
  const response = await fetch('/__bench/city');
  const saveText = response.status === 200 ? await response.text() : null;

  const tick = runTickBench(saveText);

  const { world } = loadBenchCity(saveText);
  const scheduler = new Scheduler(world, createSystems().systems);
  for (let k = 0; k < 40; k++) scheduler.tick();       // traffic on the roads, fields spread

  const canvas = document.createElement('canvas');
  canvas.width = VIEW_W; canvas.height = VIEW_H;
  document.body.appendChild(canvas);
  const renderer = new CanvasRenderer(canvas);
  const camera = new Camera(VIEW_W, VIEW_H);
  await spritesLoaded();

  const index = world.index;
  const centre = () => camera.centerOnTile((index.x0 + index.x1) >> 1, (index.y0 + index.y1) >> 1);

  let clock = 1000;                                     // the frame time the renderer is told
  const frame = (): number => {
    clock += 16;
    const t = performance.now();
    renderer.render(world, camera, { now: clock });
    renderer.ctx.getImageData(0, 0, 1, 1);              // make the drawing actually happen
    return performance.now() - t;
  };
  // A fingerprint of every pixel on screen. The bench clock is fixed, so the
  // same code draws the same picture on every run: if this changes, the look changed.
  const picture = (): string => {
    const bytes = renderer.ctx.getImageData(0, 0, VIEW_W, VIEW_H).data;
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  const frames = (n: number, before?: (k: number) => void): number[] => {
    const out: number[] = [];
    for (let k = 0; k < n; k++) { before?.(k); out.push(frame()); }
    return out;
  };

  const views = [];
  for (const zoom of [0.5, 1, 2.5]) {
    camera.zoom = zoom; centre();
    const firstFrameMs = frame();                       // nothing cached at this zoom yet
    frames(90);                                         // settle: everything sharpened
    const still = summary(frames(60));
    const stillPicture = picture();
    const panning = summary(frames(40, () => camera.panBy(-24, -14)));
    centre(); frames(90);
    // Twelve wheel notches out and twelve back, one per frame, then let go.
    const zooming = summary(frames(24, (k) => camera.zoomAt(VIEW_W / 2, VIEW_H / 2, k < 12 ? 1 / 1.1 : 1.1)));
    const afterZoom = summary(frames(60));
    views.push({ zoom, firstFrameMs, still, panning, zooming, afterZoom, picture: `${stillPicture} ${picture()}` });
  }
  // The rest of what render() can draw, as pictures only: overlays, the hover
  // outline, the inspected lot's routes and a coverage preview.
  camera.zoom = 1; centre(); frames(90);
  const mid = { tx: (index.x0 + index.x1) >> 1, ty: (index.y0 + index.y1) >> 1 };
  let lot = mid;                                        // a developed lot near the middle, if any
  search: for (let r = 0; r < 40; r++) {
    for (let ty = mid.ty - r; ty <= mid.ty + r; ty++) for (let tx = mid.tx - r; tx <= mid.tx + r; tx++) {
      if (!world.grid.inBounds(tx, ty)) continue;
      const i = world.grid.idx(tx, ty);
      if (world.layers.zone[i] !== 0 && world.layers.devLevel[i] > 0 && world.layers.abandoned[i] === 0) { lot = { tx, ty }; break search; }
    }
  }
  const coverage = new Set<number>();
  for (let ty = mid.ty - 6; ty <= mid.ty + 6; ty++) for (let tx = mid.tx - 6; tx <= mid.tx + 6; tx++) {
    if (world.grid.inBounds(tx, ty) && Math.abs(tx - mid.tx) + Math.abs(ty - mid.ty) <= 6) coverage.add(world.grid.idx(tx, ty));
  }
  const shot = (draw: () => void): string => { clock += 16; draw(); return picture(); };
  const extras = {
    crime:    shot(() => renderer.render(world, camera, { overlay: 'crime', now: clock })),
    fire:     shot(() => renderer.render(world, camera, { overlay: 'fire', now: clock })),
    vibe:     shot(() => renderer.render(world, camera, { overlay: 'vibe', now: clock })),
    inspect:  shot(() => renderer.render(world, camera, { hoverTile: lot, tool: 'inspect', now: clock })),
    roadTool: shot(() => renderer.render(world, camera, { hoverTile: mid, tool: 'road', now: clock })),
    coverage: shot(() => renderer.render(world, camera, { hoverTile: mid, tool: 'police', coveragePreview: coverage, now: clock })),
  };
  // The frame right after a sim tick, standing still: what a tick makes the renderer check or redraw.
  // Measured last, so the ticks do not change the pictures above.
  const afterTick = [];
  for (const zoom of [0.5, 1, 2.5]) {
    camera.zoom = zoom; centre(); frames(90);
    afterTick.push({ zoom, frame: summary(frames(60, () => scheduler.tick())) });
  }
  return { tick, view: `${VIEW_W}×${VIEW_H}`, views, extras, afterTick };
}

main()
  .then((result) => ({ ok: true, result }), (e) => ({ ok: false, error: String(e?.stack ?? e) }))
  .then((body) => fetch('/__bench/result', { method: 'POST', body: JSON.stringify(body) }));
