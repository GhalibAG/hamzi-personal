// Turunan keuangan (setara rpc_finance_daily/period + v_wallet_balance). Rumus di @common/calc.
import {
  addDays, budgetUsedPct, cycleEnd, cycleStart, daysInMonth, daysLeftInCycle, fromParts, isoWeekday, pctVsAvg, safeDailyRounded, wibTime,
  type DateStr,
} from '@common/calc/index.ts';
import { BULAN, BULAN_PENDEK, HARI, dayLabelComma } from '@common/format.ts';
import type { Budget, Category, RecurringRule, Transaction, Wallet } from '@/data/types';

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

/* ---------- Tambahan (layar Keuangan) — fungsi murni, tanpa rumus baru ---------- */

/** "1–31 Oktober" (siklus satu bulan) atau "25 Sep–24 Okt". */
export function cycleLabel(start: DateStr, end: DateStr): string {
  const [, m1, d1] = start.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  if (m1 === m2) return `${d1}–${d2} ${BULAN[m1]}`;
  return `${d1} ${BULAN_PENDEK[m1]}–${d2} ${BULAN_PENDEK[m2]}`;
}

/** Rata-rata pengeluaran bulanan 3 bulan terakhir (PRD §7.6): total 90 hari sebelum hari ini ÷ 3, dibulatkan. */
export function avgMonthlyExpense(transactions: Transaction[], today: DateStr): number {
  const from = addDays(today, -90);
  const total = transactions
    .filter((t) => !t.deleted_at && t.kind === 'expense' && t.occurred_on >= from && t.occurred_on <= today)
    .reduce((s, t) => s + t.amount, 0);
  return Math.round(total / 3);
}

/** Jam WIB transaksi 'HH:MM'. */
export function txTime(t: Pick<Transaction, 'occurred_at'>): string {
  return wibTime(new Date(t.occurred_at));
}

