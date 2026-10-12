import { useMemo } from 'react';
import { useRows, useSettings } from '@/data/hooks';
import { useToday } from '@/lib/hooks';
import { financeSummary } from './derive';

/** Ringkasan keuangan hari ini (Beranda, Keuangan, Sidebar). */
export function useFinanceSummary() {
  const today = useToday();
  const s = useSettings();
  const tx = useRows('transactions');
  const wallets = useRows('wallets');
  const budgets = useRows('budgets');
  const categories = useRows('categories');
  const loading = tx.isLoading || wallets.isLoading || budgets.isLoading || categories.isLoading;
  const error = tx.isError || wallets.isError;
  const data = useMemo(
    () => financeSummary({ transactions: tx.rows, wallets: wallets.rows, budgets: budgets.rows, categories: categories.rows, cycleDay: s.budget_cycle_day, today }),
    [tx.rows, wallets.rows, budgets.rows, categories.rows, s.budget_cycle_day, today],
  );
  return { data, loading, error, refetch: () => { void tx.refetch(); void wallets.refetch(); } };
}
