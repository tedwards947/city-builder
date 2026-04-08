import type { Command } from './Command';
import type { World } from '../sim/World';

const MAX_STACK = 200;

export class CommandHistory {
  private readonly world: World;
  private readonly stack: Command[] = [];

  constructor(world: World) {
    this.world = world;
  }

  run(cmd: Command): boolean {
    const ok = cmd.execute(this.world);
    if (ok) {
      this.stack.push(cmd);
      if (this.stack.length > MAX_STACK) this.stack.shift();
    }
    return ok;
  }

  undo(): void {
    const cmd = this.stack.pop();
    if (cmd) cmd.undo(this.world);
  }
}
