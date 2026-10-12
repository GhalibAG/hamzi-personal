// Ubah unit (BEL-03): judul, jenis, tautan, estimasi, status, catatan; hapus dengan Urungkan.
import { useId, useState } from 'react';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Button, Chip, ConfirmRow, Field, inputCls, Segmented, Sheet, textareaCls } from '@/components/ui';
import { useRemove, useUnitSetStatus, useUpdate, useUpsert } from '@/data/hooks';
import type { LearningUnit } from '@/data/types';
import { cx } from '@/lib/cx';
import { toast, toastUndo } from '@/stores/ui';
import { UNIT_KIND_LABEL, UNIT_KINDS } from '../derive';

const EST = [15, 30, 45, 60, 90];

function sensErr(t: string): string | null {
  const s = detectSensitive(t);
  return s.length ? SENSITIVE_MESSAGE[s[0]] : null;
}

export function UnitEditSheet({ unit, label, open, onClose }: { unit: LearningUnit; label: string; open: boolean; onClose: () => void }) {
  const id = useId();
  const [title, setTitle] = useState(unit.title);
  const [kind, setKind] = useState<LearningUnit['kind']>(unit.kind);
  const [url, setUrl] = useState(unit.url ?? '');
  const [est, setEst] = useState(unit.est_min);
  const [notes, setNotes] = useState(unit.notes ?? '');
  const [status, setStatus] = useState<LearningUnit['status']>(unit.status);
  const [confirmDel, setConfirmDel] = useState(false);
  const upd = useUpdate('learning_units');
  const rm = useRemove('learning_units');
  const reinsert = useUpsert('learning_units');
  const setStatusRpc = useUnitSetStatus();

  const titleErr = sensErr(title) ?? (title.trim().length > 120 ? 'Judul maksimal 120 karakter.' : null);
  const notesErr = sensErr(notes);
  const urlErr = url.trim() && !/^https?:\/\/\S+$/i.test(url.trim()) ? 'Tautan harus diawali http:// atau https://' : null;
  const valid = title.trim().length > 0 && !titleErr && !notesErr && !urlErr;

  const save = async () => {
    if (!valid) return;
    try {
      await upd.patch(unit.id, { title: title.trim(), kind, url: url.trim() || null, est_min: est, notes: notes.trim() || null });
      if (status !== unit.status) setStatusRpc.mutate({ p_unit_id: unit.id, p_status: status });
      toast('Unit diperbarui.');
      onClose();
    } catch {
      toast('Gagal menyimpan. Coba lagi.');
    }
  };

  const del = async () => {
    const copy = { ...unit };
    onClose();
    try {
      await rm.remove(unit.id);
      toastUndo('Unit dihapus.', () => void reinsert.save(copy));
    } catch {
      toast('Gagal menghapus. Coba lagi.');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Ubah ${label.split(' · ')[0]}`}
      footer={<Button size="lg" block disabled={!valid || upd.isPending} onClick={() => void save()}>Simpan</Button>}
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Judul unit" htmlFor={`${id}-t`} error={titleErr ?? undefined}>
          <input id={`${id}-t`} data-autofocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoComplete="off" />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted" id={`${id}-k`}>Jenis</span>
          <div role="group" aria-labelledby={`${id}-k`} className="flex flex-wrap gap-1.5">
            {UNIT_KINDS.map((k) => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{UNIT_KIND_LABEL[k]}</Chip>)}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted">Status</span>
          <Segmented<LearningUnit['status']>
            label="Status unit"
            value={status}
            onChange={setStatus}
            options={[{ value: 'belum', label: 'Belum' }, { value: 'sedang', label: 'Sedang' }, { value: 'selesai', label: 'Selesai' }]}
          />
        </div>
        <Field label="Tautan (opsional)" htmlFor={`${id}-u`} error={urlErr ?? undefined}>
          <input id={`${id}-u`} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={inputCls} autoComplete="off" />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted" id={`${id}-e`}>Estimasi</span>
          <div role="group" aria-labelledby={`${id}-e`} className="flex flex-wrap gap-1.5">
            {(EST.includes(est) ? EST : [...EST, est].sort((a, b) => a - b)).map((m) => <Chip key={m} selected={est === m} onClick={() => setEst(m)}>{m} mnt</Chip>)}
          </div>
        </div>
        <Field label="Catatan (opsional)" htmlFor={`${id}-n`} error={notesErr ?? undefined}>
          <textarea id={`${id}-n`} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} className={cx(textareaCls, 'min-h-20')} />
        </Field>
        {confirmDel ? (
          <ConfirmRow text="Hapus unit ini? Kamu masih bisa mengurungkannya sebentar." confirmLabel="Hapus" danger onConfirm={() => void del()} onCancel={() => setConfirmDel(false)} />
        ) : (
          <Button variant="danger-outline" size="sm" className="self-start" onClick={() => setConfirmDel(true)}>Hapus unit</Button>
        )}
      </div>
    </Sheet>
  );
}
