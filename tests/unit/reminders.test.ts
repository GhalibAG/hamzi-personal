// Penjadwal pengingat dalam app (src/features/notifications/schedule.ts): NOT-02, NOT-03, NOT-06, TECH-SPEC §6.1.
import { describe, expect, it } from 'vitest';
import { wibToInstant } from '@common/calc/index.ts';
import {
  dueCandidates, planReminders, snoozeKey, type PlanInput, type ReminderSettings, type SentLog,
} from '@/features/notifications/schedule';
import type { Course, CourseSchedule, Exam, LearningModule, Routine, RoutineLog, Semester, Task } from '@/data/types';

const DAY = '2026-10-12'; // Senin
const ALL = [1, 2, 3, 4, 5, 6, 7];
const at = (hhmm: string, day = DAY) => wibToInstant(day, hhmm);

const settings: ReminderSettings = {
  quiet_start: '23:00', quiet_end: '05:00', budget_cycle_day: 1, last_backup_at: '2026-10-05T12:00:00.000Z',
  system_notif: { class: true, exam: true, expense_nudge: true, budget: true, weekly_review: true, goal: true, backup: true, valuation: true, morning_brief: false },
};

const routine = (p: Partial<Routine> = {}): Routine => ({
  id: 'r1', name: 'Olahraga 20 menit', kind: 'check', target_count: 1, is_required: true, repeat_days: ALL,
  remind_at: '06:00', remind_enabled: true, icon: null, color: null, sort: 0, archived: false, ...p,
});
const mod = (p: Partial<LearningModule> = {}): LearningModule => ({
  id: 'm1', title: 'SQL & Basis Data', category: 'basis_data', color_index: 0, weekly_target_min: 120,
  remind_at: '20:00', remind_days: ALL, remind_enabled: true, status: 'aktif', sort: 0, ...p,
});

function input(now: Date, p: Partial<PlanInput> = {}): PlanInput {
  return { now, data: {}, settings, sent: [], snoozes: [], ...p };
}

describe('pengingat pengguna (NOT-02)', () => {
  it('rutinitas jatuh tempo pada jamnya dengan dedupe routine:{id}:{tgl} dan aksi done/snooze10', () => {
    const r = planReminders(input(at('06:00'), { data: { routines: [routine()] } }));
    expect(r.fire).toHaveLength(1);
    expect(r.fire[0]).toMatchObject({
      dedupe_key: `routine:r1:${DAY}`, category: 'user', kind: 'routine', title: 'Olahraga 20 menit', url: '/tumbuh?ref=r1',
    });
    expect(r.fire[0].actions.map((a) => a.action)).toEqual(['done', 'snooze10']);
  });

  it('pengingat pengguna tetap dikirim di jam tenang', () => {
    const r = planReminders(input(at('23:30'), { data: { routines: [routine({ remind_at: '23:30' })] } }));
    expect(r.fire.map((x) => x.dedupe_key)).toEqual([`routine:r1:${DAY}`]);
  });

  it('rutinitas yang sudah selesai hari ini tidak diingatkan lagi', () => {
    const logs: RoutineLog[] = [{ id: 'l1', routine_id: 'r1', log_date: DAY, value: 1, done: true }];
    const r = planReminders(input(at('06:05'), { data: { routines: [routine()], routineLogs: logs } }));
    expect(r.fire).toHaveLength(0);
  });

  it('rutinitas tidak terjadwal hari ini / pengingat mati → tidak dikirim', () => {
    const notToday = routine({ id: 'r2', repeat_days: [6, 7] });
    const off = routine({ id: 'r3', remind_enabled: false });
    expect(planReminders(input(at('06:00'), { data: { routines: [notToday, off] } })).fire).toHaveLength(0);
  });

  it('tidak mengirim pengingat yang lebih tua dari 2 jam', () => {
    expect(planReminders(input(at('08:01'), { data: { routines: [routine()] } })).fire).toHaveLength(0);
    expect(planReminders(input(at('07:59'), { data: { routines: [routine()] } })).fire).toHaveLength(1);
  });

  it('belum waktunya → belum dikirim', () => {
    expect(planReminders(input(at('05:59'), { data: { routines: [routine()] } })).fire).toHaveLength(0);
  });

  it('modul belajar: dilewati bila sudah ada sesi ≥ 10 mnt hari ini', () => {
    const now = at('20:01');
    const fire = planReminders(input(now, { data: { modules: [mod()] } })).fire;
    expect(fire[0]).toMatchObject({ dedupe_key: `module:m1:${DAY}`, url: '/tumbuh/sesi?modul=m1', title: 'SQL & Basis Data' });
    const studied = planReminders(input(now, {
      data: { modules: [mod()], sessions: [{ id: 's', started_at: at('19:00').toISOString(), duration_min: 12, started_on: DAY, module_id: 'm1', source: 'timer' }] },
    })).fire;
    expect(studied).toHaveLength(0);
  });

  it('tugas: satu pengingat per offset sebelum tenggat, dilewati bila sudah selesai', () => {
    const due = at('19:00', '2026-10-13').toISOString();
    const t: Task = { id: 't1', title: 'Laporan praktikum', status: 'belum', priority: 3, source_tag: 'kuliah', due_at: due, remind_offsets: [60, 1440] };
    const r = planReminders(input(at('19:00'), { data: { tasks: [t] } }));
    expect(r.fire.map((x) => x.dedupe_key)).toEqual([`task:t1:1440:${due}`]);
    expect(planReminders(input(at('19:00'), { data: { tasks: [{ ...t, status: 'selesai' }] } })).fire).toHaveLength(0);
  });
});

