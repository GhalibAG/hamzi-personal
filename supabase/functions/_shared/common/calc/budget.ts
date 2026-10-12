import { addDays, daysInMonth, diffDays, fromParts, type DateStr } from './date.ts';

/** Awal siklus anggaran (PRD §7.4). */
export function cycleStart(d: DateStr, cycleDay: number): DateStr {
  const [y, m, day] = d.split('-').map(Number);
  if (day >= cycleDay) return fromParts(y, m, cycleDay);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return fromParts(py, pm, Math.min(cycleDay, daysInMonth(py, pm)));
}

/** Akhir siklus (inklusif): sehari sebelum awal siklus berikutnya. */
export function cycleEnd(d: DateStr, cycleDay: number): DateStr {
  const start = cycleStart(d, cycleDay);
  const [y, m] = start.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return addDays(fromParts(ny, nm, cycleDay), -1);
}

/** Hari tersisa termasuk hari ini (min 1). */
export function daysLeftInCycle(d: DateStr, cycleDay: number): number {
  return Math.max(1, diffDays(d, cycleEnd(d, cycleDay)) + 1);
}

export function budgetUsedPct(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.round((spent / budget) * 100);
}

/** Aman per hari tanpa pembulatan ribuan (bilangan bulat ke bawah). */
export function safeDaily(budget: number, spent: number, daysLeft: number): number {
  return Math.floor(Math.max(0, budget - spent) / Math.max(1, daysLeft));
}

/** Aman per hari dibulatkan ke bawah ke ribuan (tampilan). */
export function safeDailyRounded(budget: number, spent: number, daysLeft: number): number {
  return Math.floor(Math.max(0, budget - spent) / Math.max(1, daysLeft) / 1000) * 1000;
}

/** Persen perbandingan vs rata-rata (dibulatkan). null bila rata-rata 0. */
export function pctVsAvg(today: number, avg: number): number | null {
  if (avg <= 0) return null;
  return Math.round(((today - avg) / avg) * 100);
}

export type BudgetTone = 'ok' | 'warn' | 'over';
export function budgetTone(pct: number): BudgetTone {
  return pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
}
