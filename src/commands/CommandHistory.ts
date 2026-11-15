import type { Command } from './Command';
import type { World } from '../sim/World';
import { BatchCommand } from './BatchCommand';

const MAX_STACK = 200;

export class CommandHistory {
  private readonly world: World;
  private readonly stack: Command[] = [];
  private readonly redoStack: Command[] = [];
  // Commands collected between beginBatch() and endBatch(); null when not batching.
  private batch: Command[] | null = null;

  constructor(world: World) {
    this.world = world;
  }

  get isBatching(): boolean { return this.batch !== null; }
  get canUndo(): boolean { return this.stack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  run(cmd: Command): boolean {
    const ok = cmd.execute(this.world);
    if (ok) {
      if (this.batch) {
        this.batch.push(cmd);
      } else {
        this._push(cmd);
      }
    }
    return ok;
  }

  /**
   * Start grouping subsequent run() calls into a single undo step.
   * An already-open batch is closed first.
   */
  beginBatch(): void {
    if (this.batch) this.endBatch();
    this.batch = [];
  }

  /** Close the open batch. Pushes one undo step if any command succeeded. */
  endBatch(): void {
    const batch = this.batch;
    this.batch = null;
    if (batch && batch.length > 0) {
      this._push(batch.length === 1 ? batch[0] : new BatchCommand(batch));
    }
  }

  /** Abort the open batch, reverting everything it did. Leaves no undo step. */
  cancelBatch(): void {
    const batch = this.batch;
    this.batch = null;
    if (!batch) return;
    for (let i = batch.length - 1; i >= 0; i--) batch[i].undo(this.world);
  }

  undo(): void {
    if (this.batch) this.endBatch();
    const cmd = this.stack.pop();
    if (!cmd) return;
    cmd.undo(this.world);
    this.redoStack.push(cmd);
  }

  redo(): void {
    if (this.batch) this.endBatch();
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    // Re-execute against the current world. If it no longer applies
    // (e.g. funds ran out since), the step is dropped.
    if (cmd.execute(this.world)) {
      this.stack.push(cmd);
      if (this.stack.length > MAX_STACK) this.stack.shift();
    }
  }

  private _push(cmd: Command): void {
    this.stack.push(cmd);
    if (this.stack.length > MAX_STACK) this.stack.shift();
    this.redoStack.length = 0;
  }
}
