// Turunan tugas: tenggat relatif, terlambat, skor prioritas (PRD §7.9), meta baris.
import { addDays, diffDays, isoWeekday, priorityScore, wibDate, wibTime, wibToInstant, type DateStr } from '@common/calc/index.ts';
import { dayLabel } from '@common/format.ts';
import type { CalEvent, Course, Exam, Project, Subtask, Task, XpEvent } from '@/data/types';
import { EXAM_LABEL } from '@/features/courses/derive';

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

/* ---------- Rencana (UI-SPEC §3) ---------- */

/** Skor prioritas per tugas (PRD §7.9) tanpa memandang status — urutan stabil saat dicentang. */
export function taskScorer(now: Date, ctx: { exams?: Exam[]; projects?: Project[] } = {}): (t: Task) => number {
  const soon = (iso?: string | null) => !!iso && new Date(iso).getTime() - now.getTime() <= 7 * 86_400_000 && new Date(iso).getTime() >= now.getTime();
  const today = wibDate(now);
  const examCourses = new Set((ctx.exams ?? []).filter((e) => !e.deleted_at && soon(e.starts_at)).map((e) => e.course_id));
  const projSoon = new Set((ctx.projects ?? []).filter((p) => p.due_date && diffDays(today, p.due_date) <= 7 && diffDays(today, p.due_date) >= 0).map((p) => p.id));
  return (t) => priorityScore({
    priority: t.priority,
    dueAt: t.due_at ? new Date(t.due_at) : null,
    linkedSoon: (!!t.course_id && examCourses.has(t.course_id)) || (!!t.project_id && projSoon.has(t.project_id)),
  }, now);
}

/** Urut skor prioritas (tertinggi dulu), seri dipecah tenggat lalu waktu dibuat. Tidak menyaring status. */
export function orderByScore(tasks: Task[], now: Date, ctx: { exams?: Exam[]; projects?: Project[] } = {}): Task[] {
  const score = taskScorer(now, ctx);
  return tasks
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s || (a.t.due_at ?? '9').localeCompare(b.t.due_at ?? '9') || (a.t.created_at ?? '').localeCompare(b.t.created_at ?? ''))
    .map((x) => x.t);
}

const completedOn = (t: Task) => (t.completed_at ? wibDate(new Date(t.completed_at)) : null);

/**
 * Daftar "Hari ini" Rencana untuk tanggal d (TASK-04/06).
 * - d ≠ hari ini: tugas bertenggat di d.
 * - d = hari ini: tenggat hari ini (yang belum lewat), tugas prioritas Tinggi/Kritis untuk besok (fokus),
 *   tugas tanpa tenggat di luar proyek, dan tugas yang diselesaikan hari ini. Yang terlambat tampil di seksi Terlambat.
 */
export function planDayTasks(tasks: Task[], d: DateStr, now: Date): Task[] {
  const today = wibDate(now);
  const tomorrow = addDays(today, 1);
  return tasks.filter((t) => {
    if (t.deleted_at || t.status === 'dibatalkan') return false;
    const due = dueDay(t);
    if (d !== today) return due === d;
    if (isOpen(t)) {
      if (isOverdue(t, now)) return false;
      if (due === today) return true;
      if (!due) return !t.project_id;
      return due === tomorrow && t.priority >= 3;
    }
    if (due === today) return true;
    return completedOn(t) === today && (!due || due <= tomorrow);
  });
}

/** Tugas terbuka yang lewat tenggat, paling lama dulu. */
export function overdueTasks(tasks: Task[], now: Date): Task[] {
  return tasks.filter((t) => isOverdue(t, now)).sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));
}

/** Jumlah XP tugas pada tanggal d (xp_events kind 'task'). */
export function taskXpOn(events: XpEvent[], d: DateStr): number {
  return events.filter((e) => e.kind === 'task' && e.day === d && !e.deleted_at).reduce((s, e) => s + e.xp, 0);
}

/**
 * Meta baris Rencana (dengan Tag sumber): tugas di hari terpilih → "16:30", "30 mnt", "16:30 · 3 subtugas", "Hari ini";
 * hari lain → "Besok 19:00 · 3 subtugas".
 */
export function planMeta(t: Task, ctx: { day: DateStr; today: DateStr; subtasks?: Subtask[] }): string {
  const subs = ctx.subtasks?.filter((s) => s.task_id === t.id).length ?? 0;
  const extra = subs ? `${subs} subtugas` : t.estimate_min ? `${t.estimate_min} mnt` : null;
  const d = dueDay(t);
  if (!d) return ['Tanpa tenggat', extra].filter(Boolean).join(' · ');
  if (d === ctx.day) {
    const parts = [t.all_day ? null : wibTime(new Date(t.due_at as string)), extra].filter(Boolean);
    return parts.length ? parts.join(' · ') : relDay(d, ctx.today);
  }
  return [dueLabel(t, ctx.today), extra].filter(Boolean).join(' · ');
}

