// Investasi `/keuangan/investasi` (INV-01…05): total nilai, untung/rugi, alokasi per kelas aset, daftar aset, tambah aset, disclaimer tetap.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '@/components/icons';
import { Button, Card, Columns, EmptyState, ErrorState, ListSkeleton, Page, ScreenHeader, SectionTitle, StatTile } from '@/components/ui';
import { useRows } from '@/data/hooks';
import { assetView, type AssetView } from '@/features/goals/derive';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { ASSET_CLASS_BAR, ASSET_CLASS_LABEL, agoLabel, pctSigned, portfolio, type Portfolio } from '../derive';
import { AssetFormSheet, Disclaimer, PlPct, PlValue } from '../components/InvestSheets';

function Summary({ p }: { p: Portfolio }) {
  const money = useMoney();
  return (
    <Card className="flex flex-col gap-3 rounded-5xl p-4.5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-invest-bg text-invest-fg"><Icon.TrendUp size={22} strokeWidth={2} /></span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-meta font-semibold text-ink-3">Total nilai investasi</span>
          <span className="tabular text-display leading-tight font-extrabold tracking-[-0.8px]">{money.rp(p.value)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile tone="plain" label="Modal bersih" value={<span className="tabular">{money.rp(p.capital)}</span>} />
        <StatTile tone="plain" label="Untung/rugi" value={<PlValue pl={p.pl} pct={null} />} sub={<PlPct pct={p.pct} />} />
      </div>
    </Card>
  );
}

function Allocation({ p }: { p: Portfolio }) {
  const money = useMoney();
  if (!p.allocation.length) return null;
  return (
    <section aria-label="Alokasi per kelas aset" className="flex flex-col gap-2.5">
      <SectionTitle title="Alokasi" />
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={p.allocation.map((a) => `${ASSET_CLASS_LABEL[a.assetClass] ?? a.assetClass} ${a.pct} persen`).join(', ')}>
          {p.allocation.map((a) => <span key={a.assetClass} className={cx('h-full', ASSET_CLASS_BAR[a.assetClass] ?? 'bg-n-400')} style={{ width: `${a.pct}%` }} />)}
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {p.allocation.map((a) => (
            <li key={a.assetClass} className="flex items-center gap-2.5 text-label">
              <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-full', ASSET_CLASS_BAR[a.assetClass] ?? 'bg-n-400')} />
              <span className="min-w-0 flex-1 truncate font-semibold">{ASSET_CLASS_LABEL[a.assetClass] ?? a.assetClass}</span>
              <span className="tabular text-ink-2">{money.rp(a.value)}</span>
              <span className="w-10 text-right font-bold">{a.pct}%</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function AssetRow({ v, today }: { v: AssetView; today: string }) {
  const money = useMoney();
  return (
    <li className="border-b border-surface-2 last:border-b-0">
      <Link to={`/keuangan/investasi/${v.asset.id}`} className="flex items-center gap-3 py-2.5 text-ink no-underline">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-invest-bg text-invest-fg"><Icon.TrendUp size={18} strokeWidth={2} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cx('truncate text-body font-bold', v.asset.archived && 'text-ink-3')}>{v.asset.name}</span>
          <span className="truncate text-meta text-ink-3">
            {[ASSET_CLASS_LABEL[v.asset.asset_class], v.asset.platform_label].filter(Boolean).join(' · ')}
          </span>
          <span className="text-small text-ink-3">{v.valuedOn ? `Diperbarui manual · ${agoLabel(v.valuedOn, today)}` : 'Belum ada nilai'}</span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className="tabular text-body font-extrabold">{money.rp(v.value ?? v.capital)}</span>
          <span className={cx('text-label font-extrabold', (v.pct ?? 0) < 0 ? 'text-danger-fg' : (v.pct ?? 0) > 0 ? 'text-primary' : 'text-ink-3')}>{pctSigned(v.pct)}</span>
        </span>
      </Link>
    </li>
  );
}

export default function InvestmentsPage() {
  const desktop = useIsDesktop();
  const today = useToday();
  const nav = useNavigate();
  const assetsQ = useRows('assets');
  const txs = useRows('asset_transactions').rows;
  const vals = useRows('asset_valuations').rows;
  const [formOpen, setFormOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const p = portfolio(assetsQ.rows, txs, vals);
  const archived = assetsQ.rows.filter((a) => a.archived).map((a) => assetView(a, txs, vals));

  const list = (
    <section aria-label="Daftar aset" className="flex flex-col gap-2.5">
      <SectionTitle title="Aset" right={<span className="text-meta text-ink-3">{p.views.length} aset</span>} />
      {p.views.length ? (
        <Card className="px-3.5 py-1"><ul className="m-0 list-none p-0">{p.views.map((v) => <AssetRow key={v.asset.id} v={v} today={today} />)}</ul></Card>
      ) : (
        <EmptyState title="Belum ada aset" text="Catat reksa dana, emas, atau deposito. Nilainya kamu perbarui sendiri." action={<Button size="sm" onClick={() => setFormOpen(true)}>+ Aset</Button>} />
      )}
      {archived.length > 0 && (
        <>
          <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((x) => !x)} className="flex h-11 items-center gap-1 self-start bg-transparent text-label font-bold text-ink-2">
            Diarsipkan ({archived.length}) {showArchived ? <Icon.ChevronUp size={16} /> : <Icon.ChevronDown size={16} />}
          </button>
          {showArchived && <Card className="px-3.5 py-1"><ul className="m-0 list-none p-0">{archived.map((v) => <AssetRow key={v.asset.id} v={v} today={today} />)}</ul></Card>}
        </>
      )}
    </section>
  );

  return (
    <Page>
      <ScreenHeader
        back="/keuangan"
        overline="Keuangan"
        title="Investasi"
        right={<Button size={desktop ? 'md' : 'sm'} icon={<Icon.Plus size={18} />} onClick={() => setFormOpen(true)}>Aset</Button>}
      />
      {assetsQ.isError && <div className="px-4 pt-4 lg:px-0 lg:pt-0"><ErrorState onRetry={() => void assetsQ.refetch()} /></div>}
      {assetsQ.isLoading ? <div className="px-4 pt-4 lg:px-0 lg:pt-0"><ListSkeleton rows={3} /></div> : desktop ? (
        <Columns left={<><Summary p={p} /><Disclaimer />{list}</>} right={<Allocation p={p} />} />
      ) : (
        <div className="flex flex-col gap-4 px-4 pt-4"><Summary p={p} /><Disclaimer /><Allocation p={p} />{list}</div>
      )}
      {formOpen && <AssetFormSheet open onClose={() => setFormOpen(false)} onSaved={(id) => nav(`/keuangan/investasi/${id}`)} />}
    </Page>
  );
}
