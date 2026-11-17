// npm run gen-city -- --seed 1 --target 50000 [--size 512] [--max-ticks 12000] [--out path] [--quiet]
//
// Builds a city of about `target` people with the large-city generator
// (src/gen/cityGen.ts) and writes it as a .citysave.json file the game's Load
// panel and `npm run bench` can read. Files go to cities/ (not committed) unless
// --out says otherwise. The same options always give the same city.

import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 && k + 1 < args.length ? args[k + 1] : fallback;
};
const seed = Number(opt('seed', '1'));
const target = Number(opt('target', '10000'));
const size = opt('size', null);
const maxTicks = opt('max-ticks', null);
const quiet = args.includes('--quiet');
const out = opt('out', `cities/gen-s${seed}-t${target}.citysave.json`);
if (!Number.isFinite(seed) || !Number.isFinite(target) || target <= 0) {
  console.error('usage: npm run gen-city -- --seed N --target POPULATION [--size 128|256|512] [--max-ticks N] [--out FILE]');
  process.exit(2);
}

const server = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
});
let failed = false;
try {
  const { generateCity } = await server.ssrLoadModule('/src/gen/cityGen.ts');
  const { saveCityText } = await server.ssrLoadModule('/src/bench/harness.ts');
  const t0 = performance.now();
  const result = generateCity({
    seed, target,
    size: size ? Number(size) : undefined,
    maxTicks: maxTicks ? Number(maxTicks) : undefined,
    log: quiet ? undefined : (line) => console.log(line),
  });
  const seconds = (performance.now() - t0) / 1000;
  mkdirSync(dirname(out), { recursive: true });
  const { width } = result.world.grid;
  writeFileSync(out, saveCityText(result.world, `Generated ${result.population.toLocaleString('en')} (seed ${seed})`));
  console.log(`${out}: ${width}×${width} map, population ${result.population}, ${result.ticks} ticks, built in ${seconds.toFixed(0)} s`);
} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.stack : e);
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);
