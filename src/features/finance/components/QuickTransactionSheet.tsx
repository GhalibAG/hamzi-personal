// Catat cepat (FIN-03) — HP: sheet + keypad (screenshot 10); desktop: dialog dengan nominal diketik (d06).
// Simpan → tutup, toast "Tersimpan. Sisa aman hari ini Rp X." + Urungkan (soft delete / kembalikan nilai lama).
import { useId, useMemo, useState, type FormEvent } from 'react';
import { wibDate, wibTime, wibToInstant } from '@common/calc/index.ts';
import { thousands } from '@common/format.ts';
import type { QuickSheetProps } from '@/app/quick';
import { Button, Chip, Keypad, Segmented, Sheet, inputCls } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useRemove, useRows, useSettings, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { Transaction } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { categoriesByUsage, financeSummary } from '../derive';
import {
  DateTimeButton, DateTimeInputs, InlineSelect, MoneyInput, QUICK_ADD, SensitiveNote, parseRupiah, sensitiveCheck,
} from './bits';

type Kind = 'expense' | 'income';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

function initialWhen(initial: Record<string, unknown> | undefined, today: string) {
  const at = str(initial?.occurred_at);
  if (at) {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) return { date: wibDate(d), time: wibTime(d) };
  }
  return { date: str(initial?.date) ?? today, time: str(initial?.time) ?? wibTime(new Date()) };
}