describe('dedupe', () => {
  it('kunci yang sudah ada (status apa pun) tidak dikirim ulang', () => {
    const sent: SentLog[] = [{ dedupe_key: `routine:r1:${DAY}`, category: 'user', status: 'pending' }];
    const r = planReminders(input(at('06:10'), { data: { routines: [routine()] }, sent }));
    expect(r.fire).toHaveLength(0);
    expect(r.skipped[0].reason).toBe('duplicate');
  });

  it('dua kali jalan berturut-turut dengan hasil pertama dicatat → kedua kosong', () => {
    const base = input(at('06:00'), { data: { routines: [routine()] } });
    const first = planReminders(base);
    const sent = first.fire.map((f) => ({ dedupe_key: f.dedupe_key, category: f.category, status: 'sent', sent_at: at('06:00').toISOString() }));
    expect(planReminders({ ...base, now: at('06:00'), sent }).fire).toHaveLength(0);
  });

  it('penundaan memakai kunci snooze sendiri dan jatuh tempo 10 menit kemudian', () => {
    const first = planReminders(input(at('06:00'), { data: { routines: [routine()] } })).fire[0];
    const fireAt = at('06:10');
    const snoozes = [{ key: snoozeKey(first, 'snooze10', fireAt), fire_at: fireAt.toISOString(), base: first }];
    const sent: SentLog[] = [{ dedupe_key: first.dedupe_key, category: 'user', status: 'sent', sent_at: at('06:00').toISOString() }];
    expect(planReminders(input(at('06:05'), { data: { routines: [routine()] }, sent, snoozes })).fire).toHaveLength(0);
    const later = planReminders(input(at('06:10'), { data: { routines: [routine()] }, sent, snoozes })).fire;
    expect(later.map((x) => x.dedupe_key)).toEqual(['snooze:routine:r1:2026-10-12:snooze10:0610']);
    // rutinitas sudah selesai → penundaan tidak relevan lagi
    const logs: RoutineLog[] = [{ id: 'l1', routine_id: 'r1', log_date: DAY, value: 1, done: true }];
    const done = planReminders(input(at('06:10'), { data: { routines: [routine()], routineLogs: logs }, sent, snoozes }));
    expect(done.fire).toHaveLength(0);
    expect(done.skipped.map((s) => s.reason)).toContain('stale');
  });
});

