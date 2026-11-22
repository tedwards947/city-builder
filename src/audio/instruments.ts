import type { Instrument } from './types';
import { kalimba, marimba, noise, tone } from './sfx/synth';

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
    case 'kalimba':
      kalimba(ctx, out, { t, f, d: clamp(0.8 * Math.sqrt(500 / f), 0.3, 1.2), peak: 0.26 * v });
      return;
    case 'steelpan': return steelpan(ctx, out, f, t, dur, v);
    case 'pluck': {
      // A synth pluck: a bright saw whose filter snaps shut, over a sine for body.
      const d = clamp(0.16 + dur * 0.3, 0.18, 0.55);
      tone(ctx, out, { t, f, type: 'sawtooth', a: 0.002, d, peak: 0.26 * v, lp: Math.min(f * 7, 9000), lp2: Math.max(f * 1.1, 300), Q: 2 });
      tone(ctx, out, { t, f, a: 0.002, d: d * 0.8, peak: 0.26 * v });
      return;
    }
    case 'flute': return flute(ctx, out, f, t, dur, v);
    case 'vox': return vox(ctx, out, f, t, dur, v);
    case 'pad': {
      // Two detuned saws behind a soft low-pass. The slow attack swells into each note, so a pad written
      // as one chord per beat breathes like the sidechain pump of a dance mix.
      const a = Math.min(dur * 0.45, 0.35), hold = Math.max(0.01, dur - a);
      for (const detune of [-9, 9]) {
        tone(ctx, out, { t, f, type: 'sawtooth', detune, a, hold, d: 0.3, peak: 0.04 * v, lp: 1500, lp2: 800, Q: 0.5 });
      }
      return;
    }
    case 'sub': {
      // A round sine bass, with a filtered octave so it still reads on small speakers.
      const hold = Math.max(0.01, dur * 0.8);
      tone(ctx, out, { t, f, a: 0.006, hold, d: 0.12, peak: 0.1 * v });
      tone(ctx, out, { t, f: f * 2, type: 'triangle', a: 0.006, hold, d: 0.1, peak: 0.05 * v, lp: 900 });
      return;
    }
    case 'kick':
      // A soft, round kick: a sine that drops from 150 Hz to 48 Hz, with a muffled beater.
      tone(ctx, out, { t, f: 150, f2: 48, glide: 0.1, a: 0.002, d: 0.34, peak: 0.33 * v });
      noise(ctx, out, { t, d: 0.015, peak: 0.05 * v, type: 'lowpass', f: 1400 });
      return;
    case 'clap':
      // Three quick hand slaps and a short tail.
      for (const dt of [0, 0.011, 0.022]) noise(ctx, out, { t: t + dt, a: 0.001, d: 0.012, peak: 0.8 * v, f: 1400, Q: 1.1 });
      noise(ctx, out, { t: t + 0.03, a: 0.001, d: 0.13, peak: 0.6 * v, f: 1300, Q: 0.9 });
      return;
    case 'shaker':
      noise(ctx, out, { t, a: 0.008, d: 0.05, peak: 0.45 * v, type: 'highpass', f: 6500, Q: 0.7 });
      return;
    case 'khaen': return khaen(ctx, out, f, t, dur, v);
    case 'phin': {
      // The phin, a three-string lute (played electric in modern molam): a twangy pick whose bright filter
      // snaps down with a little resonance, the string bending into pitch, over a triangle for body.
      const ring = clamp(0.3 + dur * 0.35, 0.3, 0.9);
      tone(ctx, out, { t, f: f * 1.012, f2: f, glide: 0.03, type: 'sawtooth', a: 0.002, d: ring, peak: 0.2 * v, lp: Math.min(f * 10, 9000), lp2: Math.max(f * 1.6, 450), Q: 4 });
      tone(ctx, out, { t, f, type: 'triangle', a: 0.002, d: ring * 0.9, peak: 0.14 * v });
      return;
    }
    case 'ching':
      // Ching: small thick hand cymbals struck open, a bright inharmonic ring.
      for (const [pf, k, d] of [[2630, 1, 0.7], [3910, 0.7, 0.5], [5270, 0.5, 0.35], [7020, 0.3, 0.25]]) {
        tone(ctx, out, { t, f: pf * (1 + (Math.random() - 0.5) * 0.004), a: 0.001, d, peak: 0.036 * k * v });
      }
      noise(ctx, out, { t, d: 0.02, peak: 0.13 * v, type: 'highpass', f: 5000 });
      return;
    case 'chap':
      // Chap: the same cymbals clapped together and held, a dry choked click.
      noise(ctx, out, { t, a: 0.001, d: 0.06, peak: 0.5 * v, f: 3200, Q: 1.4 });
      tone(ctx, out, { t, f: 2630, a: 0.001, d: 0.07, peak: 0.032 * v });
      return;
    case 'cowbell':
      // Cowbell: two clanging square tones a wide fifth apart, rounded off, with the stick's knock.
      for (const [pf, k] of [[562, 1], [845, 0.75]]) {
        tone(ctx, out, { t, f: pf, type: 'square', a: 0.001, d: 0.28, peak: 0.07 * k * v, lp: 3200, lp2: 1600, Q: 1.5 });
      }
      noise(ctx, out, { t, d: 0.012, peak: 0.12 * v, f: 2400, Q: 1.2 });
      return;
    case 'bass': {
      // Electric bass: a round triangle that holds for most of the note and lets go just before the next,
      // so repeated notes on one pitch are each heard, over a plucked layer (a saw growl that closes
      // quickly and the finger's thump) that accents every attack.
      const hold = Math.max(0.01, dur * 0.72 - 0.004);
      tone(ctx, out, { t, f, type: 'triangle', a: 0.004, hold, d: 0.05, peak: 0.08 * v });
      tone(ctx, out, { t, f, type: 'triangle', a: 0.002, hold: 0.015, d: 0.25, peak: 0.08 * v });
      tone(ctx, out, { t, f, type: 'sawtooth', a: 0.003, hold: Math.min(hold, 0.12), d: 0.08, peak: 0.05 * v, lp: Math.min(f * 8, 1400), lp2: Math.max(f * 2, 160), Q: 1.5 });
      tone(ctx, out, { t, f: f * 2, a: 0.002, d: 0.05, peak: 0.05 * v });
      return;
    }
    case 'snare':
      // A tight, dry snare: a short body tone and a burst of rattle.
      tone(ctx, out, { t, f: 200, f2: 160, glide: 0.05, a: 0.001, d: 0.07, peak: 0.22 * v });
      noise(ctx, out, { t, a: 0.001, d: 0.13, peak: 0.6 * v, f: 2200, Q: 0.7 });
      return;
  }
}

