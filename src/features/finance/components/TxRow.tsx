// Baris transaksi (UI-SPEC §5.4): ikon inisial kategori 40, kategori 14/700, meta "Tunai · 12:30 · nasi padang", nominal kanan.
import type { ReactNode } from 'react';
import type { Category, Transaction, Wallet } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { txTime } from '../derive';
import { CategoryBadge } from './bits';

export interface TxLookup { wallets: Wallet[]; categories: Category[] }

export function txTitle(t: Transaction, l: TxLookup): string {
  if (t.kind === 'transfer') return 'Pindah saldo';
  if (t.kind === 'adjustment') return 'Koreksi saldo';
  return l.categories.find((c) => c.id === t.category_id)?.name ?? (t.kind === 'income' ? 'Pemasukan' : 'Pengeluaran');
}

export function txMeta(t: Transaction, l: TxLookup, withTime = true): string {
  const w = (id?: string | null) => l.wallets.find((x) => x.id === id)?.name ?? 'Dompet';
  const where = t.kind === 'transfer' ? `${w(t.wallet_id)} → ${w(t.to_wallet_id)}` : w(t.wallet_id);
  return [where, withTime ? txTime(t) : null, t.note].filter(Boolean).join(' · ');
}

/** Nominal bertanda: pengeluaran "−Rp 25.000", pemasukan "+Rp …" (hijau), transfer tanpa tanda. */
export function TxAmount({ t, className }: { t: Transaction; className?: string }) {
  const money = useMoney();
  const sign = t.kind === 'expense' || (t.kind === 'adjustment' && t.direction < 0) ? '−' : t.kind === 'transfer' ? '' : '+';
  const positive = sign === '+';
  return <span className={cx('tabular shrink-0 font-extrabold whitespace-nowrap', positive ? 'text-primary' : 'text-ink', className)}>{sign}{money.rp(t.amount)}</span>;
}

export function TxBadge({ t, l, small }: { t: Transaction; l: TxLookup; small?: boolean }) {
  const cat = l.categories.find((c) => c.id === t.category_id);
  return <CategoryBadge category={cat} label={txTitle(t, l)} small={small} />;
}

export function TxRow({ t, l, onOpen, trailing, withTime = true }: { t: Transaction; l: TxLookup; onOpen: () => void; trailing?: ReactNode; withTime?: boolean }) {
  const title = txTitle(t, l);
  return (
    <div className="flex items-center gap-1 border-b border-surface-2 last:border-b-0">
      <button type="button" onClick={onOpen} aria-label={`Ubah ${title}`} className="flex min-w-0 flex-1 items-center gap-3 bg-transparent py-2.5 text-left">
        <TxBadge t={t} l={l} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body font-bold text-ink">{title}</span>
          <span className="truncate text-meta text-ink-3">{txMeta(t, l, withTime)}</span>
        </span>
        <TxAmount t={t} className="text-body" />
      </button>
      {trailing}
    </div>
  );
}
