// npm run balance:trade [-- options]
//
// Seaport / goods sweep: score a grid of trade numbers (src/balance/trade.ts TradeValues)
// with the trade targets (src/balance/targets.ts, port.* and goods.*) on the saved
// cities, spread over the lab pool. Proposes numbers; changes nothing in the game.
//
// Options:
//   --goods              sweep transit.goodsCapacity × goods.shortageIncomePenalty, no port numbers (default)
//   --port               sweep the port numbers at --goods-capacity / --penalty
//   --goods-capacity 0.55 --penalty 0.25   goods numbers to hold during a port sweep
//   --saves ids          which saved cities (default testcity1 and cities/gen-*-t10000)
//   --workers N          pool processes (default cores − 1, max 8)
//   --out <file>         default balance-results/trade-<mode>.json

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { createPool } from './balance-pool.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : undefined; };
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const mode = args.includes('--port') ? 'port' : 'goods';
const out = resolve(opt('--out') ?? join(root, 'balance-results', `trade-${mode}.json`));

const want = opt('--saves') ? opt('--saves').split(',') : null;
const dir = join(root, 'cities');
const files = [join(dir, 'testcity1.citysave.json'), join(homedir(), 'Downloads', 'testcity1.citysave.json')].filter(existsSync).slice(0, 1);
if (existsSync(dir)) files.push(...readdirSync(dir).filter((f) => /^gen-.*-t10000\.citysave\.json$/.test(f)).sort().map((f) => join(dir, f)));
const cities = [];
for (const f of files) { const id = basename(f).replace(/\.citysave\.json$/, ''); if (!want || want.includes(id)) cities.push({ id, kind: 'save', text: readFileSync(f, 'utf8') }); }

const points = [];
if (mode === 'goods') {
  for (const gc of [0.45, 0.55, 0.65, 0.75, 0.9]) for (const pen of [0.25, 0.35, 0.5]) points.push({ label: `goodsCapacity ${gc} penalty ${pen}`, values: { goodsCapacity: gc, goods: { shortageIncomePenalty: pen } } });
} else {
  const goodsCapacity = Number(opt('--goods-capacity') ?? 0.55), pen = Number(opt('--penalty') ?? 0.25);
  for (const ipt of [8, 10]) for (const cap of [10, 15, 20]) for (const upkeep of [50, 100]) for (const imp of [100, 200]) {
    points.push({ label: `incomePerTrip ${ipt} exportCapacity ${cap} upkeep ${upkeep} importCapacity ${imp}`, values: { goodsCapacity, goods: { shortageIncomePenalty: pen }, portUpkeep: upkeep, port: { exportTripsPerLevel: 0.1, exportCapacity: cap, exportIncomePerTrip: ipt, importCapacity: imp } } });
  }
}

const pool = createPool({ cities, days: 1, fn: 'evaluateTrade', ...(opt('--workers') ? { workers: Number(opt('--workers')) } : {}) });
try {
  const t0 = Date.now();
  console.log(`${mode} sweep: ${points.length} points on ${cities.map((c) => c.id).join(', ')}`);
  const evals = await pool.evaluateAll(points.map((p) => p.values));
  const rows = points.map((p, k) => ({ ...p, score: evals[k].score, pass: evals[k].pass, graded: evals[k].graded, failing: Object.entries(evals[k].results).filter(([, ok]) => !ok).map(([id]) => id), trade: evals[k].trade }))
    .sort((a, b) => a.score - b.score || points.indexOf(a) - points.indexOf(b));
  for (const r of rows.slice(0, 12)) {
    const c = Object.entries(r.trade).map(([id, v]) => `${id.replace(/-s1-t10000/, '')}: sh ${v.shortage}/${v.heavy?.shortage ?? '-'}→${v.heavy?.withPort ?? '-'} pay ${v.port?.paybackDays ?? '-'} full ${v.port?.fullShare ?? '-'} share ${v.port?.incomeShare ?? '-'} split ${v.split?.gain ?? '-'}`).join('; ');
    console.log(`${String(r.score).padStart(7)}  ${r.pass}/${r.graded}  ${r.label}  | ${c}`);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schema: 'city-builder/balance-trade@1', generatedAt: new Date().toISOString(), durationSec: Math.round((Date.now() - t0) / 1000), mode, cities: cities.map((c) => c.id), rows }, null, 1));
  console.log(`\nwritten ${out} (${Math.round((Date.now() - t0) / 1000)}s)`);
} finally {
  await pool.close();
}
