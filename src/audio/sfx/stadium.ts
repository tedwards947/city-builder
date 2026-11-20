// Stadium event sounds: the owner's picks from the review page (Nov 2026).
// - Kick-off: "Horn into fanfare". A wooden stadium horn (parp, paaarp), then a felt drum roll,
//   a marimba and kalimba fanfare, and a cheer.
// - During the match: one of "Distant cheer", "Goal, with rattle" and "So close".
// - Full time: "Final whistle". Three whistles, a last cheer, and applause thinning out.
// Everything is heard from a few streets away, so it is low-passed. The crowd is a dozen
// voices and some breath shaped by three vowel filters.

import { N, R, fm, kalimba, marimba, noise, poisson, tone, whiteNoise } from './synth';

type Ctx = BaseAudioContext;
type Out = AudioNode;

/** A low-pass that puts a sound a few streets away. Returns the node to play into. */
function far(ac: Ctx, out: Out, lp = 1800): AudioNode {
  const fl = ac.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.5;
  fl.connect(out);
  return fl;
}

type Vowel = 'ah' | 'oh' | 'oo';
const VOWEL: Record<Vowel, [number, number, number]> = { ah: [720, 1200, 2600], oh: [480, 840, 2600], oo: [340, 720, 2500] };

interface CrowdOpts {
  t: number; len: number; peak: number;
  /** Level across the sound: [x 0..1 of len, level 0..1] points. */
  shape: [number, number][];
  /** Pitch of every voice together, in cents: [x, cents] points (a cheer rises). */
  bend?: [number, number][];
  /** Mouth shape: [x, vowel] points, gliding between them. */
  vowels?: [number, Vowel][];
  voices?: number;
}

/** A crowd from a few streets away: breath and a dozen low voices through three shared vowel formants. */
function crowd(ac: Ctx, out: Out, o: CrowdOpts): void {
  const { t, len, peak, shape, bend, vowels = [[0, 'ah']], voices = 12 } = o;
  const end = t + len + 0.05;
  const g = ac.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0.0001, t);
  for (const [x, v] of shape) g.gain.linearRampToValueAtTime(Math.max(0.0001, v * peak), t + x * len);
  g.connect(far(ac, out, 1500));

  const mouth = ac.createGain();
  for (let k = 0; k < 3; k++) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = [2.2, 3, 3.5][k];
    bp.frequency.setValueAtTime(VOWEL[vowels[0][1]][k], t);
    for (const [x, v] of vowels.slice(1)) bp.frequency.linearRampToValueAtTime(VOWEL[v][k], t + x * len);
    const lg = ac.createGain();
    lg.gain.value = [1, 0.5, 0.16][k] * 5;
    mouth.connect(bp); bp.connect(lg); lg.connect(g);
  }

  // Breath: white noise into the mouth.
  const src = ac.createBufferSource();
  src.buffer = whiteNoise(ac); src.loop = true;
  const bg = ac.createGain(); bg.gain.value = 0.5;
  src.connect(bg); bg.connect(mouth);
  src.start(t, Math.random() * 2); src.stop(end);

  let bender: ConstantSourceNode | null = null;
  if (bend && typeof ac.createConstantSource === 'function') {
    bender = ac.createConstantSource();
    bender.offset.setValueAtTime(0, t);
    for (const [x, c] of bend) bender.offset.linearRampToValueAtTime(c, t + x * len);
    bender.start(t); bender.stop(end);
  }
  for (let i = 0; i < voices; i++) {
    const f = 150 * Math.pow(360 / 150, Math.random());
    const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f;
    const vib = ac.createOscillator(), vg = ac.createGain();
    vib.frequency.value = R(4, 7); vg.gain.value = f * R(0.012, 0.03);
    vib.connect(vg); vg.connect(osc.frequency);
    if (bender) bender.connect(osc.detune);
    // Each voice drifts in and out on its own, so it reads as people and not a chord.
    const vgain = ac.createGain(); vgain.gain.value = 0.05;
    const am = ac.createOscillator(), amg = ac.createGain();
    am.frequency.value = R(0.4, 1.6); amg.gain.value = 0.045;
    am.connect(amg); amg.connect(vgain.gain);
    osc.connect(vgain); vgain.connect(mouth);
    for (const n of [osc, vib, am]) { n.start(t); n.stop(end); }
  }
}

