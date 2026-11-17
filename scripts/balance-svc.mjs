// npm run balance:svc [-- options]
//
// Services sweep: score a grid of school / hospital reach (road steps) or capacity
// (residents per building) with the services targets (src/balance/targets.ts, svc.*),
// spread over the lab pool. Proposes numbers; changes nothing in the game.
//
// Options:
//   --reach              sweep reach with no capacity (default)
//   --capacity           sweep capacity at --school-range / --hospital-range
//   --school-range 16    --hospital-range 24    reach to hold during a capacity sweep
//   --saves [ids]        also score testcity1 and cities/gen-*-t10000 (or just the listed ids)
//   --days 300           game days per run (saves: up to 150)
//   --workers N          pool processes (default cores − 1, max 8)
//   --out <file>         default balance-results/svc-<mode>.json

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { createPool } from './balance-pool.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : undefined; };
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const mode = args.includes('--capacity') ? 'capacity' : 'reach';
const days = Number(opt('--days') ?? 300);
const out = resolve(opt('--out') ?? join(root, 'balance-results', `svc-${mode}.json`));

const cities = [{ id: 'fresh-128', kind: 'fresh', size: 128, seed: 7 }];
if (args.includes('--saves')) {
  const want = opt('--saves') && !opt('--saves').startsWith('--') ? opt('--saves').split(',') : null;
  const dir = join(root, 'cities');
  const files = [join(dir, 'testcity1.citysave.json'), join(homedir(), 'Downloads', 'testcity1.citysave.json')].filter(existsSync).slice(0, 1);
  if (existsSync(dir)) files.push(...readdirSync(dir).filter((f) => /^gen-.*-t10000\.citysave\.json$/.test(f)).sort().map((f) => join(dir, f)));
  for (const f of files) { const id = basename(f).replace(/\.citysave\.json$/, ''); if (!want || want.includes(id)) cities.push({ id, kind: 'save', text: readFileSync(f, 'utf8') }); }
}

const points = [];
if (mode === 'reach') {
  for (const s of [8, 10, 12, 14, 16, 20]) for (const h of [12, 20, 30, 45, 60, 90]) points.push({ label: `reach school ${s} hospital ${h}`, values: { capacity: { 6: 0, 7: 0 }, range: { 6: s, 7: h } } });
} else {
  const range = { 6: Number(opt('--school-range') ?? 16), 7: Number(opt('--hospital-range') ?? 24) };
  for (const s of [1000, 1500, 2000, 3000, 4000]) for (const h of [3000, 5000, 8000, 12000, 20000]) points.push({ label: `capacity school ${s} hospital ${h} (reach ${range[6]}/${range[7]})`, values: { capacity: { 6: s, 7: h }, range } });
}

const pool = createPool({ cities, days, fn: 'evaluateSvc', ...(opt('--workers') ? { workers: Number(opt('--workers')) } : {}) });
try {
  const t0 = Date.now();
  console.log(`${mode} sweep: ${points.length} points on ${cities.map((c) => c.id).join(', ')}`);
  const evals = await pool.evaluateAll(points.map((p) => p.values));
  const rows = points.map((p, k) => ({ ...p, score: evals[k].score, pass: evals[k].pass, graded: evals[k].graded, failing: Object.entries(evals[k].results).filter(([, ok]) => !ok).map(([id]) => id), svc: evals[k].svc }))
    .sort((a, b) => a.score - b.score || points.indexOf(a) - points.indexOf(b));
  for (const r of rows.slice(0, 12)) {
    const c = Object.entries(r.svc).map(([id, v]) => `${id}: need schools ${v.school.neededPer10k}/10k, hospitals ${v.hospital.neededPer10k}/10k`).join('; ');
    console.log(`${String(r.score).padStart(7)}  ${r.pass}/${r.graded}  ${r.label}  | ${c}`);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schema: 'city-builder/balance-svc@1', generatedAt: new Date().toISOString(), durationSec: Math.round((Date.now() - t0) / 1000), mode, cities: cities.map((c) => c.id), days, rows }, null, 1));
  console.log(`\nwritten ${out} (${Math.round((Date.now() - t0) / 1000)}s)`);
} finally {
  await pool.close();
}
