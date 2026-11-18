// npm run balance:taxdebt [-- options]
//
// Debt drain / tax level sweep: score a grid of BALANCE.budget.debtPcDrainPerDay ×
// BALANCE.tax.level.satisfactionPerPoint × demandStrength × exodusPerPoint (src/balance/taxdebt.ts) with the
// debt.* and tax.* targets (src/balance/targets.ts) on the fresh town and the saved cities,
// spread over the lab pool. Proposes numbers; changes nothing in the game.
//
// Options:
//   --drain 0.5,0.75,1,1.25        debtPcDrainPerDay values
//   --spp 0.008,0.01,0.012,0.015,0.02   satisfactionPerPoint values
//   --strength 0.5,0.75,1,1.5,2    demandStrength values
//   --exodus 0                     exodusPerPoint values (chance per point above neutral, per home, per growth pass)
//   --saves ids          which saved cities (default testcity1 and cities/gen-*-t10000)
//   --no-saves           fresh town only
//   --days 300           game days on the fresh town (saved cities: at most 150)
//   --workers N          pool processes (default cores − 1, max 8)
//   --out <file>         default balance-results/taxdebt.json

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { createPool } from './balance-pool.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : undefined; };
const nums = (name, def) => (opt(name) ?? def).split(',').map(Number);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const out = resolve(opt('--out') ?? join(root, 'balance-results', 'taxdebt.json'));
const days = Number(opt('--days') ?? 300);

const cities = [{ id: 'fresh-128', kind: 'fresh', size: 128 }];
if (!args.includes('--no-saves')) {
  const want = opt('--saves') ? opt('--saves').split(',') : null;
  const dir = join(root, 'cities');
  const files = [join(dir, 'testcity1.citysave.json'), join(homedir(), 'Downloads', 'testcity1.citysave.json')].filter(existsSync).slice(0, 1);
  if (existsSync(dir)) files.push(...readdirSync(dir).filter((f) => /^gen-.*-t10000\.citysave\.json$/.test(f)).sort().map((f) => join(dir, f)));
  for (const f of files) { const id = basename(f).replace(/\.citysave\.json$/, ''); if (!want || want.includes(id)) cities.push({ id, kind: 'save', text: readFileSync(f, 'utf8') }); }
}

const points = [];
for (const d of nums('--drain', '0.5,0.75,1,1.25')) for (const s of nums('--spp', '0.008,0.01,0.012,0.015,0.02')) for (const k of nums('--strength', '0.5,0.75,1,1.5,2')) for (const e of nums('--exodus', '0')) {
  points.push({ label: `drain ${d} spp ${s} strength ${k} exodus ${e}`, values: { debtPcDrainPerDay: d, satisfactionPerPoint: s, demandStrength: k, exodusPerPoint: e } });
}

const pool = createPool({ cities, days, fn: 'evaluateTaxDebt', ...(opt('--workers') ? { workers: Number(opt('--workers')) } : {}) });
try {
  const t0 = Date.now();
  console.log(`taxdebt sweep: ${points.length} points on ${cities.map((c) => c.id).join(', ')}`);
  const evals = await pool.evaluateAll(points.map((p) => p.values));
  const rows = points.map((p, k) => ({ ...p, score: evals[k].score, pass: evals[k].pass, graded: evals[k].graded, failing: Object.entries(evals[k].results).filter(([, ok]) => !ok).map(([id]) => id), taxdebt: evals[k].taxdebt }))
    .sort((a, b) => a.score - b.score || points.indexOf(a) - points.indexOf(b));
  for (const r of rows.slice(0, Number(opt('--show') ?? 15))) console.log(`${String(r.score).padStart(7)}  ${r.pass}/${r.graded}  ${r.label}  | failing: ${r.failing.join(', ') || 'none'}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schema: 'city-builder/balance-taxdebt@1', generatedAt: new Date().toISOString(), durationSec: Math.round((Date.now() - t0) / 1000), cities: cities.map((c) => c.id), rows }, null, 1));
  console.log(`\nwritten ${out} (${Math.round((Date.now() - t0) / 1000)}s)`);
} finally {
  await pool.close();
}
