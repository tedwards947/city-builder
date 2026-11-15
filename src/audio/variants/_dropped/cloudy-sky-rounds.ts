import { buildTrack, chords, line, section, shift, transpose, vel, type Ev, type Voice } from '../../compose.ts';

export const meta = {
  song: 'Cloudy Sky',
  label: 'Rounds',
  blurb: 'Slower (62 BPM) and built like a round: the original E–A drone becomes a repeating ground, the theme grows into an eight-bar melody, and a second voice enters two bars behind an octave lower, joined by music-box drips. It gathers to a full final round, then settles into A minor, overcast rather than clearing.',
};

/*
 * Written as one continuous timeline (bars numbered from 1), then cut into sections.
 * Lanes: 0 lead, 1 canon follower, 2 drone (the original's voice 1), 3 bass, 4-6 pad, 7 music-box drips.
 */
const B = (bar: number) => (bar - 1) * 4;
const TOTAL_BARS = 48;

// Pad voicing, bass root, drone note, music-box drip notes (two per bar)
const CH: Record<string, [string, string, string, string, string]> = {
  CE: ['E3+G3+C4', 'C3', 'E3', 'G5', 'C5'],
  Am7: ['G3+C4+E4', 'A2', 'A3', 'E5', 'A4'],
  F: ['F3+A3+C4', 'F2', 'A3', 'C5', 'A4'],
  G: ['G3+B3+D4', 'G2', 'G3', 'D5', 'B4'],
  Em7: ['G3+B3+D4', 'E2', 'E3', 'B4', 'G4'],
  Am: ['E3+A3+C4', 'A2', 'A3', 'E5', 'A4'],
  E: ['E3+G#3+B3', 'E2', 'G#3', 'B4', 'G#4'],
};

// The original two bars grown into an eight-bar melody that works as a round at two bars' distance
const M = 'C4:2 F4:2 | G4:2 C5:2 | E5:3 D5:1 | C5:2 A4:2 | G4:1 E4:1 G4:2 | A4:2 C5:1 E5:1 | E5:2 D5:1 C5:1 | A4:4';
// Same opening, second half climbs higher
const M2 = 'C4:2 F4:2 | G4:2 C5:2 | E5:3 D5:1 | C5:2 A4:2 | G4:1 A4:1 C5:2 | E5:2 D5:1 E5:1 | G5:2 C5:1 D5:1 | E5:4';
// Interlude: the theme's fourths falling, darkening to E major before returning home
const N = 'A4:2 E4:2 | D5:2 G4:2 | B4:2 E4:2 | A4:4 | C5:2 F4:2 | B4:2 D5:2 | G#4:2 B4:2 | A4:4';
const CODA = 'C5:2 F5:2 | G5:2 E5:2 | D5:2 B4:2 | A4:4';

// Harmony, one chord per bar across the whole piece
const ground = (odd: string, n: number) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? odd : 'Am7'));
const HARM: string[] = [
  ...ground('CE', 28), // bars 1-28: the original's two-bar ground
  ...'F G Em7 Am F G E Am'.split(' '), // 29-36 interlude
  ...ground('F', 8), // 37-44 final round, warmer ground under the odd bars
  'F', 'Am7', 'Em7', 'Am', // 45-48 coda
];
// Where the follower enters (bars 15 and 23) its low F would rub the E drone: warm those bars to Fmaj7
HARM[15 - 1] = 'F';
HARM[23 - 1] = 'F';

// ---- lead ----
const lead: Voice = [
  ...line(M, B(5), 0.82),
  ...line(M2, B(13), 0.85),
  ...line(M, B(21), 0.85),
  ...line(N, B(29), 0.84),
  ...line(M2, B(37), 0.9),
  ...line(CODA, B(45), 0.62),
];

// ---- canon follower: the lead two bars later, an octave down ----
const inWin = (e: Ev) => (e.t >= B(15) && e.t < B(31)) || (e.t >= B(39) && e.t < B(47));
const follower = vel(transpose(shift(lead, 8), -12), 0.5).filter(inWin);

