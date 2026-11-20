// Builds the scale review page with its sprites inlined: node art/clay-set/scale/build.mjs [out.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), sprites = join(here, '../../../public/sprites/clay');
const names = ['res-1', 'res-1-b', 'res-1-c', 'res-2', 'res-2-c', 'res-3', 'com-2', 'ind-1', 'airport/plane-red', 'port/ship-side'];
const map = Object.fromEntries(names.map(n => [n.split('/').pop(), 'data:image/png;base64,' + readFileSync(join(sprites, n + '.png')).toString('base64')]));
const html = readFileSync(join(here, 'template.html'), 'utf8')
  .replace('/*SPRITES*/{}', JSON.stringify(map))
  .replace('/*AUDIT*/[]', readFileSync(join(here, 'audit.json'), 'utf8').trim());
const out = process.argv[2] || join(here, 'index.html');
writeFileSync(out, html);
if (process.argv[3]) writeFileSync(process.argv[3], '<meta charset="utf-8">' + html); // a local preview needs the charset the artifact skeleton adds
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
