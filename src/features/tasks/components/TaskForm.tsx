// Form tugas (UI-SPEC §3.4 / §3.5): Judul, tenggat (chip + jam), prioritas, sumber/proyek/matkul, ulangi (TASK-09),
// pengingat (TASK-10). Varian `page` menambah catatan, estimasi, status. Dipakai TaskFormSheet & TaskDetailPage.
import { useMemo, useRef, useState } from 'react';
import { HARI_PENDEK } from '@common/format.ts';
import { Field, inputCls, textareaCls } from '@/components/ui';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { Task } from '@/data/types';
import { cx } from '@/lib/cx';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { activeSemester } from '@/features/courses/derive';
import { projectMilestones } from '@/features/projects/derive';
import {
  COURSE_TASK_KINDS, PRIORITIES, REMINDERS, REPEATS, SOURCES, draftFrom, draftToRow, validateDraft,
  type DraftErrors, type DueMode, type TaskDraft,
} from '../schema';
import { ChipGroup } from './FormBits';

const DUE_OPTIONS: { value: DueMode; label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: 'tomorrow', label: 'Besok' },
  { value: 'date', label: 'Pilih tanggal' },
  { value: 'none', label: 'Tanpa tenggat' },
];
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: HARI_PENDEK[d] }));
const REMIND_OPTIONS = [...REMINDERS, { value: 0, label: 'Tidak' }];
const STATUS_OPTIONS: { value: Task['status']; label: string }[] = [
  { value: 'belum', label: 'Belum' },
  { value: 'dikerjakan', label: 'Dikerjakan' },
];

export interface TaskFormProps {
  formId: string;
  task?: Task;
  initial?: Record<string, unknown>;
  variant?: 'sheet' | 'page';
  /** Dipanggil setelah simpan berhasil. */
  onSaved?: (row: Task, isNew: boolean) => void;
  /** Isi tambahan di akhir form (mis. tombol Simpan di halaman). */
  footer?: React.ReactNode;
}

