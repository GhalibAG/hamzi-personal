// Dompet `/keuangan/dompet` (FIN-01, FIN-08, FIN-13, FIN-09): saldo per dompet, tambah/ubah/arsipkan, dompet utama,
// "Pindah saldo" (transfer), "Sesuaikan saldo" (koreksi ±), transaksi berulang.
import { useState, type ReactNode } from 'react';
import { wibToInstant } from '@common/calc/index.ts';
import { dayLabel } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, Card, Columns, DecoCircle, EmptyState, ErrorState, ListSkeleton, Page, ScreenHeader, SectionLink, SectionTitle, Switch, Tag,
} from '@/components/ui';
import { useRemove, useRows, useUpdate, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { RecurringRule, Transaction, Wallet } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { advanceRun, recurringLabel, relDayLabel, walletBalances } from '../derive';
import { CategoryBadge, WalletGlyph, dataTint } from '../components/bits';
import { AdjustSheet, TransferSheet } from '../components/TransferSheets';
import { RecurringFormSheet, WALLET_KIND_LABEL, WalletFormSheet } from '../components/WalletSheets';

type SheetState =
  | { kind: 'wallet'; wallet?: Wallet }
  | { kind: 'transfer'; from?: string }
  | { kind: 'adjust'; wallet?: string }
  | { kind: 'recurring'; rule?: RecurringRule }
  | null;

function WalletRow({ w, balance, onOpen, trailing }: { w: Wallet; balance: number; onOpen: () => void; trailing?: ReactNode }) {
  const money = useMoney();
  return (
    <li className="flex items-center gap-1 border-b border-surface-2 last:border-b-0">
      <button type="button" onClick={onOpen} aria-label={`Ubah dompet ${w.name}`} className="flex min-w-0 flex-1 items-center gap-3 bg-transparent py-2.5 text-left">
        <span aria-hidden="true" className={cx('flex size-10 shrink-0 items-center justify-center rounded-lg', !w.color && 'bg-keuangan-bg text-keuangan-fg')} style={dataTint(w.color)}>
          <WalletGlyph kind={w.kind} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className={cx('truncate text-body font-bold', w.archived ? 'text-ink-3' : 'text-ink')}>{w.name}</span>
            {w.is_default && <Tag tone="masuk">Utama</Tag>}
          </span>
          {(w.name.trim().toLowerCase() !== WALLET_KIND_LABEL[w.kind].toLowerCase() || w.archived) && (
            <span className="text-meta text-ink-3">{[w.name.trim().toLowerCase() !== WALLET_KIND_LABEL[w.kind].toLowerCase() ? WALLET_KIND_LABEL[w.kind] : null, w.archived ? 'diarsipkan' : null].filter(Boolean).join(' · ')}</span>
          )}
        </span>
        <span className={cx('tabular text-body font-extrabold', balance < 0 ? 'text-danger-fg' : 'text-ink')}>{money.rp(balance)}</span>
      </button>
      {trailing}
    </li>
  );
}

function nextLabel(d: string, today: string): string {
  const rel = relDayLabel(d, today);
  return rel === 'Hari ini' || rel === 'Kemarin' || rel === 'Besok' ? rel.toLowerCase() : dayLabel(d);
}

function RecurringRow({ r, onOpen }: { r: RecurringRule; onOpen: () => void }) {
  const money = useMoney();
  const today = useToday();
  const categories = useRows('categories').rows;
  const wallets = useRows('wallets').rows;
  const upd = useUpdate('recurring_rules');
  const upsertTx = useUpsert('transactions');
  const removeTx = useRemove('transactions');
  const rulesUpsert = useUpsert('recurring_rules');
  const cat = categories.find((c) => c.id === r.template.category_id);
  const title = r.template.note || cat?.name || (r.template.kind === 'income' ? 'Pemasukan' : 'Pengeluaran');
  const due = r.active && r.next_run <= today;
  const post = () => {
    const tx: Transaction = {
      id: uuid(), kind: r.template.kind, amount: r.template.amount, direction: 1, wallet_id: r.template.wallet_id, to_wallet_id: null,
      category_id: r.template.category_id, note: r.template.note ?? null, recurring_rule_id: r.id,
      occurred_at: wibToInstant(r.next_run, '08:00').toISOString(), occurred_on: r.next_run, deleted_at: null,
    };
    const next = advanceRun(r);
    void upsertTx.save(tx);
    void upd.patch(r.id, { next_run: next });
    toastUndo(`${title} dicatat.`, () => { void removeTx.remove(tx.id); void rulesUpsert.save(r); });
  };
  return (
    <li className="flex flex-col gap-2 border-b border-surface-2 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onOpen} aria-label={`Ubah ${title}`} className="flex min-w-0 flex-1 items-center gap-3 bg-transparent text-left">
          <CategoryBadge category={cat} label={title} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cx('truncate text-body font-bold', !r.active && 'text-ink-3')}>{title}</span>
            <span className="truncate text-meta text-ink-3">
              {recurringLabel(r)} · {wallets.find((w) => w.id === r.template.wallet_id)?.name ?? 'Dompet'} · {r.active ? `berikutnya ${nextLabel(r.next_run, today)}` : 'nonaktif'}
            </span>
          </span>
          <span className={cx('tabular text-body font-extrabold', r.template.kind === 'income' ? 'text-primary' : 'text-ink')}>
            {r.template.kind === 'income' ? '+' : '−'}{money.rp(r.template.amount)}
          </span>
        </button>
        <Switch checked={r.active} onChange={(v) => void upd.patch(r.id, { active: v })} label={`${title} aktif`} />
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-13">
        <Tag tone={r.auto_post ? 'masuk' : 'neutral'}>{r.auto_post ? 'Otomatis' : 'Minta konfirmasi'}</Tag>
        {due && !r.auto_post && <Button size="xs" onClick={post}>Catat sekarang</Button>}
        {due && r.auto_post && <span className="text-meta text-ink-3">Dicatat otomatis oleh server.</span>}
      </div>
    </li>
  );
}

