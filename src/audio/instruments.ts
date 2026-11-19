import type { Instrument } from './types';
import { marimba, tone } from './sfx/synth';

// Instruments for tracks that name one per voice (Track.instruments), built from the same wood sounds as
// the sound effects (sfx/synth.ts). Each call schedules one note on `out` at `t`, `dur` seconds as written.

type Ctx = BaseAudioContext;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Lifts the instruments to sit level with the rest of the soundtrack. */
const LEVEL = 2.2;

export function playInstrument(ctx: Ctx, out: AudioNode, inst: Instrument, f: number, t: number, dur: number, vel: number): void {
  const v = vel * LEVEL;
  switch (inst) {
    case 'marimba': {
      // Wood doesn't sustain, so a long note is rolled the way players do it: soft alternating strokes
      // that keep the bar sounding. The first stroke has the mallet's click; roll strokes are just the bar.
      const ring = clamp(0.45 * Math.sqrt(300 / f), 0.18, 0.9);
      marimba(ctx, out, { t, f, d: ring, peak: 0.32 * v });
      if (dur < 1.2) return; // only genuinely long notes are rolled
      const gap = 0.085 * clamp(Math.sqrt(300 / f), 1, 1.5); // low bars ring longer, so they roll slower
      for (let at = t + gap, i = 0; at < t + dur - 0.05; at += gap, i++) {
        tone(ctx, out, { t: at + (Math.random() - 0.5) * 0.008, f, a: 0.002, d: ring, peak: 0.32 * v * (i % 2 ? 0.42 : 0.5) });
      }
      return;
    }
  }
}

/** A small warm wooden room: returns its input, feeding `dest` dry plus a 0.9 s reverb. */
export function makeRoom(ctx: Ctx, dest: AudioNode): GainNode {
  const bus = ctx.createGain();
  bus.connect(dest);
  const verb = ctx.createConvolver();
  verb.buffer = roomImpulse(ctx, 0.9);
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  bus.connect(verb); verb.connect(wet); wet.connect(dest);
  return bus;
}

/** A stereo impulse response: decaying noise that loses its highs as it fades. */
function roomImpulse(ctx: Ctx, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      const k = 0.25 + 0.7 * (t / seconds); // the low-pass closes as the tail fades
      lp += (1 - k) * ((Math.random() * 2 - 1) - lp);
      const onset = Math.min(1, t / 0.02); // 20 ms pre-delay swell
      data[i] = lp * onset * Math.exp((-6.9 * t) / seconds);
    }
  }
  return buf;
}
