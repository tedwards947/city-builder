// Vibe layers, legacy vs target mode (src/balance/vibeStudy.ts):
//   node scripts/vibe-study.mjs spread|persist <city file|fresh> <days> <legacy|target>
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const { vibeSpread, vibePersist } = await server.ssrLoadModule('/src/balance/vibeStudy.ts');
const [what, city, days, mode] = process.argv.slice(2);
const text = city === 'fresh' ? null : readFileSync(city, 'utf8');
const r = what === 'persist' ? vibePersist(text, Number(days), mode) : vibeSpread(text, Number(days), mode);
console.log(JSON.stringify({ city: city === 'fresh' ? 'fresh' : city.split('/').pop().replace('.citysave.json', ''), what, ...r }));
await server.close();