/** Kategori untuk chip catat cepat: urut paling sering dipakai (60 hari), lalu `sort`; "Lainnya" selalu terakhir. */
export function categoriesByUsage(categories: Category[], transactions: Transaction[], kind: 'expense' | 'income', today: DateStr): Category[] {
  const from = addDays(today, -60);
  const count = new Map<string, number>();
  for (const t of transactions) {
    if (t.deleted_at || t.kind !== kind || !t.category_id || t.occurred_on < from) continue;
    count.set(t.category_id, (count.get(t.category_id) ?? 0) + 1);
  }
  const isOther = (c: Category) => c.name.trim().toLowerCase() === 'lainnya';
  return categories
    .filter((c) => c.kind === kind && !c.archived && !c.deleted_at)
    .sort((a, b) => Number(isOther(a)) - Number(isOther(b)) || (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || a.sort - b.sort);
}

export const TX_KIND_LABEL: Record<Transaction['kind'], string> = {
  expense: 'Pengeluaran', income: 'Pemasukan', transfer: 'Transfer', adjustment: 'Koreksi saldo',
};

/** Efek transaksi pada total saldo semua dompet (transfer = 0). */
export function txNet(t: Transaction): number {
  switch (t.kind) {
    case 'income': return t.amount;
    case 'expense': return -t.amount;
    case 'adjustment': return t.amount * t.direction;
    case 'transfer': return 0;
  }
}

/** Kelompok per hari (terbaru dulu) + total bersih harian (pemasukan − pengeluaran ± koreksi). */
export function groupByDay(txs: Transaction[]): { day: DateStr; items: Transaction[]; net: number }[] {
  const m = new Map<DateStr, Transaction[]>();
  for (const t of [...txs].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))) {
    const arr = m.get(t.occurred_on) ?? [];
    arr.push(t);
    m.set(t.occurred_on, arr);
  }
  return [...m.entries()].map(([day, items]) => ({ day, items, net: items.reduce((s, t) => s + txNet(t), 0) }));
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV transaksi (UTF-8 dengan BOM; nominal integer rupiah, bertanda untuk pengeluaran). */
export function transactionsCsv(txs: Transaction[], wallets: Wallet[], categories: Category[]): string {
  const wName = (id?: string | null) => (id ? wallets.find((w) => w.id === id)?.name ?? '' : '');
  const cName = (id?: string | null) => (id ? categories.find((c) => c.id === id)?.name ?? '' : '');
  const head = ['Tanggal', 'Jam', 'Jenis', 'Kategori', 'Dompet', 'Ke dompet', 'Nominal', 'Catatan'];
  const rows = [...txs]
    .filter((t) => !t.deleted_at)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((t) => [
      t.occurred_on, txTime(t), TX_KIND_LABEL[t.kind], cName(t.category_id), wName(t.wallet_id), wName(t.to_wallet_id),
      t.kind === 'transfer' ? t.amount : txNet(t), t.note ?? '',
    ].map(csvCell).join(','));
  return '﻿' + [head.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Label hari relatif: "Hari ini", "Kemarin", atau "Senin, 12 Okt". */
export function relDayLabel(d: DateStr, today: DateStr): string {
  if (d === today) return 'Hari ini';
  if (d === addDays(today, -1)) return 'Kemarin';
  if (d === addDays(today, 1)) return 'Besok';
  return dayLabelComma(d);
}

/* ---------- Transaksi berulang (FIN-09) — hanya aritmetika tanggal ---------- */

function clampDay(y: number, m: number, d: number): DateStr {
  return fromParts(y, m, Math.min(d, daysInMonth(y, m)));
}

/** Tanggal jalan pertama ≥ `from` untuk aturan berulang. */
export function firstRun(freq: RecurringRule['freq'], from: DateStr, opts: { dayOfMonth?: number | null; weekday?: number | null }): DateStr {
  if (freq === 'weekly' && opts.weekday) {
    const delta = (opts.weekday - isoWeekday(from) + 7) % 7;
    return addDays(from, delta);
  }
  if (freq === 'monthly' && opts.dayOfMonth) {
    const [y, m, d] = from.split('-').map(Number);
    if (d <= opts.dayOfMonth && opts.dayOfMonth <= daysInMonth(y, m)) return clampDay(y, m, opts.dayOfMonth);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    return clampDay(ny, nm, opts.dayOfMonth);
  }
  return from;
}

/** Tanggal jalan berikutnya setelah `next_run` sekarang. */
export function advanceRun(rule: Pick<RecurringRule, 'freq' | 'interval_n' | 'day_of_month' | 'next_run'>): DateStr {
  const n = Math.max(1, rule.interval_n || 1);
  if (rule.freq === 'daily') return addDays(rule.next_run, n);
  if (rule.freq === 'weekly') return addDays(rule.next_run, 7 * n);
  const [y, m, d] = rule.next_run.split('-').map(Number);
  const total = (m - 1) + n;
  return clampDay(y + Math.floor(total / 12), (total % 12) + 1, rule.day_of_month ?? d);
}

/** "Tiap bulan tgl 5", "Tiap Senin", "Tiap hari". */
export function recurringLabel(rule: Pick<RecurringRule, 'freq' | 'interval_n' | 'day_of_month' | 'by_day'>): string {
  const n = Math.max(1, rule.interval_n || 1);
  if (rule.freq === 'daily') return n === 1 ? 'Tiap hari' : `Tiap ${n} hari`;
  if (rule.freq === 'weekly') {
    const days = (rule.by_day ?? []).map((d) => HARI[d]).join(', ');
    return (n === 1 ? 'Tiap ' : `Tiap ${n} minggu, `) + (days || 'minggu');
  }
  return (n === 1 ? 'Tiap bulan' : `Tiap ${n} bulan`) + (rule.day_of_month ? ` tgl ${rule.day_of_month}` : '');
}
