// Small WebAudio building blocks for the sound effects. Every function
// schedules nodes on a context at time `t` and cleans up after itself (each
// source stops once its envelope has died away), so a sound is just a function
// that calls a few of these. Ported from the sound-effects review page.

type Ctx = BaseAudioContext;
type Out = AudioNode;

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency of a note name like "C5", "F#3" or "Bb4". */
export function N(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const midi = (Number(m[3]) + 1) * 12 + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A random number in [a, b). */
export const R = (a: number, b: number): number => a + Math.random() * (b - a);

const BUFFERS = new WeakMap<Ctx, { white: AudioBuffer; brown: AudioBuffer }>();
/** Three seconds of white and brown noise per context, made once. */
function buffers(ac: Ctx): { white: AudioBuffer; brown: AudioBuffer } {
  let b = BUFFERS.get(ac);
  if (!b) {
    const len = Math.floor(ac.sampleRate * 3);
    const white = ac.createBuffer(1, len, ac.sampleRate), brown = ac.createBuffer(1, len, ac.sampleRate);
    const w = white.getChannelData(0), br = brown.getChannelData(0);
    let s = 22222, last = 0;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const x = s / 2147483648 - 1;
      w[i] = x;
      last = (last + 0.02 * x) / 1.02;
      br[i] = last * 3.5;
    }
    b = { white, brown };
    BUFFERS.set(ac, b);
  }
  return b;
}

/** The shared brown-noise buffer, for sounds that shape their own noise. */
export function brownNoise(ac: Ctx): AudioBuffer { return buffers(ac).brown; }

/** Gain envelope: attack to `peak`, an optional hold (sagging to 75%), then an exponential decay. */
function env(ac: Ctx, out: Out, t: number, a: number, peak: number, d: number, hold = 0): GainNode {
  const g = ac.createGain();
  // Silent until the envelope starts: a gain is 1 before its first event, and a source started between
  // two samples can leak one full-level sample ahead of it (a click, loudest through bright filters).
  g.gain.value = 0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) g.gain.linearRampToValueAtTime(peak * 0.75, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  g.connect(out);
  return g;
}

function panned(ac: Ctx, out: Out, pan: number | undefined): Out {
  if (pan === undefined || typeof ac.createStereoPanner !== 'function') return out;
  const p = ac.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(out);
  return p;
}

function filter(ac: Ctx, type: BiquadFilterType, t: number, f: number, f2: number | undefined, dur: number, Q: number): BiquadFilterNode {
  const fl = ac.createBiquadFilter();
  fl.type = type;
  fl.Q.value = Q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  return fl;
}

export interface ToneOpts {
  t: number; f: number;
  /** Glide the pitch to f2 over `glide` seconds (default: the whole note). */
  f2?: number; glide?: number;
  type?: OscillatorType;
  a?: number; d?: number; hold?: number; peak?: number;
  detune?: number;
  /** Low-pass at lp, sweeping to lp2 over the note. */
  lp?: number; lp2?: number; Q?: number;
  /** Vibrato: [rate Hz, depth Hz]. */
  vib?: [number, number] | null;
  pan?: number;
}
/** One oscillator note. */
export function tone(ac: Ctx, out: Out, o: ToneOpts): void {
  const { t, f, f2, type = 'sine', a = 0.003, d = 0.15, hold = 0, peak = 0.3, detune = 0, lp, lp2, vib, pan } = o;
  const total = a + hold + d;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + (o.glide ?? total));
  let node: AudioNode = osc;
  if (lp) { const fl = filter(ac, 'lowpass', t, lp, lp2, total, o.Q ?? 0.7); node.connect(fl); node = fl; }
  node.connect(env(ac, panned(ac, out, pan), t, a, peak, d, hold));
  if (vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = vib[0]; lg.gain.value = vib[1];
    l.connect(lg); lg.connect(osc.frequency);
    l.start(t); l.stop(t + total + 0.05);
  }
  osc.start(t); osc.stop(t + total + 0.05);
}

export interface NoiseOpts {
  t: number;
  a?: number; d?: number; hold?: number; peak?: number;
  type?: BiquadFilterType; f?: number; f2?: number; glide?: number; Q?: number;
  brown?: boolean;
  pan?: number;
}
/** A burst of filtered noise; f2 sweeps the filter. */
export function noise(ac: Ctx, out: Out, o: NoiseOpts): void {
  const { t, a = 0.002, d = 0.1, hold = 0, peak = 0.3, type = 'bandpass', f = 1000, f2, Q = 1, brown = false, pan } = o;
  const total = a + hold + d;
  const src = ac.createBufferSource();
  const b = buffers(ac);
  src.buffer = brown ? b.brown : b.white;
  src.loop = true;
  const fl = filter(ac, type, t, f, f2, o.glide ?? total, Q);
  src.connect(fl);
  fl.connect(env(ac, panned(ac, out, pan), t, a, peak, d, hold));
  src.start(t, Math.random() * 2);
  src.stop(t + total + 0.05);
}

export interface FmOpts { t: number; f: number; f2?: number; ratio?: number; index?: number; d?: number; a?: number; peak?: number; pan?: number }
/** Two-operator FM: wood with a low ratio, metal with an inharmonic ratio and a high index. */
export function fm(ac: Ctx, out: Out, o: FmOpts): void {
  const { t, f, f2, ratio = 1.5, index = 300, d = 0.12, a = 0.001, peak = 0.3, pan } = o;
  const c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain();
  c.frequency.setValueAtTime(f, t);
  m.frequency.setValueAtTime(f * ratio, t);
  if (f2) { c.frequency.exponentialRampToValueAtTime(f2, t + d); m.frequency.exponentialRampToValueAtTime(f2 * ratio, t + d); }
  mg.gain.setValueAtTime(index, t);
  mg.gain.exponentialRampToValueAtTime(1, t + a + d);
  m.connect(mg); mg.connect(c.frequency);
  c.connect(env(ac, panned(ac, out, pan), t, a, peak, d));
  c.start(t); m.start(t);
  c.stop(t + a + d + 0.05); m.stop(t + a + d + 0.05);
}

