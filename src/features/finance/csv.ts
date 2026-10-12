// Unduh CSV (FIN-10). Isi dibuat oleh `transactionsCsv` (derive.ts) — sudah diawali BOM UTF-8.
import type { Category, Transaction, Wallet } from '@/data/types';
import { transactionsCsv } from './derive';

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTransactionsCsv(txs: Transaction[], wallets: Wallet[], categories: Category[], from: string, to: string) {
  downloadText(`hamzi-transaksi-${from}_${to}.csv`, transactionsCsv(txs, wallets, categories));
}