export function TaskForm({ formId, task, initial, variant = 'sheet', onSaved, footer }: TaskFormProps) {
  const today = useToday();
  const [draft, setDraft] = useState<TaskDraft>(() => draftFrom(task, initial, today));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [newId] = useState(() => uuid());
  const saving = useRef(false);
  const upsert = useUpsert('tasks');
  const rm = useRemove('tasks');
  const courses = useRows('courses').rows;
  const semesters = useRows('semesters').rows;
  const projects = useRows('projects').rows;
  const milestones = useRows('milestones').rows;
  const sem = activeSemester(semesters);
  const courseOptions = useMemo(
    () => courses.filter((c) => !c.deleted_at && (c.semester_id === sem?.id || c.id === draft.course_id)).sort((a, b) => a.name.localeCompare(b.name)),
    [courses, sem?.id, draft.course_id],
  );
  const projectOptions = useMemo(
    () => projects.filter((p) => !p.deleted_at && (p.status !== 'selesai' || p.id === draft.project_id)).sort((a, b) => a.name.localeCompare(b.name)),
    [projects, draft.project_id],
  );
  const msOptions = draft.project_id ? projectMilestones(draft.project_id, milestones) : [];

  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const hasDue = draft.dueMode !== 'none';
  const showCourse = draft.source === 'kuliah' || !!draft.course_id;
  const showProject = draft.source === 'proyek' || !!draft.project_id;
  const id = (s: string) => `${formId}-${s}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving.current) return;
    const errs = validateDraft(draft);
    setErrors(errs);
    const first = Object.keys(errs).find((k) => errs[k as keyof DraftErrors]);
    if (first) {
      document.getElementById(id(first))?.focus();
      return;
    }
    saving.current = true;
    try {
      const isNew = !draft.id;
      const row = draftToRow(draft, today);
      // Status selesai/batal lewat RPC (centang); form hanya mengubah status bila pengguna memilih chip lain.
      if (task && (task.status === 'selesai' || draft.status === task.status)) delete row.status;
      const [saved] = await upsert.save({ ...row, id: draft.id ?? newId });
      if (isNew) toastUndo('Tugas ditambahkan', () => void rm.remove(saved.id));
      else toast('Perubahan disimpan');
      onSaved?.(saved, isNew);
    } catch {
      toast('Gagal menyimpan. Coba lagi ya.');
    } finally {
      saving.current = false;
    }
  };

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Judul" htmlFor={id('title')} error={errors.title}>
        <input
          id={id('title')} data-autofocus={variant === 'sheet' || !task ? true : undefined} className={inputCls} value={draft.title}
          onChange={(e) => set('title', e.target.value)} placeholder="Mis. Laporan praktikum Basis Data" maxLength={200}
          aria-invalid={!!errors.title} autoComplete="off"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <ChipGroup label="Tenggat" options={DUE_OPTIONS} value={draft.dueMode} onChange={(v) => set('dueMode', v)} />
        {hasDue && (
          <div className={cx('grid gap-2', draft.dueMode === 'date' ? 'grid-cols-2' : 'grid-cols-1')}>
            {draft.dueMode === 'date' && (
              <Field label="Tanggal" htmlFor={id('date')} error={errors.date}>
                <input id={id('date')} type="date" className={inputCls} value={draft.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date} />
              </Field>
            )}
            <Field label="Jam (opsional)" htmlFor={id('time')} hint={draft.time ? undefined : 'Kosong = seharian'}>
              <input id={id('time')} type="time" className={inputCls} value={draft.time} onChange={(e) => set('time', e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      <ChipGroup label="Prioritas" options={PRIORITIES} value={draft.priority} onChange={(v) => set('priority', v)} />
      <ChipGroup label="Sumber" options={SOURCES} value={draft.source} onChange={(v) => set('source', v)} />

      {showCourse && (
        <div className="flex flex-col gap-3 rounded-2xl bg-kuliah-bg p-3">
          <Field label="Mata kuliah" htmlFor={id('course')}>
            <select id={id('course')} className={inputCls} value={draft.course_id} onChange={(e) => set('course_id', e.target.value)}>
              <option value="">Tanpa mata kuliah</option>
              {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {draft.course_id && (
            <>
              <ChipGroup
                label="Jenis tugas (opsional)" options={COURSE_TASK_KINDS} value={draft.course_task_kind}
                onChange={(v) => set('course_task_kind', draft.course_task_kind === v ? '' : v)}
              />
              <Field label="Bobot nilai (%)" htmlFor={id('weight')} error={errors.weight}>
                <input id={id('weight')} inputMode="numeric" className={inputCls} value={draft.weight} onChange={(e) => set('weight', e.target.value.replace(/[^\d]/g, ''))} placeholder="Mis. 10" aria-invalid={!!errors.weight} />
              </Field>
            </>
          )}
          {!courseOptions.length && <span className="text-meta text-ink-2">Belum ada mata kuliah di semester aktif. Tambahkan dari Kuliah.</span>}
        </div>
      )}

      {showProject && (
        <div className="grid gap-3 rounded-2xl bg-surface-2 p-3 sm:grid-cols-2">
          <Field label="Proyek" htmlFor={id('project')}>
            <select id={id('project')} className={inputCls} value={draft.project_id} onChange={(e) => { set('project_id', e.target.value); set('milestone_id', ''); }}>
              <option value="">Tanpa proyek</option>
              {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {msOptions.length > 0 && (
            <Field label="Milestone" htmlFor={id('milestone')}>
              <select id={id('milestone')} className={inputCls} value={draft.milestone_id} onChange={(e) => set('milestone_id', e.target.value)}>
                <option value="">Tanpa milestone</option>
                {msOptions.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </Field>
          )}
        </div>
      )}

      {variant === 'page' && (
        <>
          <Field label="Catatan (opsional)" htmlFor={id('notes')} error={errors.notes}>
            <textarea id={id('notes')} className={textareaCls} value={draft.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} placeholder="Detail, tautan materi…" aria-invalid={!!errors.notes} />
          </Field>
          <Field label="Estimasi (menit, opsional)" htmlFor={id('estimate')} error={errors.estimate}>
            <input id={id('estimate')} inputMode="numeric" className={inputCls} value={draft.estimate} onChange={(e) => set('estimate', e.target.value.replace(/[^\d]/g, ''))} placeholder="Mis. 30" aria-invalid={!!errors.estimate} />
          </Field>
          {task && task.status !== 'selesai' && (
            <ChipGroup label="Status" options={STATUS_OPTIONS} value={draft.status} onChange={(v) => set('status', v)} />
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <ChipGroup
          label="Ulangi" options={REPEATS} value={hasDue ? draft.repeat : 'none'}
          onChange={(v) => { if (hasDue) set('repeat', v); }}
          hint={hasDue ? undefined : 'Pengulangan butuh tenggat.'}
        />
        {hasDue && draft.repeat === 'weekly' && (
          <ChipGroup
            label="Setiap hari" options={DAY_OPTIONS} value={draft.repeatDays} multi error={errors.repeatDays}
            onChange={(v) => set('repeatDays', draft.repeatDays.includes(v) ? draft.repeatDays.filter((x) => x !== v) : [...draft.repeatDays, v])}
          />
        )}
        {hasDue && draft.repeat === 'every_n_days' && (
          <Field label="Setiap berapa hari" htmlFor={id('repeatN')} error={errors.repeatN}>
            <input id={id('repeatN')} inputMode="numeric" className={inputCls} value={draft.repeatN} onChange={(e) => set('repeatN', e.target.value.replace(/[^\d]/g, ''))} aria-invalid={!!errors.repeatN} />
          </Field>
        )}
      </div>

      <ChipGroup
        label="Pengingat" options={REMIND_OPTIONS} value={hasDue ? (draft.remind.length ? draft.remind : [0]) : [0]} multi
        onChange={(v) => {
          if (!hasDue) return;
          if (v === 0) set('remind', []);
          else set('remind', draft.remind.includes(v) ? draft.remind.filter((x) => x !== v) : [...draft.remind, v]);
        }}
        hint={hasDue ? 'Sebelum tenggat.' : 'Pengingat butuh tenggat.'}
      />
      {footer}
    </form>
  );
}