/**
 * Khaen: the bamboo mouth organ of Laos and Isan, a free reed in each pipe. Reedy and bright (a saw and a
 * square behind a pipe-like low-pass), speaking quickly with a small scoop and a breath of air. Players
 * breathe in and out without stopping, so long notes waver gently with the breath.
 */
function khaen(ctx: Ctx, out: AudioNode, f: number, t: number, dur: number, v: number): void {
  const a = 0.025, hold = Math.max(0.01, dur - a - 0.03);
  const vib: [number, number] | null = dur > 0.6 ? [4.5, f * 0.003] : null;
  const lp = Math.min(f * 6, 4200), lp2 = Math.min(f * 4.5, 3400);
  tone(ctx, out, { t, f: f * 0.99, f2: f, glide: 0.03, type: 'sawtooth', a, hold, d: 0.07, peak: 0.08 * v, lp, lp2, Q: 1.2, vib });
  tone(ctx, out, { t, f: f * 0.99, f2: f, glide: 0.03, type: 'square', detune: 5, a, hold, d: 0.07, peak: 0.045 * v, lp: lp * 0.8, Q: 0.8, vib });
  noise(ctx, out, { t, a: 0.02, hold: hold * 0.5, d: 0.1, peak: 0.018 * v, f: Math.min(f * 2, 5000), Q: 3 }); // breath on the reed
}

