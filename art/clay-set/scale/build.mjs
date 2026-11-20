// Builds the scale review page with its sprites inlined: node art/clay-set/scale/build.mjs [out.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), sprites = join(here, '../../../public/sprites/clay');
const L3 = ['res-3','res-3-b','res-3-c','res-3-d','res-3-e','res-3-f','res-3-g','res-3-h','res-3-j','res-3-green','res-3-gritty','res-3-communal','res-3-wealthy','com-3','com-3-b','com-3-c','com-3-d','com-3-e','com-3-f','com-3-g','com-3-i','com-3-j','com-3-green','com-3-gritty','com-3-communal','com-3-wealthy'];
const names = [...new Set([...L3, 'res-1', 'res-1-b', 'res-1-c', 'res-2', 'res-2-c', 'res-3', 'com-2', 'ind-1', 'airport/plane-red', 'port/ship-side'])];
const map = Object.fromEntries(names.map(n => [n.split('/').pop(), 'data:image/png;base64,' + readFileSync(join(sprites, n + '.png')).toString('base64')]));
// Pilot redraws: 256 px previews of the raws (sips), magenta still in; the page keys it out.
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
for (const n of ['res-3-mid-a', 'com-3-mid-a']) {
  const tmp = join(tmpdir(), n + '-256.png');
  execFileSync('sips', ['-s', 'format', 'png', '-Z', '256', join(here, '../raw-pilot', n + '.png'), '--out', tmp], { stdio: 'ignore' });
  map[n] = 'data:image/png;base64,' + readFileSync(tmp).toString('base64');
}
const html = readFileSync(join(here, 'template.html'), 'utf8')
  .replace('/*SPRITES*/{}', JSON.stringify(map))
  .replace('/*AUDIT*/[]', readFileSync(join(here, 'audit.json'), 'utf8').trim());
const out = process.argv[2] || join(here, 'index.html');
writeFileSync(out, html);
if (process.argv[3]) writeFileSync(process.argv[3], '<meta charset="utf-8">' + html); // a local preview needs the charset the artifact skeleton adds
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