describe('pengingat sistem (NOT-03, NOT-06)', () => {
  it('catat pengeluaran 21:00 bila belum ada pengeluaran hari ini', () => {
    const fire = planReminders(input(at('21:00'))).fire;
    expect(fire.map((f) => f.dedupe_key)).toEqual([`expense_nudge:${DAY}`]);
    expect(fire[0].actions.map((a) => a.action)).toEqual(['log']);
  });

  it('pengingat sistem dilewati di jam tenang', () => {
    const quiet = { ...settings, quiet_start: '21:00', quiet_end: '05:00' };
    const r = planReminders(input(at('21:00'), { settings: quiet }));
    expect(r.fire).toHaveLength(0);
    expect(r.skipped.map((s) => s.reason)).toEqual(['quiet_hours']);
  });

  it('jam tenang berlaku juga saat app baru dibuka setelah pukul 23:00', () => {
    const sem: Semester = { id: 's1', number: 5, label: 'Ganjil', start_date: '2026-08-01', end_date: '2027-01-31', is_active: true };
    const c: Course = { id: 'c1', semester_id: 's1', name: 'Basis Data', credits: 3, min_attendance_pct: 75 };
    const sch: CourseSchedule = { id: 'cs1', course_id: 'c1', weekday: 1, start_time: '23:20', end_time: '23:59' };
    const data = { semesters: [sem], courses: [c], schedules: [sch] };
    expect(planReminders(input(at('23:05'), { data })).skipped.map((s) => s.reason)).toEqual(['quiet_hours']);
  });

  it('toggle system_notif mati → tidak dikirim', () => {
    const off = { ...settings, system_notif: { ...settings.system_notif, expense_nudge: false } };
    const r = planReminders(input(at('21:00'), { settings: off }));
    expect(r.fire).toHaveLength(0);
    expect(r.skipped[0].reason).toBe('disabled');
  });

  it('maksimal 6 pengingat sistem per hari WIB; pengingat pengguna tidak terhitung & tetap dikirim', () => {
    const sent: SentLog[] = Array.from({ length: 6 }, (_, i) => ({
      dedupe_key: `x:${i}`, category: 'system' as const, status: 'sent', sent_at: at(`1${i}:00`).toISOString(),
    }));
    const r = planReminders(input(at('21:00'), { sent, data: { routines: [routine({ remind_at: '21:00' })] } }));
    expect(r.fire.map((f) => f.kind)).toEqual(['routine']);
    expect(r.skipped.find((s) => s.reminder.kind === 'expense_nudge')?.reason).toBe('daily_cap');
    // yang terkirim kemarin tidak dihitung
    const yesterday = sent.map((s) => ({ ...s, sent_at: at('10:00', '2026-10-11').toISOString() }));
    expect(planReminders(input(at('21:00'), { sent: yesterday })).fire.map((f) => f.kind)).toEqual(['expense_nudge']);
  });

  it('batas 6 juga berlaku di dalam satu putaran', () => {
    const sem: Semester = { id: 's1', number: 5, label: 'Ganjil', start_date: '2026-08-01', end_date: '2027-01-31', is_active: true };
    const courses: Course[] = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, semester_id: 's1', name: `MK ${i}`, credits: 2, min_attendance_pct: 75 }));
    const schedules: CourseSchedule[] = courses.map((c, i) => ({ id: `cs${i}`, course_id: c.id, weekday: 1, start_time: '10:30', end_time: '12:00' }));
    const r = planReminders(input(at('10:00'), { data: { semesters: [sem], courses, schedules } }));
    expect(r.fire).toHaveLength(6);
    expect(r.skipped.filter((s) => s.reason === 'daily_cap')).toHaveLength(2);
  });

  it('kelas 30 menit sebelum mulai, aksi attend; dilewati bila kehadiran sudah dicatat', () => {
    const sem: Semester = { id: 's1', number: 5, label: 'Ganjil', start_date: '2026-08-01', end_date: '2027-01-31', is_active: true };
    const c: Course = { id: 'c1', semester_id: 's1', name: 'Pemrograman Web', credits: 3, min_attendance_pct: 75 };
    const sch: CourseSchedule = { id: 'cs1', course_id: 'c1', weekday: 1, start_time: '16:30', end_time: '18:10' };
    const data = { semesters: [sem], courses: [c], schedules: [sch] };
    const fire = planReminders(input(at('16:00'), { data })).fire;
    expect(fire[0]).toMatchObject({ dedupe_key: `class:cs1:${DAY}`, category: 'system', title: 'Pemrograman Web', ref_type: 'course_schedule' });
    expect(fire[0].actions.map((a) => a.action)).toEqual(['attend']);
    const attended = planReminders(input(at('16:00'), { data: { ...data, attendances: [{ id: 'a', course_id: 'c1', meeting_date: DAY, status: 'hadir' }] } }));
    expect(attended.fire).toHaveLength(0);
  });

  it('ujian H-3 dan H-1 pukul 19:00', () => {
    const e: Exam = { id: 'e1', course_id: 'c1', kind: 'kuis', starts_at: at('08:00', '2026-10-15').toISOString(), prep_status: 'belum' };
    const c: Course = { id: 'c1', semester_id: 's1', name: 'Analisis Sistem', credits: 3, min_attendance_pct: 75 };
    const fire = planReminders(input(at('19:00'), { data: { exams: [e], courses: [c] } })).fire;
    expect(fire.map((f) => [f.dedupe_key, f.title])).toEqual([['exam:e1:h3', 'Kuis Analisis Sistem · H-3']]);
    const h1 = planReminders(input(at('19:00', '2026-10-14'), { data: { exams: [e], courses: [c] }, settings: { ...settings, system_notif: { ...settings.system_notif, expense_nudge: false } } })).fire;
    expect(h1.map((f) => f.dedupe_key)).toEqual(['exam:e1:h1']);
  });

  it('review mingguan hanya Minggu 19:00 → /chat?review=minggu', () => {
    expect(dueCandidates(input(at('19:00'))).some((c) => c.kind === 'weekly_review')).toBe(false);
    const sun = dueCandidates(input(at('19:00', '2026-10-18'))).find((c) => c.kind === 'weekly_review');
    expect(sun).toMatchObject({ dedupe_key: 'weekly_review:2026-10-18', url: '/chat?review=minggu' });
  });

  it('backup setelah 14 hari sejak last_backup_at', () => {
    expect(dueCandidates(input(at('12:00'))).some((c) => c.kind === 'backup')).toBe(false);
    const old = { ...settings, last_backup_at: '2026-09-20T12:00:00.000Z' };
    expect(dueCandidates(input(at('12:00'), { settings: old })).find((c) => c.kind === 'backup')?.dedupe_key).toBe(`backup:${DAY}`);
  });

  it('anggaran 80% sekali per siklus; isi tanpa nominal', () => {
    const data = {
      budgets: [{ id: 'b', category_id: null, amount: 1_000_000, effective_from: '2026-10-01' }],
      transactions: [{ id: 'x', kind: 'expense' as const, amount: 850_000, direction: 1 as const, wallet_id: 'w', occurred_at: at('09:00').toISOString(), occurred_on: DAY }],
    };
    const fire = planReminders(input(at('12:00'), { data })).fire;
    expect(fire.map((f) => f.dedupe_key)).toEqual(['budget80:2026-10-01']);
    expect(`${fire[0].title} ${fire[0].body}`).not.toMatch(/Rp|\d{3}\.\d{3}/);
    const sent: SentLog[] = [{ dedupe_key: 'budget80:2026-10-01', category: 'system', status: 'sent', sent_at: at('12:00').toISOString() }];
    expect(planReminders(input(at('15:00'), { data, sent })).fire).toHaveLength(0);
  });
});
