// Keuangan `/keuangan` — Keuangan.dc.html (HP, screenshot 09–11) & Desktop-Keuangan.dc.html (d05). UI-SPEC §5, §14; FIN-06.
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { BULAN } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, ButtonLink, DecoCircle, EmptyState, ErrorState, Fab, Page, ProgressBar, Skeleton, StatTile, budgetBarColor,
} from '@/components/ui';
import { useRows } from '@/data/hooks';
import type { Transaction } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { useUi } from '@/stores/ui';
import { goalView, type AssetView, type GoalView } from '@/features/goals/derive';
import { agoLabel, pctSigned, portfolio } from '@/features/investments/derive';
import { exportTransactionsCsv } from '../csv';
import { cycleLabel, txTime, type FinanceSummary } from '../derive';
import { useFinanceSummary } from '../hooks';
import { GoalGlyph } from '../components/bits';
import { useTxEditor } from '../components/TransferSheets';
import { TxAmount, TxBadge, TxRow, txMeta, txTitle, type TxLookup } from '../components/TxRow';

function useFinancePage() {
  const today = useToday();
  const fin = useFinanceSummary();
  const wallets = useRows('wallets');
  const categories = useRows('categories').rows;
  const txs = useRows('transactions').rows;
  const goals = useRows('savings_goals').rows;
  const contributions = useRows('goal_contributions').rows;
  const assets = useRows('assets').rows;
  const assetTx = useRows('asset_transactions').rows;
  const vals = useRows('asset_valuations').rows;
  const goalViews = goals
    .filter((g) => g.status === 'aktif' && !g.deleted_at)
    .sort((a, b) => a.priority - b.priority)
    .map((g) => goalView(g, contributions, today));
  const invest = portfolio(assets, assetTx, vals).views;
  const activeWallets = wallets.rows.filter((w) => !w.archived);
  const lookup: TxLookup = { wallets: wallets.rows, categories };
  return { today, fin, f: fin.data, txs, lookup, walletCount: activeWallets.length, goalViews, invest };
}
type D = ReturnType<typeof useFinancePage>;

const overline = (f: FinanceSummary) => `Siklus ${cycleLabel(f.cycleStart, f.cycleEnd)} · sisa ${f.daysLeft} hari`;

/* ---------- Kartu saldo ---------- */
function BalanceHero({ f, desktop }: { f: FinanceSummary; desktop: boolean }) {
  const money = useMoney();
  return (
    <div className={cx('relative overflow-hidden rounded-5xl bg-header text-on-primary shadow-hero-green', desktop ? 'flex-[1_1_320px] p-5' : 'mx-4 mt-4 p-4.5')}>
      <DecoCircle className={cx('bg-header-c1 opacity-70', desktop ? '-top-25 -right-17.5 size-55' : '-top-22.5 -right-17.5 size-50')} />
      {!desktop && <DecoCircle className="-bottom-17.5 -left-10 size-30 bg-header-c2 opacity-60" />}
      <div className="relative flex flex-col gap-0.5">
        <span className="text-meta font-semibold text-on-header-sub">Saldo semua dompet</span>
        <span className="tabular text-display font-extrabold tracking-[-0.8px]">{money.rp(f.balanceTotal)}</span>
      </div>
      <div className="relative mt-3.5 grid grid-cols-2 gap-2">
        <StatTile tone="hero" label="↓ Masuk bulan ini" value={<span className="tabular">{money.rp(f.incomeCycle)}</span>} />
        <StatTile tone="hero" label="↑ Keluar bulan ini" value={<span className="tabular">{money.rp(f.spentCycle)}</span>} />
      </div>
    </div>
  );
}

