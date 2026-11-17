// What the HUD says about the city's debt (pure, so it can be tested).
// The numbers come from debtStatus() in sim/debt.ts.

import type { DebtStatus } from '../sim/debt';

export interface DebtHud {
  /** Nothing is shown while the city is out of debt. */
  show: boolean;
  /** How full the bar is, 0–1: the debt as a share of the limit, or the share of the countdown left. */
  fill: number;
  tone: 'plain' | 'amber' | 'red';
  /** The countdown to the council's vote is running: the bar drains and is striped. */
  countdown: boolean;
  label: string;
}

export interface DebtLabels {
  /** "Debt {pct}% of limit" */
  ofLimit: string;
  overLimit: string;
  /** "Council vote in {days} days" */
  voteIn: string;
  voteIn1: string;
}

export function debtHud(money: number, s: DebtStatus, labels: DebtLabels): DebtHud {
  if (!s.inDebt) return { show: false, fill: 0, tone: 'plain', countdown: false, label: '' };
  if (s.daysLeft !== null && s.graceDays > 0) {
    return {
      show: true, countdown: true, tone: 'red',
      fill: Math.max(0, Math.min(1, s.daysLeft / s.graceDays)),
      label: (s.daysLeft === 1 ? labels.voteIn1 : labels.voteIn).replace('{days}', String(s.daysLeft)),
    };
  }
  const share = s.limit > 0 ? -money / s.limit : 1;
  if (s.overLimit) return { show: true, countdown: false, tone: 'red', fill: 1, label: labels.overLimit };
  return {
    show: true, countdown: false, tone: s.pastHalf ? 'amber' : 'plain',
    fill: Math.max(0, Math.min(1, share)),
    // Never "100%" while still within the limit.
    label: labels.ofLimit.replace('{pct}', String(Math.min(99, Math.floor(share * 100)))),
  };
}

/** Time in office for the game-over summary: whole years, or months in the first year. */
export function timeInOffice(days: number): { n: number; unit: 'years' | 'months' } {
  const years = Math.floor(days / 360);
  return years >= 1 ? { n: years, unit: 'years' } : { n: Math.floor(days / 30), unit: 'months' };
}
