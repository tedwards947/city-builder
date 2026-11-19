// Sound effects and ambience. Listen-only: it subscribes to the world's events,
// watches the toolbar and toast DOM, and polls a few numbers (game speed,
// population, the congestion on screen) four times a second. It never
// changes the game.
//
// Mixing rules (agreed with the owner on the review page):
// - Interface sounds are short and quiet; frequent events are throttled (see GAP).
// - Sounds from a place on the map get quieter, and pan, with distance from the
//   middle of the screen; minor ones (growth, abandonment, fire spreading) play
//   only on screen.
// - The music ducks under the milestone fanfare and the fire bell.
// - Effects (ambience included) have their own volume, the FX slider.
// - City hum fades from Small town to Downtown as the population grows; the
//   traffic-jam layer plays only when zoomed in close.
// - Trains (rail review page): only trains drawn on screen make sound. Each one is
//   heard as a distant rumble, panned where it is, with now and then a faint
//   whistle; a train stopping at a platform sighs and rings the hand bell, both
//   just above the ambience. Subway trains are drawn only in the underground
//   view and stay silent.

import { LOOPS, SOUNDS } from './sfx/sounds';
import type { LoopHandle, LoopName, SfxName } from './sfx/sounds';
import type { World } from '../sim/World';
import type { Camera } from '../render/Camera';
import { Projection, TILE_SIZE } from '../render/Projection';
import type { Tool } from '../input/InputController';
import { TRAIN_MIN_TILE, trainsInView } from '../render/clay/trains';
import { RAIL_ELEVATED, RAIL_GROUND } from '../sim/constants';

/** Overall level of the effects at full volume, set by ear against the music. */
const SFX_BASE = 0.45;
/** Level of the ambience beds, relative to the effects. */
const AMBIENCE_LEVEL = 0.6;
/** Share of the room echo mixed into the effects. */
const ROOM_WET = 0.22;
const VOLUME_KEY = 'city-builder.sfxVolume';
/** A train still running on screen rumbles again after this long (ms). */
const RERUMBLE_MS = 25_000;

/** Least time between two plays of a sound, in ms. Sounds not listed: 60 ms. */
const GAP: Partial<Record<SfxName, number>> = {
  roadTile: 45, zoneTile: 40, bulldoze: 150, placed: 80, refused: 250, pause: 0, resume: 0,
  grows: 2000, abandoned: 1500,
  pcGain: 250, pcSpend: 250,
  toastInfo: 300, toastWarning: 300, toastAlert: 300,
  moneyLow: 4000, crime: 8000, health: 8000,
  fireStart: 1500, fireSpread: 1200, fireOut: 1200,
  railRumble: 2500, railWhistle: 60000, trainSigh: 5000, trainBell: 5000,
};

/** Sounds that stand for the toast that comes with them: the toast itself then plays nothing. */
const COVERS_TOAST = new Set<SfxName>([
  'refused', 'milestone', 'gavel', 'suspended', 'requestOpened', 'requestMet', 'requestFailed',
  'powerOut', 'powerBack', 'waterOut', 'waterBack', 'moneyLow', 'debtCleared', 'crime', 'health',
  'fireStart', 'fireSpread', 'fireOut', 'abandoned',
]);

/** The view tools; every other tool builds something. */
const VIEW_TOOLS = new Set<Tool>(['none', 'inspect']);

export interface MusicDucker { duck(seconds: number): void }

export interface SoundEffectsDeps {
  camera: Camera;
  getWorld(): World;
  getSpeed(): number;
}

interface PlayOpts {
  /** A tile the sound comes from: it fades and pans with distance from the screen centre. */
  at?: { tx: number; ty: number };
  /** Off screen, play quietly ('quiet', the default) or not at all ('skip'). */
  far?: 'quiet' | 'skip';
  gain?: number;
  arg?: number;
  /** Start this many seconds from now. */
  delay?: number;
  /** Play on the ambience bed instead of with the effects (no room echo, the ambience's level). */
  ambience?: boolean;
}

interface RunningLoop { handle: LoopHandle; out: GainNode; next: number; v: number }

/**
 * Silent under browser automation (agents' headless browsers) and with ?sfx=off
 * or ?music=off in the URL, matching the music's guard in main.ts.
 */
