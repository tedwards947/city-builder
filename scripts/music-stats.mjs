// Usage: node scripts/music-stats.mjs [song-dir]
// Prints length, voices and a rough loudness figure for each variant in src/audio/variants.
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../src/audio/variants');
const { trackSeconds, flatten } = await import(pathToFileURL(join(root, '../compose.ts')).href);
const only = process.argv[2];

for (const song of readdirSync(root).sort()) {
  if (only && song !== only) continue;
  for (const f of readdirSync(join(root, song)).filter(f => f.endsWith('.ts')).sort()) {
    const mod = await import(pathToFileURL(join(root, song, f)).href);
    const s = trackSeconds(mod.track);
    const fl = flatten(mod.track);
    const voices = Math.max(...mod.track.patterns.map(p => p.length));
    // Max summed velocity of notes sounding at once (rough loudness check; keep under ~3.5)
    const ms = x => Math.round(x * 1000); // integer ms so a note ending as the next starts isn't double-counted
    const ev = fl.notes.flatMap(n => [[ms(n.t), n.vel], [ms(n.t + n.d), -n.vel]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0, peak = 0;
    for (const [, d] of ev) { cur += d; peak = Math.max(peak, cur); }
    const r = Math.round(s);
    const mmss = `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
    console.log(`${song}/${f}  "${mod.meta.label}"  ${mmss}  bpm=${mod.track.bpm} voices=${voices} notes=${fl.notes.length} peakVelSum=${peak.toFixed(2)} sections=${mod.track.patterns.length}`);
  }
}
