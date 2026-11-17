// One worker of the Balance Lab's evaluation pool (src/balance/pool.ts). Not
// run by hand: the pool starts it with child_process.fork.
//
// Each worker is its own process, because BALANCE is one shared object per
// process and every candidate needs its own numbers. It loads the evaluation
// function once through its own Vite server, receives the cities once, then
// scores one candidate per message.
//
// Messages in:   { type: 'init', root, module, fn, args }   then   { type: 'job', id, values }
// Messages out:  { type: 'ready' }   then   { type: 'result', id, value } or { type: 'result', id, error }

import { createServer } from 'vite';

let evaluate = null;
let extraArgs = [];
let server = null;

process.on('message', async (msg) => {
  try {
    if (msg.type === 'init') {
      server = await createServer({ root: msg.root, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
      const mod = await server.ssrLoadModule(msg.module);
      if (typeof mod[msg.fn] !== 'function') throw new Error(`${msg.module} has no function "${msg.fn}"`);
      evaluate = mod[msg.fn];
      extraArgs = msg.args ?? [];
      process.send({ type: 'ready' });
    } else if (msg.type === 'job') {
      let out;
      try {
        out = { type: 'result', id: msg.id, value: await evaluate(msg.values, ...extraArgs) };
      } catch (e) {
        out = { type: 'result', id: msg.id, error: String(e?.stack ?? e) };
      }
      process.send(out);
    } else if (msg.type === 'close') {
      await server?.close();
      process.exit(0);
    }
  } catch (e) {
    process.send({ type: 'fatal', error: String(e?.stack ?? e) });
    process.exit(1);
  }
});

// If the pool's process goes away, do not linger.
process.on('disconnect', () => process.exit(0));