/* ---------- Kartu anggaran ---------- */
function CategoryBars({ f, desktop }: { f: FinanceSummary; desktop: boolean }) {
  const rows = f.byCategory.slice(0, 3);
  if (!rows.length) return <span className="text-meta text-ink-3">Belum ada pengeluaran di siklus ini.</span>;
  return (
    <div className={cx('flex flex-col', desktop ? 'flex-[1_1_200px] justify-center gap-1.75' : 'mt-1 gap-2')}>
      {rows.map((r) => (
        <div key={r.categoryId ?? 'none'} className={cx('grid items-center gap-2 text-meta', desktop ? 'grid-cols-[76px_1fr_38px]' : 'grid-cols-[84px_1fr_44px]')}>
          <span className="truncate font-semibold">{r.category?.name ?? 'Tanpa kategori'}</span>
          <ProgressBar value={r.pct} height={8} label={`${r.category?.name ?? 'Tanpa kategori'} ${r.pct} persen dari pengeluaran`} />
          <span className="text-right font-bold">{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function BudgetCard({ f, desktop }: { f: FinanceSummary; desktop: boolean }) {
  const money = useMoney();
  const month = BULAN[f.cycleMonth];
  const tiles = (
    <div className={cx('flex gap-2', desktop && 'flex-[1_1_200px]')}>
      <StatTile tone="soft" label="Aman per hari" value={<span className="tabular">{money.rp(f.safeDaily)}</span>} />
      <StatTile tone="plain" label="Keluar hari ini" value={<span className="tabular">{money.rp(f.spentToday)}</span>} />
    </div>
  );
  const cls = cx('flex flex-col gap-2.5 border border-line bg-surface text-ink no-underline', desktop ? 'flex-[1.4_1_380px] rounded-5xl p-4.5' : 'rounded-4xl p-4');
  if (!f.budgetTotal) {
    return (
      <div className={cls}>
        <span className={cx('font-extrabold', desktop ? 'text-card' : 'text-body')}>Anggaran {month}</span>
        <p className="m-0 text-label text-ink-2">Atur batas belanja bulanan supaya Hamzi bisa hitung aman per hari.</p>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink to="/keuangan/anggaran" size="sm">Atur anggaran</ButtonLink>
          <span className="text-meta text-ink-3">Keluar hari ini <span className="tabular font-bold text-ink">{money.rp(f.spentToday)}</span></span>
        </div>
        <CategoryBars f={f} desktop={false} />
      </div>
    );
  }
  return (
    <Link to="/keuangan/anggaran" aria-label={`Anggaran ${month}, ${f.budgetUsedPct} persen terpakai. Buka anggaran`} className={cx(cls, 'hover:border-line-strong')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cx('font-extrabold', desktop ? 'text-card' : 'text-body')}>Anggaran {month}</span>
        <span className="text-label font-bold text-ink-2">{f.budgetUsedPct}% dari {money.rp(f.budgetTotal)}</span>
      </div>
      <ProgressBar value={f.budgetUsedPct} height={10} color={budgetBarColor(f.budgetUsedPct)} label="Anggaran terpakai" />
      {desktop ? (
        <div className="flex flex-wrap gap-4">{tiles}<CategoryBars f={f} desktop /></div>
      ) : (
        <>{tiles}<CategoryBars f={f} desktop={false} /></>
      )}
    </Link>
  );
}

/* ---------- Target & investasi ---------- */
function goalLine(v: GoalView, money: ReturnType<typeof useMoney>): string {
  if (!v.goal.monthly_plan && v.monthly) return `nabung ${money.short(v.monthly)}/bln`;
  return `${money.short(v.saved)} / ${money.short(v.goal.target_amount).replace(/^Rp /, '')}`;
}

function GoalCardMobile({ v }: { v: GoalView }) {
  const money = useMoney();
  return (
    <Link to={`/keuangan/target/${v.goal.id}`} className="flex max-w-60 min-w-40 shrink-0 flex-col gap-2 rounded-3xl border border-line bg-surface p-3.5 text-ink no-underline">
      <span className="flex size-9 items-center justify-center rounded-md bg-target-bg text-target-fg"><GoalGlyph goal={v.goal} /></span>
      <span className="truncate text-label font-bold">{v.goal.name}</span>
      <ProgressBar value={v.pct} height={6} color="target" track="target" label={`${v.goal.name} ${v.pct} persen`} />
      <span className="text-meta whitespace-nowrap text-ink-2">{v.pct}% · {goalLine(v, money)}</span>
    </Link>
  );
}

function InvestCardMobile({ v, today }: { v: AssetView; today: string }) {
  return (
    <Link to="/keuangan/investasi" className="flex max-w-60 min-w-40 shrink-0 flex-col gap-2 rounded-3xl border border-line bg-surface p-3.5 text-ink no-underline">
      <span className="flex size-9 items-center justify-center rounded-md bg-invest-bg text-invest-fg"><Icon.TrendUp size={18} strokeWidth={2} /></span>
      <span className="truncate text-label font-bold">{v.asset.name}</span>
      <span className={cx('text-h3 font-extrabold', (v.pct ?? 0) < 0 ? 'text-danger-fg' : 'text-primary')}>{pctSigned(v.pct)}</span>
      <span className="text-meta text-ink-2">{v.valuedOn ? `Diperbarui manual · ${agoLabel(v.valuedOn, today)}` : 'Belum ada nilai'}</span>
    </Link>
  );
}

function AddGoalCard({ desktop }: { desktop: boolean }) {
  return (
    <Link
      to="/keuangan/target?baru=1"
      className={cx(
        'flex shrink-0 items-center justify-center gap-1.5 border border-dashed border-line-strong bg-transparent text-label font-bold text-ink-2 no-underline hover:bg-surface-2',
        desktop ? 'h-12 rounded-2xl' : 'min-w-40 flex-col rounded-3xl p-3.5',
      )}
    >
      <Icon.Plus size={18} /> Target
    </Link>
  );
}

function GoalRowDesktop({ v }: { v: GoalView }) {
  const money = useMoney();
  return (
    <Link to={`/keuangan/target/${v.goal.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-ink no-underline hover:bg-surface-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-target-bg text-target-fg"><GoalGlyph goal={v.goal} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex justify-between gap-2"><span className="truncate text-label-lg font-bold">{v.goal.name}</span><span className="text-meta text-ink-2">{v.pct}%</span></span>
        <ProgressBar value={v.pct} height={6} color="target" track="target" label={`${v.goal.name} ${v.pct} persen`} />
        <span className="text-small text-ink-3">{goalLine(v, money)}</span>
      </span>
    </Link>
  );
}

function InvestRowDesktop({ v, today }: { v: AssetView; today: string }) {
  return (
    <Link to="/keuangan/investasi" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-ink no-underline hover:bg-surface-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-invest-bg text-invest-fg"><Icon.TrendUp size={18} strokeWidth={2} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-label-lg font-bold">{v.asset.name}</span>
          <span className={cx('text-card font-extrabold', (v.pct ?? 0) < 0 ? 'text-danger-fg' : 'text-primary')}>{pctSigned(v.pct)}</span>
        </span>
        <span className="text-small text-ink-3">{v.valuedOn ? `Diperbarui manual · ${agoLabel(v.valuedOn, today)}` : 'Belum ada nilai'}</span>
      </span>
    </Link>
  );
}

function TargetsSection({ d, desktop }: { d: D; desktop: boolean }) {
  const title = (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className={cx('m-0 font-extrabold', desktop ? 'text-card' : 'text-section')}>Target &amp; investasi</h2>
      <Link to="/keuangan/target" className="text-meta font-bold text-primary no-underline">Semua target</Link>
    </div>
  );
  const invest = d.invest.slice(0, 3);
  if (desktop) {
    return (
      <aside id="target" className="flex min-w-0 flex-[2_1_280px] scroll-mt-6 flex-col gap-2.5">
        {title}
        {d.goalViews.map((v) => <GoalRowDesktop key={v.goal.id} v={v} />)}
        {invest.map((v) => <InvestRowDesktop key={v.asset.id} v={v} today={d.today} />)}
        <AddGoalCard desktop />
      </aside>
    );
  }
  return (
    <section id="target" aria-label="Target dan investasi" className="flex scroll-mt-4 flex-col gap-2">
      {title}
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {d.goalViews.map((v) => <GoalCardMobile key={v.goal.id} v={v} />)}
        {invest.map((v) => <InvestCardMobile key={v.asset.id} v={v} today={d.today} />)}
        <AddGoalCard desktop={false} />
      </div>
    </section>
  );
}

/* ---------- Transaksi hari ini ---------- */
function TodayEmpty() {
  const openQuick = useUi((s) => s.openQuick);
  return <EmptyState compact text="Belum ada transaksi hari ini. Catat yang pertama?" action={<Button size="xs" onClick={() => openQuick('expense')}>+ Catat</Button>} />;
}

function TodayList({ d, onOpen }: { d: D; onOpen: (t: Transaction) => void }) {
  const list = d.f.todayTx;
  return (
    <section aria-label="Transaksi hari ini" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-section font-extrabold">Hari ini</h2>
        <Link to="/keuangan/transaksi" className="-my-3 py-3 text-meta font-semibold text-ink-3 no-underline">{list.length} transaksi</Link>
      </div>
      {list.length ? (
        <div className="rounded-3xl border border-line bg-surface px-3.5 py-1">
          {list.map((t) => <TxRow key={t.id} t={t} l={d.lookup} onOpen={() => onOpen(t)} />)}
        </div>
      ) : <TodayEmpty />}
    </section>
  );
}

function TodayTable({ d, onOpen }: { d: D; onOpen: (t: Transaction) => void }) {
  const list = d.f.todayTx;
  const th = 'border-b border-line px-1 py-2 text-left text-small font-bold text-ink-3';
  return (
    <section className="min-w-0 flex-[3_1_420px] rounded-4xl border border-line bg-surface px-4 py-3.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-card font-extrabold">Transaksi hari ini</h2>
        <Link to="/keuangan/transaksi" className="text-meta-lg font-bold text-primary no-underline">{list.length} transaksi · lihat semua</Link>
      </div>
      {list.length ? (
        <table className="w-full table-fixed border-collapse text-label">
          <colgroup><col className="w-15" /><col className="w-[24%]" /><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[20%]" /></colgroup>
          <thead>
            <tr><th scope="col" className={th}>Jam</th><th scope="col" className={th}>Kategori</th><th scope="col" className={th}>Catatan</th><th scope="col" className={th}>Dompet</th><th scope="col" className={cx(th, 'text-right')}>Nominal</th></tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} onClick={() => onOpen(t)} className="cursor-pointer border-b border-surface-2 hover:bg-surface-2">
                <td className="px-1 py-2.5 font-semibold text-ink-3 tabular">{txTime(t)}</td>
                <td className="px-1 py-1.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(t); }} aria-label={`Ubah ${txTitle(t, d.lookup)}`} className="flex min-h-9 max-w-full items-center gap-2 bg-transparent text-left font-bold text-ink">
                    <TxBadge t={t} l={d.lookup} small />
                    <span className="truncate">{txTitle(t, d.lookup)}</span>
                  </button>
                </td>
                <td className="truncate px-1 py-2.5 text-ink-2">{t.note || '–'}</td>
                <td className="truncate px-1 py-2.5 text-ink-2">{txMeta({ ...t, note: null }, d.lookup, false)}</td>
                <td className="px-1 py-2.5 text-right"><TxAmount t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="pt-2"><TodayEmpty /></div>}
    </section>
  );
}

/* ---------- Status ---------- */
function LoadingBlocks({ desktop }: { desktop: boolean }) {
  return (
    <div className={cx('flex flex-col gap-4', !desktop && 'px-4 pt-4')} aria-busy="true" aria-label="Memuat">
      <Skeleton className="h-40 rounded-5xl" />
      <Skeleton className="h-56 rounded-4xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}

function useHashScroll(ready: boolean) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const id = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 120);
    return () => window.clearTimeout(id);
  }, [hash, ready]);
}

function WalletPill({ n, desktop }: { n: number; desktop: boolean }) {
  return (
    <Link
      to="/keuangan/dompet"
      className={cx(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface font-bold text-ink-muted no-underline hover:bg-surface-2',
        desktop ? 'px-4 text-label-lg' : 'px-3.5 text-label',
      )}
    >
      {!desktop && <Icon.Wallet size={18} />}{n} dompet
    </Link>
  );
}

/* ---------- Halaman ---------- */
function MobileFinance({ d, onOpen }: { d: D; onOpen: (t: Transaction) => void }) {
  const openQuick = useUi((s) => s.openQuick);
  return (
    <div className="mx-auto w-full pb-6 md:max-w-160">
      <header className="flex items-center justify-between gap-3 px-4 pt-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-meta font-semibold text-ink-3">{overline(d.f)}</span>
          <h1 className="m-0 text-title leading-tight font-extrabold tracking-[-0.5px]">Keuangan</h1>
        </div>
        <WalletPill n={d.walletCount} desktop={false} />
      </header>
      {d.fin.error && <div className="px-4 pt-4"><ErrorState onRetry={d.fin.refetch} /></div>}
      {d.fin.loading ? <LoadingBlocks desktop={false} /> : (
        <>
          <BalanceHero f={d.f} desktop={false} />
          <div className="flex flex-col gap-4.5 px-4 pt-4">
            <BudgetCard f={d.f} desktop={false} />
            <TodayList d={d} onOpen={onOpen} />
            <TargetsSection d={d} desktop={false} />
          </div>
        </>
      )}
      <Fab label="Catat transaksi" onClick={() => openQuick('expense')} />
    </div>
  );
}

function DesktopFinance({ d, onOpen }: { d: D; onOpen: (t: Transaction) => void }) {
  const openQuick = useUi((s) => s.openQuick);
  const exportCsv = () => {
    const rows = d.txs.filter((t) => t.occurred_on >= d.f.cycleStart && t.occurred_on <= d.f.cycleEnd);
    exportTransactionsCsv(rows, d.lookup.wallets, d.lookup.categories, d.f.cycleStart, d.f.cycleEnd);
  };
  const row = (children: ReactNode, cls?: string) => <div className={cx('flex flex-wrap gap-4', cls)}>{children}</div>;
  return (
    <Page className="lg:gap-4.5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-50 flex-1 flex-col">
          <span className="text-meta font-semibold text-ink-3">{overline(d.f)}</span>
          <h1 className="m-0 text-title leading-tight font-extrabold tracking-[-0.5px]">Keuangan</h1>
        </div>
        <WalletPill n={d.walletCount} desktop />
        <button type="button" onClick={exportCsv} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-label-lg font-bold text-ink-muted hover:bg-surface-2">Export CSV</button>
        <Button onClick={() => openQuick('expense')} className="shadow-day-sel" aria-keyshortcuts="E">
          + Catat <span aria-hidden="true" className="rounded-xs border border-on-primary/50 px-1.5 py-px text-micro font-bold">E</span>
        </Button>
      </header>
      {d.fin.error && <ErrorState onRetry={d.fin.refetch} />}
      {d.fin.loading ? <LoadingBlocks desktop /> : (
        <>
          {row(<><BalanceHero f={d.f} desktop /><BudgetCard f={d.f} desktop /></>)}
          {row(<><TodayTable d={d} onOpen={onOpen} /><TargetsSection d={d} desktop /></>, 'items-start')}
        </>
      )}
    </Page>
  );
}

export default function FinancePage() {
  const d = useFinancePage();
  const desktop = useIsDesktop();
  const editor = useTxEditor();
  useHashScroll(!d.fin.loading);
  return (
    <>
      {desktop ? <DesktopFinance d={d} onOpen={editor.open} /> : <MobileFinance d={d} onOpen={editor.open} />}
      {editor.element}
    </>
  );
}
