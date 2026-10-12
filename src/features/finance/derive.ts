// Turunan keuangan (setara rpc_finance_daily/period + v_wallet_balance). Rumus di @common/calc.
import {
  addDays, budgetUsedPct, cycleEnd, cycleStart, daysLeftInCycle, pctVsAvg, safeDailyRounded, type DateStr,
} from '@common/calc/index.ts';
import type { Budget, Category, Transaction, Wallet } from '@/data/types';

/** Efek transaksi pada saldo satu dompet. */
export function txEffect(t: Transaction, walletId: string): number {
  if (t.deleted_at) return 0;
  switch (t.kind) {
    case 'income': return t.wallet_id === walletId ? t.amount : 0;
    case 'expense': return t.wallet_id === walletId ? -t.amount : 0;
    case 'adjustment': return t.wallet_id === walletId ? t.amount * t.direction : 0;
    case 'transfer': return (t.wallet_id === walletId ? -t.amount : 0) + (t.to_wallet_id === walletId ? t.amount : 0);
  }
}

export function walletBalance(w: Wallet, txs: Transaction[]): number {
  return txs.reduce((s, t) => s + txEffect(t, w.id), w.opening_balance);
}

export function walletBalances(wallets: Wallet[], txs: Transaction[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of wallets) m.set(w.id, walletBalance(w, txs));
  return m;
}

/** Anggaran aktif (total bila categoryId null) pada tanggal d. */
export function activeBudget(budgets: Budget[], categoryId: string | null, d: DateStr): number | null {
  const b = budgets
    .filter((x) => (x.category_id ?? null) === categoryId && x.effective_from <= d)
    .sort((a, z) => z.effective_from.localeCompare(a.effective_from))[0];
  return b ? b.amount : null;
}

const sum = (xs: Transaction[]) => xs.reduce((s, t) => s + t.amount, 0);

export interface FinanceSummary {
  today: DateStr;
  cycleStart: DateStr;
  cycleEnd: DateStr;
  daysLeft: number;
  spentToday: number;
  avgDaily7d: number;
  pctVsAvg: number | null;
  spentCycle: number;
  incomeCycle: number;
  budgetTotal: number | null;
  budgetUsedPct: number;
  safeDaily: number;
  balanceTotal: number;
  balances: Map<string, number>;
  todayTx: Transaction[];
  /** Pengeluaran siklus per kategori, urut terbesar. pct = porsi dari total pengeluaran siklus. */
  byCategory: { category: Category | undefined; categoryId: string | null; amount: number; pct: number; budget: number | null }[];
  /** Nama bulan siklus (bulan tanggal awal siklus bila cycle_day=1; selain itu bulan akhir). */
  cycleMonth: number;
}

export function financeSummary(a: {
  transactions: Transaction[]; wallets: Wallet[]; budgets: Budget[]; categories: Category[]; cycleDay: number; today: DateStr;
}): FinanceSummary {
  const { today, cycleDay } = a;
  const txs = a.transactions.filter((t) => !t.deleted_at);
  const expenses = txs.filter((t) => t.kind === 'expense');
  const cs = cycleStart(today, cycleDay);
  const ce = cycleEnd(today, cycleDay);
  const spentToday = sum(expenses.filter((t) => t.occurred_on === today));
  const avg = Math.round(sum(expenses.filter((t) => t.occurred_on >= addDays(today, -7) && t.occurred_on <= addDays(today, -1))) / 7);
  const cycleExp = expenses.filter((t) => t.occurred_on >= cs && t.occurred_on <= today);
  const spentCycle = sum(cycleExp);
  const incomeCycle = sum(txs.filter((t) => t.kind === 'income' && t.occurred_on >= cs && t.occurred_on <= today));
  const budgetTotal = activeBudget(a.budgets, null, today);
  const daysLeft = daysLeftInCycle(today, cycleDay);
  const balances = walletBalances(a.wallets.filter((w) => !w.archived), txs);
  const balanceTotal = [...balances.values()].reduce((s, v) => s + v, 0);
  const catMap = new Map<string | null, number>();
  for (const t of cycleExp) catMap.set(t.category_id ?? null, (catMap.get(t.category_id ?? null) ?? 0) + t.amount);
  const byCategory = [...catMap.entries()]
    .map(([categoryId, amount]) => ({
      categoryId, amount, category: a.categories.find((c) => c.id === categoryId),
      pct: spentCycle > 0 ? Math.round((amount / spentCycle) * 100) : 0,
      budget: categoryId ? activeBudget(a.budgets, categoryId, today) : null,
    }))
    .sort((x, y) => y.amount - x.amount);
  const todayTx = txs.filter((t) => t.occurred_on === today).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at));
  const cycleMonth = Number((cycleDay === 1 ? cs : ce).slice(5, 7));
  return {
    today, cycleStart: cs, cycleEnd: ce, daysLeft, spentToday, avgDaily7d: avg, pctVsAvg: pctVsAvg(spentToday, avg),
    spentCycle, incomeCycle, budgetTotal,
    budgetUsedPct: budgetTotal ? budgetUsedPct(spentCycle, budgetTotal) : 0,
    safeDaily: budgetTotal ? safeDailyRounded(budgetTotal, spentCycle, daysLeft) : 0,
    balanceTotal, balances, todayTx, byCategory, cycleMonth,
  };
}
