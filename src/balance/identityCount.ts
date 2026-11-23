// Balance Lab study (ENGINEER 3, 2026-11-22): neighbourhood identity label shares on a city, and the raw trait
// spreads behind them. Run: node scripts/identity-count.mjs <city files...>
import { BALANCE } from '../data/balance';
import { cellIdentities, IDENTITY_TYPES } from '../sim/identity';
import { loadSaveText, startSim } from './world';

export function identityCount(text: string) {
  const w = loadSaveText(text);
  startSim(w).tick(2 * BALANCE.ticksPerDay);
  const ids = [...cellIdentities(w).values()];
  const counts = Object.fromEntries(IDENTITY_TYPES.map(t => [t, ids.filter(i => i.type === t).length]));
  const spread = (k: keyof (typeof ids)[number]['raw']) => {
    const xs = ids.map(i => i.raw[k]).sort((a, b) => a - b);
    const q = (p: number) => Math.round((xs[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0) * 100) / 100;
    return `${q(0.1)}/${q(0.5)}/${q(0.9)}`;
  };
  return {
    pop: w.stats.population, cells: ids.length, counts,
    vibeOff: (['vibeEgalitarian', 'vibeGreen', 'vibePlanned'] as const).map(k => { let n = 0, far = 0; for (const v of w.layers[k]) { if (v !== 128) n++; if (Math.abs(v - 128) > 8) far++; } return `${k} ${n} off, ${far} by >8`; }),
    character: w.character,
    rawP10P50P90: { egalitarian: spread('egalitarian'), green: spread('green'), planned: spread('planned'), density: spread('density'), wealth: spread('wealth'), shops: spread('shops'), industry: spread('industry') },
  };
}
