// PC outcomes study (docs/PC_OUTCOMES.md): node scripts/pc-outcomes.mjs <city file|fresh> <days> <every> <from>
// Prints one JSON line: the request cells' outcomes, sampled every <every> days from day <from> to <days>.
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const { pcOutcomes } = await server.ssrLoadModule('/src/balance/pcOutcomes.ts');
const [f, days, every, from] = process.argv.slice(2);
const r = pcOutcomes(f === 'fresh' ? null : readFileSync(f, 'utf8'), Number(days), Number(every), Number(from));
console.log(JSON.stringify({ city: f === 'fresh' ? 'fresh-growth' : f.split('/').pop().replace('.citysave.json', ''), ...r }));
await server.close();
