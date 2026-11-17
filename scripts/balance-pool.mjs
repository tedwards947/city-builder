// Balance Lab: score many candidates at once, in separate processes.
//
// BALANCE is one shared, mutable object per process, so two candidates with
// different numbers cannot be scored side by side in one process. The pool
// starts worker processes (scripts/balance-pool-worker.mjs), each with its
// own copy of the game and its own BALANCE, and hands them candidates.
//
// What it promises:
//   - results come back in the order the candidates were given;
//   - the same candidates give the same results whatever the worker count
//     (each is scored by the same function a single process would call; this
//     relies on that function not depending on what it scored before);
//   - a candidate whose evaluation throws rejects the call with that error,
//     naming the candidate, after the other candidates have finished; the
//     pool stays usable;
//   - the cities (which can be megabytes of save text) are sent to each
//     worker once, when it starts, not with every candidate.
//
// Plain Node, so it lives with the runner scripts and not under src/ (the
// game's TypeScript has no Node types). Types: balance-pool.d.mts.
//
//   import { createPool } from './balance-pool.mjs';
//   const pool = createPool({ cities, days: 300 });
//   const evals = await pool.evaluateAll(trees);   // one sweep
//   ...                                            // more rounds, same workers
//   await pool.close();

import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The default number of workers on this machine: one fewer than its cores, at most 8, at least 1. */
export function defaultWorkers() {
  return Math.max(1, Math.min(8, availableParallelism() - 1));
}

/**
 * Start a pool. Workers start lazily, on the first evaluateAll, and stay up
 * between calls, so a search that scores a sweep per round pays the start-up
 * (a Vite server and the cities, a second or two each) once.
 *
 * opts: { cities, days, workers?, root?, module?, fn? } — see balance-pool.d.mts.
 */
export function createPool(opts) {
  const count = Math.max(1, Math.floor(opts.workers ?? defaultWorkers()));
  const root = resolve(opts.root ?? resolve(HERE, '..'));
  const script = resolve(HERE, 'balance-pool-worker.mjs');
  const workers = [];
  let closed = false;

  // A clean child: none of the parent's loader flags (a test runner's, say).
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  for (const k of Object.keys(env)) if (k.startsWith('VITEST')) delete env[k];

  const start = () => {
    const child = fork(script, [], { cwd: root, env, execArgv: [], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const w = { child, ready: null, done: null, dead: null };
    w.ready = new Promise((ok, fail) => {
      const die = (why) => {
        if (w.dead) return;
        w.dead = why;
        fail(new Error(why));
        const done = w.done; w.done = null;
        done?.({ error: why });
      };
      child.on('message', (msg) => {
        if (msg.type === 'ready') ok();
        else if (msg.type === 'result') { const done = w.done; w.done = null; done?.(msg); }
        else if (msg.type === 'fatal') die(`balance pool worker failed: ${msg.error}`);
      });
      child.on('error', (e) => die(`balance pool worker could not start: ${e.message}`));
      child.on('exit', (code) => { if (!closed) die(`balance pool worker exited (code ${code})`); });
    });
    w.ready.catch(() => { /* reported to whoever uses the worker */ });
    child.send({ type: 'init', root, module: opts.module ?? '/src/balance/tune.ts', fn: opts.fn ?? 'evaluate', args: [opts.cities, opts.days] });
    return w;
  };

  const run = (w, id, values) => new Promise((ok) => {
    if (w.dead) { ok({ error: w.dead }); return; }
    w.done = ok;
    w.child.send({ type: 'job', id, values });
  });

  return {
    workers: count,

    /** Score every tree; results in the same order. */
    async evaluateAll(trees) {
      if (closed) throw new Error('balance pool: used after close()');
      const need = Math.min(count, trees.length);
      // Replace workers that died in an earlier round.
      for (let k = 0; k < workers.length; k++) if (workers[k].dead) workers[k] = start();
      while (workers.length < need) workers.push(start());

      const results = new Array(trees.length);
      const errors = [];
      let next = 0;
      // Each worker takes the next unscored candidate until none are left.
      await Promise.all(workers.slice(0, need).map(async (w) => {
        try { await w.ready; } catch (e) { errors.push(String(e.message)); return; }
        while (next < trees.length) {
          const id = next++;
          const out = await run(w, id, trees[id]);
          if (out.error !== undefined) {
            errors.push(`candidate ${id}: ${out.error}`);
            if (w.dead) return;
          } else {
            results[id] = out.value;
          }
        }
      }));
      // Workers that died may have left candidates nobody picked up.
      if (errors.length === 0 && next < trees.length) errors.push('balance pool: every worker stopped before the candidates were finished');
      if (errors.length > 0) throw new Error(errors.join('\n'));
      return results;
    },

    /** Stop the workers. The pool cannot be used afterwards. */
    async close() {
      if (closed) return;
      closed = true;
      await Promise.all(workers.map((w) => new Promise((ok) => {
        if (w.child.exitCode !== null || w.child.signalCode !== null) { ok(); return; }
        w.child.once('exit', () => ok());
        try { w.child.send({ type: 'close' }); } catch { w.child.kill(); }
        setTimeout(() => { if (w.child.exitCode === null) w.child.kill(); }, 5000).unref();
      })));
    },
  };
}

/**
 * Score every tree and return the results in order. One-shot: starts workers,
 * scores, stops them. For many rounds, keep a pool from createPool instead.
 */
export async function evaluateAll(trees, opts) {
  const pool = createPool(opts);
  try {
    return await pool.evaluateAll(trees);
  } finally {
    await pool.close();
  }
}
