// npm run balance:tune [-- options]
//
// Auto-tuner: a deterministic coordinate search over the PC keys the variants
// set (src/balance/tune.ts), scored by the PC targets on the fresh town.
// It proposes a number set; it changes nothing in the game.
//
// Options:
//   --start A|B|C|D      variant to start from (default B)
//   --budget 150         evaluations (each one is the PC suite on the fresh town)
//   --days 300           game days per run
//   --out <file>         default balance-results/tune-<start>.json
//
// Then grade the result on every city as a 6th variant 'T':
//   npm run balance -- --suite pc --tuned balance-results/tune-B.json

import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : undefined; };
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const start = opt('--start') ?? 'B';
const out = resolve(opt('--out') ?? join(root, 'balance-results', `tune-${start}.json`));

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
try {
  const { tune, diff } = await server.ssrLoadModule('/src/balance/tune.ts');
  const { VARIANT_VALUES } = await server.ssrLoadModule('/src/ui/pcVariantValues.ts');
  const t0 = Date.now();
  const r = tune(start, [{ id: 'fresh-128', kind: 'fresh', size: 128, seed: 7 }], {
    days: Number(opt('--days') ?? 300), budget: Number(opt('--budget') ?? 150), log: (l) => console.log(l),
  });
  const result = {
    schema: 'city-builder/balance-tune@1',
    generatedAt: new Date().toISOString(),
    durationSec: Math.round((Date.now() - t0) / 1000),
    ...r,
    changedFromStart: diff(VARIANT_VALUES[start], r.best.values),
    changedFromB: diff(VARIANT_VALUES.B, r.best.values),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(`\n${start}: ${r.startEval.pass}/${r.startEval.graded} → ${r.best.pass}/${r.best.graded} (score ${r.startEval.score} → ${r.best.score}) in ${r.evals} evals, ${result.durationSec}s\nwritten ${out}`);
} finally {
  await server.close();
}
