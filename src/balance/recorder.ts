// Balance Lab: what happened during a run, from the sim's own events.

import type { World } from '../sim/World';
import type { Command } from '../commands/Command';
import type { CommandHistory } from '../commands/CommandHistory';
import { BALANCE } from '../data/balance';
import { pcCap } from '../sim/politics';

export interface DaySample { day: number; pc: number; cap: number; pop: number; sat: number; money: number; regen: number }

export class Recorder {
  /** PC gained or lost per reason (pcChanged), plus passive regeneration as 'regen'. */
  readonly pcByReason: Record<string, number> = {};
  /** Player actions tried, and refused, per tag; refusals also per fail reason. */
  readonly tried: Record<string, number> = {};
  readonly refused: Record<string, Record<string, number>> = {};
  readonly requests = { opened: {} as Record<string, number>, met: {} as Record<string, number>, failed: {} as Record<string, number> };
  readonly days: DaySample[] = [];
  /** Each milestone payout ÷ the cap when it was paid. */
  readonly milestoneRatios: number[] = [];
  /** Requests the player answered with a building, and those of them later met. */
  readonly answered = new Set<number>();
  answeredMet = 0;
  private regenToday = 0;
  private readonly world: World;

  constructor(world: World) {
    this.world = world;
    world.events.on('pcChanged', p => {
      this.add(p.reason as string, p.delta as number);
      if (p.reason === 'milestone') this.milestoneRatios.push((p.delta as number) / pcCap(world));
    });
    world.events.on('requestMet', p => { if (this.answered.has(p.id as number)) this.answeredMet++; });
    for (const ev of ['requestOpened', 'requestMet', 'requestFailed'] as const) {
      const into = ev === 'requestOpened' ? this.requests.opened : ev === 'requestMet' ? this.requests.met : this.requests.failed;
      world.events.on(ev, p => { const k = p.kind as string; into[k] = (into[k] ?? 0) + 1; });
    }
  }

  private add(reason: string, delta: number) { this.pcByReason[reason] = (this.pcByReason[reason] ?? 0) + delta; }

  /** Call after every tick: adds the tick's regeneration. */
  afterTick() {
    if (this.world.politics.regen) { this.add('regen', this.world.politics.regen); this.regenToday += this.world.politics.regen; }
    if (this.world.tick % BALANCE.ticksPerDay === 0) {
      const w = this.world;
      this.days.push({ day: w.tick / BALANCE.ticksPerDay, pc: w.budget.politicalCapital, cap: pcCap(w), pop: w.stats.population, sat: w.stats.satisfaction, money: w.budget.money, regen: this.regenToday });
      this.regenToday = 0;
    }
  }

  /** Run a command through the history, counting tries and refusals under `tag`. */
  run(history: CommandHistory, cmd: Command, tag: string): boolean {
    this.tried[tag] = (this.tried[tag] ?? 0) + 1;
    const ok = history.run(cmd);
    if (!ok) {
      const why = cmd.failReason ?? 'invalid';
      (this.refused[tag] ??= {})[why] = (this.refused[tag][why] ?? 0) + 1;
    }
    return ok;
  }

  refusedFor(reason: string, tags?: string[]): number {
    return Object.entries(this.refused).filter(([t]) => !tags || tags.includes(t)).reduce((n, [, r]) => n + (r[reason] ?? 0), 0);
  }
  triedTotal(tags?: string[]): number {
    return Object.entries(this.tried).filter(([t]) => !tags || tags.includes(t)).reduce((n, [, v]) => n + v, 0);
  }
}
