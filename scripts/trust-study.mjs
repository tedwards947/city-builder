// Local trust prototype, slice 2 (docs/PC_OUTCOMES.md): node scripts/trust-study.mjs <persona> <city file|fresh> <days> <displacements> <area 0|1>
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const { trustStudy } = await server.ssrLoadModule('/src/balance/trustStudy.ts');
const [persona, city, days, displacements, area] = process.argv.slice(2);
const r = trustStudy(persona, city === 'fresh' ? null : readFileSync(city, 'utf8'), Number(days), Number(displacements), area === '1');
console.log(JSON.stringify({ city: city === 'fresh' ? 'fresh' : city.split('/').pop().replace('.citysave.json', ''), ...r }));
await server.close();