export default function WalletsPage() {
  const desktop = useIsDesktop();
  const money = useMoney();
  const walletsQ = useRows('wallets');
  const txs = useRows('transactions');
  const rules = useRows('recurring_rules').rows;
  const upsert = useUpsert('wallets');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [showArchived, setShowArchived] = useState(false);
  const close = () => setSheet(null);

  const all = [...walletsQ.rows].sort((a, b) => a.sort - b.sort);
  const active = all.filter((w) => !w.archived);
  const archived = all.filter((w) => w.archived);
  const balances = walletBalances(all, txs.rows.filter((t) => !t.deleted_at));
  const total = active.reduce((s, w) => s + (balances.get(w.id) ?? 0), 0);
  const loading = walletsQ.isLoading || txs.isLoading;

  const restore = (w: Wallet) => {
    void upsert.save({ ...w, archived: false });
    toast(`Dompet "${w.name}" aktif lagi.`);
  };

  const header = (
    <ScreenHeader
      back="/keuangan"
      overline="Keuangan"
      title="Dompet"
      right={<Button size={desktop ? 'md' : 'sm'} onClick={() => setSheet({ kind: 'wallet' })} icon={<Icon.Plus size={18} />}>Dompet</Button>}
    />
  );

  const walletsBlock = (
    <>
      <div className="relative overflow-hidden rounded-5xl bg-header p-4.5 text-on-primary shadow-hero-green">
        <DecoCircle className="-top-22.5 -right-17.5 size-50 bg-header-c1 opacity-70" />
        <div className="relative flex flex-col gap-0.5">
          <span className="text-meta font-semibold text-on-header-sub">Saldo semua dompet</span>
          <span className="tabular text-display font-extrabold tracking-[-0.8px]">{money.rp(total)}</span>
          <span className="text-meta font-semibold text-on-header-sub">{active.length} dompet aktif</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" icon={<Icon.Swap size={18} />} onClick={() => setSheet({ kind: 'transfer' })} disabled={active.length < 2}>Pindah saldo</Button>
        <Button variant="secondary" icon={<Icon.Sliders size={18} />} onClick={() => setSheet({ kind: 'adjust' })} disabled={!active.length}>Sesuaikan saldo</Button>
      </div>
      {active.length ? (
        <Card className="px-3.5 py-1">
          <ul className="m-0 list-none p-0">
            {active.map((w) => <WalletRow key={w.id} w={w} balance={balances.get(w.id) ?? 0} onOpen={() => setSheet({ kind: 'wallet', wallet: w })} />)}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Belum ada dompet" text="Tambah dompet pertama, mis. Tunai atau E-wallet." action={<Button size="sm" onClick={() => setSheet({ kind: 'wallet' })}>+ Dompet</Button>} />
      )}
      {archived.length > 0 && (
        <div className="flex flex-col gap-1">
          <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)} className="flex h-11 items-center gap-1 self-start bg-transparent text-label font-bold text-ink-2">
            Diarsipkan ({archived.length}) {showArchived ? <Icon.ChevronUp size={16} /> : <Icon.ChevronDown size={16} />}
          </button>
          {showArchived && (
            <Card className="px-3.5 py-1">
              <ul className="m-0 list-none p-0">
                {archived.map((w) => (
                  <WalletRow
                    key={w.id}
                    w={w}
                    balance={balances.get(w.id) ?? 0}
                    onOpen={() => setSheet({ kind: 'wallet', wallet: w })}
                    trailing={<Button size="xs" variant="outline-soft" onClick={() => restore(w)}>Aktifkan</Button>}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );

  const recurringBlock = (
    <section aria-label="Transaksi berulang" className="flex flex-col gap-2.5">
      <SectionTitle title="Transaksi berulang" right={<SectionLink onClick={() => setSheet({ kind: 'recurring' })}>+ Tambah</SectionLink>} />
      {rules.length ? (
        <Card className="px-3.5 py-1">
          <ul className="m-0 list-none p-0">
            {[...rules].sort((a, b) => Number(b.active) - Number(a.active) || a.next_run.localeCompare(b.next_run)).map((r) => (
              <RecurringRow key={r.id} r={r} onOpen={() => setSheet({ kind: 'recurring', rule: r })} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState compact text="Kos, kuota, atau kiriman bulanan bisa dicatat otomatis." action={<Button size="xs" onClick={() => setSheet({ kind: 'recurring' })}>+ Tambah</Button>} />
      )}
    </section>
  );

  return (
    <Page>
      {header}
      {walletsQ.isError && <div className="px-4 pt-4 lg:px-0 lg:pt-0"><ErrorState onRetry={() => void walletsQ.refetch()} /></div>}
      {loading ? <div className="px-4 pt-4 lg:px-0 lg:pt-0"><ListSkeleton rows={4} /></div> : desktop ? (
        <Columns left={walletsBlock} right={recurringBlock} />
      ) : (
        <div className="flex flex-col gap-4 px-4 pt-4">{walletsBlock}<div className="pt-1">{recurringBlock}</div></div>
      )}
      {sheet?.kind === 'wallet' && <WalletFormSheet open onClose={close} editing={sheet.wallet} />}
      {sheet?.kind === 'transfer' && <TransferSheet open onClose={close} fromWallet={sheet.from} />}
      {sheet?.kind === 'adjust' && <AdjustSheet open onClose={close} walletId={sheet.wallet} />}
      {sheet?.kind === 'recurring' && <RecurringFormSheet open onClose={close} editing={sheet.rule} />}
    </Page>
  );
}
