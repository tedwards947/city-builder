// node scripts/bench-check.mjs bench.json
//
// Used by CI after `npm run bench -- --no-browser --json > bench.json`.
// Writes the tick times to the job summary (or stdout) and fails only on a
// large slowdown. Shared CI machines are noisy and slower than a desktop, so
// the limits are several times the usual CI numbers: they catch things like a
// system looping over the whole map every tick, not 10% drifts. Compare the
// summary between PRs to spot smaller changes, and use `npm run bench` on
// your own machine (ideally on a big exported city) to measure them.

import { readFileSync, appendFileSync } from 'node:fs';

// Built-in test city (128×128), Node, in ms.
const LIMITS = {
  median: 10,             // a typical tick
  p95: 40,
  firstTicksWorstMs: 80,  // worst of the first 8 ticks after loading
  loadWarmupMs: 200,      // settling traffic while the city loads
};

const LABELS = {
  median: 'a tick (median)',
  p95: 'a tick (95%)',
  firstTicksWorstMs: 'first 8 ticks (worst)',
  loadWarmupMs: 'load warm-up',
};

const result = JSON.parse(readFileSync(process.argv[2], 'utf8')).node;
const fmt = (n) => (n >= 10 ? n.toFixed(0) : n.toFixed(1)) + ' ms';

const rows = [];
const over = [];
for (const key of Object.keys(LIMITS)) {
  const value = result[key];
  const bad = !(value <= LIMITS[key]);
  if (bad) over.push(LABELS[key]);
  rows.push(`| ${LABELS[key]} | ${fmt(value)} | ${fmt(LIMITS[key])} | ${bad ? '❌' : '✅'} |`);
}

const md = [
  `### Sim tick speed (${result.city}, Node, ${result.ticks} ticks)`,
  '',
  '| | time | fails above | |',
  '|---|---:|---:|---|',
  ...rows,
  '',
  '<details><summary>By system (average per tick)</summary>',
  '',
  ...result.systems.map((s) => `- ${s.name}: ${s.ms.toFixed(2)} ms`),
  '',
  '</details>',
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);

if (over.length) {
  console.error(`Much slower than expected: ${over.join(', ')}. Check with \`npm run bench\` locally.`);
  process.exit(1);
}
