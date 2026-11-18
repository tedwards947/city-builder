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
// Four suites: "pc" grades the PC targets per PC variant; "svc" the services targets per
// school / hospital capacity preset; "econ" grades the
// economy targets per economy preset (the Planner on the city's own money); "trade" the
// seaport and goods targets per trade preset, on saved cities only.
// Cities above 20k residents only run the econ suite (--pc-max-pop to change; it applies to svc too).
//
// Options:
//   --suite pc|econ|svc|trade  one suite only (default all four)
//   --variants Off,A,B,C,D   which PC number sets (default all five)
//   --presets shipped,...    which economy presets (default: shipped = Tight, original, recommended, generous)
//   --svc-presets shipped,.. which services capacity presets (src/balance/services.ts; default all)
//   --trade-presets shipped,.. which seaport / goods presets (src/balance/trade.ts; default all)
//   --pc-max-pop 20000       saved cities above this skip the PC and services suites
//   --personas planner,...   which personas (default all)
//   --days-fresh 300         game days on fresh cities
//   --days-save 150          game days on saved cities
//   --quick                  PC variant B and preset recommended, fresh city only, 120 days: a fast check
//   --no-saves               fresh city only
//   --city <file>            add a saved city (repeatable)
//   --out <file>             where to write (default balance-results/latest.json)
//   --summary-md <file>      also write a short markdown summary (e.g. a CI job summary)
//   --tuned <file>           grade this auto-tuner result as PC variant 'T' (default T: src/balance/tunedT.ts)
//
// Exit code is 0 whatever the targets say: the lab reports, it doesn't gate.

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
const tuned = opt('--tuned') ? JSON.parse(readFileSync(opt('--tuned'), 'utf8')) : null;
const variants = quick ? ['B'] : list(opt('--variants')) ?? ['Off', 'A', 'B', 'C', 'D', 'T'];
if (tuned && !variants.includes('T')) variants.push('T');

let gitSha = null;
try { gitSha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
try {
  const { runLab } = await server.ssrLoadModule('/src/balance/lab.ts');
  const t0 = Date.now();
  const report = runLab({
    suites: opt('--suite') ? [opt('--suite')] : undefined,
    variants,
    customVariants: tuned ? { T: { name: 'Tuned', desc: `Auto-tuner result from ${tuned.start} (${tuned.evals} evaluations, ${tuned.generatedAt}).`, values: tuned.best.values } } : undefined,
    econPresets: quick ? ['recommended'] : list(opt('--presets')),
    svcPresets: quick ? ['shipped'] : list(opt('--svc-presets')),
    tradePresets: quick ? ['shipped'] : list(opt('--trade-presets')),
    pcMaxPopulation: opt('--pc-max-pop') ? Number(opt('--pc-max-pop')) : undefined,
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
  for (const [v, s] of Object.entries(report.summary)) console.log(`pc   ${v.padEnd(12)} pass ${s.pass}  fail ${s.fail}  n/a ${s.na}`);
  if (report.best) console.log(`pc best: ${[report.best.variant, ...report.best.tied].join(' = ')} (${report.best.pass}/${report.best.of})`);
  for (const [v, s] of Object.entries(report.econSummary)) console.log(`econ ${v.padEnd(12)} pass ${s.pass}  fail ${s.fail}  n/a ${s.na}`);
  for (const [v, s] of Object.entries(report.svcSummary ?? {})) console.log(`svc  ${v.padEnd(12)} pass ${s.pass}  fail ${s.fail}  n/a ${s.na}`);
  for (const [v, s] of Object.entries(report.tradeSummary ?? {})) console.log(`trade ${v.padEnd(11)} pass ${s.pass}  fail ${s.fail}  n/a ${s.na}`);
  if (report.econVerdict) console.log('\n' + report.econVerdict);
  if (opt('--summary-md')) writeFileSync(opt('--summary-md'), summaryMd(report));
} finally {
  await server.close();
}

/** A short markdown summary: pass counts per PC variant and economy preset, newly failing targets, the economy verdict. */
function summaryMd(r) {
  const rows = (title, sum, best) => {
    const keys = Object.keys(sum);
    if (!keys.length) return '';
    let md = `### ${title}\n\n| | pass | fail | n/a |\n|---|---|---|---|\n`;
    for (const k of keys) md += `| ${k} | ${sum[k].pass} | ${sum[k].fail} | ${sum[k].na} |\n`;
    if (best) md += `\nBest: **${[best.variant, ...best.tied].join(' = ')}** (${best.pass}/${best.of} graded results).\n`;
    return md + '\n';
  };
  const broke = [], fixed = [];
  for (const t of r.targets) for (const [key, byCity] of Object.entries(t.results)) for (const [city, o] of Object.entries(byCity)) {
    if (o.trend === 'broke') broke.push(`\`${t.id}\` ${key} @ ${city}: ${JSON.stringify(o.prev)} → ${JSON.stringify(o.value)}`);
    if (o.trend === 'fixed') fixed.push(`\`${t.id}\` ${key} @ ${city}`);
  }
  let md = `## Balance Lab\n\n${r.cities.map(c => `${c.id} (${c.population.toLocaleString('en')})`).join(', ')}. ${r.durationSec}s${r.gitSha ? `, ${r.gitSha}` : ''}.\n\n`;
  md += rows('PC suite (per variant)', r.summary, r.best) + rows('Economy suite (per preset)', r.econSummary, r.econBest) + rows('Services suite (per capacity preset)', r.svcSummary ?? {}, r.svcBest) + rows('Trade suite (per seaport / goods preset)', r.tradeSummary ?? {}, r.tradeBest);
  md += `### Since the last run\n\n${broke.length ? `Newly failing (${broke.length}):\n${broke.map(b => `- ${b}`).join('\n')}` : 'Nothing newly failing.'}${fixed.length ? `\n\nNewly passing (${fixed.length}): ${fixed.join(', ')}` : ''}\n`;
  if (r.econVerdict) md += `\n### Economy verdict\n\n${r.econVerdict.split('\n').map(l => `- ${l}`).join('\n')}\n`;
  return md;
}
