// Turunan Kuliah (setara rpc_gpa_summary / rpc_schedule_overview). Rumus di @common/calc/gpa.
import {
  attendancePct, ceil2, diffDays, ipk as ipkFn, isoWeekday, parseHHMM, points, projectedGpa, requiredIpsThisSemester,
  roundHalfUp2, wibDate, wibMinutes, type DateStr, type GradeScale,
} from '@common/calc/index.ts';
import type { Attendance, Course, CourseSchedule, Exam, Semester } from '@/data/types';

export function activeSemester(semesters: Semester[]): Semester | undefined {
  return semesters.find((s) => s.is_active && !s.deleted_at) ?? [...semesters].filter((s) => !s.deleted_at).sort((a, b) => b.number - a.number)[0];
}

export interface ClassSlot { schedule: CourseSchedule; course: Course; start: string; end: string; room: string | null }

/** Kelas pada tanggal d (semester aktif), urut jam. */
export function classesOn(d: DateStr, schedules: CourseSchedule[], courses: Course[], semesterId?: string): ClassSlot[] {
  const wd = isoWeekday(d);
  return schedules
    .filter((s) => s.weekday === wd)
    .map((s) => ({ schedule: s, course: courses.find((c) => c.id === s.course_id && !c.deleted_at)! }))
    .filter((x) => x.course && (!semesterId || x.course.semester_id === semesterId))
    .map((x) => ({ ...x, start: x.schedule.start_time.slice(0, 5), end: x.schedule.end_time.slice(0, 5), room: x.schedule.room ?? x.course.room ?? null }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Kelas berikutnya hari ini (belum mulai) atau sedang berlangsung. minutesUntil < 0 = sedang berjalan. */
export function nextClass(slots: ClassSlot[], now: Date): (ClassSlot & { minutesUntil: number }) | null {
  const m = wibMinutes(now);
  for (const s of slots) {
    const st = parseHHMM(s.start);
    const en = parseHHMM(s.end);
    if (m < en) return { ...s, minutesUntil: st - m };
  }
  return null;
}

export interface GpaSummary {
  ipk: number | null;
  creditsPassed: number;
  pointsPassed: number;
  semesterCredits: number;
  ipsSim: number | null;
  ipsOfficial: number | null;
  projected: number | null;
  required: { value: number; display: number; unreachable: boolean } | null;
  attendancePct: number | null;
  curriculum: number;
  target: number | null;
}

/** IPK dari nilai resmi semua semester sebelumnya (+ nilai resmi semester aktif yang sudah keluar). */
export function gpaSummary(a: {
  semesters: Semester[]; courses: Course[]; attendances: Attendance[]; scale: GradeScale; curriculum: number; target: number | null;
}): GpaSummary {
  const active = activeSemester(a.semesters);
  const live = a.courses.filter((c) => !c.deleted_at);
  const passed = live.filter((c) => c.final_grade);
  const p = points(passed.map((c) => ({ credits: c.credits, grade: c.final_grade })), a.scale);
  const ipk = p.credits > 0 ? ipkFn([p]) : null;
  const cur = live.filter((c) => c.semester_id === active?.id);
  const pending = cur.filter((c) => !c.final_grade);
  const semesterCredits = pending.reduce((s, c) => s + c.credits, 0);
  const sim = points(pending.map((c) => ({ credits: c.credits, grade: c.sim_grade ?? c.target_grade ?? null })), a.scale);
  const ipsSim = sim.credits > 0 ? sim.points / sim.credits : null;
  const officialCur = points(cur.filter((c) => c.final_grade).map((c) => ({ credits: c.credits, grade: c.final_grade })), a.scale);
  const projected = p.credits + sim.credits > 0 ? projectedGpa({ pointsDone: p.points, creditsDone: p.credits, semesterPoints: sim.points, semesterCredits: sim.credits }) : null;
  const required = a.target && semesterCredits > 0
    ? requiredIpsThisSemester({ pointsDone: p.points, creditsDone: p.credits, semesterCredits, target: a.target })
    : null;
  const curIds = new Set(cur.map((c) => c.id));
  const att = a.attendances.filter((x) => curIds.has(x.course_id));
  const present = att.filter((x) => x.status === 'hadir').length;
  return {
    ipk, creditsPassed: p.credits, pointsPassed: p.points, semesterCredits,
    ipsSim, ipsOfficial: officialCur.credits ? officialCur.points / officialCur.credits : null, projected, required,
    attendancePct: att.length ? Math.round(attendancePct(present, att.length)) : null,
    curriculum: a.curriculum, target: a.target,
  };
}

/** Kehadiran per matkul: hadir / pertemuan tercatat. */
export function courseAttendance(courseId: string, attendances: Attendance[]) {
  const rows = attendances.filter((a) => a.course_id === courseId);
  const present = rows.filter((a) => a.status === 'hadir').length;
  return { present, held: rows.length, pct: rows.length ? attendancePct(present, rows.length) : 0 };
}

/** Ujian mendatang ≤ n hari, dengan sisa hari. */
export function upcomingExams(exams: Exam[], today: DateStr, days = 7) {
  return exams
    .filter((e) => !e.deleted_at)
    .map((e) => ({ exam: e, inDays: diffDays(today, wibDate(new Date(e.starts_at))) }))
    .filter((x) => x.inDays >= 0 && x.inDays <= days)
    .sort((a, b) => a.exam.starts_at.localeCompare(b.exam.starts_at));
}

export const EXAM_LABEL: Record<string, string> = { kuis: 'Kuis', uts: 'UTS', uas: 'UAS', praktikum: 'Praktikum' };

export { roundHalfUp2, ceil2 };
