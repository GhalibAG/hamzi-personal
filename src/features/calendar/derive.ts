// Turunan Kalender (CAL-01/02): sel bulan 7×N, agenda per hari dari kelas, tugas, ujian, event, rutinitas.
import { addDays, daysInMonth, fromParts, isoWeekday, isRoutineDue, wibDate, wibTime, type DateStr } from '@common/calc/index.ts';
import type { CalEvent, Course, CourseSchedule, Exam, Routine, Semester, Task } from '@/data/types';
import { classesOn, EXAM_LABEL } from '@/features/courses/derive';
import { dueDay } from '@/features/tasks/derive';

export type AgendaKind = 'kelas' | 'tugas' | 'ujian' | 'event' | 'rutinitas';
export const AGENDA_KINDS: AgendaKind[] = ['kelas', 'tugas', 'ujian', 'event', 'rutinitas'];
export const AGENDA_LABEL: Record<AgendaKind, string> = { kelas: 'Kuliah', tugas: 'Tugas', ujian: 'Ujian', event: 'Event', rutinitas: 'Rutinitas' };

export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  /** 'HH:MM' atau null (seharian). */
  time: string | null;
  end: string | null;
  title: string;
  sub: string;
  done?: boolean;
  to?: string;
  eventId?: string;
}

export interface AgendaSources {
  tasks: Task[];
  exams: Exam[];
  courses: Course[];
  schedules: CourseSchedule[];
  semester?: Semester;
  events: CalEvent[];
  routines: Routine[];
}

export interface MonthCell { date: DateStr; day: number; inMonth: boolean }

/** Sel bulan mulai Senin. `fill6` = selalu 6 baris (42 sel, termasuk hari bulan lain); selain itu baris secukupnya, sel luar = null. */
export function monthCells(year: number, month: number, fill6: boolean): (MonthCell | null)[] {
  const first = fromParts(year, month, 1);
  const lead = isoWeekday(first) - 1;
  const n = daysInMonth(year, month);
  const total = fill6 ? 42 : Math.ceil((lead + n) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const date = addDays(first, i - lead);
    const inMonth = i >= lead && i < lead + n;
    if (!inMonth && !fill6) return null;
    return { date, day: Number(date.slice(8, 10)), inMonth };
  });
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

const inSemester = (d: DateStr, s?: Semester) => !s || (d >= s.start_date && d <= s.end_date);

function eventDays(ev: CalEvent): [DateStr, DateStr] {
  const s = wibDate(new Date(ev.starts_at));
  const e = ev.ends_at ? wibDate(new Date(ev.ends_at)) : s;
  return [s, e < s ? s : e];
}

/** Agenda tanggal d, urut jam (seharian dulu). `kinds` = sumber yang ditampilkan. */
export function agendaOn(d: DateStr, src: AgendaSources, kinds: ReadonlySet<AgendaKind>): AgendaItem[] {
  const out: AgendaItem[] = [];
  if (kinds.has('kelas') && inSemester(d, src.semester)) {
    for (const c of classesOn(d, src.schedules, src.courses, src.semester?.id)) {
      out.push({
        key: `k-${c.schedule.id}`, kind: 'kelas', time: c.start, end: c.end, title: c.course.name,
        sub: ['Kelas', c.room].filter(Boolean).join(' · '), to: `/kuliah/matkul/${c.course.id}`,
      });
    }
  }
  if (kinds.has('tugas')) {
    for (const t of src.tasks) {
      if (t.deleted_at || t.status === 'dibatalkan' || dueDay(t) !== d) continue;
      const course = t.course_id ? src.courses.find((c) => c.id === t.course_id)?.name : null;
      out.push({
        key: `t-${t.id}`, kind: 'tugas', time: t.all_day ? null : wibTime(new Date(t.due_at as string)), end: null, title: t.title,
        sub: ['Tugas', course].filter(Boolean).join(' · '), done: t.status === 'selesai', to: `/rencana/tugas/${t.id}`,
      });
    }
  }
  if (kinds.has('ujian')) {
    for (const e of src.exams) {
      if (e.deleted_at || wibDate(new Date(e.starts_at)) !== d) continue;
      const c = src.courses.find((x) => x.id === e.course_id);
      out.push({
        key: `x-${e.id}`, kind: 'ujian', time: wibTime(new Date(e.starts_at)), end: null,
        title: `${EXAM_LABEL[e.kind] ?? 'Ujian'} ${c?.name ?? ''}`.trim(),
        sub: ['Ujian', e.material, e.room].filter(Boolean).join(' · '), to: `/kuliah/matkul/${e.course_id}`,
      });
    }
  }
  if (kinds.has('event')) {
    for (const ev of src.events) {
      if (ev.deleted_at) continue;
      const [s, e] = eventDays(ev);
      if (d < s || d > e) continue;
      const timed = !ev.all_day && d === s;
      out.push({
        key: `e-${ev.id}`, kind: 'event', time: timed ? wibTime(new Date(ev.starts_at)) : null,
        end: timed && ev.ends_at && wibDate(new Date(ev.ends_at)) === d ? wibTime(new Date(ev.ends_at)) : null,
        title: ev.title, sub: ['Event', ev.notes].filter(Boolean).join(' · '), eventId: ev.id,
      });
    }
  }
  if (kinds.has('rutinitas')) {
    for (const r of src.routines) {
      if (r.archived || r.deleted_at || !isRoutineDue(r.repeat_days, d)) continue;
      out.push({
        key: `r-${r.id}`, kind: 'rutinitas', time: r.remind_at ? r.remind_at.slice(0, 5) : null, end: null, title: r.name,
        sub: r.is_required ? 'Rutinitas wajib' : 'Kebiasaan', to: `/tumbuh/rutinitas/${r.id}`,
      });
    }
  }
  return out.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));
}

/** Sumber yang ada di setiap tanggal rentang [from, to] — untuk titik kalender & WeekStrip. */
export function kindsByDay(from: DateStr, to: DateStr, src: AgendaSources, kinds: ReadonlySet<AgendaKind>): Map<DateStr, Set<AgendaKind>> {
  const map = new Map<DateStr, Set<AgendaKind>>();
  const add = (d: DateStr, k: AgendaKind) => {
    if (d < from || d > to || !kinds.has(k)) return;
    let s = map.get(d);
    if (!s) { s = new Set(); map.set(d, s); }
    s.add(k);
  };
  for (const t of src.tasks) {
    const d = dueDay(t);
    if (d && !t.deleted_at && t.status !== 'dibatalkan') add(d, 'tugas');
  }
  for (const e of src.exams) if (!e.deleted_at) add(wibDate(new Date(e.starts_at)), 'ujian');
  for (const ev of src.events) {
    if (ev.deleted_at) continue;
    const [s, e] = eventDays(ev);
    for (let d = s < from ? from : s; d <= e && d <= to; d = addDays(d, 1)) add(d, 'event');
  }
  if (kinds.has('kelas') || kinds.has('rutinitas')) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (kinds.has('kelas') && inSemester(d, src.semester) && classesOn(d, src.schedules, src.courses, src.semester?.id).length) add(d, 'kelas');
      if (kinds.has('rutinitas') && src.routines.some((r) => !r.archived && !r.deleted_at && isRoutineDue(r.repeat_days, d))) add(d, 'rutinitas');
    }
  }
  return map;
}