/** A bell: a few partials, the higher ones dying sooner. `bright` scales the overtones. */
export function bell(ac: Ctx, out: Out, o: { t: number; f: number; d?: number; peak?: number; pan?: number; bright?: number }): void {
  const { t, f, d = 1.0, peak = 0.12, pan, bright = 1 } = o;
  const partials: [number, number][] = [[1, 1], [2.0, 0.45 * bright], [3.01, 0.22 * bright], [4.17, 0.1 * bright], [5.43, 0.05 * bright]];
  partials.forEach(([m, amp], i) => tone(ac, out, { t, f: f * m, d: d / (1 + i * 0.7), peak: peak * amp, a: 0.002, pan }));
}

/** Kalimba: a round sine with a short, slightly inharmonic tine overtone. */
export function kalimba(ac: Ctx, out: Out, o: { t: number; f: number; d?: number; peak?: number; pan?: number }): void {
  const { t, f, d = 0.45, peak = 0.1, pan } = o;
  tone(ac, out, { t, f, a: 0.003, d, peak, pan });
  tone(ac, out, { t, f: f * 5.4, a: 0.001, d: d * 0.12, peak: peak * 0.22, pan });
  noise(ac, out, { t, d: 0.01, peak: peak * 0.35, f: Math.min(f * 3, 4000), Q: 2, pan });
}

/** Marimba: a soft mallet on wood, with the bar's fourth-harmonic ring. */
export function marimba(ac: Ctx, out: Out, o: { t: number; f: number; d?: number; peak?: number; pan?: number }): void {
  const { t, f, d = 0.3, peak = 0.14, pan } = o;
  fm(ac, out, { t, f, ratio: 4, index: f * 0.5, d: d * 0.4, peak: peak * 0.5, pan });
  tone(ac, out, { t, f, a: 0.002, d, peak, pan });
}

/** One crackle of a fire. */
export function crackle(ac: Ctx, out: Out, t: number, amp = 1): void {
  noise(ac, out, { t, a: 0.001, d: R(0.003, 0.018), peak: amp * R(0.03, 0.12), type: 'highpass', f: R(1800, 4800), Q: 0.7, pan: R(-0.6, 0.6) });
}

/** Calls fn at random times averaging `rate` per second between t0 and t1. */
export function poisson(t0: number, t1: number, rate: number, fn: (t: number) => void): void {
  if (rate <= 0) return;
  let t = t0;
  for (;;) {
    t += -Math.log(1 - Math.random()) / rate;
    if (t >= t1) break;
    fn(t);
  }
}

export interface Bed { g: GainNode; stop: (t: number) => void }
/** A continuous noise bed for a loop. Its gain node lets a loop follow a parameter. */
export function bed(ac: Ctx, out: Out, o: { brown?: boolean; type?: BiquadFilterType; f?: number; Q?: number; gain?: number; lfo?: [number, number]; lfoGain?: [number, number] }): Bed {
  const { brown = true, type = 'lowpass', f = 400, Q = 0.7, gain = 0.1, lfo, lfoGain } = o;
  const src = ac.createBufferSource();
  src.buffer = brown ? buffers(ac).brown : buffers(ac).white;
  src.loop = true;
  const fl = ac.createBiquadFilter();
  fl.type = type; fl.frequency.value = f; fl.Q.value = Q;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(fl); fl.connect(g); g.connect(out);
  const extra: OscillatorNode[] = [];
  if (lfo) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = lfo[0]; lg.gain.value = lfo[1];
    l.connect(lg); lg.connect(fl.frequency); l.start(); extra.push(l);
  }
  if (lfoGain) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = lfoGain[0]; lg.gain.value = lfoGain[1] * gain;
    l.connect(lg); lg.connect(g.gain); l.start(); extra.push(l);
  }
  src.start(0, Math.random() * 2);
  return { g, stop: t => { src.stop(t); extra.forEach(x => x.stop(t)); } };
}

/** A car horn: two detuned saws through a low-pass. */
export function horn(ac: Ctx, out: Out, t: number, f: number, len: number, peak = 0.04, pan?: number): void {
  for (const m of [1, 1.26]) tone(ac, out, { t, f: f * m, type: 'sawtooth', a: 0.015, hold: len, d: 0.05, peak, lp: 1400, pan });
}

/** A short bird call. */
export function bird(ac: Ctx, out: Out, t: number, peak = 0.035): void {
  const base = R(2400, 3800), n = 2 + Math.floor(R(0, 3)), pan = R(-0.8, 0.8);
  for (let i = 0; i < n; i++) {
    tone(ac, out, { t: t + i * R(0.07, 0.11), f: base * R(0.9, 1.1), f2: base * R(1.15, 1.45), glide: 0.04, a: 0.005, d: 0.05, peak, pan });
  }
}

/** A car driving past in the distance. */
export function carPass(ac: Ctx, out: Out, t: number, peak = 0.05): void {
  const dur = R(2, 3.2), f = R(300, 500);
  noise(ac, out, { t, a: dur * 0.5, d: dur * 0.5, peak, f, f2: f * 0.55, Q: 0.8, brown: true, pan: R(-0.5, 0.5) });
}
