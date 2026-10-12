export function investmentPL(netCapital: number, value: number): { pl: number; pct: number | null } {
  const pl = value - netCapital;
  return { pl, pct: netCapital > 0 ? Math.round((pl / netCapital) * 1000) / 10 : null };
}

export function netCapital(tx: { kind: 'beli' | 'jual' | 'setor' | 'tarik'; amount: number }[]): number {
  return tx.reduce((a, t) => a + (t.kind === 'beli' || t.kind === 'setor' ? t.amount : -t.amount), 0);
}
