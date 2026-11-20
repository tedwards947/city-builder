// Builds the scale review page with its sprites inlined: node art/clay-set/scale/build.mjs [out.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), sprites = join(here, '../../../public/sprites/clay');
const names = ['res-1', 'res-1-b', 'res-1-c', 'res-2', 'res-2-c', 'res-3', 'com-2', 'ind-1', 'airport/plane-red', 'port/ship-side'];
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