// ---- drone: the original's pulse, struck every two beats ----
function droneLane(): Voice {
  const out: Ev[] = [];
  HARM.forEach((c, i) => {
    const bar = i + 1;
    const v = bar <= 4 ? 0.3 + bar * 0.04 : bar >= 29 && bar <= 36 ? 0.3 : 0.38;
    out.push({ t: B(bar), pitch: CH[c][2], len: 4, vel: v });
    // the second strike rings over the barline only if the next bar keeps the same drone note
    const same = bar < TOTAL_BARS && CH[HARM[i + 1]][2] === CH[c][2];
    if (bar < TOTAL_BARS) out.push({ t: B(bar) + 2, pitch: CH[c][2], len: same ? 4 : 2, vel: v * 0.8 });
  });
  return out;
}

// ---- bass: absent at first, whole notes from the third round, pulsing in the final round ----
function bassLane(): Voice {
  const out: Ev[] = [];
  HARM.forEach((c, i) => {
    const bar = i + 1, r = CH[c][1];
    if (bar < 21) return;
    if (bar >= 37 && bar <= 44) {
      out.push({ t: B(bar), pitch: r, len: 2, vel: 0.56 }, { t: B(bar) + 2, pitch: r, len: 2, vel: 0.4 });
    } else {
      out.push({ t: B(bar), pitch: r, len: bar === TOTAL_BARS ? 8 : 4, vel: bar >= 45 ? 0.45 : 0.55 });
    }
  });
  return out;
}

// ---- pads: enter with the second voice, struck each bar ----
function padLanes(): Voice[] {
  const lanes: Voice[] = [[], [], []];
  HARM.forEach((c, i) => {
    const bar = i + 1;
    if (bar < 13) return;
    const v = bar < 21 ? 0.14 : bar < 37 ? 0.18 : bar < 45 ? 0.19 : 0.16;
    chords(`${CH[c][0]}:${bar === TOTAL_BARS ? 8 : 4}`, 3, B(bar), v).forEach((l, k) => lanes[k].push(...l));
  });
  return lanes;
}

// ---- music-box drips: offbeat high plucks; eighth-note figures in the final round ----
function drips(): Voice {
  const out: Ev[] = [];
  HARM.forEach((c, i) => {
    const bar = i + 1, [, , , hi, lo] = CH[c];
    if (bar < 3 || bar === TOTAL_BARS) return;
    if (bar >= 37 && bar <= 44) {
      // busier: hi, lo, hi on the offbeats
      [[0.5, hi], [1.5, lo], [2.5, hi], [3.5, lo]].forEach(([t, p]) =>
        out.push({ t: B(bar) + (t as number), pitch: p as string, len: 0.5, vel: 0.2 }));
    } else {
      const v = bar < 5 ? 0.22 : 0.2;
      out.push({ t: B(bar) + 1, pitch: hi, len: 0.5, vel: v }, { t: B(bar) + 3, pitch: lo, len: 0.5, vel: v * 0.85 });
    }
  });
  return out;
}

// Final bar: an A minor add9 shimmer above the last A
const lanes: Voice[] = [lead, follower, droneLane(), bassLane(), ...padLanes(), [...drips(), { t: B(48) + 1, pitch: 'B4', len: 6, vel: 0.16 }]];

/** Cut bars [from, from + n) out of the timeline as a section. Notes are trimmed a hair so a lane's notes don't stack. */
function cut(name: string, from: number, n: number) {
  const s = B(from), e = B(from + n);
  return section(name, n * 4, lanes.map(l => l
    .filter(x => x.t >= s - 1e-6 && x.t < e - 1e-6)
    .map(x => ({ ...x, t: Math.round((x.t - s) * 1e6) / 1e6, len: Math.max(0.1, x.len - 0.04) }))));
}

const parts = [
  cut('ground', 1, 4),
  cut('solo', 5, 8),
  cut('round', 13, 8),
  cut('round-3', 21, 8),
  cut('interlude', 29, 8),
  cut('final-round', 37, 8),
  cut('coda', 45, 4),
];

export const track = buildTrack({
  name: 'Cloudy Sky',
  genre: 'ambient',
  bpm: 62,
  sections: parts,
  // 48 bars = 192 beats at 62 BPM = 3:06
  form: parts.map(p => p.name),
});
