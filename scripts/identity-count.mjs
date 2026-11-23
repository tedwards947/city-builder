// Neighbourhood identity label shares (src/balance/identityCount.ts): node scripts/identity-count.mjs <city files...>
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const { identityCount } = await server.ssrLoadModule('/src/balance/identityCount.ts');
for (const f of process.argv.slice(2)) console.log(JSON.stringify({ city: f.split('/').pop().replace('.citysave.json', ''), ...identityCount(readFileSync(f, 'utf8')) }));
await server.close();
