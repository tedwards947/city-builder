// npm run bench [-- path/to/city.citysave.json] [--json] [--no-browser]
//
// Prints how long a sim tick takes (in Node and in Chrome) and how long a
// frame takes to draw (in headless Chrome), on a save file exported from the
// game or, with no file, on the built-in test city.
//
// Use it before and after a change you expect to affect speed, on the same
// machine with little else running; numbers from different machines are not
// comparable. Chrome is found automatically or taken from $CHROME; without it
// only the Node numbers are printed.

import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const noBrowser = args.includes('--no-browser');
const cityPath = args.find((a) => !a.startsWith('--')) ?? null;
const saveText = cityPath ? readFileSync(cityPath, 'utf8') : null;

const BROWSER_TIMEOUT_MS = 180_000;

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

const ms = (n) => (n >= 10 ? n.toFixed(0) : n.toFixed(1)).padStart(5) + ' ms';
const spread = (s) => `median ${ms(s.median)}   95% ${ms(s.p95)}   worst ${ms(s.worst)}`;

function printTick(title, r) {
  console.log(`\n${title}  (${r.ticks} ticks)`);
  console.log(`  a tick             ${spread(r)}`);
  console.log(`  first tick         ${ms(r.firstTickMs)}`);
  console.log('  by system (average per tick):');
  for (const s of r.systems.filter((s) => s.ms >= 0.01).slice(0, 8)) {
    console.log(`    ${s.name.padEnd(20)} ${s.ms.toFixed(2).padStart(6)} ms`);
  }
}

function printFrames(r) {
  console.log(`\nDrawing a frame in headless Chrome, on the CPU  (${r.view} view; compare runs, not against 16.7 ms)`);
  for (const v of r.views) {
    console.log(`  zoom ${v.zoom}`);
    console.log(`    standing still   ${spread(v.still)}`);
    console.log(`    panning          ${spread(v.panning)}`);
    console.log(`    while zooming    ${spread(v.zooming)}`);
    console.log(`    after zooming    ${spread(v.afterZoom)}`);
    console.log(`    first frame      ${ms(v.firstFrameMs)}`);
    console.log(`    picture          ${v.picture}   (same code and city give the same value; a change means the look changed)`);
  }
  console.log('  other pictures     ' + Object.entries(r.extras).map(([k, v]) => `${k} ${v}`).join('  '));
}

/** Opens the bench page in headless Chrome and resolves with what it posts back. */
function runInBrowser(server, chrome) {
  return new Promise((resolve, reject) => {
    let child = null;
    const profile = mkdtempSync(join(tmpdir(), 'city-bench-'));
    const finish = (fn, value) => {
      clearTimeout(timer);
      child?.kill();
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('the browser did not report back in time')), BROWSER_TIMEOUT_MS);

    onResult = (parsed) => {
      if (parsed.ok) finish(resolve, parsed.result);
      else finish(reject, new Error(`the bench page failed:\n${parsed.error}`));
    };

    const { port } = server.httpServer.address();
    child = spawn(chrome, [
      '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      // Draw on the CPU. With the GPU, Chrome moves canvases between GPU and CPU
      // as it likes and the same frame measures anywhere from 2 to 50 ms. CPU
      // drawing is slower than the real game but repeatable, which is the point.
      '--disable-gpu', '--disable-accelerated-2d-canvas',
      `--user-data-dir=${profile}`, '--window-size=1600,900',
      `http://127.0.0.1:${port}/bench/frame.html`,
    ], { stdio: 'ignore' });
    child.on('error', (e) => finish(reject, e));
  });
}

// The two addresses the bench page talks to. They are added by a plugin so that
// they sit in front of Vite's own handlers (which would answer with index.html).
let onResult = () => {};
const benchEndpoints = {
  name: 'bench-endpoints',
  configureServer(server) {
    server.middlewares.use('/__bench/city', (_req, res) => {
      if (saveText === null) { res.statusCode = 204; res.end(); return; }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(saveText);
    });
    server.middlewares.use('/__bench/result', (req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => { res.end('ok'); onResult(JSON.parse(body)); });
    });
  },
};

const server = await createServer({
  logLevel: 'error',
  plugins: [benchEndpoints],
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null },
});

const out = { city: cityPath ?? 'built-in test city', node: null, chrome: null };
let failed = false;
try {
  const { runTickBench } = await server.ssrLoadModule('/src/bench/tickBench.ts');
  out.node = runTickBench(saveText);
  if (!asJson) {
    console.log(out.node.city);
    printTick('Sim tick in Node', out.node);
  }

  const chrome = noBrowser ? null : findChrome();
  if (chrome) {
    await server.listen();
    out.chrome = await runInBrowser(server, chrome);
    if (!asJson) {
      printTick('Sim tick in headless Chrome', out.chrome.tick);
      printFrames(out.chrome);
    }
  } else if (!asJson) {
    console.log(noBrowser ? '\nBrowser part skipped (--no-browser).' : '\nChrome not found, so no frame times. Set CHROME=/path/to/chrome to include them.');
  }
  if (asJson) console.log(JSON.stringify(out, null, 2));
} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.message : e);
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);
