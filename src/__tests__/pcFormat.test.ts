import { describe, it, expect } from 'vitest';
import { pcAmount, pcDelta, pcOfCap } from '../ui/pcFormat';

describe('political capital formatting', () => {
  it('writes whole amounts plainly and small fractions to one decimal', () => {
    expect(pcAmount(12)).toBe('12');
    expect(pcAmount(3.5)).toBe('3.5');
    expect(pcAmount(-3.5)).toBe('3.5');
    expect(pcAmount(17.5)).toBe('18');
    expect(pcAmount(0.96)).toBe('1');
    expect(pcAmount(0.02)).toBe('0.1');   // a real change never reads as nothing
    expect(pcAmount(1234)).toBe('1,234');
  });

  it('signs a change', () => {
    expect(pcDelta(9)).toBe('+◆ 9');
    expect(pcDelta(-20)).toBe('−◆ 20');
  });

  it('shows the HUD figure without rounding up or going negative', () => {
    expect(pcOfCap(61.9, 100)).toBe('61 / 100');
    expect(pcOfCap(-0.4, 100)).toBe('0 / 100');
    expect(pcOfCap(112.2, 100)).toBe('112 / 100');
  });
});
