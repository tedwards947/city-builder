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

  // Political-capital changes since the current action began, added up so the
  // whole action can be reported as one `pcAction` event.
  private pcDelta = 0;
  private pcTx: number | undefined;
  private pcTy: number | undefined;

  constructor(world: World) {
    this.world = world;
    world.events.on('pcChanged', p => {
      this.pcDelta += p.delta as number;
      if (p.tx !== undefined) { this.pcTx = p.tx as number; this.pcTy = p.ty as number; }
    });
  }

  private _pcReset(): void {
    this.pcDelta = 0;
    this.pcTx = this.pcTy = undefined;
  }

  /** Report the action's net political-capital change, if any, as one event. */
  private _pcReport(undo: boolean): void {
    // Costs are multiples of 0.5, so sums that cancel come out as exactly 0.
    if (this.pcDelta !== 0) {
      this.world.events.emit('pcAction', { delta: this.pcDelta, tx: this.pcTx, ty: this.pcTy, undo });
    }
    this._pcReset();
  }

  get isBatching(): boolean { return this.batch !== null; }
  get canUndo(): boolean { return this.stack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  run(cmd: Command): boolean {
    if (!this.batch) this._pcReset();
    const ok = cmd.execute(this.world);
    if (ok) {
      if (this.batch) {
        this.batch.push(cmd);
      } else {
        this._push(cmd);
      }
    }
    if (!this.batch) this._pcReport(false);
    return ok;
  }

  /**
   * Start grouping subsequent run() calls into a single undo step.
   * An already-open batch is closed first.
   */
  beginBatch(): void {
    if (this.batch) this.endBatch();
    this.batch = [];
    this._pcReset();
  }

  /** Close the open batch. Pushes one undo step if any command succeeded. */
  endBatch(): void {
    const batch = this.batch;
    this.batch = null;
    if (batch) this._pcReport(false);
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
    this._pcReset();   // nothing happened, so nothing to report
  }

  undo(): void {
    if (this.batch) this.endBatch();
    const cmd = this.stack.pop();
    if (!cmd) return;
    this._pcReset();
    cmd.undo(this.world);
    this._pcReport(true);
    this.redoStack.push(cmd);
  }

  redo(): void {
    if (this.batch) this.endBatch();
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    // Re-execute against the current world. If it no longer applies
    // (e.g. funds ran out since), the step is dropped.
    this._pcReset();
    if (cmd.execute(this.world)) {
      this.stack.push(cmd);
      if (this.stack.length > MAX_STACK) this.stack.shift();
    }
    this._pcReport(false);
  }

  private _push(cmd: Command): void {
    this.stack.push(cmd);
    if (this.stack.length > MAX_STACK) this.stack.shift();
    this.redoStack.length = 0;
  }
}
