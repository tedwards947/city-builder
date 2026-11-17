// npm run balance [-- options]
//
// Balance Lab: plays scripted personas on the real sim for each PC variant and
// city, grades the targets in src/balance/targets.ts, and writes one JSON
// report to balance-results/latest.json (the previous one is kept as
// previous.json and used for trends).
//
// Cities: a fresh 128×128 town every run; the owner's testcity1 if it is on
// this machine (cities/testcity1.citysave.json or ~/Downloads/
// testcity1.citysave.json; never commit it); every cities/gen-*.citysave.json
// (generated cities); and any --city <file>.
//
// Options:
//   --variants Off,A,B,C,D   which PC number sets (default all five)
//   --personas planner,...   which personas (default all)
//   --days-fresh 300         game days on fresh cities
//   --days-save 150          game days on saved cities
//   --quick                  one variant (B), fresh city only, 120 days: a fast check
//   --no-saves               fresh city only
//   --city <file>            add a saved city (repeatable)
//   --out <file>             where to write (default balance-results/latest.json)

import { createServer } from 'vite';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : undefined; };
const quick = args.includes('--quick');
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const out = resolve(opt('--out') ?? join(root, 'balance-results', 'latest.json'));

const saves = [];
if (!quick && !args.includes('--no-saves')) {
  for (const p of [join(root, 'cities', 'testcity1.citysave.json'), join(homedir(), 'Downloads', 'testcity1.citysave.json')]) {
    if (existsSync(p)) { saves.push({ id: 'testcity1', path: p }); break; }
  }
  const dir = join(root, 'cities');
  if (existsSync(dir)) for (const f of readdirSync(dir).sort()) if (/^gen-.*\.citysave\.json$/.test(f)) saves.push({ id: f.replace('.citysave.json', ''), path: join(dir, f) });
}
args.forEach((a, k) => { if (a === '--city') saves.push({ id: basename(args[k + 1]).replace('.citysave.json', ''), path: args[k + 1] }); });

const cities = [{ id: 'fresh-128', kind: 'fresh', size: 128, seed: 7 }, ...saves.map((s) => ({ id: s.id, kind: 'save', text: readFileSync(s.path, 'utf8') }))];
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;

let gitSha = null;
try { gitSha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null } });
try {
  const { runLab } = await server.ssrLoadModule('/src/balance/lab.ts');
  const t0 = Date.now();
  const report = runLab({
    variants: quick ? ['B'] : list(opt('--variants')),
    personas: list(opt('--personas')),
    daysFresh: Number(opt('--days-fresh') ?? (quick ? 120 : 300)),
    daysSave: Number(opt('--days-save') ?? 150),
    cities,
    previous,
    log: (l) => console.log(l),
  });
  report.gitSha = gitSha;
  report.durationSec = Math.round((Date.now() - t0) / 1000);
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out)) renameSync(out, join(dirname(out), 'previous.json'));
  writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(`\nwritten ${out} (${report.durationSec}s)`);
  for (const [v, s] of Object.entries(report.summary)) console.log(`${v.padEnd(4)} pass ${s.pass}  fail ${s.fail}  n/a ${s.na}`);
  if (report.best) console.log(`best: ${report.best.variant} (${report.best.pass}/${report.best.of})`);
} finally {
  await server.close();
}
