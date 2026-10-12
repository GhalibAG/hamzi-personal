// Laporan keuangan `/keuangan/laporan` (FIN-12): ringkasan periode, perbandingan, donut kategori, tren harian.
// Grafik = SVG ringan (tanpa pustaka) agar bundle kecil. Warna kategori berasal dari data pengguna.
import { useMemo, useState, type ReactNode } from 'react';
import { addDays, cycleStart, weekStart } from '@common/calc/index.ts';
import { BULAN_PENDEK } from '@common/format.ts';
import { Columns, EmptyState, ErrorState, ListSkeleton, Page, ProgressBar, ScreenHeader, Segmented, StatTile } from '@/components/ui';
import { useRows, useSettings } from '@/data/hooks';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { periodReport, type PeriodReport } from '../derive';
import { CategoryBadge } from '../components/bits';

type Range = 'minggu' | 'siklus' | '30';

const FALLBACK = 'var(--n-400)';
const short = (d: string) => `${Number(d.slice(8, 10))} ${BULAN_PENDEK[Number(d.slice(5, 7))]}`;

function Donut({ r }: { r: PeriodReport }) {
  const money = useMoney();
  const size = 168;
  const stroke = 22;
  const rad = (size - stroke) / 2;
  const c = 2 * Math.PI * rad;
  const top = r.byCategory.slice(0, 5);
  const rest = r.byCategory.slice(5).reduce((s, x) => s + x.amount, 0);
  const parts = [...top.map((x) => ({ amount: x.amount, color: x.category?.color ?? FALLBACK })), ...(rest ? [{ amount: rest, color: FALLBACK }] : [])];
  let acc = 0;
  const label = `Donut pengeluaran per kategori: ${top.map((x) => `${x.category?.name ?? 'Lainnya'} ${x.pct}%`).join(', ')}`;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {r.expense > 0 && parts.map((p, i) => {
          const len = (p.amount / r.expense) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={p.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-micro font-semibold text-ink-3">Keluar</span>
        <span className="tabular text-card font-extrabold">{money.short(r.expense)}</span>
      </div>
    </div>
  );
}

function Trend({ r }: { r: PeriodReport }) {
  const money = useMoney();
  const max = Math.max(1, ...r.daily.map((d) => d.expense));
  const w = 100 / r.daily.length;
  const avgY = 100 - (r.avgDailyExpense / max) * 100;
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-36 w-full" role="img"
        aria-label={`Tren pengeluaran harian ${short(r.from)}–${short(r.to)}; rata-rata ${money.rp(r.avgDailyExpense)} per hari`}>
        {r.daily.map((d, i) => {
          const h = (d.expense / max) * 56;
          return <rect key={d.day} x={i * w + w * 0.15} y={58 - h} width={w * 0.7} height={Math.max(h, d.expense ? 1 : 0)} rx={Math.min(1.2, w * 0.2)} fill="var(--brand-500)" />;
        })}
        <line x1="0" x2="100" y1={(avgY / 100) * 56 + 2} y2={(avgY / 100) * 56 + 2} stroke="var(--mod-target-bar)" strokeWidth="0.6" strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-micro font-semibold text-ink-3">
        <span>{short(r.from)}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-target-bar" />rata-rata {money.short(r.avgDailyExpense)}/hari</span>
        <span>{short(r.to)}</span>
      </div>
    </div>
  );
}

function Summary({ r }: { r: PeriodReport }) {
  const money = useMoney();
  const ch = r.expenseChangePct;
  return (
    <div className="flex flex-col gap-3 rounded-4xl border border-line bg-surface p-4">
      <div className="flex gap-2">
        <StatTile label="Keluar" value={money.rp(r.expense)} tone="plain" />
        <StatTile label="Masuk" value={money.rp(r.income)} tone="soft" />
      </div>
      <div className="flex items-center justify-between text-meta">
        <span className="text-ink-2">Selisih periode ini</span>
        <span className={cx('tabular font-extrabold', r.net >= 0 ? 'text-primary' : 'text-danger-fg')}>{r.net >= 0 ? '+' : '−'}{money.rp(Math.abs(r.net))}</span>
      </div>
      {ch !== null && ch !== 0 && (
        <span className={cx('self-start rounded-full px-2.5 py-1 text-micro font-bold', ch > 0 ? 'bg-warn-bg text-warn-fg' : 'bg-primary-soft text-brand-800')}>
          {ch > 0 ? '▲' : '▼'} {Math.abs(ch)}% pengeluaran dari periode sebelumnya
        </span>
      )}
    </div>
  );
}

function CategoryList({ r }: { r: PeriodReport }) {
  const money = useMoney();
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {r.byCategory.map((x) => (
        <li key={x.categoryId ?? 'none'} className="flex items-center gap-3">
          <CategoryBadge category={x.category} label={x.category?.name ?? 'Lainnya'} small />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex justify-between gap-2 text-label">
              <span className="truncate font-bold">{x.category?.name ?? 'Lainnya'}</span>
              <span className="tabular shrink-0 font-bold">{money.rp(x.amount)}</span>
            </div>
            <ProgressBar value={x.pct} height={6} label={`${x.category?.name ?? 'Lainnya'} ${x.pct}%`} />
          </div>
          <span className="tabular w-10 shrink-0 text-right text-meta font-bold text-ink-2">{x.pct}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportPage() {
  const desktop = useIsDesktop();
  const today = useToday();
  const s = useSettings();
  const tx = useRows('transactions');
  const cats = useRows('categories');
  const [range, setRange] = useState<Range>('siklus');
  const from = range === 'minggu' ? weekStart(today) : range === 'siklus' ? cycleStart(today, s.budget_cycle_day) : addDays(today, -29);
  const r = useMemo(() => periodReport(tx.rows, cats.rows, from, today), [tx.rows, cats.rows, from, today]);

  const seg = (
    <Segmented<Range> label="Periode laporan" value={range} onChange={setRange}
      options={[{ value: 'minggu', label: 'Minggu ini' }, { value: 'siklus', label: 'Siklus ini' }, { value: '30', label: '30 hari' }]} />
  );
  const card = (title: string, body: ReactNode) => (
    <section className="flex flex-col gap-3 rounded-4xl border border-line bg-surface p-4">
      <h2 className="m-0 text-section font-extrabold">{title}</h2>
      {body}
    </section>
  );
  const empty = !tx.isLoading && r.expense === 0 && r.income === 0;
  const content = tx.isError ? <ErrorState onRetry={() => void tx.refetch()} /> : tx.isLoading ? <ListSkeleton rows={4} /> : empty ? (
    <EmptyState title="Belum ada transaksi" text="Catat pengeluaran dulu, laporan akan muncul di sini." />
  ) : desktop ? (
    <Columns
      left={<><Summary r={r} />{card('Tren harian', <Trend r={r} />)}</>}
      right={card('Per kategori', <><Donut r={r} /><CategoryList r={r} /></>)}
    />
  ) : (
    <div className="flex flex-col gap-4">
      <Summary r={r} />
      {card('Per kategori', <><Donut r={r} /><CategoryList r={r} /></>)}
      {card('Tren harian', <Trend r={r} />)}
    </div>
  );

  return (
    <Page narrow={!desktop}>
      <ScreenHeader back="/keuangan" overline={`Keuangan · ${short(from)}–${short(today)}`} title="Laporan" />
      <div className="flex flex-col gap-4 px-4 pt-4 lg:px-0 lg:pt-0">
        {seg}
        {content}
        <p className="m-0 text-meta text-ink-3">Transfer antardompet dan koreksi saldo tidak dihitung sebagai pengeluaran/pemasukan.</p>
      </div>
    </Page>
  );
}
