// npm run balance:tune [-- options]
//
// Auto-tuner: a deterministic steepest-descent search over the PC keys the variants
// set (src/balance/tune.ts), scored by the PC targets on the fresh town.
// It proposes a number set; it changes nothing in the game.
//
// Options:
//   --start A|B|C|D      variant to start from (default B)
//   --budget 150         evaluations (each one is the PC suite on the fresh town)
//   --days 300           game days per run
//   --workers N          parallel processes (scripts/balance-pool.mjs; default cores − 1, max 8; 1 = this process)
//   --saves              also score every candidate on testcity1 and cities/gen-*-t10000 (slower, better)
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
if (args.includes('--saves')) {
  const dir = join(root, 'cities');
  const files = [join(dir, 'testcity1.citysave.json'), join(homedir(), 'Downloads', 'testcity1.citysave.json')].filter(existsSync).slice(0, 1);
  if (existsSync(dir)) files.push(...readdirSync(dir).filter((f) => /^gen-.*-t10000\.citysave\.json$/.test(f)).sort().map((f) => join(dir, f)));
  for (const f of files) cities.push({ id: basename(f).replace(/\.citysave\.json$/, ''), kind: 'save', text: readFileSync(f, 'utf8') });
}

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
let pool = null;
try {
  const { tune, diff, localEvaluator } = await server.ssrLoadModule('/src/balance/tune.ts');
  const { VARIANT_VALUES } = await server.ssrLoadModule('/src/ui/pcVariantValues.ts');
  if (workers !== 1) {
    const { createPool } = await import('./balance-pool.mjs');
    pool = createPool({ cities, days, ...(workers ? { workers } : {}) });
  }
  const evaluateMany = pool ? (trees) => pool.evaluateAll(trees) : localEvaluator(cities, days);
  const t0 = Date.now();
  console.log(`cities: ${cities.map((c) => c.id).join(', ')}; ${pool ? 'pool' : 'one process'}`);
  const r = await tune(start, evaluateMany, { budget: Number(opt('--budget') ?? 150), log: (l) => console.log(l) });
  const result = {
    schema: 'city-builder/balance-tune@2',
    generatedAt: new Date().toISOString(),
    durationSec: Math.round((Date.now() - t0) / 1000),
    cities: cities.map((c) => c.id),
    days,
    ...r,
    changedFromStart: diff(VARIANT_VALUES[start], r.best.values),
    changedFromB: diff(VARIANT_VALUES.B, r.best.values),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(`\n${start}: ${r.startEval.pass}/${r.startEval.graded} → ${r.best.pass}/${r.best.graded} (score ${r.startEval.score} → ${r.best.score}) in ${r.evals} evals, ${result.durationSec}s\nwritten ${out}`);
} finally {
  if (pool) await pool.close();
  await server.close();
}
