// A group of commands that undo/redo as one step (e.g. one drag-paint stroke).

import { Command } from './Command';
import type { World } from '../sim/World';

export class BatchCommand extends Command {
  private readonly commands: Command[];

  constructor(commands: Command[]) {
    super();
    this.commands = commands;
  }

  get size(): number { return this.commands.length; }

  /** Re-runs every member in order (used for redo). True if any succeeded. */
  execute(world: World): boolean {
    let any = false;
    for (const cmd of this.commands) {
      if (cmd.execute(world)) any = true;
    }
    return any;
  }

  /** Undoes members in reverse order. */
  undo(world: World): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo(world);
    }
  }
}
