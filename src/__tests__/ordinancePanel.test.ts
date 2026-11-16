import { describe, it, expect } from 'vitest';
import { ordinancePrice, ordinanceUpkeep } from '../ui/OrdinancePanel';
import { ORDINANCES, enactOrdinance } from '../sim/ordinances';
import type { OrdinanceDef } from '../sim/ordinances';
import { landWorld } from './pcTestWorld';

const def = (numbers: Partial<OrdinanceDef['numbers']>): OrdinanceDef =>
  ({ ...ORDINANCES[0], numbers: { enactCost: 0, dailyUpkeep: 0, dailyMoney: 0, modifiers: {}, ...numbers } });

describe('ordinance panel', () => {
  it('prices an ordinance: what it costs to enact and to keep', () => {
    expect(ordinancePrice(def({ enactCost: 20, dailyUpkeep: 0.3 }))).toEqual({ enact: '◆ 20', keep: '◆ 0.3 / day' });
    expect(ordinancePrice(def({ enactCost: 15, dailyUpkeep: 0.2, dailyMoney: 40 }))).toEqual({ enact: '◆ 15', keep: '◆ 0.2 + $40 / day' });
    expect(ordinancePrice(def({ enactCost: 10 }))).toEqual({ enact: '◆ 10', keep: '' });
  });

  it('adds up the upkeep of active ordinances, leaving out suspended ones', () => {
    const w = landWorld();
    expect(ordinanceUpkeep(w)).toBe(0);
    const [a, b] = ORDINANCES;
    const numbers = a.numbers as { dailyUpkeep: number }, numbersB = b.numbers as { dailyUpkeep: number };
    const was = [numbers.dailyUpkeep, numbersB.dailyUpkeep];
    numbers.dailyUpkeep = 0.3; numbersB.dailyUpkeep = 0.5;
    try {
      expect(enactOrdinance(w, a.id)).toBe(true);
      expect(enactOrdinance(w, b.id)).toBe(true);
      expect(ordinanceUpkeep(w)).toBeCloseTo(0.8);
      w.politics.ordinances.suspended.push(b.id);
      expect(ordinanceUpkeep(w)).toBeCloseTo(0.3);
    } finally {
      numbers.dailyUpkeep = was[0]; numbersB.dailyUpkeep = was[1];
    }
  });
});