/** Steel pan: a strong fundamental with the octave blooming in a moment late and a quick third partial. */
function steelpan(ctx: Ctx, out: AudioNode, f: number, t: number, dur: number, v: number): void {
  const ring = clamp(0.8 * Math.sqrt(400 / f), 0.35, 1.1);
  const stroke = (at: number, k: number, stick: boolean) => {
    tone(ctx, out, { t: at, f, a: 0.004, d: ring, peak: 0.24 * v * k });
    tone(ctx, out, { t: at, f: f * 2, a: 0.018, d: ring * 0.55, peak: 0.1 * v * k });
    tone(ctx, out, { t: at, f: f * 3.01, a: 0.002, d: ring * 0.22, peak: 0.035 * v * k });
    if (stick) noise(ctx, out, { t: at, d: 0.012, peak: 0.035 * v, f: Math.min(f * 4, 5000), Q: 1.5 });
  };
  stroke(t, 1, true);
  if (dur < 1.2) return;
  // Pan players roll long notes too.
  for (let at = t + 0.09, i = 0; at < t + dur - 0.05; at += 0.09, i++) stroke(at + (Math.random() - 0.5) * 0.008, i % 2 ? 0.34 : 0.42, false);
}

/** Pan flute: a breathy sine that scoops up into the note, with a chiff of air at the start. */
function flute(ctx: Ctx, out: AudioNode, f: number, t: number, dur: number, v: number): void {
  const hold = Math.max(0.01, dur - 0.08);
  const vib: [number, number] | null = dur > 0.45 ? [5.2, f * 0.005] : null;
  tone(ctx, out, { t, f: f * 0.985, f2: f, glide: 0.05, a: 0.05, hold, d: 0.18, peak: 0.1 * v, vib });
  tone(ctx, out, { t, f: f * 2, a: 0.05, hold, d: 0.12, peak: 0.011 * v });
  noise(ctx, out, { t, a: 0.03, hold: hold * 0.6, d: 0.15, peak: 0.022 * v, f, Q: 5 }); // breath around the pitch
  noise(ctx, out, { t, a: 0.004, d: 0.045, peak: 0.025 * v, f: Math.min(f * 3, 6000), Q: 1 }); // the chiff
}

/** A vocal chop: a sung "ah" (a saw through three vowel formants) over a sine, sliding up into the pitch. */
function vox(ctx: Ctx, out: AudioNode, f: number, t: number, dur: number, v: number): void {
  const a = 0.012, hold = Math.max(0.01, dur * 0.85 - a), d = 0.1, end = t + a + hold + d;
  const peak = 0.18 * v;
  const g = ctx.createGain();
  g.gain.value = 0; // silent before the note, as in sfx/synth.ts env()
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.linearRampToValueAtTime(peak * 0.8, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(out);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f * 0.97, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  for (const [fc, Q, amp] of [[800, 4, 1], [1250, 5, 0.6], [2600, 8, 0.25]]) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = Q;
    const fg = ctx.createGain();
    fg.gain.value = amp;
    osc.connect(bp); bp.connect(fg); fg.connect(g);
  }
  const body = ctx.createOscillator();
  body.frequency.setValueAtTime(f * 0.97, t);
  body.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  const bg = ctx.createGain();
  bg.gain.value = 0.35;
  body.connect(bg); bg.connect(g);
  const stops = [osc, body];
  if (dur > 0.5) { // a little vibrato on held notes
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 5.5; lg.gain.value = f * 0.006;
    lfo.connect(lg); lg.connect(osc.frequency); lg.connect(body.frequency);
    stops.push(lfo);
  }
  for (const s of stops) { s.start(t); s.stop(end + 0.05); }
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
