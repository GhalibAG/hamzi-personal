// Sheet ujian (KUL-08): matkul, jenis (Kuis/UTS/UAS/Praktikum), tanggal, jam, materi, ruang → tabel `exams`.
// initial: { id?, course_id?, kind?, date?, time?, material?, room? }. starts_at = wibToInstant(date, time) (UTC).
import { useId, useState } from 'react';
import { wibDate, wibTime, wibToInstant } from '@common/calc/index.ts';
import type { QuickSheetProps } from '@/app/quick';
import { Button, EmptyState, Field, inputCls, ListSkeleton, Sheet, textareaCls } from '@/components/ui';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { Exam } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo, useUi } from '@/stores/ui';
import { activeSemester, EXAM_KINDS, EXAM_LABEL, semesterCourses } from '../derive';
import { examFormSchema, fieldErrors } from '../schema';
import { ChipRow, FormLabel, Select } from './formBits';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function ExamFormSheet(p: QuickSheetProps) {
  const qs = [useRows('exams'), useRows('courses'), useRows('semesters')];
  if (qs.some((q) => q.isLoading)) {
    return <Sheet open={p.open} onClose={p.onClose} title="Ujian" closeButton><ListSkeleton rows={3} /></Sheet>;
  }
  return <ExamForm {...p} />;
}

function ExamForm({ open, onClose, initial = {} }: QuickSheetProps) {
  const today = useToday();
  const exams = useRows('exams').rows;
  const courses = useRows('courses').rows;
  const semesters = useRows('semesters').rows;
  const save = useUpsert('exams');
  const remove = useRemove('exams');
  const openQuick = useUi((s) => s.openQuick);

  const id = str(initial.id) || undefined;
  const existing = id ? exams.find((e) => e.id === id) : undefined;
  const at = existing ? new Date(existing.starts_at) : null;
  const sem = activeSemester(semesters);
  const options = semesterCourses(courses, sem?.id);
  const initialCourse = str(initial.course_id) || existing?.course_id || '';
  const extra = initialCourse && !options.some((c) => c.id === initialCourse) ? courses.filter((c) => c.id === initialCourse) : [];
  const list = [...options, ...extra];

  const [courseId, setCourseId] = useState(initialCourse || (list.length === 1 ? list[0].id : ''));
  const [kind, setKind] = useState<Exam['kind']>((str(initial.kind) as Exam['kind']) || existing?.kind || 'kuis');
  const [date, setDate] = useState(str(initial.date) || (at ? wibDate(at) : today));
  const [time, setTime] = useState(str(initial.time) || (at ? wibTime(at) : '08:00'));
  const [material, setMaterial] = useState(str(initial.material) || existing?.material || '');
  const [room, setRoom] = useState(str(initial.room) || existing?.room || list.find((c) => c.id === courseId)?.room || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = useId();
  const [busy, setBusy] = useState(false);

  if (!list.length) {
    return (
      <Sheet open={open} onClose={onClose} title="Ujian baru" closeButton>
        <EmptyState
          compact
          text="Tambah mata kuliah dulu supaya ujiannya bisa dikaitkan."
          action={<Button size="xs" onClick={() => { onClose(); openQuick('course'); }}>+ Matkul</Button>}
        />
      </Sheet>
    );
  }

  const submit = async () => {
    const parsed = examFormSchema.safeParse({ course_id: courseId, kind, date, time, material: material.trim() || undefined, room: room.trim() || undefined });
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    setBusy(true);
    const v = parsed.data;
    const row: Exam = {
      ...(existing ?? {}),
      id: existing?.id ?? uuid(), course_id: v.course_id, kind: v.kind, starts_at: wibToInstant(v.date, v.time).toISOString(),
      material: v.material ?? null, room: v.room ?? null, prep_status: existing?.prep_status ?? 'belum',
    };
    try {
      await save.save(row);
      toast(existing ? 'Ujian diperbarui' : `${EXAM_LABEL[v.kind]} tersimpan`);
      onClose();
    } catch {
      toast('Gagal menyimpan. Coba lagi ya.');
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!existing) return;
    await remove.remove(existing.id);
    onClose();
    toastUndo('Ujian dihapus', () => void remove.undo(existing.id));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? 'Ubah ujian' : 'Ujian baru'}
      closeButton
      footer={
        <div className="flex flex-col gap-2">
          <Button type="submit" form={formId} size="lg" block disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
          {existing && <Button variant="danger-outline" block onClick={() => void del()}>Hapus ujian</Button>}
        </div>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Mata kuliah" htmlFor="x-course" error={errors.course_id}>
          <Select id="x-course" data-autofocus value={courseId} onChange={(e) => {
            setCourseId(e.target.value);
            if (!room) setRoom(list.find((c) => c.id === e.target.value)?.room ?? '');
          }}>
            <option value="" disabled>Pilih mata kuliah</option>
            {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <FormLabel>Jenis</FormLabel>
          <ChipRow label="Jenis ujian" options={EXAM_KINDS.map((k) => ({ value: k, label: EXAM_LABEL[k] }))} value={kind} onChange={(v) => v && setKind(v)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal" htmlFor="x-date" error={errors.date}>
            <input id="x-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Jam" htmlFor="x-time" error={errors.time}>
            <input id="x-time" type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Materi" htmlFor="x-mat" error={errors.material} hint="Mis. bab 1–3. Hamzi mengingatkan H-3 & H-1.">
          <textarea id="x-mat" className={textareaCls} value={material} maxLength={300} onChange={(e) => setMaterial(e.target.value)} placeholder="bab 1–3" />
        </Field>
        <Field label="Ruang" htmlFor="x-room">
          <input id="x-room" className={inputCls} value={room} maxLength={60} onChange={(e) => setRoom(e.target.value)} placeholder="R. 3.1" />
        </Field>
      </form>
    </Sheet>
  );
}
