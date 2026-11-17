// Types for balance-pool.mjs (the Balance Lab's evaluation pool).

/** A number set shaped like VARIANT_VALUES[x], applied with applyValues. */
export type ValueTree = Record<string, unknown>;

/** A city to score on: the lab's CitySpec (src/balance/world.ts). Save specs carry the save's text. */
export type PoolCity =
  | { id: string; kind: 'fresh'; size?: number; seed?: number }
  | { id: string; kind: 'save'; text: string };

export interface PoolOptions {
  /** Cities every candidate is scored on. Sent to each worker once, when it starts. */
  cities: PoolCity[];
  /** Game days per run. */
  days: number;
  /** Worker processes. Default: defaultWorkers(). */
  workers?: number;
  /** Project root (where vite and src/ are). Default: the folder above scripts/. */
  root?: string;
  /** Module (a Vite path such as '/src/balance/tune.ts') and function that score one candidate: fn(values, cities, days). Default: tune.ts's evaluate. */
  module?: string;
  fn?: string;
}

export interface Pool<E> {
  /** Score every tree; results in the same order. Rejects, naming the candidate, if an evaluation throws. */
  evaluateAll(trees: ValueTree[]): Promise<E[]>;
  /** Stop the workers. The pool cannot be used afterwards. */
  close(): Promise<void>;
  /** How many worker processes the pool runs at most. */
  readonly workers: number;
}

/** One fewer than the machine's cores, at most 8, at least 1. */
export function defaultWorkers(): number;

/** A pool whose workers start on first use and stay up between rounds. */
export function createPool<E = unknown>(opts: PoolOptions): Pool<E>;

/** One-shot: start workers, score every tree in order, stop them. */
export function evaluateAll<E = unknown>(trees: ValueTree[], opts: PoolOptions): Promise<E[]>;
