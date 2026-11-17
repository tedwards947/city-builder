// npm run balance:tune [-- options]
//
// Auto-tuner: a deterministic steepest-descent search over the PC keys the variants
// set (src/balance/tune.ts), scored by the PC targets on the fresh town.
// It proposes a number set; it changes nothing in the game.
//
// Options:
//   --start A|B|C|D|T    variant to start from (default B; T = src/balance/tunedT.ts, the current best)
//   --budget 900         evaluations (each one is the PC suite on the fresh town; a round is 42, so ~20 rounds; ~50 min with 9 workers)
//   --days 300           game days per run
//   --workers N          parallel processes (scripts/balance-pool.mjs; default cores − 1, max 8; 1 = this process)
//   --saves [ids]        also score every candidate on testcity1 and cities/gen-*-t10000 (slower, better);
//                        a comma list (e.g. --saves testcity1) keeps only those
//   --from <file>        start from a previous tuner result's best numbers (its start is kept as the label)
//   --out <file>         default balance-results/tune-<start>.json
//
// Then grade the result on every city as a 6th variant 'T':
//   npm run balance -- --suite pc --tuned balance-results/tune-B.json

import { createServer } from 'vite';
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const opt = (name) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : undefined; };
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const start = opt('--start') ?? 'B';
const out = resolve(opt('--out') ?? join(root, 'balance-results', `tune-${start}.json`));

const days = Number(opt('--days') ?? 300);
const workers = opt('--workers') !== undefined ? Number(opt('--workers')) : undefined;
const cities = [{ id: 'fresh-128', kind: 'fresh', size: 128, seed: 7 }];
const savesArg = args.includes('--saves') ? (opt('--saves') && !opt('--saves').startsWith('--') ? opt('--saves').split(',') : null) : undefined;
if (savesArg !== undefined) {
  const dir = join(root, 'cities');
  const files = [join(dir, 'testcity1.citysave.json'), join(homedir(), 'Downloads', 'testcity1.citysave.json')].filter(existsSync).slice(0, 1);
  if (existsSync(dir)) files.push(...readdirSync(dir).filter((f) => /^gen-.*-t10000\.citysave\.json$/.test(f)).sort().map((f) => join(dir, f)));
  for (const f of files) if (!savesArg || savesArg.includes(basename(f).replace(/\.citysave\.json$/, ''))) cities.push({ id: basename(f).replace(/\.citysave\.json$/, ''), kind: 'save', text: readFileSync(f, 'utf8') });
}

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
let pool = null;
try {
  const { tune, diff, localEvaluator } = await server.ssrLoadModule('/src/balance/tune.ts');
  const { VARIANT_VALUES } = await server.ssrLoadModule('/src/ui/pcVariantValues.ts');
  const { TUNED_T } = await server.ssrLoadModule('/src/balance/tunedT.ts');
  const from = opt('--from') ? JSON.parse(readFileSync(resolve(opt('--from')), 'utf8')) : null;
  const startValues = from ? from.best.values : start === 'T' ? TUNED_T : VARIANT_VALUES[start];
  if (workers !== 1) {
    const { createPool } = await import('./balance-pool.mjs');
    pool = createPool({ cities, days, ...(workers ? { workers } : {}) });
  }
  const evaluateMany = pool ? (trees) => pool.evaluateAll(trees) : localEvaluator(cities, days);
  const t0 = Date.now();
  console.log(`cities: ${cities.map((c) => c.id).join(', ')}; ${pool ? 'pool' : 'one process'}`);
  const r = await tune(start, evaluateMany, { budget: Number(opt('--budget') ?? 900), log: (l) => console.log(l), startValues });
  const result = {
    schema: 'city-builder/balance-tune@2',
    generatedAt: new Date().toISOString(),
    durationSec: Math.round((Date.now() - t0) / 1000),
    cities: cities.map((c) => c.id),
    days,
    from: opt('--from') ?? null,
    ...r,
    changedFromStart: diff(startValues, r.best.values),
    changedFromB: diff(VARIANT_VALUES.B, r.best.values),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(`\n${start}: ${r.startEval.pass}/${r.startEval.graded} → ${r.best.pass}/${r.best.graded} (score ${r.startEval.score} → ${r.best.score}) in ${r.evals} evals, ${result.durationSec}s\nwritten ${out}`);
} finally {
  if (pool) await pool.close();
  await server.close();
}
