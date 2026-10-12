// Turunan Kuliah (setara rpc_gpa_summary / rpc_schedule_overview). Rumus di @common/calc/gpa.
import {
  attendancePct, attendanceWarn, ceil2, courseProjected, diffDays, formatGpa, ipk as ipkFn, isoWeekday, parseHHMM, points,
  projectedGpa, requiredIpsThisSemester, roundHalfUp2, scoreToGrade, wibDate, wibMinutes, wibTime, type DateStr, type GradeScale,
} from '@common/calc/index.ts';
import { BULAN_PENDEK, HARI } from '@common/format.ts';
import type { Attendance, Course, CourseSchedule, Exam, GradeComponent, Semester, Task } from '@/data/types';

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

/* ---------- Tambahan (M6 Kuliah): turunan murni untuk layar Kuliah. Rumus tetap di @common/calc. ---------- */

export type AttendanceStatus = Attendance['status'];
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = { hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpa: 'Alpa' };
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alpa'];
export const EXAM_KINDS: Exam['kind'][] = ['kuis', 'uts', 'uas', 'praktikum'];

/** Matkul aktif (tidak dihapus) pada satu semester. */
export function semesterCourses(courses: Course[], semesterId: string | undefined): Course[] {
  if (!semesterId) return [];
  return courses.filter((c) => c.semester_id === semesterId && !c.deleted_at);
}

