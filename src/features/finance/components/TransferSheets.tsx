// Pindah saldo (FIN-08, transaksi `transfer`) & Sesuaikan saldo (FIN-13, `adjustment` arah ±1) + editor transaksi umum.
import { useId, useState, type FormEvent } from 'react';
import { wibDate, wibTime, wibToInstant } from '@common/calc/index.ts';
import { Button, Field, Segmented, Sheet, inputCls } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { Transaction } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo, useUi } from '@/stores/ui';
import { walletBalance } from '../derive';
import { DateTimeButton, DateTimeInputs, MoneyInput, SelectField, SensitiveNote, sensitiveCheck } from './bits';

function whenOf(t: Transaction | undefined) {
  const d = t ? new Date(t.occurred_at) : new Date();
  return { date: wibDate(d), time: wibTime(d) };
}

function useTxSave() {
  const upsert = useUpsert('transactions');
  const remover = useRemove('transactions');
  return {
    save: (row: Transaction, prev: Transaction | undefined, text: string) => {
      upsert.save(row).catch(() => toast('Gagal menyimpan. Coba lagi.'));
      toastUndo(text, () => { if (prev) void upsert.save(prev); else void remover.remove(row.id); });
    },
    del: (id: string) => {
      void remover.remove(id);
      toastUndo('Transaksi dihapus.', () => void remover.undo(id));
    },
  };
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <Button variant="danger-outline" icon={<Icon.Trash size={16} />} onClick={() => setConfirm(true)}>Hapus</Button>;
  return (
    <div className="flex items-center gap-2">
      <span className="text-label font-semibold text-danger-fg">Yakin?</span>
      <Button size="sm" variant="danger" onClick={onDelete}>Hapus</Button>
    </div>
  );
}

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const sens = sensitiveCheck(value);
  return (
    <>
      <Field label="Catatan (opsional)" htmlFor={id}>
        <input id={id} value={value} maxLength={140} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder="mis. tarik tunai" />
      </Field>
      <SensitiveNote message={sens.message} />
    </>
  );
}

/** Sheet "Pindah saldo" antar dompet. */
export function TransferSheet({ open, onClose, editing, fromWallet }: { open: boolean; onClose: () => void; editing?: Transaction; fromWallet?: string }) {
  const today = useToday();
  const wallets = useRows('wallets').rows.filter((w) => !w.archived || w.id === editing?.wallet_id || w.id === editing?.to_wallet_id).sort((a, b) => a.sort - b.sort);
  const { save, del } = useTxSave();
  const formId = useId();
  const whenId = useId();
  const [from, setFrom] = useState(editing?.wallet_id ?? fromWallet ?? wallets.find((w) => w.is_default)?.id ?? wallets[0]?.id ?? '');
  const [to, setTo] = useState(editing?.to_wallet_id ?? wallets.find((w) => w.id !== (editing?.wallet_id ?? fromWallet ?? wallets[0]?.id))?.id ?? '');
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [when, setWhen] = useState(() => whenOf(editing));
  const [whenOpen, setWhenOpen] = useState(false);
  const [note, setNote] = useState(editing?.note ?? '');
  const same = !!from && from === to;
  const valid = amount > 0 && !!from && !!to && !same && !sensitiveCheck(note).block;
  const opts = wallets.map((w) => ({ value: w.id, label: w.name }));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const row: Transaction = {
      ...(editing ?? {}), id: editing?.id ?? uuid(), kind: 'transfer', amount, direction: 1, wallet_id: from, to_wallet_id: to, category_id: null,
      occurred_at: wibToInstant(when.date, when.time).toISOString(), occurred_on: when.date, note: note.trim() || null, deleted_at: null,
    };
    onClose();
    save(row, editing, 'Saldo dipindahkan.');
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah pindah saldo' : 'Pindah saldo'}
      closeButton
      footer={
        <div className="flex items-center justify-end gap-2">
          {editing && <span className="mr-auto"><DeleteButton onDelete={() => { onClose(); del(editing.id); }} /></span>}
          <Button type="submit" form={formId} disabled={!valid} block={!editing}>Simpan</Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        {wallets.length < 2 ? (
          <p className="m-0 rounded-lg bg-surface-2 p-3 text-body text-ink-2">Butuh minimal 2 dompet untuk memindahkan saldo. Tambah dompet dulu ya.</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <SelectField label="Dari" value={from} options={opts} onChange={setFrom} />
              <span className="flex h-12 items-center text-ink-3" aria-hidden="true"><Icon.ArrowRight size={18} /></span>
              <SelectField label="Ke" value={to} options={opts} onChange={setTo} />
            </div>
            {same && <span role="alert" className="text-meta font-semibold text-danger-fg">Pilih dompet tujuan yang berbeda.</span>}
            <MoneyInput label="Nominal" value={amount} onChange={setAmount} autoFocus />
            <div className="flex flex-col gap-1.5">
              <span className="text-label font-bold text-ink-muted">Waktu</span>
              <DateTimeButton variant="box" date={when.date} time={when.time} today={today} open={whenOpen} onToggle={() => setWhenOpen((v) => !v)} controls={whenId} />
              {whenOpen && <DateTimeInputs id={whenId} date={when.date} time={when.time} today={today} onChange={(date, time) => setWhen({ date, time })} />}
            </div>
            <NoteField value={note} onChange={setNote} />
          </>
        )}
      </form>
    </Sheet>
  );
}

