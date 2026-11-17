// The sound kit the owner picked on the review page (two rounds, Nov 2026):
// clay-feeling sounds made of wood, felt, kalimba and soft bells, plus a few
// distant realistic ones (sirens, fire, traffic). Each one-shot schedules
// itself at time `t` on `out`; `arg` is a small per-sound variation (a level, a
// tile count in a drag).

import { N, R, bed, bell, bird, carPass, fm, horn, kalimba, marimba, noise, poisson, tone } from './synth';
import type { Bed } from './synth';

type Play = (ac: BaseAudioContext, out: AudioNode, t: number, arg?: number) => void;
export interface OneShot { /** Seconds until it has died away. */ len: number; play: Play }

const brass = (ac: BaseAudioContext, o: AudioNode, t: number, n: string, hold: number, peak = 0.06) => {
  for (const dt of [-7, 7]) tone(ac, o, { t, f: N(n), type: 'sawtooth', detune: dt, a: 0.025, hold, d: 0.25, peak, lp: 2400, vib: [5, 2] });
};
const bubble = (ac: BaseAudioContext, o: AudioNode, t: number, f: number, peak = 0.06) =>
  tone(ac, o, { t, f, f2: f * 1.7, glide: 0.035, a: 0.004, d: 0.045, peak });
const windClick = (ac: BaseAudioContext, o: AudioNode, t: number, i: number, lift = 0) =>
  fm(ac, o, { t, f: 900 - i * 45 + lift, ratio: 1.5, index: 300, d: 0.025, peak: 0.12 });
/** Wind-up pace for each game speed: gaps between clicks are multiplied by this (1× is unhurried, 3× races). */
const WIND_PACE: Record<number, number> = { 1: 1.5, 2: 0.95, 3: 0.55 };

