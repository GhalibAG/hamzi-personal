/** Nilai akhir tabungan dengan setoran bulanan P, saldo awal C, return tahunan r% selama n bulan. */
export function futureValue(c: number, p: number, annualPct: number, n: number): number {
  const i = annualPct / 100 / 12;
  if (i === 0) return c + p * n;
  const g = Math.pow(1 + i, n);
  return c * g + p * ((g - 1) / i);
}

/** Setoran per bulan yang dibutuhkan (dibulatkan ke atas ke rupiah). */
export function goalMonthlyNeeded(target: number, saved: number, months: number, annualPct = 0): number {
  const n = Math.max(1, months);
  if (target <= saved) return 0;
  const i = annualPct / 100 / 12;
  if (i === 0) return Math.ceil((target - saved) / n);
  const g = Math.pow(1 + i, n);
  return Math.ceil((target - saved * g) / ((g - 1) / i));
}

/** Bulan tersisa sampai tenggat (min 1). */
export function monthsLeft(daysToDue: number): number {
  return Math.max(1, Math.ceil(daysToDue / 30.4375));
}

export function goalProgressPct(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((saved / target) * 100));
}

export function emergencyFundTarget(avgMonthlyExpense: number, months = 6): number {
  return Math.round(avgMonthlyExpense * months);
}