/** Applause from far off: many tiny claps. level(x) shapes it across len (0..1); wood claps wood blocks. */
function applause(ac: Ctx, out: Out, t: number, len: number, rate: number, peak: number, level: (x: number) => number, wood = false): void {
  const o = far(ac, out, 2600);
  poisson(t, t + len, rate, x => {
    const a = level((x - t) / len);
    if (a < 0.03 || Math.random() > a) return;
    const pan = R(-0.35, 0.35);
    if (wood) knock(ac, o, x, R(700, 1150), peak * R(0.5, 1), pan, 0.03);
    else noise(ac, o, { t: x, d: R(0.008, 0.02), peak: peak * R(0.5, 1), f: R(900, 2300), Q: 1.3, pan });
  });
}
/** A wood-block knock; a lower f is a bigger block. */
function knock(ac: Ctx, out: Out, t: number, f: number, peak: number, pan?: number, d = 0.07): void {
  fm(ac, out, { t, f, ratio: 1.47, index: f * 0.7, d, peak, pan });
  noise(ac, out, { t, d: 0.012, peak: peak * 0.25, type: 'lowpass', f: 1800, pan });
}
/** A wooden football rattle: a ratchet of quick knocks. */
function rattle(ac: Ctx, out: Out, t: number, len: number, peak: number, pan: number): void {
  const rate = 22, n = Math.floor(len * rate);
  for (let i = 0; i < n; i++) {
    const a = Math.sin(Math.PI * (i + 0.5) / n) ** 0.6;
    knock(ac, out, t + i / rate + R(0, 0.006), 950 * (i % 2 ? 0.92 : 1), peak * a, pan, 0.035);
  }
}
/** The referee's whistle, in clay: a round pea-whistle trill. */
function refWhistle(ac: Ctx, out: Out, t: number, len: number, peak: number): void {
  const o = far(ac, out, 3000), f = 2100;
  tone(ac, o, { t, f, type: 'triangle', a: 0.012, hold: len, d: 0.06, peak, vib: [26, f * 0.045] });
  noise(ac, o, { t, a: 0.01, hold: len, d: 0.05, peak: peak * 0.35, f, Q: 6 });
}
/** A felt-headed bass drum. */
function feltDrum(ac: Ctx, out: Out, t: number, peak: number, f = 72): void {
  tone(ac, out, { t, f: f * 1.4, f2: f, glide: 0.06, a: 0.004, d: 0.45, peak });
  noise(ac, out, { t, d: 0.05, peak: peak * 0.35, type: 'lowpass', f: 300 });
}
/** A wooden stadium horn: a reedy low fifth with a breathy edge. */
function woodHorn(ac: Ctx, out: Out, t: number, f: number, len: number, peak: number): void {
  const o = far(ac, out, 1400);
  for (const s of [0, 7]) {
    const ff = f * Math.pow(2, s / 12);
    tone(ac, o, { t, f: ff, type: 'sawtooth', a: 0.07, hold: len, d: 0.22, peak, vib: [4.5, ff * 0.006], lp: ff * 3.2 });
  }
  noise(ac, o, { t, a: 0.06, hold: len, d: 0.15, peak: peak * 0.25, f: f * 2, Q: 3 });
}

/** Kick-off: the horn, then the felt drum roll and fanfare, and the crowd answering. About 6.6 s. */
export function kickoff(ac: Ctx, o: Out, t: number): void {
  woodHorn(ac, o, t, N('A2'), 0.25, 0.055);
  woodHorn(ac, o, t + 0.55, N('A2'), 0.95, 0.06);
  const b = t + 1.75;
  for (let i = 0; i < 14; i++) feltDrum(ac, o, b + i * 0.07, 0.03 + 0.06 * i / 13, 95);
  const fanfare: [string, number, number][] = [['G4', 1.05, 0.5], ['G4', 1.25, 0.3], ['C5', 1.45, 0.4], ['E5', 1.65, 0.4], ['G5', 1.85, 1.4]];
  for (const [n, dt, d] of fanfare) {
    marimba(ac, o, { t: b + dt, f: N(n), d, peak: 0.1 });
    kalimba(ac, o, { t: b + dt, f: N(n) * 2, d: d * 0.8, peak: 0.035 });
  }
  feltDrum(ac, o, b + 1.85, 0.13);
  crowd(ac, o, { t: b + 1.8, len: 2.8, peak: 0.08, shape: [[0.12, 1], [0.4, 0.6], [1, 0]], bend: [[0, 0], [0.15, 200], [1, 50]] });
  applause(ac, o, b + 2.0, 2.5, 65, 0.024, x => Math.pow(1 - x, 1.3));
}

/** During the match, three ways: 0 a distant cheer (3 s), 1 a goal with a rattle (4.2 s), 2 a near miss (3.2 s). */
export function cheer(ac: Ctx, o: Out, t: number, which: number): void {
  if (which === 1) {
    crowd(ac, o, { t, len: 4.2, peak: 0.075, voices: 16, shape: [[0.06, 0.5], [0.12, 1], [0.5, 0.75], [1, 0]], bend: [[0, -80], [0.12, 320], [1, 150]], vowels: [[0, 'oh'], [0.12, 'ah']] });
    rattle(ac, o, t + 0.35, 1.9, 0.032, 0.2);
    feltDrum(ac, o, t + 1.0, 0.07); feltDrum(ac, o, t + 1.45, 0.07);
    applause(ac, o, t + 0.5, 3.5, 70, 0.022, x => Math.pow(1 - x, 1.3));
  } else if (which === 2) {
    crowd(ac, o, { t, len: 3.2, peak: 0.055, shape: [[0.3, 0.85], [0.5, 1], [1, 0]], bend: [[0, -100], [0.4, 250], [0.95, -350]], vowels: [[0, 'oo'], [0.45, 'oh'], [0.9, 'oo']] });
    applause(ac, o, t + 2.1, 1.6, 30, 0.018, x => 1 - x);
  } else {
    crowd(ac, o, { t, len: 3.0, peak: 0.06, shape: [[0.12, 1], [0.35, 0.7], [1, 0]], bend: [[0, -50], [0.15, 200], [1, 80]], vowels: [[0, 'oh'], [0.15, 'ah']] });
    applause(ac, o, t + 0.4, 2.4, 55, 0.02, x => Math.pow(1 - x, 1.5));
  }
}

/** Full time: peep, peep, peeeep, a last cheer, and applause thinning out. About 7.4 s. */
export function fullTime(ac: Ctx, o: Out, t: number): void {
  for (const [dt, len] of [[0, 0.16], [0.36, 0.16], [0.72, 0.95]]) refWhistle(ac, o, t + dt, len, 0.026);
  crowd(ac, o, { t: t + 1.6, len: 5.8, peak: 0.05, shape: [[0.08, 1], [0.3, 0.55], [1, 0]], bend: [[0, 0], [0.1, 180], [1, -60]] });
  applause(ac, o, t + 1.7, 5.5, 85, 0.024, x => Math.pow(1 - x, 1.8));
}