export const SOUNDS = {
  // ── Interface ─────────────────────────────────────────────────────────────
  /** Picking a build tool. */
  clayTap: { len: 0.2, play: (ac, o, t) => {
    fm(ac, o, { t, f: 380, ratio: 1.47, index: 260, d: 0.08, peak: 0.3 });
    noise(ac, o, { t, d: 0.012, peak: 0.08, type: 'lowpass', f: 1800 });
  } },
  /** View tools, overlays, menu buttons, speed changes. */
  softTick: { len: 0.15, play: (ac, o, t) => {
    noise(ac, o, { t, d: 0.025, peak: 0.28, type: 'bandpass', f: 3800, Q: 1.5 });
    tone(ac, o, { t, f: 2300, d: 0.035, peak: 0.05 });
  } },
  /** Small controls inside panels. */
  feltTick: { len: 0.15, play: (ac, o, t) => {
    noise(ac, o, { t, a: 0.002, d: 0.022, peak: 0.24, f: 2200, Q: 1.2 });
    fm(ac, o, { t, f: 900, ratio: 1.5, index: 80, d: 0.02, peak: 0.06 });
  } },
  flyoutOpen: { len: 0.35, play: (ac, o, t) => {
    marimba(ac, o, { t, f: N('G4'), d: 0.12, peak: 0.12 });
    marimba(ac, o, { t: t + 0.06, f: N('C5'), d: 0.16, peak: 0.12 });
  } },
  flyoutClose: { len: 0.35, play: (ac, o, t) => {
    marimba(ac, o, { t, f: N('C5'), d: 0.12, peak: 0.1 });
    marimba(ac, o, { t: t + 0.06, f: N('G4'), d: 0.16, peak: 0.1 });
  } },
  /** Wind-up toy running down. */
  pause: { len: 0.9, play: (ac, o, t) => {
    let tt = t;
    for (let i = 0; i < 9; i++) { windClick(ac, o, tt, i); tt += 0.03 + i * 0.012; }
  } },
  /** Wind-up toy picking up; `arg` is the new game speed (1–3): faster and a little higher for each. */
  resume: { len: 1.3, play: (ac, o, t, speed = 1) => {
    const s = Math.max(1, Math.min(3, Math.round(speed)));
    const pace = WIND_PACE[s], lift = (s - 1) * 110;
    let tt = t;
    for (let i = 8; i >= 0; i--) { windClick(ac, o, tt, i, lift); tt += (0.03 + i * 0.012) * pace; }
  } },
  /** Felt buzz: placement refused. */
  refused: { len: 0.35, play: (ac, o, t) => {
    for (const f of [98, 104]) tone(ac, o, { t, f, type: 'triangle', a: 0.015, d: 0.16, peak: 0.2, lp: 420 });
    noise(ac, o, { t, d: 0.05, peak: 0.12, type: 'lowpass', f: 300, brown: true });
  } },
  /** Page flip, swept down. */
  undo: { len: 0.25, play: (ac, o, t) => {
    noise(ac, o, { t, a: 0.01, d: 0.06, peak: 0.14, f: 2500, f2: 1200, Q: 1 });
    noise(ac, o, { t: t + 0.04, d: 0.04, peak: 0.06, f: 1800, Q: 1 });
  } },
  /** Page flip, swept up. */
  redo: { len: 0.25, play: (ac, o, t) => {
    noise(ac, o, { t, a: 0.01, d: 0.06, peak: 0.14, f: 1200, f2: 2500, Q: 1 });
    noise(ac, o, { t: t + 0.04, d: 0.04, peak: 0.06, f: 2200, Q: 1 });
  } },

  // ── Building ──────────────────────────────────────────────────────────────
  /** Asphalt press: one road tile. */
  roadTile: { len: 0.15, play: (ac, o, t) => {
    noise(ac, o, { t, d: 0.06, peak: 0.25, type: 'lowpass', f: 350, brown: true });
    tone(ac, o, { t, f: 120, f2: 80, d: 0.05, peak: 0.12 });
  } },
  /** The heavier press when a road is finished. */
  roadDone: { len: 0.35, play: (ac, o, t) => fm(ac, o, { t, f: 140, ratio: 1.02, index: 300, d: 0.2, peak: 0.3 }) },
  /** Felt stamp: one zoned tile; `arg` is its place in the drag, so a long drag climbs slowly. */
  zoneTile: { len: 0.1, play: (ac, o, t, i = 0) => {
    tone(ac, o, { t, f: 180 * Math.pow(2, Math.min(i, 24) / 24), a: 0.004, d: 0.05, peak: 0.17 });
    noise(ac, o, { t, d: 0.02, peak: 0.05, type: 'lowpass', f: 600 });
  } },
  /** Clay thunk: a building placed. */
  placed: { len: 0.8, play: (ac, o, t) => {
    fm(ac, o, { t, f: 120, ratio: 1.02, index: 350, d: 0.25, peak: 0.4 });
    noise(ac, o, { t, d: 0.12, peak: 0.25, type: 'lowpass', f: 400, brown: true });
    noise(ac, o, { t: t + 0.05, a: 0.03, d: 0.4, peak: 0.03, type: 'highpass', f: 2500 });
  } },
  /** Crumble, without debris. */
  bulldoze: { len: 0.7, play: (ac, o, t) => noise(ac, o, { t, a: 0.01, d: 0.6, peak: 0.4, type: 'lowpass', f: 700, f2: 150, brown: true }) },
  /** Wood block, higher for each level (arg = level 1..3). */
  grows: { len: 0.15, play: (ac, o, t, level = 1) => {
    fm(ac, o, { t, f: [520, 620, 740][Math.max(0, Math.min(2, level - 1))], ratio: 2.0, index: 120, d: 0.06, peak: 0.15 });
  } },
  /** Hollow thump. */
  abandoned: { len: 1.1, play: (ac, o, t) => {
    tone(ac, o, { t, f: 70, d: 1.0, peak: 0.3 });
    tone(ac, o, { t, f: 104, d: 0.7, peak: 0.1 });
    noise(ac, o, { t, d: 0.2, peak: 0.1, type: 'lowpass', f: 250, brown: true });
  } },

  // ── Political capital ─────────────────────────────────────────────────────
  /** Kalimba shimmer, rising. */
  pcGain: { len: 0.7, play: (ac, o, t) => {
    ['C5', 'E5', 'G5', 'A5', 'C6'].forEach((n, i) => kalimba(ac, o, { t: t + i * 0.045, f: N(n), d: 0.4, peak: 0.08, pan: i % 2 ? 0.35 : -0.35 }));
  } },
  /** Kalimba shimmer, falling. */
  pcSpend: { len: 0.7, play: (ac, o, t) => {
    ['C6', 'A5', 'G5', 'E5', 'C5'].forEach((n, i) => kalimba(ac, o, { t: t + i * 0.045, f: N(n), d: 0.4, peak: 0.07, pan: i % 2 ? 0.35 : -0.35 }));
  } },
  /** Brass fanfare. */
  milestone: { len: 2.2, play: (ac, o, t) => {
    brass(ac, o, t, 'G4', 0.08); brass(ac, o, t + 0.14, 'C5', 0.08); brass(ac, o, t + 0.28, 'E5', 0.08);
    for (const n of ['C5', 'E5', 'G5', 'C4']) brass(ac, o, t + 0.42, n, 0.75, 0.045);
  } },
  /** Gavel: two knocks. */
  gavel: { len: 0.7, play: (ac, o, t) => {
    for (const dt of [0, 0.2]) {
      fm(ac, o, { t: t + dt, f: 210, ratio: 1.42, index: 500, d: 0.12, peak: 0.38 });
      noise(ac, o, { t: t + dt, d: 0.03, peak: 0.18, type: 'lowpass', f: 900 });
      noise(ac, o, { t: t + dt + 0.02, a: 0.02, d: 0.25, peak: 0.035, type: 'lowpass', f: 300, brown: true });
    }
  } },
  /** Power sag: ordinances suspended. */
  suspended: { len: 1.0, play: (ac, o, t) => {
    for (const n of ['G3', 'B3', 'D4']) tone(ac, o, { t, f: N(n), f2: N(n) * 0.92, type: 'sawtooth', a: 0.02, d: 0.85, peak: 0.05, lp: 1200, lp2: 300 });
  } },
  /** Doorbell: a request opened. */
  requestOpened: { len: 1.5, play: (ac, o, t) => {
    bell(ac, o, { t, f: N('E5'), d: 0.9, peak: 0.13, bright: 0.6 });
    bell(ac, o, { t: t + 0.35, f: N('C5'), d: 1.1, peak: 0.13, bright: 0.6 });
  } },
  /** Thank-you chime. */
  requestMet: { len: 1.2, play: (ac, o, t) => {
    ['C5', 'E5', 'G5'].forEach((n, i) => bell(ac, o, { t: t + i * 0.08, f: N(n), d: 0.6, peak: 0.08 }));
    bell(ac, o, { t: t + 0.24, f: N('C6'), d: 0.9, peak: 0.09 });
  } },
  /** Deflate. */
  requestFailed: { len: 0.8, play: (ac, o, t) => {
    tone(ac, o, { t, f: 520, f2: 160, glide: 0.6, d: 0.65, peak: 0.1 });
    noise(ac, o, { t, a: 0.02, d: 0.5, peak: 0.05, f: 1500, f2: 500, Q: 1 });
  } },

  // ── Alerts and toasts ─────────────────────────────────────────────────────
  toastInfo: { len: 0.15, play: (ac, o, t) => tone(ac, o, { t, f: 480, f2: 720, glide: 0.03, d: 0.06, peak: 0.13 }) },
  toastWarning: { len: 0.35, play: (ac, o, t) => {
    for (const dt of [0, 0.16]) tone(ac, o, { t: t + dt, f: N('A4'), type: 'triangle', d: 0.09, peak: 0.17 });
  } },
  /** Woodblock triple. */
  toastAlert: { len: 0.35, play: (ac, o, t) => {
    for (const dt of [0, 0.1, 0.2]) {
      fm(ac, o, { t: t + dt, f: 880, ratio: 2.0, index: 500, d: 0.06, peak: 0.2 });
      noise(ac, o, { t: t + dt, d: 0.01, peak: 0.08, f: 2500, Q: 1.5 });
    }
  } },
  powerOut: { len: 1.0, play: (ac, o, t) => {
    noise(ac, o, { t, d: 0.02, peak: 0.25, f: 1800, Q: 2 });
    for (const f of [60, 120]) tone(ac, o, { t, f, f2: f * 0.35, glide: 0.8, type: 'sawtooth', a: 0.005, d: 0.9, peak: 0.08, lp: 500 });
  } },
  powerBack: { len: 1.0, play: (ac, o, t) => {
    for (const f of [60, 120]) tone(ac, o, { t, f: f / 3, f2: f, glide: 0.5, type: 'sawtooth', a: 0.3, hold: 0.2, d: 0.35, peak: 0.07, lp: 500 });
    bell(ac, o, { t: t + 0.55, f: N('E6'), d: 0.4, peak: 0.04 });
  } },
  /** Bottle emptying: glugs falling in pitch. */
  waterOut: { len: 0.9, play: (ac, o, t) => {
    [700, 600, 520, 440, 370].forEach((f, i) => {
      const tt = t + i * 0.16;
      bubble(ac, o, tt, f, 0.1);
      noise(ac, o, { t: tt, d: 0.05, peak: 0.05, f, Q: 6 });
    });
  } },
  /** Bottle filling: a rising ring. */
  waterBack: { len: 1.4, play: (ac, o, t) => {
    noise(ac, o, { t, a: 0.1, hold: 1.0, d: 0.25, peak: 0.28, f: 300, f2: 1600, glide: 1.2, Q: 10 });
    noise(ac, o, { t, a: 0.1, hold: 1.0, d: 0.25, peak: 0.03, type: 'highpass', f: 3000 });
  } },
  /** Coins slipping. */
  moneyLow: { len: 0.8, play: (ac, o, t) => {
    [0, 0.1, 0.22, 0.38, 0.6].forEach((dt, i) => fm(ac, o, { t: t + dt, f: 3200 - i * 260, ratio: 2.1, index: 800, d: 0.08, peak: 0.06, pan: R(-0.4, 0.4) }));
  } },
  /** Ledger balanced. */
  debtCleared: { len: 0.8, play: (ac, o, t) => {
    noise(ac, o, { t, d: 0.015, peak: 0.1, type: 'highpass', f: 3500 });
    noise(ac, o, { t: t + 0.09, d: 0.02, peak: 0.1, type: 'highpass', f: 3200 });
    marimba(ac, o, { t: t + 0.25, f: N('C5'), d: 0.3 });
    marimba(ac, o, { t: t + 0.37, f: N('G5'), d: 0.4 });
    noise(ac, o, { t: t + 0.55, a: 0.03, d: 0.12, peak: 0.04, f: 1800, Q: 1 });
  } },
  /** A distant police siren. */
  crime: { len: 2.5, play: (ac, o, t) => tone(ac, o, { t, f: 800, type: 'triangle', a: 0.7, hold: 0.9, d: 0.8, peak: 0.06, lp: 1500, vib: [1.6, 170] }) },
  /** A distant ambulance. */
  health: { len: 2.3, play: (ac, o, t) => {
    for (let i = 0; i < 6; i++) {
      tone(ac, o, { t: t + i * 0.36, f: i % 2 ? N('G5') : N('B5'), type: 'triangle', a: 0.02, hold: 0.28, d: 0.06, peak: 0.05 * (1 - Math.abs(i - 2.5) / 4), lp: 2000 });
    }
  } },

  // ── Fire ──────────────────────────────────────────────────────────────────
  /** The firehouse bell, struck with a felt hammer. */
  fireStart: { len: 1.7, play: (ac, o, t) => {
    [0, 0.18, 0.36, 0.54, 0.9, 1.08].forEach(dt => bell(ac, o, { t: t + dt, f: N('A5'), d: 0.5, peak: 0.09, bright: 0.5 }));
  } },
  /** Ember jump: a pop, then sparks flying across. */
  fireSpread: { len: 0.9, play: (ac, o, t) => {
    noise(ac, o, { t, d: 0.03, peak: 0.2, type: 'lowpass', f: 900, pan: -0.6 });
    for (let i = 0; i < 6; i++) noise(ac, o, { t: t + 0.05 + i * 0.07, a: 0.001, d: 0.012, peak: 0.09, type: 'highpass', f: R(2500, 4500), pan: -0.6 + i * 0.24 });
    noise(ac, o, { t: t + 0.5, a: 0.08, d: 0.3, peak: 0.1, f: 500, f2: 1500, Q: 0.8, pan: 0.6 });
  } },
  /** Steam hiss (no crackles: the owner found them distracting). */
  fireOut: { len: 1.4, play: (ac, o, t) => noise(ac, o, { t, a: 0.05, d: 1.2, peak: 0.12, type: 'highpass', f: 2500, f2: 5000 }) },
} satisfies Record<string, OneShot>;

