// Sheet semester (KUL-01): nomor, label ("Ganjil 2026/2027"), tanggal mulai/selesai, aktif (hanya satu aktif).
import { useId, useState } from 'react';
import { addDays } from '@common/calc/index.ts';
import { Button, Field, inputCls, Sheet } from '@/components/ui';
import { useRemove, useUpdate, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { Course, Semester } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { fieldErrors, semesterFormSchema } from '../schema';
import { ToggleSwitch } from './formBits';

export function SemesterFormSheet({ open, onClose, semester, semesters, courses, onSaved }: {
  open: boolean; onClose: () => void; semester?: Semester; semesters: Semester[]; courses: Course[]; onSaved?: (id: string) => void;
}) {
  const today = useToday();
  const save = useUpsert('semesters');
  const upd = useUpdate('semesters');
  const removeSem = useRemove('semesters');
  const removeCourse = useRemove('courses');
  const hasActive = semesters.some((s) => s.is_active);
  const nextNumber = semesters.reduce((m, s) => Math.max(m, s.number), 0) + 1;

  const [number, setNumber] = useState(String(semester?.number ?? Math.min(20, nextNumber)));
  const [label, setLabel] = useState(semester?.label ?? '');
  const [start, setStart] = useState(semester?.start_date ?? today);
  const [end, setEnd] = useState(semester?.end_date ?? addDays(today, 120));
  const [active, setActive] = useState(semester ? semester.is_active : !hasActive);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = useId();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = semesterFormSchema.safeParse({ number: Number(number), label, start_date: start, end_date: end });
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    const v = parsed.data;
    if (semesters.some((s) => s.number === v.number && s.id !== semester?.id)) { setErrors({ number: `Semester ${v.number} sudah ada` }); return; }
    setErrors({});
    setBusy(true);
    const id = semester?.id ?? uuid();
    try {
      // Hanya satu semester aktif: nonaktifkan yang lain dulu (indeks unik one_active_semester).
      if (active) {
        for (const s of semesters) if (s.is_active && s.id !== id) await upd.patch(s.id, { is_active: false });
      }
      await save.save({ ...(semester ?? {}), id, number: v.number, label: v.label, start_date: v.start_date, end_date: v.end_date, is_active: active });
      toast(semester ? 'Semester diperbarui' : `Semester ${v.number} dibuat`);
      onSaved?.(id);
      onClose();
    } catch {
      toast('Gagal menyimpan. Coba lagi ya.');
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!semester) return;
    const own = courses.filter((c) => c.semester_id === semester.id);
    await Promise.all(own.map((c) => removeCourse.remove(c.id)));
    await removeSem.remove(semester.id);
    onClose();
    toastUndo(`Semester ${semester.number} dihapus`, () => {
      void removeSem.undo(semester.id);
      own.forEach((c) => void removeCourse.undo(c.id));
    });
  };

  const ownCount = semester ? courses.filter((c) => c.semester_id === semester.id).length : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={semester ? `Ubah semester ${semester.number}` : 'Semester baru'}
      closeButton
      footer={
        <div className="flex flex-col gap-2">
          <Button type="submit" form={formId} size="lg" block disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
          {semester && (
            <Button variant="danger-outline" block onClick={() => void del()}>
              Hapus semester{ownCount ? ` + ${ownCount} matkul` : ''}
            </Button>
          )}
        </div>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Field label="Semester ke-" htmlFor="sm-no" error={errors.number}>
            <input id="sm-no" type="number" inputMode="numeric" min={1} max={20} className={inputCls} value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Label" htmlFor="sm-label" error={errors.label}>
            <input id="sm-label" data-autofocus className={inputCls} value={label} maxLength={60} placeholder="Ganjil 2026/2027" onChange={(e) => setLabel(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai" htmlFor="sm-start" error={errors.start_date}>
            <input id="sm-start" type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Selesai" htmlFor="sm-end" error={errors.end_date}>
            <input id="sm-end" type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 py-1 pr-1 pl-3.5">
          <span className="flex flex-col">
            <span className="text-body font-bold">Semester aktif</span>
            <span className="text-meta text-ink-3">Jadwal, kehadiran & simulasi memakai semester ini. Hanya satu yang aktif.</span>
          </span>
          <ToggleSwitch checked={active} onChange={setActive} label="Semester aktif" />
        </div>
      </form>
    </Sheet>
  );
}
