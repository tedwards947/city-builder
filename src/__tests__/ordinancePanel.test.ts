import './pcOffBaseline';
import { describe, it, expect } from 'vitest';
import { ordinancePrice, ordinanceUpkeep } from '../ui/OrdinancePanel';
import { ORDINANCES, enactOrdinance } from '../sim/ordinances';
import type { OrdinanceDef } from '../sim/ordinances';
import { landWorld } from './pcTestWorld';

/** Set an ordinance's numbers for one test; returns a function that puts them back. */
function withNumbers(id: number, numbers: Partial<OrdinanceDef['numbers']>): () => void {
  const target = ORDINANCES[id].numbers as OrdinanceDef['numbers'];
  const was = { ...target };
  Object.assign(target, numbers);
  return () => { Object.assign(target, was); };
}

describe('ordinance panel', () => {
  it('prices an ordinance: what it costs to enact and to keep', () => {
    const w = landWorld();   // cap 100: upkeep is charged as the table says
    let undo = withNumbers(0, { enactCost: 20, dailyUpkeep: 0.3 });
    try { expect(ordinancePrice(w, ORDINANCES[0])).toEqual({ enact: '◆ 20', keep: '◆ 0.3 / day' }); } finally { undo(); }
    undo = withNumbers(0, { enactCost: 15, dailyUpkeep: 0.2, dailyMoney: 40 });
    try { expect(ordinancePrice(w, ORDINANCES[0])).toEqual({ enact: '◆ 15', keep: '◆ 0.2 + $40 / day' }); } finally { undo(); }
    undo = withNumbers(0, { enactCost: 10 });
    try { expect(ordinancePrice(w, ORDINANCES[0])).toEqual({ enact: '◆ 10', keep: '' }); } finally { undo(); }
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
