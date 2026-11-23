// Local trust prototype (docs/PC_OUTCOMES.md): node scripts/trust-study.mjs <persona|bigbuilds> <city file|fresh> <days> <displacements> <area 0|1> [spill] [regenMult]
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const { trustStudy, bigBuilds } = await server.ssrLoadModule('/src/balance/trustStudy.ts');
const [persona, city, days, displacements, area, spill, regen] = process.argv.slice(2);
const r = persona === 'bigbuilds'
  ? bigBuilds(readFileSync(city, 'utf8'), Number(displacements), Number(spill ?? 0), 5, Number(regen ?? 1))
  : trustStudy(persona, city === 'fresh' ? null : readFileSync(city, 'utf8'), Number(days), Number(displacements), area === '1', 10, 120, Number(spill ?? 0), Number(regen ?? 1));
console.log(JSON.stringify({ city: city === 'fresh' ? 'fresh' : city.split('/').pop().replace('.citysave.json', ''), ...r }));
await server.close();
