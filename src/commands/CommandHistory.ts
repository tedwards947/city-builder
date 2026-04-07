import type { Command } from './Command';
import type { World } from '../sim/World';

export class CommandHistory {
  private readonly world: World;
  private readonly stack: Command[] = [];

  constructor(world: World) {
    this.world = world;
  }

  run(cmd: Command): boolean {
    const ok = cmd.execute(this.world);
    if (ok) this.stack.push(cmd);
    return ok;
  }

  undo(): void {
    const cmd = this.stack.pop();
    if (cmd) cmd.undo(this.world);
  }
}
