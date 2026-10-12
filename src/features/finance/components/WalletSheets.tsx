// Form dompet (FIN-01, tanpa nomor rekening/kartu) & aturan transaksi berulang (FIN-09).
import { useId, useState, type FormEvent } from 'react';
import { HARI } from '@common/format.ts';
import { Button, Field, Segmented, Sheet, Switch, inputCls } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import type { RecurringRule, Wallet } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { categoriesByUsage, firstRun } from '../derive';
import { ArchiveIcon, DateField, MoneyInput, SelectField, SensitiveNote, sensitiveCheck } from './bits';

export const WALLET_KIND_LABEL: Record<Wallet['kind'], string> = { cash: 'Tunai', bank: 'Bank', ewallet: 'E-wallet', other: 'Lainnya' };
const KIND_ICON: Record<Wallet['kind'], string> = { cash: 'wallet', bank: 'bank', ewallet: 'phone', other: 'wallet' };

export function WalletFormSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Wallet }) {
  const wallets = useRows('wallets').rows;
  const upsert = useUpsert('wallets');
  const formId = useId();
  const nameId = useId();
  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<Wallet['kind']>(editing?.kind ?? 'cash');
  const [opening, setOpening] = useState(editing?.opening_balance ?? 0);
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? wallets.filter((w) => !w.archived).length === 0);
  const sens = sensitiveCheck(name);
  const dup = wallets.some((w) => w.id !== editing?.id && !w.archived && w.name.trim().toLowerCase() === name.trim().toLowerCase());
  const valid = !!name.trim() && !sens.block && !dup;
  const palette = [...new Set(wallets.map((w) => w.color).filter((x): x is string => !!x))];

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const row: Partial<Wallet> = {
      ...(editing ?? {}),
      name: name.trim().slice(0, 40), kind, icon: KIND_ICON[kind], opening_balance: opening, is_default: isDefault,
      archived: editing?.archived ?? false,
      color: editing?.color ?? palette[wallets.length % Math.max(1, palette.length)] ?? null,
      sort: editing?.sort ?? Math.max(-1, ...wallets.map((w) => w.sort)) + 1,
    };
    const others = isDefault ? wallets.filter((w) => w.id !== editing?.id && w.is_default).map((w) => ({ ...w, is_default: false })) : [];
    upsert.save([row, ...others]).catch(() => toast('Gagal menyimpan dompet.'));
    onClose();
    toast(editing ? 'Dompet diperbarui.' : `Dompet "${row.name}" ditambahkan.`);
  };

  const archive = () => {
    if (!editing) return;
    const next = wallets.filter((w) => w.id !== editing.id && !w.archived).sort((a, b) => a.sort - b.sort)[0];
    const rows: Partial<Wallet>[] = [{ ...editing, archived: true, is_default: false }];
    if (editing.is_default && next) rows.push({ ...next, is_default: true });
    void upsert.save(rows);
    onClose();
    toastUndo(`Dompet "${editing.name}" diarsipkan.`, () => void upsert.save([editing, ...(editing.is_default && next ? [{ ...next, is_default: false }] : [])]));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah dompet' : 'Dompet baru'}
      closeButton
      footer={
        <div className="flex items-center justify-end gap-2">
          {editing && !editing.archived && <Button variant="secondary" icon={<ArchiveIcon size={16} />} onClick={archive} className="mr-auto">Arsipkan</Button>}
          <Button type="submit" form={formId} disabled={!valid} block={!editing}>Simpan</Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Nama dompet" htmlFor={nameId} hint="Cukup nama umum, mis. Tunai, Bank, E-wallet. Jangan isi nomor rekening/kartu." error={dup ? 'Nama dompet sudah dipakai.' : undefined}>
          <input id={nameId} data-autofocus="" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="mis. Tabungan kampus" className={inputCls} />
        </Field>
        <SensitiveNote message={sens.message} />
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted">Jenis</span>
          <Segmented label="Jenis dompet" options={(Object.keys(WALLET_KIND_LABEL) as Wallet['kind'][]).map((k) => ({ value: k, label: WALLET_KIND_LABEL[k] }))} value={kind} onChange={setKind} />
        </div>
        <MoneyInput label="Saldo awal" value={opening} onChange={setOpening} hint={editing ? 'Saldo sebelum transaksi pertama. Untuk mencocokkan saldo sekarang, pakai "Sesuaikan saldo".' : 'Saldo dompet saat mulai dicatat.'} />
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 py-1 pr-1 pl-3.5">
          <span className="text-body font-semibold">Jadikan dompet utama</span>
          <Switch checked={isDefault} onChange={setIsDefault} label="Jadikan dompet utama" />
        </div>
      </form>
    </Sheet>
  );
}

/* ---------- Transaksi berulang ---------- */

const FREQ: { value: RecurringRule['freq']; label: string }[] = [
  { value: 'daily', label: 'Harian' }, { value: 'weekly', label: 'Mingguan' }, { value: 'monthly', label: 'Bulanan' },
];