export function effectsMuted(): boolean {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
  if (typeof location === 'undefined') return false;
  const q = new URLSearchParams(location.search);
  return q.get('sfx') === 'off' || q.get('music') === 'off';
}

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export class SoundEffects {
  private readonly deps: SoundEffectsDeps;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fx: GainNode | null = null;
  private ambience: GainNode | null = null;
  private music: MusicDucker | null = null;
  private volume: number;

  private readonly lastPlayed = new Map<SfxName, number>();
  private toastCoveredUntil = 0;
  private buildQuietUntil = 0;
  private menuSoundAt = 0;

  private world: World | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastSpeed: number | null = null;
  private readonly loops = new Map<string, RunningLoop>();
  /** Trains heard last tick: key -> phase, and when a station train was first seen slowing in. */
  private trains = new Map<string, { phase: string; inSince: number; sighed: boolean; rumbledAt: number }>();

  // A drag: tiles built since the pointer went down, and taps waiting to be counted.
  private dragRoads = 0;
  private dragZones = 0;
  private pendingRoads = 0;
  private pendingZones = 0;
  private flushQueued = false;

  constructor(deps: SoundEffectsDeps) {
    this.deps = deps;
    this.volume = loadNumber(VOLUME_KEY, 0.8);
    if (typeof window === 'undefined') return;

    // Browsers allow audio only after the player interacts with the page.
    const unlock = () => this.ensureContext();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    window.addEventListener('pointerdown', () => { this.dragRoads = 0; this.dragZones = 0; }, true);
    window.addEventListener('pointerup', () => {
      if (this.dragRoads > 0) this.play('roadDone');
      this.dragRoads = 0;
      this.dragZones = 0;
    }, true);

    document.addEventListener('click', e => this.onClick(e), true);
    this.watchToasts();
    setInterval(() => this.tick(), 250);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  getVolume(): number { return this.volume; }
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.8));
    save(VOLUME_KEY, String(this.volume));
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(SFX_BASE * this.volume, this.ctx.currentTime, 0.02);
  }
  setMusic(music: MusicDucker): void { this.music = music; }

  // ── Hooks for main.ts ─────────────────────────────────────────────────────

  /** A tool was picked (toolbar, fly-out or hotkey). */
  toolPicked(tool: Tool): void {
    // Opening a fly-out re-arms its last tool; the fly-out sound covers that click.
    if (performance.now() - this.menuSoundAt < 120) return;
    this.play(VIEW_TOOLS.has(tool) ? 'softTick' : 'clayTap');
  }
  /** An overlay or menu button on the toolbar. */
  menuClicked(): void {
    if (performance.now() - this.menuSoundAt < 120) return;
    this.play('softTick');
  }
  undo(happened: boolean): void { if (happened) { this.buildQuietUntil = performance.now() + 300; this.play('undo'); } }
  redo(happened: boolean): void { if (happened) { this.buildQuietUntil = performance.now() + 300; this.play('redo'); } }
  /** A placement was refused (money or political capital). */
  refused(): void { this.play('refused'); }

  // ── Playing ───────────────────────────────────────────────────────────────

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      if (effectsMuted()) return null;
      const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = SFX_BASE * this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      comp.connect(master);
      master.connect(ctx.destination);
      // Effects: dry, plus a short warm room so they sound like one place.
      const fx = ctx.createGain();
      fx.connect(comp);
      const room = ctx.createConvolver();
      room.buffer = makeRoom(ctx);
      const wet = ctx.createGain();
      wet.gain.value = ROOM_WET;
      fx.connect(room); room.connect(wet); wet.connect(comp);
      const ambience = ctx.createGain();
      ambience.gain.value = AMBIENCE_LEVEL;
      ambience.connect(comp);
      this.ctx = ctx; this.master = master; this.fx = fx; this.ambience = ambience;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Plays a sound now, subject to its throttle and its distance from the camera. */
  play(name: SfxName, opts: PlayOpts = {}): boolean {
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? -Infinity) < (GAP[name] ?? 60)) return false;
    let gain = opts.gain ?? 1, pan: number | undefined;
    if (opts.at) {
      const s = this.spatial(opts.at.tx, opts.at.ty);
      if (!s.onScreen && opts.far === 'skip') return false;
      gain *= s.gain; pan = s.pan;
    }
    this.lastPlayed.set(name, now);
    if (COVERS_TOAST.has(name)) this.toastCoveredUntil = now + 600;
    this.output(name, gain, pan, opts.arg, opts.delay ?? 0, opts.ambience ?? false);
    return true;
  }

  /** Schedules the sound's nodes. Separate from play() so tests can see what plays without audio. */
  protected output(name: SfxName, gain: number, pan: number | undefined, arg: number | undefined, delay: number, ambience = false): void {
    const ctx = this.ctx;
    const bus = ambience ? this.ambience : this.fx;
    if (!ctx || !bus || ctx.state !== 'running' || gain <= 0.01) return;
    const sound = SOUNDS[name];
    const out = ctx.createGain();
    out.gain.value = gain;
    let node: AudioNode = out;
    if (pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      node = p;
    }
    node.connect(bus);
    sound.play(ctx, out, ctx.currentTime + 0.01 + delay, arg);
    setTimeout(() => node.disconnect(), (sound.len + delay + 1) * 1000);
  }

  /** How loud and where a sound from tile (tx, ty) is, from the camera. */
  spatial(tx: number, ty: number): { gain: number; pan: number; onScreen: boolean } {
    const cam = this.deps.camera;
    const sx = cam.worldToScreenX(Projection.tileToWorldX(tx) + TILE_SIZE / 2);
    const sy = cam.worldToScreenY(Projection.tileToWorldY(ty) + TILE_SIZE / 2);
    const w = cam.viewportW, h = cam.viewportH;
    const pan = Math.max(-0.7, Math.min(0.7, (sx / w - 0.5) * 1.4));
    const dx = Math.max(0, -sx, sx - w), dy = Math.max(0, -sy, sy - h);
    if (dx === 0 && dy === 0) return { gain: 1, pan, onScreen: true };
    const d = Math.hypot(dx, dy) / Math.hypot(w, h);
    return { gain: Math.max(0.2, 1 - d), pan, onScreen: false };
  }

  // ── Game events ───────────────────────────────────────────────────────────

  private attach(world: World): void {
    this.unsubscribe?.();
    this.world = world;
    const subs: [string, (p: Record<string, unknown>) => void][] = [];
    const on = (type: string, fn: (p: Record<string, any>) => void) => { world.events.on(type, fn); subs.push([type, fn]); };
    const at = (p: Record<string, any>) => (typeof p.tx === 'number' ? { tx: p.tx, ty: p.ty } : undefined);
    const building = () => performance.now() >= this.buildQuietUntil;

    on('roadBuilt', () => { if (building()) { this.pendingRoads++; this.queueFlush(); } });
    on('zonePainted', () => { if (building()) { this.pendingZones++; this.queueFlush(); } });
    on('buildingPlaced', () => { if (building()) this.play('placed'); });
    on('tileCleared', () => { if (building()) this.play('bulldoze'); });
    on('tileDeveloped', p => this.play('grows', { at: at(p), far: 'skip', arg: p.level, gain: 0.8 }));
    on('tileAbandoned', p => { if (p.level >= 2) this.play('abandoned', { at: at(p), far: 'skip' }); });

    on('pcAction', p => this.play(p.delta > 0 ? 'pcGain' : 'pcSpend'));
    on('populationMilestone', () => { if (this.play('milestone')) this.music?.duck(2.4); });
    on('ordinanceEnacted', () => this.play('gavel'));
    on('ordinanceRepealed', () => this.play('gavel', { gain: 0.6 }));
    on('ordinanceSuspended', () => this.play('suspended'));
    on('requestOpened', () => this.play('requestOpened'));
    on('requestMet', () => this.play('requestMet'));
    on('requestFailed', () => this.play('requestFailed'));

    on('powerShortage', () => this.play('powerOut'));
    on('powerRestored', () => this.play('powerBack'));
    on('waterShortage', () => this.play('waterOut'));
    on('sewageShortage', () => this.play('waterOut'));
    on('waterRestored', () => this.play('waterBack'));
    on('sewageRestored', () => this.play('waterBack'));
    on('budgetWarning', () => this.play('moneyLow'));
    on('debtEntered', () => this.play('moneyLow'));
    on('debtCleared', () => this.play('debtCleared'));
    on('crimeSpike', () => this.play('crime'));
    on('healthcareCrisis', () => this.play('health'));

    on('fireIgnition', p => { if (this.play('fireStart', { at: at(p) })) this.music?.duck(1.8); });
    on('fireSpreading', p => this.play('fireSpread', { at: at(p), far: 'skip' }));
    on('fireDamage', p => this.play('fireOut', { at: at(p), far: 'skip' }));

    this.unsubscribe = () => subs.forEach(([type, fn]) => world.events.off(type, fn));
  }

  /**
   * Road and zone tiles arrive one event each. Tiles that arrive together (an
   * auto road, a zone fill) play as a quick roll; tiles that trickle in (a drag)
   * play one press each, and the road gets its heavier press when the pointer lifts.
   */
  private queueFlush(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    setTimeout(() => {
      this.flushQueued = false;
      const roads = this.pendingRoads, zones = this.pendingZones;
      this.pendingRoads = this.pendingZones = 0;
      if (roads >= 3) {
        for (let i = 0; i < Math.min(roads, 6); i++) this.output('roadTile', 1, undefined, undefined, i * 0.045);
        this.output('roadDone', 1, undefined, undefined, Math.min(roads, 6) * 0.045 + 0.05);
      } else if (roads > 0) {
        this.dragRoads += roads;
        this.play('roadTile');
      }
      if (zones >= 3) {
        for (let i = 0; i < Math.min(zones, 8); i++) this.output('zoneTile', 1, undefined, i, i * 0.05);
      } else if (zones > 0) {
        this.play('zoneTile', { arg: this.dragZones });
        this.dragZones += zones;
      }
    }, 0);
  }

  // ── Interface ─────────────────────────────────────────────────────────────

  private onClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;
    // Toolbar family tiles open and close their fly-out. Read aria-expanded
    // now, in the capture phase, before the toolbar re-renders.
    const family = target.closest('#toolbar .tb-tile.more');
    if (family) {
      this.menuSoundAt = performance.now();
      this.play(family.getAttribute('aria-expanded') === 'true' ? 'flyoutClose' : 'flyoutOpen');
      return;
    }
    if (target.closest('#toolbar .tb-seg button')) { this.play('feltTick'); return; }
    if (target.closest('#toolbar, .speed, canvas')) return;   // tools and speed have their own sounds
    if (target.closest('button, select, [role="button"], [role="menuitem"], input[type="checkbox"], input[type="radio"]')) this.play('feltTick');
  }

  /** Each new toast plays its type's sound, unless an event sound just stood in for it. */
  private watchToasts(): void {
    const container = document.getElementById('toast-container');
    if (!container || typeof MutationObserver === 'undefined') return;
    new MutationObserver(records => {
      for (const r of records) for (const n of r.addedNodes) {
        if (!(n instanceof HTMLElement) || !n.classList.contains('toast')) continue;
        if (performance.now() < this.toastCoveredUntil) continue;
        this.play(n.classList.contains('alert') ? 'toastAlert' : n.classList.contains('warning') ? 'toastWarning' : 'toastInfo');
      }
    }).observe(container, { childList: true });
  }

  // ── Polling: speed, world swaps, loops ────────────────────────────────────

  private tick(): void {
    const world = this.deps.getWorld();
    if (world !== this.world) this.attach(world);

    const speed = this.deps.getSpeed();
    // Pause winds down; every speed winds up at its own pace (1× slow, 3× fastest).
    if (this.lastSpeed !== null && speed !== this.lastSpeed) {
      if (speed === 0) this.play('pause');
      else this.play('resume', { arg: speed });
    }
    this.lastSpeed = speed;

    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.fx || !this.ambience) return;
    const cam = this.deps.camera;

    // City hum: Small town fades into Downtown between 2,000 and 20,000 people.
    const pop = world.stats.population;
    const size = Math.max(0, Math.min(1, Math.log10(pop + 1) / 5));
    const downtown = smoothstep(2000, 20000, pop);
    this.runLoop('smallTown', 'smallTown', this.ambience, 1 - downtown, size);
    this.runLoop('downtown', 'downtown', this.ambience, downtown, size);

    // Traffic jam: only zoomed in close, from the roads on screen.
    let jam = 0;
    if (cam.zoom >= 2.5) {
      const b = cam.visibleTileBounds(world.grid);
      const { roadClass, congestion } = world.layers;
      let sum = 0, n = 0;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        const i = world.grid.idx(x, y);
        if (roadClass[i] !== 0) { sum += congestion[i]; n++; }
      }
      if (n > 0) jam = Math.max(0, Math.min(1, (sum / n - 100) / 120));
    }
    this.runLoop('trafficJam', 'trafficJam', this.ambience, jam > 0.05 ? 0.4 + 0.6 * jam : 0, jam);

    this.listenTrains(world, performance.now());
  }

  /**
   * Trains on screen (render/clay/trains.ts, read only). A train coming into view rumbles far off; a
   * station train sighs once it has been slowing in for a moment, and the bell rings as it stops.
   */
  private listenTrains(world: World, now: number): void {
    const cam = this.deps.camera;
    const heard = new Map<string, { phase: string; inSince: number; sighed: boolean; rumbledAt: number }>();
    // Trains are drawn only from TRAIN_MIN_TILE px a tile up.
    if (TILE_SIZE * cam.zoom >= TRAIN_MIN_TILE) {
      const b = cam.visibleTileBounds(world.grid);
      const seen = [RAIL_GROUND, RAIL_ELEVATED].flatMap(level => trainsInView(world, now, b.x0, b.y0, b.x1, b.y1, level));
      const busy = Math.min(1, seen.length / 6);
      for (const tr of seen) {
        const before = this.trains.get(tr.key);
        const at = { tx: tr.x - 0.5, ty: tr.y - 0.5 };   // x, y are the train's middle; spatial() takes a tile
        // A train comes into one station after another: each time it starts slowing in counts afresh.
        const slowing = before?.phase === 'in';
        const state = { phase: tr.phase, inSince: tr.phase === 'in' ? (slowing ? before.inSince : now) : -1, sighed: slowing ? before.sighed : false, rumbledAt: before?.rumbledAt ?? -Infinity };
        // Trains keep running, so one may first be seen just off screen: it rumbles once it is on it, and
        // again every so often while it runs on screen, so a busy view keeps its rumble.
        const due = state.rumbledAt === -Infinity || (tr.phase === 'run' && now - state.rumbledAt >= RERUMBLE_MS);
        if (due && this.play('railRumble', { at, far: 'skip', arg: busy, ambience: true })) {
          state.rumbledAt = now;
          if (Math.random() < 0.3) this.play('railWhistle', { at, far: 'skip', delay: 3.5, ambience: true });
        }
        if (tr.phase === 'in' && !state.sighed && state.inSince >= 0 && now - state.inSince >= 1500) {
          this.play('trainSigh', { at, far: 'skip' });
          state.sighed = true;
        }
        if (tr.phase === 'dwell' && before?.phase === 'in') this.play('trainBell', { at, far: 'skip', delay: 0.4 });
        heard.set(tr.key, state);
      }
    }
    this.trains = heard;
  }

  /** Starts, updates or stops one loop; `gain` 0 stops it. Events are scheduled 1.2 s ahead. */
  private runLoop(id: string, name: LoopName, bus: GainNode, gain: number, v: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    let loop = this.loops.get(id);
    if (gain <= 0.02) {
      if (loop) {
        loop.out.gain.setTargetAtTime(0, now, 0.25);
        loop.handle.stop(now + 1.2);
        const out = loop.out;
        setTimeout(() => out.disconnect(), 2500);
        this.loops.delete(id);
      }
      return;
    }
    if (!loop) {
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(bus);
      loop = { handle: LOOPS[name].start(ctx, out, v), out, next: now, v };
      this.loops.set(id, loop);
    }
    loop.out.gain.setTargetAtTime(gain, now, 0.5);
    if (Math.abs(v - loop.v) > 0.01) { loop.handle.set(v); loop.v = v; }
    if (loop.next < now + 1.2) {
      LOOPS[name].events(ctx, loop.out, Math.max(loop.next, now), now + 1.2, v);
      loop.next = now + 1.2;
    }
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A short, warm room: 0.8 s of decaying, softened noise. */
function makeRoom(ac: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ac.sampleRate * 0.8);
  const b = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += 0.35 * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-i / ac.sampleRate * 5.5);
    }
  }
  return b;
}
