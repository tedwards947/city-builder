// NOTE: the file that ships on the title screen is now the owner's hand-built
// city (public/showcase/showcase.citysave.json, with focus markers). Running
// this script overwrites it with a generated city: use --out to write elsewhere.
//
// npm run gen-showcase [-- --seed 3 --target 19000 --out public/showcase/showcase.citysave.json]
//
// Builds the title screen's showcase city (src/gen/showcase.ts) and writes it
// as an ordinary save file, the format of the Save panel's "save to file".
// The same options always give the same file (savedAt is 0).

import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const k = args.indexOf(`--${name}`); return k >= 0 && k + 1 < args.length ? args[k + 1] : fallback; };
const seed = Number(opt('seed', '3'));
const target = Number(opt('target', '19000'));
const out = opt('out', 'public/showcase/showcase.citysave.json');

const server = await createServer({ logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
let failed = false;
try {
  const { buildShowcase } = await server.ssrLoadModule('/src/gen/showcase.ts');
  const { saveCityText } = await server.ssrLoadModule('/src/bench/harness.ts');
  const t0 = performance.now();
  const { world, report } = buildShowcase({ seed, target, log: (line) => console.log(line) });
  const text = saveCityText(world, 'Showcase', 0);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(JSON.stringify(report, null, 1));
  console.log(`${out}: ${(text.length / 1e6).toFixed(2)} MB (${(gzipSync(text).length / 1e3).toFixed(0)} kB gzipped), built in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.stack : e);
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);
