// Turunan tugas: tenggat relatif, terlambat, skor prioritas (PRD §7.9), meta baris.
import { addDays, diffDays, priorityScore, wibDate, wibTime, type DateStr } from '@common/calc/index.ts';
import { dayLabel } from '@common/format.ts';
import type { Course, Exam, Project, Subtask, Task } from '@/data/types';

export const isOpen = (t: Task) => t.status !== 'selesai' && t.status !== 'dibatalkan' && !t.deleted_at;
export const isDone = (t: Task) => t.status === 'selesai';

/** Tanggal WIB tenggat. */
export function dueDay(t: Task): DateStr | null {
  return t.due_at ? wibDate(new Date(t.due_at)) : null;
}

export function isOverdue(t: Task, now: Date): boolean {
  if (!isOpen(t) || !t.due_at) return false;
  if (t.all_day) return (dueDay(t) as string) < wibDate(now);
  return new Date(t.due_at).getTime() < now.getTime();
}

/** "Hari ini" / "Besok" / "Kemarin" / "Selasa 20 Okt". */
export function relDay(d: DateStr, today: DateStr): string {
  const n = diffDays(today, d);
  if (n === 0) return 'Hari ini';
  if (n === 1) return 'Besok';
  if (n === -1) return 'Kemarin';
  return dayLabel(d);
}

/** Tenggat ringkas: "Besok 19:00", "Hari ini", "Kemarin 23:59", "20 Okt". */
export function dueLabel(t: Task, today: DateStr): string {
  if (!t.due_at) return 'Tanpa tenggat';
  const d = dueDay(t) as string;
  const day = relDay(d, today);
  const time = wibTime(new Date(t.due_at));
  return t.all_day ? day : `${day} ${time}`;
}

export const SOURCE_LABEL: Record<string, string> = { kuliah: 'Kuliah', belajar: 'Belajar', keuangan: 'Keuangan', pribadi: 'Pribadi', proyek: 'Proyek' };

/**
 * Meta baris tugas. HP (tanpa Tag): "Besok 19:00 · Kuliah", "Hari ini · 30 mnt".
 * Desktop/Rencana (dengan Tag sumber): "Besok 19:00 · 3 subtugas", "Hari ini · 30 mnt", "Hari ini".
 * Terlambat: "Terlambat · kemarin 23:59".
 */
export function taskMeta(t: Task, ctx: { today: DateStr; now: Date; subtasks?: Subtask[]; withTag?: boolean }): string {
  if (isOverdue(t, ctx.now)) return `Terlambat · ${dueLabel(t, ctx.today).toLowerCase()}`;
  const parts = [dueLabel(t, ctx.today)];
  const subs = ctx.subtasks?.filter((s) => s.task_id === t.id) ?? [];
  if (ctx.withTag) {
    if (subs.length) parts.push(`${subs.length} subtugas`);
    else if (t.estimate_min) parts.push(`${t.estimate_min} mnt`);
  } else if (t.estimate_min && !subs.length) parts.push(`${t.estimate_min} mnt`);
  else parts.push(SOURCE_LABEL[t.source_tag] ?? 'Pribadi');
  return parts.join(' · ');
}

/** Tugas terbuka diurutkan skor prioritas (tertinggi dulu). */
export function rankTasks(tasks: Task[], now: Date, ctx: { exams?: Exam[]; projects?: Project[] } = {}): Task[] {
  const soon = (iso?: string | null) => !!iso && new Date(iso).getTime() - now.getTime() <= 7 * 86_400_000 && new Date(iso).getTime() >= now.getTime();
  const examCourses = new Set((ctx.exams ?? []).filter((e) => soon(e.starts_at)).map((e) => e.course_id));
  const projSoon = new Set((ctx.projects ?? []).filter((p) => p.due_date && diffDays(wibDate(now), p.due_date) <= 7 && diffDays(wibDate(now), p.due_date) >= 0).map((p) => p.id));
  const score = (t: Task) =>
    priorityScore({ priority: t.priority, dueAt: t.due_at ? new Date(t.due_at) : null, linkedSoon: (!!t.course_id && examCourses.has(t.course_id)) || (!!t.project_id && projSoon.has(t.project_id)) }, now);
  return tasks.filter(isOpen).map((t) => ({ t, s: score(t) })).sort((a, b) => b.s - a.s || (a.t.due_at ?? '9').localeCompare(b.t.due_at ?? '9')).map((x) => x.t);
}

/** Tugas untuk tanggal d: tenggat di hari itu (terbuka maupun selesai hari itu). */
export function tasksOnDay(tasks: Task[], d: DateStr): Task[] {
  return tasks.filter((t) => !t.deleted_at && t.status !== 'dibatalkan' && dueDay(t) === d);
}

/** Tugas "hari ini" untuk Beranda: maks n teratas yang jatuh tempo ≤ besok atau terlambat, plus yang selesai hari ini. */
export function homeTasks(tasks: Task[], now: Date, n = 3, ctx: { exams?: Exam[]; projects?: Project[] } = {}): Task[] {
  const today = wibDate(now);
  const horizon = addDays(today, 1);
  const open = rankTasks(tasks, now, ctx).filter((t) => !t.due_at || (dueDay(t) as string) <= horizon);
  const doneToday = tasks.filter((t) => isDone(t) && t.completed_at && wibDate(new Date(t.completed_at)) === today && dueDay(t) === today);
  return [...open.slice(0, n), ...doneToday].slice(0, n);
}

export function courseName(courses: Course[], id?: string | null): string | null {
  return id ? courses.find((c) => c.id === id)?.name ?? null : null;
}