/** Sheet "Sesuaikan saldo" (koreksi + / −). */
export function AdjustSheet({ open, onClose, editing, walletId }: { open: boolean; onClose: () => void; editing?: Transaction; walletId?: string }) {
  const today = useToday();
  const money = useMoney();
  const allWallets = useRows('wallets').rows;
  const txs = useRows('transactions').rows;
  const wallets = allWallets.filter((w) => !w.archived || w.id === editing?.wallet_id).sort((a, b) => a.sort - b.sort);
  const { save, del } = useTxSave();
  const formId = useId();
  const whenId = useId();
  const [wid, setWid] = useState(editing?.wallet_id ?? walletId ?? wallets.find((w) => w.is_default)?.id ?? wallets[0]?.id ?? '');
  const [dir, setDir] = useState<'1' | '-1'>(editing?.direction === -1 ? '-1' : '1');
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [when, setWhen] = useState(() => whenOf(editing));
  const [whenOpen, setWhenOpen] = useState(false);
  const [note, setNote] = useState(editing?.note ?? '');
  const wallet = allWallets.find((w) => w.id === wid);
  const current = wallet ? walletBalance(wallet, txs.filter((t) => t.id !== editing?.id)) : 0;
  const after = current + (dir === '1' ? amount : -amount);
  const valid = amount > 0 && !!wid && !sensitiveCheck(note).block;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const row: Transaction = {
      ...(editing ?? {}), id: editing?.id ?? uuid(), kind: 'adjustment', amount, direction: dir === '1' ? 1 : -1, wallet_id: wid, to_wallet_id: null,
      category_id: null, occurred_at: wibToInstant(when.date, when.time).toISOString(), occurred_on: when.date, note: note.trim() || null, deleted_at: null,
    };
    onClose();
    save(row, editing, 'Saldo disesuaikan.');
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah koreksi saldo' : 'Sesuaikan saldo'}
      closeButton
      footer={
        <div className="flex items-center justify-end gap-2">
          {editing && <span className="mr-auto"><DeleteButton onDelete={() => { onClose(); del(editing.id); }} /></span>}
          <Button type="submit" form={formId} disabled={!valid} block={!editing}>Simpan</Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <SelectField label="Dompet" value={wid} options={wallets.map((w) => ({ value: w.id, label: w.name }))} onChange={setWid} />
        <Segmented
          label="Arah koreksi"
          options={[{ value: '1', label: 'Tambah (+)' }, { value: '-1', label: 'Kurangi (−)' }]}
          value={dir}
          onChange={setDir}
        />
        <MoneyInput label="Selisih" value={amount} onChange={setAmount} autoFocus />
        <p className="m-0 rounded-lg bg-surface-2 px-3 py-2.5 text-label text-ink-2">
          Saldo {wallet?.name ?? 'dompet'}: <span className="tabular font-bold text-ink">{money.rp(current)}</span> → <span className="tabular font-bold text-ink">{money.rp(after)}</span>
        </p>
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted">Waktu</span>
          <DateTimeButton variant="box" date={when.date} time={when.time} today={today} open={whenOpen} onToggle={() => setWhenOpen((v) => !v)} controls={whenId} />
          {whenOpen && <DateTimeInputs id={whenId} date={when.date} time={when.time} today={today} onChange={(date, time) => setWhen({ date, time })} />}
        </div>
        <NoteField value={note} onChange={setNote} />
      </form>
    </Sheet>
  );
}

/** Buka editor yang tepat untuk transaksi apa pun (pengeluaran/pemasukan → sheet catat cepat). */
export function useTxEditor() {
  const openQuick = useUi((s) => s.openQuick);
  const [edit, setEdit] = useState<Transaction | null>(null);
  const open = (t: Transaction) => {
    if (t.kind === 'expense' || t.kind === 'income') {
      openQuick(t.kind, {
        id: t.id, kind: t.kind, amount: t.amount, category_id: t.category_id ?? undefined, wallet_id: t.wallet_id,
        note: t.note ?? undefined, occurred_at: t.occurred_at,
      });
    } else setEdit(t);
  };
  const close = () => setEdit(null);
  const element = edit ? (
    edit.kind === 'transfer'
      ? <TransferSheet key={edit.id} open onClose={close} editing={edit} />
      : <AdjustSheet key={edit.id} open onClose={close} editing={edit} />
  ) : null;
  return { open, element };
}
