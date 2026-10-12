// Form tugas (TASK-01/02/09/10): draf UI ⇄ baris `tasks`, validasi zod + cek data sensitif.
import { z } from 'zod';
import { addDays, isoWeekday, wibTime, wibToInstant, type DateStr } from '@common/calc/index.ts';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import type { SourceTag, Task } from '@/data/types';
import { dueDay } from './derive';

export type DueMode = 'today' | 'tomorrow' | 'date' | 'none';
export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly' | 'every_n_days';

export interface TaskDraft {
  id?: string;
  title: string;
  notes: string;
  dueMode: DueMode;
  date: DateStr;
  time: string;
  priority: 1 | 2 | 3 | 4;
  source: SourceTag;
  project_id: string;
  milestone_id: string;
  course_id: string;
  course_task_kind: string;
  weight: string;
  estimate: string;
  remind: number[];
  repeat: RepeatMode;
  repeatDays: number[];
  repeatN: string;
  status: Task['status'];
}

export const COURSE_TASK_KINDS: { value: string; label: string }[] = [
  { value: 'individu', label: 'Individu' },
  { value: 'kelompok', label: 'Kelompok' },
  { value: 'laporan', label: 'Laporan' },
  { value: 'presentasi', label: 'Presentasi' },
  { value: 'praktikum', label: 'Praktikum' },
];

export const SOURCES: { value: SourceTag; label: string }[] = [
  { value: 'pribadi', label: 'Pribadi' },
  { value: 'kuliah', label: 'Kuliah' },
  { value: 'belajar', label: 'Belajar' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'proyek', label: 'Proyek' },
];

export const PRIORITIES: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: 'Rendah' },
  { value: 2, label: 'Sedang' },
  { value: 3, label: 'Tinggi' },
  { value: 4, label: 'Kritis' },
];

export const REPEATS: { value: RepeatMode; label: string }[] = [
  { value: 'none', label: 'Tidak' },
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'every_n_days', label: 'Tiap N hari' },
];

/** Chip pengingat (TASK-10): menit sebelum tenggat. */
export const REMINDERS: { value: number; label: string }[] = [
  { value: 60, label: '1 jam' },
  { value: 1440, label: '1 hari' },
];

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const isSource = (v: unknown): v is SourceTag => SOURCES.some((s) => s.value === v);
const isPrio = (v: unknown): v is 1 | 2 | 3 | 4 => v === 1 || v === 2 || v === 3 || v === 4;

function modeFor(date: DateStr | null, today: DateStr): DueMode {
  if (!date) return 'none';
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return 'date';
}

/** Draf dari tugas yang ada (ubah) atau dari nilai awal `openQuick` (baru). */
export function draftFrom(task: Task | undefined, initial: Record<string, unknown> | undefined, today: DateStr): TaskDraft {
  if (task) {
    const d = dueDay(task);
    const rec = task.recurrence;
    return {
      id: task.id,
      title: task.title,
      notes: task.notes ?? '',
      dueMode: modeFor(d, today),
      date: d ?? today,
      time: task.due_at && !task.all_day ? wibTime(new Date(task.due_at)) : '',
      priority: task.priority,
      source: task.source_tag,
      project_id: task.project_id ?? '',
      milestone_id: task.milestone_id ?? '',
      course_id: task.course_id ?? '',
      course_task_kind: task.course_task_kind ?? '',
      weight: task.weight_pct != null ? String(task.weight_pct) : '',
      estimate: task.estimate_min != null ? String(task.estimate_min) : '',
      remind: task.remind_offsets ?? [60],
      repeat: (rec?.freq as RepeatMode | undefined) ?? 'none',
      repeatDays: rec?.by_day ?? (d ? [isoWeekday(d)] : []),
      repeatN: rec && rec.freq === 'every_n_days' ? String(rec.interval) : '2',
      status: task.status,
    };
  }
  const i = initial ?? {};
  const date = str(i.due_date) || null;
  const project = str(i.project_id);
  const course = str(i.course_id);
  const source: SourceTag = isSource(i.source_tag) ? i.source_tag : project ? 'proyek' : course ? 'kuliah' : 'pribadi';
  const hasDue = 'due_date' in i ? !!date : true;
  const d = date ?? today;
  return {
    title: str(i.title),
    notes: str(i.notes),
    dueMode: hasDue ? modeFor(d, today) : 'none',
    date: d,
    time: str(i.due_time),
    priority: isPrio(i.priority) ? i.priority : 2,
    source,
    project_id: project,
    milestone_id: str(i.milestone_id),
    course_id: course,
    course_task_kind: str(i.course_task_kind),
    weight: str(i.weight_pct),
    estimate: str(i.estimate_min),
    remind: [60],
    repeat: 'none',
    repeatDays: [isoWeekday(d)],
    repeatN: '2',
    status: 'belum',
  };
}

