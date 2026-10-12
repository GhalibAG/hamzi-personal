// Riwayat transaksi `/keuangan/transaksi` (FIN-07, FIN-10): per hari (judul + total), cari, filter chip, edit, hapus + Urungkan, CSV.
import { useMemo, useState, type ReactNode } from 'react';
import { dayLabelComma } from '@common/format.ts';
import { Icon } from '@/components/icons';
import { Button, Chip, EmptyState, ErrorState, IconButton, ListSkeleton, Page, ScreenHeader } from '@/components/ui';
import { useRemove, useRows } from '@/data/hooks';
import type { Transaction } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { toastUndo, useUi } from '@/stores/ui';
import { exportTransactionsCsv } from '../csv';
import { groupByDay, relDayLabel } from '../derive';
import { useTxEditor } from '../components/TransferSheets';
import { TxRow, txMeta, txTitle, type TxLookup } from '../components/TxRow';

type KindFilter = 'all' | Transaction['kind'];
const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Semua' }, { value: 'expense', label: 'Pengeluaran' }, { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' }, { value: 'adjustment', label: 'Koreksi' },
];
const PAGE_DAYS = 14;

/** Chip berisi <select> native (filter kategori/dompet). */
function ChipSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const current = options.find((o) => o.value === value);
  const active = value !== '';
  return (
    <label
      className={cx(
        'relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-label font-bold whitespace-nowrap',
        active ? 'border-brand-300 bg-primary-soft text-on-primary-soft' : 'border-line-strong bg-surface text-ink-muted',
      )}
    >
      <span aria-hidden="true">{active ? current?.label : label} ▾</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer appearance-none opacity-0">
        <option value="">{label}: semua</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function DayTotal({ net }: { net: number }) {
  const money = useMoney();
  if (net === 0) return <span className="text-meta font-bold text-ink-3">{money.rp(0)}</span>;
  return <span className={cx('tabular text-meta font-extrabold', net > 0 ? 'text-primary' : 'text-ink-2')}>{net > 0 ? '+' : '−'}{money.rp(Math.abs(net))}</span>;
}

export default function TransactionsPage() {
  const desktop = useIsDesktop();
  const today = useToday();
  const tx = useRows('transactions');
  const wallets = useRows('wallets').rows;
  const categories = useRows('categories').rows;
  const remover = useRemove('transactions');
  const openQuick = useUi((s) => s.openQuick);
  const editor = useTxEditor();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [cat, setCat] = useState('');
  const [wal, setWal] = useState('');
  const [days, setDays] = useState(PAGE_DAYS);
  const l: TxLookup = { wallets, categories };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    return tx.rows.filter((t) => {
      if (t.deleted_at) return false;
      if (kind !== 'all' && t.kind !== kind) return false;
      if (cat && t.category_id !== cat) return false;
      if (wal && t.wallet_id !== wal && t.to_wallet_id !== wal) return false;
      if (!needle) return true;
      const hay = `${txTitle(t, { wallets, categories })} ${txMeta(t, { wallets, categories })}`.toLowerCase();
      return hay.includes(needle) || (digits.length >= 3 && String(t.amount).includes(digits));
    });
  }, [tx.rows, q, kind, cat, wal, wallets, categories]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const shown = groups.slice(0, days);
  const filtering = !!(q || kind !== 'all' || cat || wal);

  const del = (t: Transaction) => {
    void remover.remove(t.id);
    toastUndo('Transaksi dihapus.', () => void remover.undo(t.id));
  };
  const exportCsv = () => {
    const sorted = [...filtered].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
    exportTransactionsCsv(sorted, wallets, categories, sorted[0]?.occurred_on ?? today, sorted[sorted.length - 1]?.occurred_on ?? today);
  };
  const catOptions = categories
    .filter((c) => !c.archived && (kind === 'all' || c.kind === kind))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.sort - b.sort)
    .map((c) => ({ value: c.id, label: kind === 'all' ? `${c.name}${c.kind === 'income' ? ' (masuk)' : ''}` : c.name }));
  const walOptions = wallets.filter((w) => !w.archived).sort((a, b) => a.sort - b.sort).map((w) => ({ value: w.id, label: w.name }));

  let body: ReactNode;
  if (tx.isLoading) body = <ListSkeleton rows={5} />;
  else if (tx.isError) body = <ErrorState onRetry={() => void tx.refetch()} />;
  else if (!groups.length) {
    body = filtering
      ? <EmptyState mood="calm" text="Tidak ada transaksi yang cocok dengan pencarian atau filter." action={<Button size="xs" variant="secondary" onClick={() => { setQ(''); setKind('all'); setCat(''); setWal(''); }}>Hapus filter</Button>} />
      : <EmptyState mood="happy" title="Belum ada transaksi" text="Catat pengeluaran pertamamu, cukup tiga ketukan." action={<Button size="sm" onClick={() => openQuick('expense')}>+ Catat</Button>} />;
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {shown.map((g) => (
          <section key={g.day} aria-label={dayLabelComma(g.day)} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 px-0.5">
              <h2 className="m-0 text-body font-extrabold">
                {relDayLabel(g.day, today)}
                {(g.day === today || relDayLabel(g.day, today) === 'Kemarin') && <span className="font-semibold text-ink-3"> · {dayLabelComma(g.day)}</span>}
              </h2>
              <DayTotal net={g.net} />
            </div>
            <div className="rounded-3xl border border-line bg-surface py-1 pr-1 pl-3.5">
              {g.items.map((t) => (
                <TxRow
                  key={t.id}
                  t={t}
                  l={l}
                  onOpen={() => editor.open(t)}
                  trailing={
                    <IconButton variant="plain" label={`Hapus ${txTitle(t, l)} ${txMeta(t, l)}`} onClick={() => del(t)} className="text-ink-3">
                      <Icon.Trash size={18} />
                    </IconButton>
                  }
                />
              ))}
            </div>
          </section>
        ))}
        {groups.length > days && (
          <Button variant="secondary" block onClick={() => setDays((d) => d + PAGE_DAYS)}>Tampilkan hari sebelumnya</Button>
        )}
      </div>
    );
  }

  return (
    <Page narrow>
      <ScreenHeader
        back="/keuangan"
        overline="Keuangan"
        title="Transaksi"
        right={desktop ? (
          <>
            <Button variant="secondary" icon={<Icon.Download size={18} />} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
            <Button onClick={() => openQuick('expense')} className="shadow-day-sel">+ Catat</Button>
          </>
        ) : (
          <IconButton label="Export CSV" onClick={exportCsv} disabled={!filtered.length}><Icon.Download size={20} /></IconButton>
        )}
      />
      <div className="flex flex-col gap-3 px-4 pt-4 lg:px-0 lg:pt-0">
        <div className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-ink-3 focus-within:border-brand-400">
          <Icon.Search size={18} />
          <label htmlFor="tx-search" className="sr-only">Cari transaksi</label>
          <input
            id="tx-search"
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setDays(PAGE_DAYS); }}
            placeholder="Cari catatan, kategori, dompet, nominal…"
            className="min-w-0 flex-1 border-0 bg-transparent text-label-lg text-ink outline-none"
          />
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Filter transaksi">
          {KINDS.map((k) => (
            <Chip key={k.value} selected={kind === k.value} onClick={() => { setKind(k.value); setCat(''); setDays(PAGE_DAYS); }}>{k.label}</Chip>
          ))}
          {(kind === 'all' || kind === 'expense' || kind === 'income') && <ChipSelect label="Kategori" value={cat} options={catOptions} onChange={(v) => { setCat(v); setDays(PAGE_DAYS); }} />}
          <ChipSelect label="Dompet" value={wal} options={walOptions} onChange={(v) => { setWal(v); setDays(PAGE_DAYS); }} />
        </div>
        {filtering && groups.length > 0 && (
          <span className="text-meta text-ink-3" aria-live="polite">{filtered.length} transaksi cocok</span>
        )}
        {body}
      </div>
      {!desktop && <div className="h-4" />}
      {editor.element}
    </Page>
  );
}
