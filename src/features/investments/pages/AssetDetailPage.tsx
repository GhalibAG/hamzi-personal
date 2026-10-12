// Detail aset `/keuangan/investasi/:id` (INV-02…05): nilai terkini, modal bersih, untung/rugi, transaksi (beli/jual/setor/tarik),
// riwayat valuasi manual, disclaimer.
import { useState } from 'react';
import { useParams } from 'react-router';
import { dayLabelComma } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, ButtonLink, Card, Columns, EmptyState, IconButton, ListSkeleton, Menu, Page, ScreenHeader, SectionTitle, StatTile, Tag,
} from '@/components/ui';
import { useRemove, useRows, useUpdate, useUpsert } from '@/data/hooks';
import type { AssetTransaction, AssetValuation } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { assetView } from '@/features/goals/derive';
import { ASSET_CLASS_LABEL, ASSET_TX_LABEL, agoLabel } from '../derive';
import { AssetFormSheet, AssetTxSheet, Disclaimer, PlPct, PlValue, ValuationSheet } from '../components/InvestSheets';

type SheetState = 'edit' | 'tx' | 'value' | null;

export default function AssetDetailPage() {
  const { id = '' } = useParams();
  const desktop = useIsDesktop();
  const today = useToday();
  const money = useMoney();
  const assetsQ = useRows('assets');
  const txs = useRows('asset_transactions').rows;
  const vals = useRows('asset_valuations').rows;
  const updAsset = useUpdate('assets');
  const removeTx = useRemove('asset_transactions');
  const removeVal = useRemove('asset_valuations');
  const upsertTx = useUpsert('asset_transactions');
  const upsertVal = useUpsert('asset_valuations');
  const [sheet, setSheet] = useState<SheetState>(null);
  const asset = assetsQ.rows.find((a) => a.id === id);

  if (assetsQ.isLoading) return <Page narrow><ScreenHeader back="/keuangan/investasi" title="Aset" /><div className="px-4 pt-4 lg:px-0"><ListSkeleton rows={3} /></div></Page>;
  if (!asset) {
    return (
      <Page narrow>
        <ScreenHeader back="/keuangan/investasi" title="Aset" />
        <div className="px-4 pt-4 lg:px-0">
          <EmptyState mood="worried" title="Aset tidak ditemukan" text="Mungkin sudah dihapus." action={<ButtonLink to="/keuangan/investasi" size="sm">Lihat investasi</ButtonLink>} />
        </div>
      </Page>
    );
  }

  const v = assetView(asset, txs, vals);
  const myTx = txs.filter((t) => t.asset_id === asset.id).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const myVals = vals.filter((x) => x.asset_id === asset.id).sort((a, b) => b.valued_on.localeCompare(a.valued_on));

  const delTx = (t: AssetTransaction) => {
    void removeTx.remove(t.id);
    toastUndo('Transaksi aset dihapus.', () => void upsertTx.save(t));
  };
  const delVal = (x: AssetValuation) => {
    void removeVal.remove(x.id);
    toastUndo('Nilai dihapus.', () => void upsertVal.save(x));
  };
  const toggleArchive = () => {
    void updAsset.patch(asset.id, { archived: !asset.archived });
    toast(asset.archived ? 'Aset aktif lagi.' : 'Aset diarsipkan.');
  };

  const summary = (
    <Card className="flex flex-col gap-3 rounded-5xl p-4.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-meta font-semibold text-ink-3">Nilai terkini</span>
        <span className="tabular text-display leading-tight font-extrabold tracking-[-0.8px]">{v.value !== null ? money.rp(v.value) : '–'}</span>
        <span className="text-meta text-ink-3">{v.valuedOn ? `Diperbarui manual · ${agoLabel(v.valuedOn, today)}` : 'Belum ada nilai. Perbarui nilai dulu ya.'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile tone="plain" label="Modal bersih" value={<span className="tabular">{money.rp(v.capital)}</span>} />
        <StatTile tone="plain" label="Untung/rugi" value={v.pl !== null ? <PlValue pl={v.pl} pct={null} /> : '–'} sub={v.pl !== null ? <PlPct pct={v.pct} /> : undefined} />
      </div>
      {!asset.archived && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setSheet('value')} icon={<Icon.Edit size={16} />}>Perbarui nilai</Button>
          <Button variant="secondary" onClick={() => setSheet('tx')} icon={<Icon.Plus size={16} />}>Transaksi</Button>
        </div>
      )}
    </Card>
  );

  const txBlock = (
    <section aria-label="Transaksi aset" className="flex flex-col gap-2.5">
      <SectionTitle title="Transaksi" right={<span className="text-meta text-ink-3">{myTx.length}</span>} />
      {myTx.length ? (
        <Card className="px-3.5 py-1">
          <ul className="m-0 list-none p-0">
            {myTx.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-b border-surface-2 py-1 last:border-b-0">
                <Tag tone={t.kind === 'beli' || t.kind === 'setor' ? 'masuk' : 'keluar'}>{ASSET_TX_LABEL[t.kind]}</Tag>
                <span className="min-w-0 flex-1 truncate text-label text-ink-2">{dayLabelComma(t.occurred_on)}</span>
                <span className="tabular text-body font-extrabold">{t.kind === 'beli' || t.kind === 'setor' ? '+' : '−'}{money.rp(t.amount)}</span>
                <IconButton variant="plain" label={`Hapus ${ASSET_TX_LABEL[t.kind]} ${dayLabelComma(t.occurred_on)}`} onClick={() => delTx(t)} className="text-ink-3"><Icon.Trash size={18} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : <EmptyState compact text="Belum ada transaksi beli/setor." />}
    </section>
  );

  const valBlock = (
    <section aria-label="Riwayat nilai" className="flex flex-col gap-2.5">
      <SectionTitle title="Riwayat nilai" right={<span className="text-meta text-ink-3">{myVals.length}</span>} />
      {myVals.length ? (
        <Card className="px-3.5 py-1">
          <ul className="m-0 list-none p-0">
            {myVals.map((x) => (
              <li key={x.id} className="flex items-center gap-3 border-b border-surface-2 py-1 last:border-b-0">
                <span className="min-w-0 flex-1 truncate text-label text-ink-2">{dayLabelComma(x.valued_on)}</span>
                <span className="tabular text-body font-bold">{money.rp(x.value)}</span>
                <IconButton variant="plain" label={`Hapus nilai ${dayLabelComma(x.valued_on)}`} onClick={() => delVal(x)} className="text-ink-3"><Icon.Trash size={18} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : <EmptyState compact text="Belum ada nilai tercatat." />}
    </section>
  );

  return (
    <Page>
      <ScreenHeader
        back="/keuangan/investasi"
        overline={[ASSET_CLASS_LABEL[asset.asset_class] ?? asset.asset_class, asset.platform_label].filter(Boolean).join(' · ')}
        title={asset.name}
        right={
          <>
            <IconButton label="Ubah aset" onClick={() => setSheet('edit')}><Icon.Edit size={20} /></IconButton>
            <Menu
              trigger={({ open, toggle }) => <IconButton label="Menu lainnya" aria-expanded={open} onClick={toggle}><Icon.More size={20} /></IconButton>}
              items={[{ label: asset.archived ? 'Aktifkan lagi' : 'Arsipkan aset', onSelect: toggleArchive }]}
            />
          </>
        }
      />
      {desktop ? (
        <Columns left={<>{summary}<Disclaimer />{txBlock}</>} right={valBlock} />
      ) : (
        <div className="flex flex-col gap-4 px-4 pt-4">{summary}<Disclaimer />{txBlock}{valBlock}</div>
      )}
      {sheet === 'edit' && <AssetFormSheet open onClose={() => setSheet(null)} editing={asset} />}
      {sheet === 'tx' && <AssetTxSheet open onClose={() => setSheet(null)} asset={asset} />}
      {sheet === 'value' && <ValuationSheet open onClose={() => setSheet(null)} asset={asset} current={v.value} />}
    </Page>
  );
}
