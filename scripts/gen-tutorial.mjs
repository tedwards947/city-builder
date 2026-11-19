// npm run gen-tutorial [-- --out public/tutorial/tutorial.citysave.json]
//
// Writes the PLACEHOLDER tutorial map (src/gen/tutorialMap.ts) as an ordinary
// save file. Once the owner's hand-built map is in place, running this would
// overwrite it: use --out to write elsewhere.

import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const k = args.indexOf('--out');
const out = k >= 0 && k + 1 < args.length ? args[k + 1] : 'public/tutorial/tutorial.citysave.json';

const server = await createServer({ logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
let failed = false;
try {
  const { buildTutorialMap } = await server.ssrLoadModule('/src/gen/tutorialMap.ts');
  const { saveCityText } = await server.ssrLoadModule('/src/bench/harness.ts');
  const text = saveCityText(buildTutorialMap(), 'Tutorial', 0);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(`${out}: ${(text.length / 1e3).toFixed(0)} kB`);
} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.stack : e);
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);