export function RecurringFormSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: RecurringRule }) {
  const today = useToday();
  const wallets = useRows('wallets').rows.filter((w) => !w.archived || w.id === editing?.template.wallet_id).sort((a, b) => a.sort - b.sort);
  const categories = useRows('categories').rows;
  const txs = useRows('transactions').rows;
  const upsert = useUpsert('recurring_rules');
  const remover = useRemove('recurring_rules');
  const formId = useId();
  const noteId = useId();
  const t = editing?.template;
  const [kind, setKind] = useState<'expense' | 'income'>(t?.kind ?? 'expense');
  const [amount, setAmount] = useState(t?.amount ?? 0);
  const [categoryId, setCategoryId] = useState<string>(t?.category_id ?? '');
  const [walletId, setWalletId] = useState<string>(t?.wallet_id ?? wallets.find((w) => w.is_default)?.id ?? wallets[0]?.id ?? '');
  const [note, setNote] = useState(t?.note ?? '');
  const [freq, setFreq] = useState<RecurringRule['freq']>(editing?.freq ?? 'monthly');
  const [dom, setDom] = useState<number>(editing?.day_of_month ?? Math.min(28, Number(today.slice(8, 10))));
  const [weekday, setWeekday] = useState<number>(editing?.by_day?.[0] ?? 1);
  const [start, setStart] = useState(editing?.next_run ?? today);
  const [auto, setAuto] = useState(editing?.auto_post ?? false);
  const cats = categoriesByUsage(categories, txs, kind, today);
  const cId = categoryId || cats[0]?.id || '';
  const sens = sensitiveCheck(note);
  const valid = amount > 0 && !!walletId && !sens.block && !!start;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const next_run = editing && start === editing.next_run ? start : firstRun(freq, start, { dayOfMonth: freq === 'monthly' ? dom : null, weekday: freq === 'weekly' ? weekday : null });
    const row: Partial<RecurringRule> = {
      ...(editing ?? {}),
      template: { kind, amount, wallet_id: walletId, category_id: cId || null, note: note.trim() || null },
      freq, interval_n: editing?.interval_n ?? 1,
      by_day: freq === 'weekly' ? [weekday] : null,
      day_of_month: freq === 'monthly' ? dom : null,
      next_run, auto_post: auto, active: editing?.active ?? true,
    };
    upsert.save(row).catch(() => toast('Gagal menyimpan transaksi berulang.'));
    onClose();
    toast(editing ? 'Transaksi berulang diperbarui.' : 'Transaksi berulang ditambahkan.');
  };
  const del = () => {
    if (!editing) return;
    void remover.remove(editing.id);
    onClose();
    toastUndo('Transaksi berulang dihapus.', () => void upsert.save(editing));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah transaksi berulang' : 'Transaksi berulang'}
      closeButton
      footer={
        <div className="flex items-center justify-end gap-2">
          {editing && <Button variant="danger-outline" icon={<Icon.Trash size={16} />} onClick={del} className="mr-auto">Hapus</Button>}
          <Button type="submit" form={formId} disabled={!valid} block={!editing}>Simpan</Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Segmented label="Jenis" options={[{ value: 'expense', label: 'Pengeluaran' }, { value: 'income', label: 'Pemasukan' }]} value={kind} onChange={(v) => { setKind(v); setCategoryId(''); }} />
        <MoneyInput label="Nominal" value={amount} onChange={setAmount} />
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Kategori" value={cId} options={cats.map((c) => ({ value: c.id, label: c.name }))} onChange={setCategoryId} />
          <SelectField label="Dompet" value={walletId} options={wallets.map((w) => ({ value: w.id, label: w.name }))} onChange={setWalletId} />
        </div>
        <Field label="Catatan (opsional)" htmlFor={noteId}>
          <input id={noteId} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="mis. kos bulanan" className={inputCls} />
        </Field>
        <SensitiveNote message={sens.message} />
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted">Ulangi</span>
          <Segmented label="Frekuensi" options={FREQ} value={freq} onChange={setFreq} />
        </div>
        {freq === 'monthly' && (
          <SelectField label="Tanggal" value={String(dom)} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Tanggal ${i + 1}` }))} onChange={(v) => setDom(Number(v))} />
        )}
        {freq === 'weekly' && (
          <SelectField label="Hari" value={String(weekday)} options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: HARI[d] }))} onChange={(v) => setWeekday(Number(v))} />
        )}
        <DateField label={editing ? 'Jalan berikutnya' : 'Mulai'} value={start} min={editing ? undefined : today} onChange={setStart} />
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 py-1 pr-1 pl-3.5">
          <span className="flex flex-col">
            <span className="text-body font-semibold">Catat otomatis</span>
            <span className="text-meta text-ink-3">{auto ? 'Dicatat sendiri saat jatuh tempo.' : 'Hamzi minta konfirmasi dulu.'}</span>
          </span>
          <Switch checked={auto} onChange={setAuto} label="Catat otomatis" />
        </div>
      </form>
    </Sheet>
  );
}
