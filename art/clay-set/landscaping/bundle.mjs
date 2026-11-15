// Bundles the game's lot-dressing modules (src/render/clay/lot*.ts) into lot-dressing.js,
// a plain script that defines globalThis.LotDressing. Run before build.mjs:
//   node art/clay-set/landscaping/bundle.mjs && node art/clay-set/landscaping/build.mjs
import { build } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
await build({
  configFile: false, logLevel: 'warn', publicDir: false,
  build: {
    outDir: here, emptyOutDir: false, minify: false, copyPublicDir: false,
    lib: { entry: join(here, 'lot-dressing.entry.ts'), formats: ['iife'], name: 'LotDressing', fileName: () => 'lot-dressing.js' },
    rollupOptions: { output: { footer: 'globalThis.LotDressing = LotDressing;' } },
  },
});
