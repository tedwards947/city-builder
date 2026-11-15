// How much one wheel event zooms.
//
// A mouse wheel sends one event of about 100 px per notch; a trackpad sends
// dozens of small events per gesture. Zooming a fixed 10% per event made a
// wheel feel right and a trackpad uncontrollably fast, so the step is scaled
// by how far the event actually scrolled: one mouse notch in is still 10%.

/** Zoom per pixel scrolled: 100 px (one wheel notch) = 10%. */
const ZOOM_PER_PIXEL = Math.log(1.1) / 100;
/** Trackpad pinches arrive as ctrl+wheel with small deltas; they zoom faster per pixel. */
const ZOOM_PER_PINCH_PIXEL = 0.01;
/** Zooming out is this much faster than zooming in for the same scroll: pulling back to see the city is the common move, and it felt sluggish at equal speed. */
export const ZOOM_OUT_BOOST = 1.5;
/** A single event never zooms more than this (about two notches). */
const MAX_STEP = Math.log(1.25);

const PIXELS_PER_LINE = 100 / 3;   // browsers that report lines send 3 per notch
const PIXELS_PER_PAGE = 300;

/**
 * The factor to multiply the camera zoom by for a wheel event. Scrolling up
 * (negative deltaY) zooms in. `deltaMode` is WheelEvent.deltaMode: 0 pixels,
 * 1 lines, 2 pages. `pinch` is true for ctrl+wheel (a trackpad pinch).
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0, pinch = false): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
  const pixels = deltaMode === 1 ? deltaY * PIXELS_PER_LINE : deltaMode === 2 ? deltaY * PIXELS_PER_PAGE : deltaY;
  let step = -pixels * (pinch ? ZOOM_PER_PINCH_PIXEL : ZOOM_PER_PIXEL);
  if (step < 0) step *= ZOOM_OUT_BOOST;
  return Math.exp(Math.max(-MAX_STEP, Math.min(MAX_STEP, step)));
}
