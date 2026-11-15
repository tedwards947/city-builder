// Builds the music review page: node scripts/build-music-review.mjs <out.html>
// Flattens every original track and every variant in src/audio/variants into note lists
// and inlines them into scripts/music-review.template.html.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const audio = join(here, '../src/audio');
const { flatten } = await import(pathToFileURL(join(audio, 'compose.ts')).href);
const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/build-music-review.mjs <out.html>');

const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function pack(track, extra) {
  const f = flatten(track);
  const notes = [];
  for (const n of f.notes) {
    const midi = Math.round(69 + 12 * Math.log2(n.f / 440));
    notes.push(Math.round(n.t * 1000), Math.round(n.d * 1000), midi, n.v, Math.round(n.vel * 100));
  }
  // Collapse consecutive repeats of the same section into one timeline band
  const names = track.sectionNames;
  const sections = [];
  for (const m of f.marks) {
    const name = names ? names[m.pattern] : `pattern ${m.pattern + 1}`;
    if (sections.length && sections[sections.length - 1].name === name) continue;
    sections.push({ t: Math.round(m.t * 1000), name });
  }
  return { genre: track.genre, bpm: track.bpm, ms: Math.round(f.seconds * 1000), sections, notes, ...extra };
}

const ls = (dir, re) => { try { return readdirSync(dir).filter(f => re.test(f)).sort(); } catch { return []; } };

// Reference material a song under review can be compared against:
// the in-game original (tracks/<slug>.ts without `meta`) or a melody sketch with the same name.
const originals = new Map();
const inGame = new Set(); // slugs of every song name in the game, e.g. "glass-towers"
for (const file of ls(join(audio, 'tracks'), /\.ts$/)) {
  const { track, meta } = await import(pathToFileURL(join(audio, 'tracks', file)).href);
  if (!meta) originals.set(slug(track.name), { track, file: `src/audio/tracks/${file}` });
  inGame.add(slug(track.name));
}
const sketchGroups = [];
const sketchesBySlug = new Map();
for (const file of ls(join(audio, 'sketches'), /\.ts$/)) {
  const { sketches } = await import(pathToFileURL(join(audio, 'sketches', file)).href);
  const g = basename(file, '.ts');
  sketchGroups.push({ g, file, sketches });
  sketches.forEach((sk, i) => sketchesBySlug.set(slug(sk.meta.label), { sk, id: `${g}-m${i + 1}`, file: `src/audio/sketches/${file}` }));
}

// One review group per variants/<slug>/ folder (skipping the _dropped archive)
const songs = [];
const underReview = new Set();
for (const s of ls(join(audio, 'variants'), /^[a-z0-9-]+$/)) {
  const variants = [];
  let name = s;
  for (const vf of ls(join(audio, 'variants', s), /^v\d+\.ts$/)) {
    const mod = await import(pathToFileURL(join(audio, 'variants', s, vf)).href);
    name = mod.meta.song;
    variants.push(pack(mod.track, { id: `${s}-${basename(vf, '.ts')}`, label: mod.meta.label, blurb: mod.meta.blurb, file: `src/audio/variants/${s}/${vf}` }));
  }
  if (!variants.length) continue;
  underReview.add(s);
  const o = originals.get(s), sk = sketchesBySlug.get(s);
  const original = o ? pack(o.track, { id: `${s}-original`, label: 'Original', blurb: 'The current in-game loop, for reference.', file: o.file })
    : sk ? pack(sk.sk.track, { id: sk.id, label: 'Sketch', blurb: sk.sk.meta.blurb, file: sk.file })
    : null;
  songs.push({ slug: s, name, original, variants });
}

// Sketches that haven't become full songs yet get their own group
for (const { g, file, sketches } of sketchGroups) {
  const open = sketches.map((sk, i) => ({ sk, i }))
    .filter(({ sk }) => !underReview.has(slug(sk.meta.label)) && !inGame.has(slug(sk.meta.label)));
  if (!open.length) continue;
  songs.push({
    slug: g,
    name: sketches[0].meta.song,
    sketch: true,
    original: null,
    variants: open.map(({ sk, i }) => pack(sk.track, { id: `${g}-m${i + 1}`, label: sk.meta.label, blurb: sk.meta.blurb, file: `src/audio/sketches/${file}` })),
  });
}

// The game's playlist, in the order MusicManager plays it
const { playlistOrder } = await import(pathToFileURL(join(audio, 'MusicManager.ts')).href);
const gameTracks = [];
for (const file of readdirSync(join(audio, 'tracks')).filter(f => f.endsWith('.ts'))) {
  gameTracks.push((await import(pathToFileURL(join(audio, 'tracks', file)).href)).track);
}
const playlist = playlistOrder(gameTracks).map(t => t.name);

const template = readFileSync(join(here, 'music-review.template.html'), 'utf8');
const json = JSON.stringify(songs).replace(/</g, '\\u003c');
writeFileSync(out, template
  .replace('/*__SONGS__*/[]', () => json)
  .replace('/*__PLAYLIST__*/[]', () => JSON.stringify(playlist).replace(/</g, '\\u003c')));
const count = songs.reduce((n, s) => n + s.variants.length, 0);
console.log(`Wrote ${out}: ${songs.length} songs, ${count} variants, ${(json.length / 1024).toFixed(0)} KB of note data`);