export type SfxName = keyof typeof SOUNDS;

// ── Loops ─────────────────────────────────────────────────────────────────────
// A loop has a continuous bed and random events, both following one parameter
// `v` in 0..1 (city size, congestion). Events are scheduled a second
// ahead at a time by whoever runs the loop.

export interface LoopHandle { set(v: number): void; stop(t: number): void }
export interface LoopDef {
  start(ac: BaseAudioContext, out: AudioNode, v: number): LoopHandle;
  events(ac: BaseAudioContext, out: AudioNode, t0: number, t1: number, v: number): void;
}
const follow = (ac: BaseAudioContext, b: Bed, gain: (v: number) => number) => (v: number) => b.g.gain.setTargetAtTime(gain(v), ac.currentTime, 0.3);

export const LOOPS = {
  /** Breeze, birds and the odd car passing. */
  smallTown: {
    start: (ac, o, v) => {
      const wind = bed(ac, o, { f: 500, gain: 0.08, lfo: [0.1, 200], lfoGain: [0.13, 0.4] });
      const traffic = bed(ac, o, { f: 180, gain: 0.1 * v });
      return { set: follow(ac, traffic, x => 0.1 * x), stop: t => { wind.stop(t); traffic.stop(t); } };
    },
    events: (ac, o, t0, t1, v) => {
      poisson(t0, t1, 0.6 * (1 - 0.6 * v), t => bird(ac, o, t));
      poisson(t0, t1, 0.08 + 0.25 * v, t => carPass(ac, o, t));
    },
  },
  /** Traffic rumble, a murmur of people, horns and bus brakes. */
  downtown: {
    start: (ac, o, v) => {
      const rumble = bed(ac, o, { f: 220, gain: 0.1 + 0.1 * v });
      const murmur = bed(ac, o, { brown: false, type: 'bandpass', f: 600, Q: 0.7, gain: 0.015 + 0.025 * v, lfoGain: [0.7, 0.3] });
      const r = follow(ac, rumble, x => 0.1 + 0.1 * x), m = follow(ac, murmur, x => 0.015 + 0.025 * x);
      return { set: x => { r(x); m(x); }, stop: t => { rumble.stop(t); murmur.stop(t); } };
    },
    events: (ac, o, t0, t1, v) => {
      poisson(t0, t1, 0.05 + 0.2 * v, t => {
        const f = R(300, 460), pan = R(-0.7, 0.7);
        horn(ac, o, t, f, R(0.08, 0.25), 0.025, pan);
        if (Math.random() < 0.3) horn(ac, o, t + 0.25, f, 0.1, 0.025, pan);
      });
      poisson(t0, t1, 0.05 + 0.05 * v, t => noise(ac, o, { t, a: 0.05, d: 0.6, peak: 0.025, type: 'highpass', f: 3000, pan: R(-0.6, 0.6) }));
      poisson(t0, t1, 0.15 + 0.3 * v, t => carPass(ac, o, t, 0.04));
    },
  },
  /** Horn chorus over idling traffic, for jammed roads up close. */
  trafficJam: {
    start: (ac, o, v) => {
      const idle = bed(ac, o, { f: 150, gain: 0.12 * v });
      return { set: follow(ac, idle, x => 0.12 * x), stop: idle.stop };
    },
    events: (ac, o, t0, t1, v) => poisson(t0, t1, 0.3 + 2 * v, t => horn(ac, o, t, R(260, 520), R(0.06, 0.35), R(0.015, 0.035), R(-0.9, 0.9))),
  },
} satisfies Record<string, LoopDef>;

export type LoopName = keyof typeof LOOPS;