export type SnoozeOption = 'hour' | 'tomorrow' | 'weekend';
export const SNOOZE_LABEL: Record<SnoozeOption, string> = { hour: '+1 jam', tomorrow: 'Besok', weekend: 'Akhir pekan' };

/** Sabtu terdekat setelah tanggal d. */
export function nextSaturday(d: DateStr): DateStr {
  return addDays(d, (6 - isoWeekday(d) + 7) % 7 || 7);
}

/** Tunda cepat (TASK-08): +1 jam dari sekarang/tenggat, besok (jam sama), atau Sabtu terdekat (jam sama). */
export function snoozeDue(t: Task, opt: SnoozeOption, now: Date): { due_at: string; all_day: boolean } {
  const today = wibDate(now);
  if (opt === 'hour') {
    const base = Math.max(now.getTime(), t.due_at ? new Date(t.due_at).getTime() : 0);
    return { due_at: new Date(Math.ceil((base + 3_600_000) / 60_000) * 60_000).toISOString(), all_day: false };
  }
  const keepTime = !!t.due_at && !t.all_day;
  const time = keepTime ? wibTime(new Date(t.due_at as string)) : '23:59';
  const day = opt === 'tomorrow' ? addDays(today, 1) : nextSaturday(today);
  return { due_at: wibToInstant(day, time).toISOString(), all_day: !keepTime };
}

/** Konteks singkat tugas: nama proyek / matkul / label sumber. */
export function taskContext(t: Task, projects: Project[], courses: Course[]): string {
  return (t.project_id && projects.find((p) => p.id === t.project_id)?.name)
    || courseName(courses, t.course_id)
    || SOURCE_LABEL[t.source_tag]
    || 'Pribadi';
}

export const isRecurring = (t: Task) => !!t.recurrence || !!t.recurrence_parent_id;

export type WeekTone = 'danger' | 'muted' | 'kuliah' | 'rutin' | 'belajar' | 'keuangan' | 'pribadi' | 'proyek';
export interface WeekItem {
  key: string; title: string; right: string; tone: WeekTone; sort: string;
  to?: string; eventId?: string;
}

/**
 * Tab "Minggu ini" (TASK-05): 7 hari ke depan (besok s.d. +7) per hari. Kanan = jam (merah bila < 24 jam),
 * "Kuliah" untuk ujian, "Rutin" untuk tugas berulang, atau label sumber untuk tugas seharian.
 */
export function weekGroups(a: { tasks: Task[]; exams: Exam[]; courses: Course[]; events: CalEvent[]; now: Date; days?: number }) {
  const today = wibDate(a.now);
  const out: { day: DateStr; items: WeekItem[] }[] = [];
  for (let i = 1; i <= (a.days ?? 7); i++) {
    const d = addDays(today, i);
    const items: WeekItem[] = [];
    for (const t of a.tasks) {
      if (!isOpen(t) || dueDay(t) !== d) continue;
      const time = wibTime(new Date(t.due_at as string));
      let right: string; let tone: WeekTone;
      if (isRecurring(t)) { right = 'Rutin'; tone = 'rutin'; }
      else if (!t.all_day) { right = time; tone = new Date(t.due_at as string).getTime() - a.now.getTime() < 86_400_000 ? 'danger' : 'muted'; }
      else { right = SOURCE_LABEL[t.source_tag] ?? 'Pribadi'; tone = t.source_tag; }
      items.push({ key: `t-${t.id}`, title: t.title, right, tone, sort: t.all_day ? '99' : time, to: `/rencana/tugas/${t.id}` });
    }
    for (const e of a.exams) {
      if (e.deleted_at || wibDate(new Date(e.starts_at)) !== d) continue;
      const c = a.courses.find((x) => x.id === e.course_id);
      const title = `${EXAM_LABEL[e.kind] ?? 'Ujian'} ${c?.name ?? ''}${e.material ? ` (${e.material})` : ''}`.replace(/\s+/g, ' ').trim();
      items.push({ key: `x-${e.id}`, title, right: 'Kuliah', tone: 'kuliah', sort: wibTime(new Date(e.starts_at)), to: `/kuliah/matkul/${e.course_id}` });
    }
    for (const ev of a.events) {
      if (ev.deleted_at) continue;
      const s = wibDate(new Date(ev.starts_at));
      const e = ev.ends_at ? wibDate(new Date(ev.ends_at)) : s;
      if (d < s || d > e) continue;
      const time = ev.all_day || d !== s ? null : wibTime(new Date(ev.starts_at));
      items.push({ key: `e-${ev.id}`, title: ev.title, right: time ?? 'Seharian', tone: 'muted', sort: time ?? '00', eventId: ev.id });
    }
    items.sort((x, y) => x.sort.localeCompare(y.sort) || x.title.localeCompare(y.title));
    if (items.length) out.push({ day: d, items });
  }
  return out;
}