export function QuickTransactionSheet({ open, onClose, initial }: QuickSheetProps) {
  const desktop = useIsDesktop();
  const today = useToday();
  const money = useMoney();
  const settings = useSettings();
  const tx = useRows('transactions');
  const wallets = useRows('wallets').rows;
  const categories = useRows('categories').rows;
  const budgets = useRows('budgets').rows;
  const upsert = useUpsert('transactions');
  const remover = useRemove('transactions');
  const formId = useId();
  const whenId = useId();
  const noteId = useId();

  const editId = str(initial?.id);
  const original = editId ? tx.rows.find((t) => t.id === editId) : undefined;
  const [kind, setKind] = useState<Kind>(initial?.kind === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState<number>(num(initial?.amount));
  const [categoryId, setCategoryId] = useState<string | null>(str(initial?.category_id) ?? null);
  const [walletId, setWalletId] = useState<string | null>(str(initial?.wallet_id) ?? null);
  const [when, setWhen] = useState(() => initialWhen(initial, today));
  const [note, setNote] = useState<string>(str(initial?.note) ?? '');
  const [noteOpen, setNoteOpen] = useState<boolean>(!!str(initial?.note));
  const [whenOpen, setWhenOpen] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cats = useMemo(() => categoriesByUsage(categories, tx.rows, kind, today), [categories, tx.rows, kind, today]);
  const activeWallets = wallets.filter((w) => !w.archived || w.id === walletId).sort((a, b) => a.sort - b.sort);
  const defaultWallet = activeWallets.find((w) => w.is_default && !w.archived) ?? activeWallets[0];
  const wId = walletId ?? defaultWallet?.id ?? '';
  const cId = categoryId ?? cats[0]?.id ?? null;
  const sens = sensitiveCheck(note);
  const valid = amount > 0 && !!wId && !sens.block;

  const pickKind = (k: Kind) => { setKind(k); setCategoryId(null); };

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const id = editId ?? uuid();
    const occurred_at = wibToInstant(when.date, when.time).toISOString();
    const row: Transaction = {
      ...(original ?? {}),
      id, kind, amount, direction: 1, wallet_id: wId, to_wallet_id: null, category_id: cId,
      occurred_at, occurred_on: when.date, note: note.trim() ? note.trim().slice(0, 140) : null, deleted_at: null,
    };
    const next = [...tx.rows.filter((t) => t.id !== id), row];
    const sum = financeSummary({ transactions: next, wallets, budgets, categories, cycleDay: settings.budget_cycle_day, today });
    upsert.save(row).catch(() => toast('Gagal menyimpan. Coba lagi.'));
    onClose();
    const text = sum.budgetTotal ? `Tersimpan. Sisa aman hari ini ${money.rp(sum.safeDaily)}.` : 'Tersimpan.';
    const prev = original;
    toastUndo(text, () => {
      if (prev) void upsert.save(prev);
      else void remover.remove(id);
    });
  };

  const del = () => {
    if (!editId) return;
    void remover.remove(editId);
    onClose();
    toastUndo('Transaksi dihapus.', () => void remover.undo(editId));
  };

  const label = kind === 'expense' ? 'Berapa yang keluar?' : 'Berapa yang masuk?';
  const segOptions = [{ value: 'expense' as const, label: 'Pengeluaran' }, { value: 'income' as const, label: 'Pemasukan' }];
  const walletOptions = activeWallets.map((w) => ({ value: w.id, label: w.name }));
  const quickChips = (
    <div className={cx('flex gap-1.5', desktop ? 'flex-wrap' : 'justify-center')}>
      {QUICK_ADD.map((v) => (
        <Chip key={v} aria-label={`Tambah ${thousands(v)}`} aria-pressed={undefined} onClick={() => setAmount((a) => Math.min(a + v, 999_999_999_999))}>
          {v / 1000}rb
        </Chip>
      ))}
    </div>
  );
  const catChip = (c: { id: string; name: string }) => (
    <Chip key={c.id} selected={c.id === cId} onClick={() => setCategoryId(c.id)}>{c.name}</Chip>
  );
  const noCats = cats.length === 0 && (
    <span className="text-meta text-ink-3">Belum ada kategori {kind === 'expense' ? 'pengeluaran' : 'pemasukan'}.</span>
  );
  const deleteRow = editId && (
    confirmDelete ? (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-danger-soft px-3 py-2">
        <span className="text-label font-semibold text-danger-fg">Hapus transaksi ini?</span>
        <div className="flex gap-2">
          <Button size="xs" variant="secondary" onClick={() => setConfirmDelete(false)}>Batal</Button>
          <Button size="xs" variant="danger" onClick={del}>Hapus</Button>
        </div>
      </div>
    ) : (
      <Button variant="danger-outline" size={desktop ? 'md' : 'sm'} icon={<Icon.Trash size={16} />} onClick={() => setConfirmDelete(true)}>Hapus transaksi</Button>
    )
  );

  if (desktop) {
    const top = cats.slice(0, 5);
    const other = cats.find((c) => c.name.trim().toLowerCase() === 'lainnya');
    const base = [...top, ...(other && !top.includes(other) ? [other] : [])];
    const selected = cats.find((c) => c.id === cId);
    const list = showAllCats ? cats : [...base, ...(selected && !base.includes(selected) ? [selected] : [])];
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={editId ? 'Ubah transaksi' : 'Catat transaksi'}
        closeButton
        footer={
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto">{deleteRow}</span>
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button type="submit" form={formId} disabled={!valid}>Simpan (Enter)</Button>
          </div>
        }
      >
        <form id={formId} onSubmit={save} className="flex flex-col gap-3.5">
          <Segmented label="Jenis transaksi" options={segOptions} value={kind} onChange={pickKind} />
          <MoneyInput big autoFocus label={label} value={amount} onChange={setAmount} />
          {quickChips}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kategori">
            {list.map(catChip)}
            {cats.length > base.length && (
              <Chip onClick={() => setShowAllCats((v) => !v)} aria-expanded={showAllCats} aria-pressed={undefined}>
                {showAllCats ? 'Lebih sedikit' : `+${cats.length - base.length} lagi`}
              </Chip>
            )}
            {noCats}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-meta font-semibold text-ink-2">Dompet</span>
              <InlineSelect variant="box" label="Dompet" value={wId} options={walletOptions} onChange={setWalletId} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-meta font-semibold text-ink-2">Waktu</span>
              <DateTimeButton variant="box" date={when.date} time={when.time} today={today} open={whenOpen} onToggle={() => setWhenOpen((v) => !v)} controls={whenId} />
            </div>
          </div>
          {whenOpen && <DateTimeInputs id={whenId} date={when.date} time={when.time} today={today} onChange={(date, time) => setWhen({ date, time })} />}
          <div className="flex flex-col gap-1">
            <label htmlFor={noteId} className="text-meta font-semibold text-ink-2">Catatan (opsional)</label>
            <input id={noteId} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="mis. nasi padang" className={cx(inputCls, 'h-11 text-label-lg')} />
          </div>
          <SensitiveNote message={sens.message} />
        </form>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} label={editId ? 'Ubah transaksi' : 'Catat transaksi'}>
      <form id={formId} onSubmit={save} className="flex flex-col gap-3">
        <Segmented label="Jenis transaksi" options={segOptions} value={kind} onChange={pickKind} />
        <div className="flex flex-col items-center gap-0.5 py-1 text-center">
          <span className="text-meta font-semibold text-ink-3">{label}</span>
          <span
            aria-live="polite"
            tabIndex={-1}
            data-autofocus=""
            className={cx('tabular text-display-lg leading-tight font-extrabold tracking-[-1px] outline-none', amount > 0 ? (kind === 'income' ? 'text-primary' : 'text-ink') : 'text-n-400')}
          >
            Rp {thousands(amount)}
          </span>
        </div>
        {quickChips}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5" role="group" aria-label="Kategori">
          {cats.map(catChip)}
          {noCats}
        </div>
        <div className="-my-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center">
            <InlineSelect label="Dompet" prefix="Dompet: " value={wId} options={walletOptions} onChange={setWalletId} />
            <button
              type="button"
              aria-label={noteOpen ? 'Tutup catatan' : 'Tambah catatan'}
              aria-expanded={noteOpen}
              onClick={() => setNoteOpen((v) => !v)}
              className={cx('flex size-11 items-center justify-center rounded-full bg-transparent', note ? 'text-primary' : 'text-ink-3')}
            >
              <Icon.Edit size={16} />
            </button>
          </div>
          <DateTimeButton date={when.date} time={when.time} today={today} open={whenOpen} onToggle={() => setWhenOpen((v) => !v)} controls={whenId} />
        </div>
        {whenOpen && <DateTimeInputs id={whenId} date={when.date} time={when.time} today={today} onChange={(date, time) => setWhen({ date, time })} />}
        {noteOpen && (
          <div className="flex flex-col gap-1">
            <label htmlFor={noteId} className="sr-only">Catatan (opsional)</label>
            <input id={noteId} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional), mis. nasi padang" className={cx(inputCls, 'h-11')} />
          </div>
        )}
        <SensitiveNote message={sens.message} />
        <Keypad value={amount ? String(amount) : ''} onChange={(v) => setAmount(parseRupiah(v))} maxLen={12} />
        <Button type="submit" size="lg" block disabled={!valid}>Simpan</Button>
        {deleteRow}
      </form>
    </Sheet>
  );
}