const intIn = (min: number, max: number, msg: string) =>
  z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), msg);

const draftSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200, 'Judul maksimal 200 karakter'),
  notes: z.string().max(2000, 'Catatan maksimal 2000 karakter'),
  date: z.string(),
  dueMode: z.enum(['today', 'tomorrow', 'date', 'none']),
  weight: intIn(0, 100, 'Bobot 0–100%'),
  estimate: intIn(0, 1440, 'Estimasi 0–1440 menit'),
  repeatN: intIn(1, 365, 'Isi 1–365 hari'),
}).superRefine((v, ctx) => {
  if (v.dueMode === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Pilih tanggal' });
  const t = detectSensitive(v.title)[0];
  if (t) ctx.addIssue({ code: 'custom', path: ['title'], message: SENSITIVE_MESSAGE[t] });
  const n = detectSensitive(v.notes)[0];
  if (n) ctx.addIssue({ code: 'custom', path: ['notes'], message: SENSITIVE_MESSAGE[n] });
});

export type DraftErrors = Partial<Record<'title' | 'notes' | 'date' | 'weight' | 'estimate' | 'repeatN' | 'repeatDays', string>>;

export function validateDraft(d: TaskDraft): DraftErrors {
  const r = draftSchema.safeParse(d);
  const errors: DraftErrors = {};
  if (!r.success) {
    for (const issue of r.error.issues) {
      const k = issue.path[0] as keyof DraftErrors;
      if (!errors[k]) errors[k] = issue.message;
    }
  }
  if (d.repeat === 'weekly' && d.dueMode !== 'none' && d.repeatDays.length === 0) errors.repeatDays = 'Pilih minimal satu hari';
  return errors;
}

export function draftDueDate(d: TaskDraft, today: DateStr): DateStr | null {
  if (d.dueMode === 'today') return today;
  if (d.dueMode === 'tomorrow') return addDays(today, 1);
  if (d.dueMode === 'date') return d.date;
  return null;
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

/** Baris `tasks` dari draf (sudah valid). */
export function draftToRow(d: TaskDraft, today: DateStr): Partial<Task> {
  const date = draftDueDate(d, today);
  const recurrence: Task['recurrence'] = d.repeat === 'none' || !date
    ? null
    : d.repeat === 'weekly'
      ? { freq: 'weekly', interval: 1, by_day: [...d.repeatDays].sort((a, b) => a - b) }
      : d.repeat === 'monthly'
        ? { freq: 'monthly', interval: 1, day_of_month: Number(date.slice(8, 10)) }
        : d.repeat === 'every_n_days'
          ? { freq: 'every_n_days', interval: Math.max(1, Number(d.repeatN) || 1) }
          : { freq: 'daily', interval: 1 };
  const row: Partial<Task> = {
    title: d.title.trim(),
    notes: d.notes.trim() || null,
    priority: d.priority,
    source_tag: d.source,
    due_at: date ? wibToInstant(date, d.time || '23:59').toISOString() : null,
    all_day: !!date && !d.time,
    project_id: d.project_id || null,
    milestone_id: d.project_id && d.milestone_id ? d.milestone_id : null,
    course_id: d.course_id || null,
    course_task_kind: d.course_id && d.course_task_kind ? d.course_task_kind : null,
    weight_pct: d.course_id ? numOrNull(d.weight) : null,
    estimate_min: numOrNull(d.estimate),
    recurrence,
    remind_offsets: date ? [...d.remind].sort((a, b) => a - b) : [],
  };
  if (d.id) {
    row.id = d.id;
    if (d.status !== 'selesai') row.status = d.status;
  } else {
    row.status = 'belum';
    row.completed_at = null;
    row.recurrence_parent_id = null;
  }
  return row;
}
