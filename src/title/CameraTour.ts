// The title screen's camera tour: HOW the camera moves. It rests on a spot
// for a few seconds, never quite still (a slow push in and a slow drift to
// one side), then glides to the next one:
// eased at both ends, and pulling back a little in the middle of a long
// flight so the city passes underneath. `stop()` ends it at once, wherever
// the camera is (the player clicked).

import type { Camera } from '../render/Camera';
import { Projection } from '../render/Projection';
import { nextTourSpot, type TourSpot } from './tourSpots';

/** Where a camera looks: the world point at the middle of the view, and the zoom. */
export interface Pose { x: number; y: number; zoom: number }

export const TOUR = {
  /** Seconds resting on a spot. */
  dwell: 3.5,
  /** How much the view pushes in while resting (0.05 = 5 %). */
  push: 0.05,
  /** How far the view drifts sideways while resting, as a share of the view's smaller side. Each rest drifts another way. */
  drift: 0.06,
  /** Seconds a flight takes: `flight` plus `perScreen` for each screen-width travelled, at most `maxFlight`. */
  flight: 1.5, perScreen: 0.12, maxFlight: 2.2,
  /** How far a long flight pulls back at its middle: the zoom falls to 1 / (1 + pull × screens), screens capped at `pullScreens`. */
  pull: 0.3, pullScreens: 4,
  /** Spots are found again this often (seconds): jams move. */
  refresh: 20,
};

/** Slow start, slow stop: 0→1 over t 0→1, with no speed at either end. */
export function easeInOut(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/** How far through a rest's drift and push the view is, `t` 0→1 of the rest: a short ease in, then steady to the end. */
export function restProgress(t: number): number {
  const u = Math.max(0, Math.min(1, t)), ramp = 0.2;
  return (u < ramp ? u * u / (2 * ramp) : u - ramp / 2) / (1 - ramp / 2);
}

/** Which way rest number `n` drifts (radians): a golden-angle turn each time, so no two in a row go the same way. */
export function driftAngle(n: number): number {
  return n * 2.399963;
}

/** How many screen-widths apart two poses are, at the wider of their two zooms. `viewport` is the view's smaller side in pixels. */
export function screensApart(a: Pose, b: Pose, viewport: number): number {
  return Math.hypot(b.x - a.x, b.y - a.y) * Math.min(a.zoom, b.zoom) / Math.max(1, viewport);
}

/** Seconds the flight from `a` to `b` should take. */
export function flightSeconds(a: Pose, b: Pose, viewport: number): number {
  return Math.min(TOUR.maxFlight, TOUR.flight + TOUR.perScreen * screensApart(a, b, viewport));
}

/**
 * The pose `t` (0–1) of the way through the flight from `a` to `b`. Position
 * and zoom ease in and out; a long flight also pulls back in the middle.
 */
export function flightPose(a: Pose, b: Pose, t: number, viewport: number): Pose {
  const e = easeInOut(t);
  const straight = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * e);
  const back = 1 / (1 + TOUR.pull * Math.min(TOUR.pullScreens, screensApart(a, b, viewport)));
  const bump = Math.sin(Math.PI * e) ** 2;          // 0 at both ends, 1 in the middle, flat at all three
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, zoom: straight * (1 - (1 - back) * bump) };
}

/** A small window shows less, so the tour pulls back there: what a spot's zoom is multiplied by. `viewport` is the view's smaller side in pixels. */
export function viewScale(viewport: number): number {
  return Math.max(0.55, Math.min(1.25, viewport / 800));
}

export class CameraTour {
  private readonly camera: Camera;
  private readonly findSpots: () => TourSpot[];
  private readonly random: () => number;
  private running = false;
  private spots: TourSpot[] = [];
  private spotsAt = -Infinity;
  private readonly recent: TourSpot[] = [];
  // The leg under way: a flight from `from` to `to` (seconds `flight`), then a rest on `to`.
  private from: Pose = { x: 0, y: 0, zoom: 1 };
  private to: Pose = { x: 0, y: 0, zoom: 1 };
  private legStart = 0;
  private flight = 0;
  /** Rests so far: turns the drift. */
  private rests = 0;

  /** `findSpots` is asked for the city's spots now and then (tourSpots.findTourSpots on the live world). */
  constructor(camera: Camera, findSpots: () => TourSpot[], random: () => number = Math.random) {
    this.camera = camera;
    this.findSpots = findSpots;
    this.random = random;
  }

  get active(): boolean { return this.running; }

  /** Begin: the view goes straight to a first spot and rests there. `now` in milliseconds, as for `update`. */
  start(now: number): void {
    this.running = true;
    this.recent.length = 0;
    this.spotsAt = -Infinity;
    const first = this.pick(now);
    this.from = this.to = first;
    this.legStart = now;
    this.flight = 0;
    this.rests = 0;
    this.apply(first);
  }

  /** End the tour at once; the camera stays where it is. */
  stop(): void { this.running = false; }

  /** Call every frame with the frame's time in milliseconds. Does nothing once stopped. */
  update(now: number): void {
    if (!this.running) return;
    let t = (now - this.legStart) / 1000;
    if (t >= this.flight + TOUR.dwell) {
      // Rested long enough: fly on from wherever the view is now.
      this.from = this.pose();
      this.to = this.pick(now);
      this.legStart = now;
      this.flight = flightSeconds(this.from, this.to, this.viewport());
      this.rests++;
      t = 0;
    }
    if (t < this.flight) {
      this.apply(flightPose(this.from, this.to, t / this.flight, this.viewport()));
    } else {
      // Resting, but never still: push in and drift a little (world units = pixels / zoom).
      const rest = restProgress((t - this.flight) / TOUR.dwell);
      const far = TOUR.drift * this.viewport() * rest / this.to.zoom, angle = driftAngle(this.rests);
      this.apply({ x: this.to.x + Math.cos(angle) * far, y: this.to.y + Math.sin(angle) * far, zoom: this.to.zoom * (1 + TOUR.push * rest) });
    }
  }

  private viewport(): number { return Math.min(this.camera.viewportW, this.camera.viewportH); }

  private pick(now: number): Pose {
    if (now - this.spotsAt > TOUR.refresh * 1000 || this.spots.length === 0) {
      this.spots = this.findSpots();
      this.spotsAt = now;
    }
    const spot = nextTourSpot(this.spots, this.recent, this.random);
    if (!spot) return this.pose();
    this.recent.push(spot);
    if (this.recent.length > 8) this.recent.shift();
    const at = Projection.tileToWorld(spot.tx + 0.5, spot.ty + 0.5);
    const zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, spot.zoom * viewScale(this.viewport())));
    return { x: at.x, y: at.y, zoom };
  }

  private pose(): Pose {
    const c = this.camera;
    return { x: c.x + c.viewportW / (2 * c.zoom), y: c.y + c.viewportH / (2 * c.zoom), zoom: c.zoom };
  }

  private apply(p: Pose): void {
    const c = this.camera;
    c.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, p.zoom));
    c.x = p.x - c.viewportW / (2 * c.zoom);
    c.y = p.y - c.viewportH / (2 * c.zoom);
  }
}