/** Semua huruf nilai urut bobot turun (A, B+, …, E). */
export function gradeLetters(scale: GradeScale): string[] {
  return Object.entries(scale).sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

/** Chip simulasi (KUL-06): hanya nilai dengan bobot ≥ 2. */
export function simGradeOptions(scale: GradeScale): string[] {
  return Object.entries(scale).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

/** Nilai yang dipakai proyeksi (PRD §7.1): resmi › simulasi › target. */
export function projectedGrade(c: Course): string | null {
  return c.final_grade ?? c.sim_grade ?? c.target_grade ?? null;
}

/**
 * IPS satu semester. `official` = hanya nilai resmi; `projected` = resmi › simulasi › target (PRD §7.1).
 * null bila tidak ada SKS bernilai.
 */
export function semesterIps(courses: Course[], scale: GradeScale, mode: 'official' | 'projected' = 'official'): { ips: number | null; credits: number; graded: number } {
  const live = courses.filter((c) => !c.deleted_at);
  const p = points(live.map((c) => ({ credits: c.credits, grade: mode === 'official' ? c.final_grade : projectedGrade(c) })), scale);
  return { ips: p.credits > 0 ? p.points / p.credits : null, credits: live.reduce((s, c) => s + c.credits, 0), graded: p.credits };
}

export interface CourseAttendanceView { present: number; held: number; pct: number; warn: boolean; label: string }

/** Kehadiran per matkul + peringatan (PRD §7.3): "5/6 · 83%", merah bila < batas + 5. */
export function courseAttendanceView(course: Course, attendances: Attendance[]): CourseAttendanceView {
  const a = courseAttendance(course.id, attendances);
  const warn = attendanceWarn(a.present, a.held, course.min_attendance_pct ?? 75);
  return { ...a, warn, label: a.held ? `${a.present}/${a.held} · ${Math.round(a.pct)}%` : 'Belum ada pertemuan' };
}

/** Kehadiran di kartu IPK: rata-rata persen semua matkul semester aktif yang sudah berjalan, dibulatkan (PRD §7.3). */
export function attendanceAverage(courses: Course[], attendances: Attendance[]): number | null {
  const pcts = courses.map((c) => courseAttendance(c.id, attendances)).filter((a) => a.held > 0).map((a) => a.pct);
  return pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : null;
}

/** "22 mnt lagi", "1 jam 20 mnt lagi", "Sedang berlangsung". */
export function minutesUntilLabel(min: number): string {
  if (min <= 0) return 'Sedang berlangsung';
  if (min < 60) return `${min} mnt lagi`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} jam ${m} mnt lagi` : `${h} jam lagi`;
}

/** Status kelas hari ini relatif terhadap sekarang. */
export function slotState(slot: ClassSlot, now: Date): 'past' | 'ongoing' | 'upcoming' {
  const m = wibMinutes(now);
  if (m >= parseHHMM(slot.end)) return 'past';
  if (m >= parseHHMM(slot.start)) return 'ongoing';
  return 'upcoming';
}

/** Detail kelas: "08:00–10:30 · R. 2.3 · Pak Hendra". */
export function slotDetail(slot: ClassSlot, withTime = true): string {
  return [withTime ? `${slot.start}–${slot.end}` : null, slot.room, slot.course.lecturer].filter(Boolean).join(' · ');
}

/** Tugas kuliah (KUL-05): tugas terbuka yang terhubung ke matkul, selain sesi belajar; urut tenggat. */
export function courseTasks(tasks: Task[], courseIds?: Set<string>): Task[] {
  return tasks
    .filter((t) => !t.deleted_at && t.course_id && t.source_tag !== 'belajar' && t.status !== 'selesai' && t.status !== 'dibatalkan')
    .filter((t) => !courseIds || courseIds.has(t.course_id as string))
    .sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9'));
}

/** Sesi belajar terjadwal untuk ujian: tugas belajar terbuka pada matkul ujian dengan tenggat hari ini…hari ujian. */
export function studySessionsFor(exam: Exam, tasks: Task[], today: DateStr): number {
  const examDay = wibDate(new Date(exam.starts_at));
  return tasks.filter((t) => {
    if (t.deleted_at || t.course_id !== exam.course_id || t.source_tag !== 'belajar') return false;
    if (t.status === 'selesai' || t.status === 'dibatalkan' || !t.due_at) return false;
    const d = wibDate(new Date(t.due_at));
    return d >= today && d <= examDay;
  }).length;
}

/** Tanggal pendek "19 Okt". */
export function shortDate(d: DateStr): string {
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${BULAN_PENDEK[m]}`;
}

/** Tenggat relatif tugas kuliah: "Terlambat" / "Hari ini" / "Besok" / "19 Okt"; `urgent` = merah (≤ besok). */
export function courseDue(t: Task, today: DateStr, now: Date): { label: string; urgent: boolean } {
  if (!t.due_at) return { label: 'Tanpa tenggat', urgent: false };
  const d = wibDate(new Date(t.due_at));
  const n = diffDays(today, d);
  const overdue = t.all_day ? n < 0 : new Date(t.due_at).getTime() < now.getTime();
  if (overdue) return { label: 'Terlambat', urgent: true };
  if (n === 0) return { label: 'Hari ini', urgent: true };
  if (n === 1) return { label: 'Besok', urgent: true };
  return { label: shortDate(d), urgent: false };
}

/** Meta tugas kuliah: "Basis Data Lanjut · bobot 10%" / "Interaksi Manusia Komputer · kelompok". */
export function courseTaskMeta(t: Task, courseName: string | null | undefined): string {
  const parts: string[] = [];
  if (courseName) parts.push(courseName);
  if (t.course_task_kind === 'kelompok') parts.push('kelompok');
  else if (t.weight_pct) parts.push(`bobot ${t.weight_pct}%`);
  return parts.join(' · ');
}

/** Banner ujian ≤ 3 hari: "Kuis Analisis Sistem · H-3" + "Kamis 10:00 · bab 1–3 · 2 sesi belajar dijadwalkan". */
export function examBannerText(exam: Exam, courseName: string, inDays: number, sessions: number): { title: string; sub: string } {
  const at = new Date(exam.starts_at);
  const d = wibDate(at);
  const when = inDays === 0 ? 'Hari ini' : inDays === 1 ? 'Besok' : HARI[isoWeekday(d)];
  const title = `${EXAM_LABEL[exam.kind] ?? 'Ujian'} ${courseName} · ${inDays === 0 ? 'hari ini' : `H-${inDays}`}`;
  const sub = [`${when} ${wibTime(at)}`, exam.material || null, sessions > 0 ? `${sessions} sesi belajar dijadwalkan` : null].filter(Boolean).join(' · ');
  return { title, sub };
}

/** Teks target di tab Nilai (PRD §7.2). */
export function targetIpsText(s: GpaSummary): string {
  if (s.target === null) return 'Atur target IPK di Kelola semester untuk melihat IPS yang dibutuhkan.';
  const t = formatGpa(s.target);
  if (!s.required) return s.semesterCredits === 0 ? 'Semua nilai semester ini sudah resmi.' : `Target IPK ${t}.`;
  if (s.required.unreachable) return `Target IPK ${t} tidak tercapai dengan SKS semester ini.`;
  if (s.required.value <= 0) return `Target IPK ${t} sudah aman · skenario ini tercapai ✓`;
  const ok = s.ipsSim !== null && s.ipsSim >= s.required.value - 1e-9;
  return `Target IPK ${t} butuh IPS ≥ ${formatGpa(s.required.display)}${ok ? ' · skenario ini tercapai ✓' : ' · skenario ini belum cukup'}`;
}

/** Skor minimum untuk huruf (rentang angka→huruf). */
export function gradeMinScore(grade: string | null | undefined, ranges: [string, number][]): number | undefined {
  if (!grade) return undefined;
  return ranges.find(([g]) => g === grade)?.[1];
}

/** Angka skor id-ID ringkas: 90 → "90", 82,857 → "82,86", 72,5 → "72,5". */
export function scoreId(x: number): string {
  return String(roundHalfUp2(x)).replace('.', ',');
}

/** Ringkasan komponen nilai (KUL-09): "Sementara 90 (A); UTS + UAS untuk 85 = 82,86". */
export function componentSummary(
  components: GradeComponent[], target: { score: number; grade: string } | undefined, ranges: [string, number][],
): { current: number | null; needed: number | null; text: string; weightTotal: number } {
  const res = courseProjected(components.map((c) => ({ weightPct: Number(c.weight_pct), score: c.score })), target?.score);
  const weightTotal = components.reduce((s, c) => s + Number(c.weight_pct), 0);
  const remaining = components.filter((c) => c.score === null || c.score === undefined).map((c) => c.name);
  const parts: string[] = [];
  if (res.current !== null) parts.push(`Sementara ${scoreId(res.current)} (${scoreToGrade(res.current, ranges)})`);
  else parts.push('Belum ada skor');
  if (target && res.neededOnRemaining !== null && remaining.length) {
    const need = res.neededOnRemaining;
    const who = remaining.join(' + ');
    if (need <= 0) parts.push(`target ${target.grade} sudah aman`);
    else if (need > 100) parts.push(`${who} untuk ${target.score} butuh ${scoreId(need)} (tidak cukup)`);
    else parts.push(`${who} untuk ${target.score} = ${scoreId(need)}`);
  }
  return { current: res.current, needed: res.neededOnRemaining, text: parts.join('; '), weightTotal };
}

/** Nama hari untuk pilihan jadwal (1=Senin…7=Minggu). */
export const WEEKDAY_OPTIONS = HARI.slice(1).map((label, i) => ({ value: i + 1, label }));
