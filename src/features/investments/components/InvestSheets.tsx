// Aset (INV-01), transaksi aset (INV-02), valuasi manual (INV-03), disclaimer (INV-05).
import { useId, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Button, Field, Segmented, Sheet, inputCls } from '@/components/ui';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { Asset, AssetTransaction, AssetValuation } from '@/data/types';
import { cx } from '@/lib/cx';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { DateField, MoneyInput, SelectField, SensitiveNote, sensitiveCheck } from '@/features/finance/components/bits';
import { ASSET_CLASSES, ASSET_CLASS_LABEL, ASSET_TX_LABEL, pctSigned } from '../derive';
import { useMoney } from '@/lib/amounts';

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p role="note" className={cx('m-0 flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2.5 text-meta font-semibold text-info-fg', className)}>
      <Icon.Shield size={16} className="mt-px shrink-0" />
      Hamzi tidak memberi rekomendasi investasi. Nilai diperbarui manual.
    </p>
  );
}

/** Untung/rugi bertanda + persen (hijau/merah). */
export function PlValue({ pl, pct, className }: { pl: number; pct: number | null; className?: string }) {
  const money = useMoney();
  const tone = pl > 0 ? 'text-primary' : pl < 0 ? 'text-danger-fg' : 'text-ink';
  return (
    <span className={cx('tabular', tone, className)}>
      {pl > 0 ? '+' : pl < 0 ? '−' : ''}{money.rp(Math.abs(pl))}{pct !== null && ` (${pctSigned(pct)})`}
    </span>
  );
}

export function PlPct({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return <span className={cx('text-micro font-bold', pct > 0 ? 'text-primary' : pct < 0 ? 'text-danger-fg' : 'text-ink-3')}>{pctSigned(pct)}</span>;
}

export function AssetFormSheet({ open, onClose, editing, onSaved }: { open: boolean; onClose: () => void; editing?: Asset; onSaved?: (id: string) => void }) {
  const today = useToday();
  const upsertAsset = useUpsert('assets');
  const upsertTx = useUpsert('asset_transactions');
  const upsertVal = useUpsert('asset_valuations');
  const formId = useId();
  const nameId = useId();
  const platId = useId();
  const [name, setName] = useState(editing?.name ?? '');
  const [cls, setCls] = useState<string>(editing?.asset_class ?? 'rd_pasar_uang');
  const [platform, setPlatform] = useState(editing?.platform_label ?? '');
  const [capital, setCapital] = useState(0);
  const [value, setValue] = useState(0);
  const [date, setDate] = useState(today);
  const sens = sensitiveCheck(`${name} ${platform}`);
  const valid = !!name.trim() && !sens.block;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const id = editing?.id ?? uuid();
    const row: Partial<Asset> = { ...(editing ?? { archived: false }), id, name: name.trim().slice(0, 60), asset_class: cls, platform_label: platform.trim() || null };
    upsertAsset.save(row)
      .then(() => {
        if (!editing && capital > 0) void upsertTx.save({ asset_id: id, kind: 'beli', amount: capital, occurred_on: date });
        if (!editing && (value > 0 || capital > 0)) void upsertVal.save({ asset_id: id, valued_on: date, value: value || capital });
      })
      .catch(() => toast('Gagal menyimpan aset.'));
    onClose();
    toast(editing ? 'Aset diperbarui.' : `Aset "${row.name}" ditambahkan.`);
    onSaved?.(id);
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Ubah aset' : 'Aset baru'} closeButton footer={<Button type="submit" form={formId} block disabled={!valid}>Simpan</Button>}>
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Nama aset" htmlFor={nameId} hint="Nama umum saja, mis. Reksa dana pasar uang.">
          <input id={nameId} data-autofocus="" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="mis. Emas batangan" />
        </Field>
        <SelectField label="Kelas aset" value={cls} options={ASSET_CLASSES.map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))} onChange={setCls} />
        <Field label="Label platform (opsional)" htmlFor={platId} hint="Tanpa nomor akun/rekening.">
          <input id={platId} value={platform} maxLength={40} onChange={(e) => setPlatform(e.target.value)} className={inputCls} placeholder="mis. Aplikasi investasi" />
        </Field>
        <SensitiveNote message={sens.message} />
        {!editing && (
          <>
            <MoneyInput label="Modal awal (opsional)" value={capital} onChange={setCapital} hint="Dicatat sebagai transaksi beli." />
            <MoneyInput label="Nilai sekarang (opsional)" value={value} onChange={setValue} hint="Kosongkan bila sama dengan modal." />
            <DateField label="Tanggal" value={date} max={today} onChange={setDate} />
          </>
        )}
      </form>
    </Sheet>
  );
}

export function AssetTxSheet({ open, onClose, asset }: { open: boolean; onClose: () => void; asset: Asset }) {
  const today = useToday();
  const upsert = useUpsert('asset_transactions');
  const formId = useId();
  const [kind, setKind] = useState<AssetTransaction['kind']>('beli');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today);
  const valid = amount > 0 && !!date;
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const row: AssetTransaction = { id: uuid(), asset_id: asset.id, kind, amount, occurred_on: date };
    upsert.save(row).catch(() => toast('Gagal menyimpan.'));
    onClose();
    toast(`${ASSET_TX_LABEL[kind]} dicatat. Jangan lupa perbarui nilai aset.`);
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Transaksi ${asset.name}`} closeButton footer={<Button type="submit" form={formId} block disabled={!valid}>Simpan</Button>}>
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Segmented label="Jenis transaksi aset" options={(Object.keys(ASSET_TX_LABEL) as AssetTransaction['kind'][]).map((k) => ({ value: k, label: ASSET_TX_LABEL[k] }))} value={kind} onChange={setKind} />
        <MoneyInput autoFocus label="Nominal" value={amount} onChange={setAmount} hint={kind === 'beli' || kind === 'setor' ? 'Menambah modal bersih.' : 'Mengurangi modal bersih.'} />
        <DateField label="Tanggal" value={date} max={today} onChange={setDate} />
      </form>
    </Sheet>
  );
}

export function ValuationSheet({ open, onClose, asset, current }: { open: boolean; onClose: () => void; asset: Asset; current: number | null }) {
  const today = useToday();
  const vals = useRows('asset_valuations').rows;
  const upsert = useUpsert('asset_valuations');
  const remover = useRemove('asset_valuations');
  const formId = useId();
  const [value, setValue] = useState(current ?? 0);
  const [date, setDate] = useState(today);
  const valid = value >= 0 && !!date && (value > 0 || current !== null);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const same = vals.find((v) => v.asset_id === asset.id && v.valued_on === date);
    const row: AssetValuation = { id: same?.id ?? uuid(), asset_id: asset.id, valued_on: date, value };
    upsert.save(row).catch(() => toast('Gagal menyimpan nilai.'));
    onClose();
    toastUndo('Nilai aset diperbarui.', () => { if (same) void upsert.save(same); else void remover.remove(row.id); });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Perbarui nilai" closeButton footer={<Button type="submit" form={formId} block disabled={!valid}>Simpan</Button>}>
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <MoneyInput autoFocus label={`Nilai ${asset.name} sekarang`} value={value} onChange={setValue} hint="Lihat nilai terkini di aplikasi/platformmu, lalu ketik di sini." />
        <DateField label="Per tanggal" value={date} max={today} onChange={setDate} />
      </form>
    </Sheet>
  );
}
