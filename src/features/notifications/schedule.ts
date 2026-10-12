// Penjadwal pengingat dalam app — logika MURNI (tanpa DOM/React), setara `fn_enqueue_notifications` + dispatch
// (TECH-SPEC §6.1). Dipakai ReminderEngine: mode demo (satu-satunya penjadwal) dan cadangan mode Supabase saat app terbuka.
// Aturan: pengingat buatan pengguna selalu dikirim; pengingat sistem patuh `system_notif`, jam tenang, maks 6/hari (NOT-02/03/06).
// Pengingat yang lebih tua dari 2 jam tidak dikirim (sama dengan dispatch server). Isi tanpa nominal (NOT-08).
import {
  addDays, budgetUsedPct, cycleStart, daysInMonth, diffDays, inQuietHours, isoWeekday, isRoutineDue, STUDY_WATER_MIN,
  SYSTEM_NOTIF_MAX_PER_DAY, wibDate, wibTime, wibToInstant, type DateStr,
} from '@common/calc/index.ts';
import { NOTIF_ACTIONS, NOTIF_BODY, notifBody } from '@common/notif-lines.id.ts';
import type {
  Asset, Attendance, Budget, Course, CourseSchedule, Exam, LearningModule, Routine, RoutineLog, SavingsGoal, Semester,
  StudySession, Task, Transaction,
} from '@/data/types';
import { activeSemester, classesOn, EXAM_LABEL } from '@/features/courses/derive';
import { activeBudget } from '@/features/finance/derive';

/** Jendela mundur: pengingat lebih tua dari ini dilewati (TECH-SPEC §6.1 langkah 2). */
export const REMINDER_LOOKBACK_MIN = 120;

export type NotifCategory = 'user' | 'system';
export interface NotifAction { action: string; title: string }

export interface Reminder {
  dedupe_key: string;
  category: NotifCategory;
  kind: string;
  /** Kunci toggle `user_settings.system_notif` (null untuk pengingat pengguna). */
  system_key: string | null;
  ref_type: string | null;
  ref_id: string | null;
  fire_at: string;
  title: string;
  body: string;
  url: string;
  actions: NotifAction[];
}

/** Penundaan dari tombol "Tunda" (disimpan klien). */
export interface Snooze { key: string; fire_at: string; base: Reminder }

export interface ReminderData {
  routines: Routine[];
  routineLogs: RoutineLog[];
  modules: LearningModule[];
  sessions: StudySession[];
  tasks: Task[];
  semesters: Semester[];
  courses: Course[];
  schedules: CourseSchedule[];
  attendances: Attendance[];
  exams: Exam[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  assets: Asset[];
}

export interface ReminderSettings {
  quiet_start: string;
  quiet_end: string;
  system_notif: Record<string, boolean>;
  last_backup_at: string | null;
  budget_cycle_day: number;
}

/** Notifikasi yang sudah ada (baris `scheduled_notifications` atau catatan lokal). */
export interface SentLog { dedupe_key: string; category: NotifCategory; status: string; sent_at?: string | null }

export interface PlanInput {
  now: Date;
  data: Partial<ReminderData>;
  settings: ReminderSettings;
  sent: SentLog[];
  snoozes?: Snooze[];
  /** Acuan backup bila `last_backup_at` kosong (mis. `profiles.onboarded_at`). */
  backupRef?: string | null;
  lookbackMin?: number;
}

export type SkipReason = 'duplicate' | 'disabled' | 'quiet_hours' | 'daily_cap' | 'stale';
export interface PlanResult { fire: Reminder[]; skipped: { reminder: Reminder; reason: SkipReason }[] }

const MIN = 60_000;
const BUDGET100_BODY = NOTIF_BODY.budget100[0];

/** Benih kalimat stabil per kunci (variasi badan notifikasi tanpa acak). */
function seedOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function minuteStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / MIN) * MIN);
}

function isOpenTask(t: Task): boolean {
  return t.status !== 'selesai' && t.status !== 'dibatalkan' && !t.deleted_at;
}

export function routineDoneOn(logs: RoutineLog[], routineId: string, day: DateStr): boolean {
  return logs.some((l) => l.routine_id === routineId && l.log_date === day && l.done);
}

export function moduleStudiedOn(sessions: StudySession[], moduleId: string, day: DateStr): boolean {
  return sessions.some((s) => s.module_id === moduleId && s.started_on === day && !s.deleted_at && s.duration_min >= STUDY_WATER_MIN);
}

const D = <K extends keyof ReminderData>(data: Partial<ReminderData>, k: K): ReminderData[K] => (data[k] ?? []) as ReminderData[K];

/**
 * Semua pengingat yang jatuh tempo pada jendela (now − lookback, now] dan masih relevan
 * (rutinitas belum selesai, tugas belum selesai, belum ada sesi belajar ≥ 10 mnt, dst.). Belum difilter dedupe/jam tenang/batas.
 */
export function dueCandidates(input: PlanInput): Reminder[] {
  const { now, data, settings } = input;
  const lookback = (input.lookbackMin ?? REMINDER_LOOKBACK_MIN) * MIN;
  const nowMs = now.getTime();
  const inWindow = (t: number) => t <= nowMs && nowMs - t < lookback;
  const today = wibDate(now);
  const days = [...new Set([wibDate(new Date(nowMs - lookback)), today])];
  const out: Reminder[] = [];
  const push = (r: Omit<Reminder, 'body'> & { body?: string }) => {
    out.push({ ...r, body: r.body ?? notifBody(r.kind, seedOf(r.dedupe_key)) });
  };

  // --- Pengingat buatan pengguna (selalu dikirim) ---
  const logs = D(data, 'routineLogs');
  for (const r of D(data, 'routines')) {
    if (r.archived || r.deleted_at || !r.remind_enabled || !r.remind_at) continue;
    for (const day of days) {
      const at = wibToInstant(day, r.remind_at.slice(0, 5));
      if (!inWindow(at.getTime()) || !isRoutineDue(r.repeat_days, day) || routineDoneOn(logs, r.id, day)) continue;
      push({
        dedupe_key: `routine:${r.id}:${day}`, category: 'user', kind: 'routine', system_key: null, ref_type: 'routine', ref_id: r.id,
        fire_at: at.toISOString(), title: r.name, url: `/tumbuh?ref=${r.id}`, actions: NOTIF_ACTIONS.routine,
      });
    }
  }

  const sessions = D(data, 'sessions');
  for (const m of D(data, 'modules')) {
    if (m.status !== 'aktif' || m.deleted_at || !m.remind_enabled || !m.remind_at) continue;
    for (const day of days) {
      const at = wibToInstant(day, m.remind_at.slice(0, 5));
      if (!inWindow(at.getTime()) || !m.remind_days.includes(isoWeekday(day)) || moduleStudiedOn(sessions, m.id, day)) continue;
      push({
        dedupe_key: `module:${m.id}:${day}`, category: 'user', kind: 'module', system_key: null, ref_type: 'module', ref_id: m.id,
        fire_at: at.toISOString(), title: m.title, url: `/tumbuh/sesi?modul=${m.id}`, actions: NOTIF_ACTIONS.module,
      });
    }
  }

  for (const t of D(data, 'tasks')) {
    if (!isOpenTask(t) || !t.due_at) continue;
    const due = new Date(t.due_at).getTime();
    for (const offset of t.remind_offsets ?? []) {
      const at = due - offset * MIN;
      if (!inWindow(at)) continue;
      push({
        dedupe_key: `task:${t.id}:${offset}:${t.due_at}`, category: 'user', kind: 'task', system_key: null, ref_type: 'task', ref_id: t.id,
        fire_at: new Date(at).toISOString(), title: t.title, url: `/rencana?ref=${t.id}`, actions: NOTIF_ACTIONS.task,
      });
    }
  }

  // --- Pengingat sistem ---
  const classBody = (startMs: number, now: number) => {
    const m = Math.round((startMs - now) / MIN);
    return m <= 0 ? 'Kelas sudah dimulai.' : `Kelas mulai ${m} menit lagi.`;
  };
  const sem = activeSemester(D(data, 'semesters'));
  const attendances = D(data, 'attendances');
  for (const day of days) {
    for (const slot of classesOn(day, D(data, 'schedules'), D(data, 'courses'), sem?.id)) {
      const at = wibToInstant(day, slot.start).getTime() - 30 * MIN;
      if (!inWindow(at) || attendances.some((a) => a.course_id === slot.course.id && a.meeting_date === day)) continue;
      push({
        dedupe_key: `class:${slot.schedule.id}:${day}`, category: 'system', kind: 'class', system_key: 'class',
        ref_type: 'course_schedule', ref_id: slot.schedule.id, fire_at: new Date(at).toISOString(), title: slot.course.name,
        body: classBody(wibToInstant(day, slot.start).getTime(), nowMs),
        url: `/kuliah?ref=${slot.schedule.id}`, actions: NOTIF_ACTIONS.class,
      });
    }
  }

  const courses = D(data, 'courses');
  for (const e of D(data, 'exams')) {
    if (e.deleted_at || new Date(e.starts_at).getTime() <= nowMs) continue;
    const examDay = wibDate(new Date(e.starts_at));
    const course = courses.find((c) => c.id === e.course_id);
    for (const h of [3, 1]) {
      const at = wibToInstant(addDays(examDay, -h), '19:00').getTime();
      if (!inWindow(at)) continue;
      push({
        dedupe_key: `exam:${e.id}:h${h}`, category: 'system', kind: 'exam', system_key: 'exam', ref_type: 'exam', ref_id: e.id,
        fire_at: new Date(at).toISOString(), title: `${EXAM_LABEL[e.kind] ?? 'Ujian'} ${course?.name ?? ''}`.trim() + ` · H-${h}`,
        url: '/kuliah', actions: [],
      });
    }
  }

  const txs = D(data, 'transactions').filter((t) => !t.deleted_at && t.kind === 'expense');
  for (const day of days) {
    const at = wibToInstant(day, '21:00').getTime();
    if (!inWindow(at) || txs.some((t) => t.occurred_on === day)) continue;
    push({
      dedupe_key: `expense_nudge:${day}`, category: 'system', kind: 'expense_nudge', system_key: 'expense_nudge', ref_type: null, ref_id: null,
      fire_at: new Date(at).toISOString(), title: 'Catat pengeluaran hari ini?', url: '/keuangan', actions: NOTIF_ACTIONS.expense_nudge,
    });
  }

  // Anggaran 80% / 100% — sekali per siklus, saat kondisi terpenuhi.
  const total = activeBudget(D(data, 'budgets'), null, today);
  if (total && total > 0) {
    const cs = cycleStart(today, settings.budget_cycle_day);
    const spent = txs.filter((t) => t.occurred_on >= cs && t.occurred_on <= today).reduce((s, t) => s + t.amount, 0);
    const pct = budgetUsedPct(spent, total);
    const at = minuteStart(now).toISOString();
    if (pct >= 100) {
      push({
        dedupe_key: `budget100:${cs}`, category: 'system', kind: 'budget', system_key: 'budget', ref_type: null, ref_id: null,
        fire_at: at, title: 'Anggaran sudah terpakai 100%', body: BUDGET100_BODY, url: '/keuangan/anggaran', actions: [],
      });
    } else if (pct >= 80) {
      push({
        dedupe_key: `budget80:${cs}`, category: 'system', kind: 'budget', system_key: 'budget', ref_type: null, ref_id: null,
        fire_at: at, title: 'Anggaran sudah terpakai 80%', url: '/keuangan/anggaran', actions: [],
      });
    }
  }

  for (const day of days) {
    if (isoWeekday(day) !== 7) continue;
    const at = wibToInstant(day, '19:00').getTime();
    if (!inWindow(at)) continue;
    push({
      dedupe_key: `weekly_review:${day}`, category: 'system', kind: 'weekly_review', system_key: 'weekly_review', ref_type: null, ref_id: null,
      fire_at: new Date(at).toISOString(), title: 'Review mingguanmu siap', url: '/chat?review=minggu', actions: [],
    });
  }

  for (const g of D(data, 'goals')) {
    if (g.status !== 'aktif' || g.deleted_at || !g.plan_day) continue;
    for (const day of days) {
      const [y, m, dd] = day.split('-').map(Number);
      if (dd !== Math.min(g.plan_day, daysInMonth(y, m))) continue;
      const at = wibToInstant(day, '19:00').getTime();
      if (!inWindow(at)) continue;
      push({
        dedupe_key: `goal:${g.id}:${day}`, category: 'system', kind: 'goal', system_key: 'goal', ref_type: 'goal', ref_id: g.id,
        fire_at: new Date(at).toISOString(), title: `Setor ke ${g.name}`, url: `/keuangan/target/${g.id}`, actions: [],
      });
    }
  }

  if (D(data, 'assets').some((a) => !a.archived && !a.deleted_at)) {
    for (const day of days) {
      if (!day.endsWith('-01')) continue;
      const at = wibToInstant(day, '10:00').getTime();
      if (!inWindow(at)) continue;
      push({
        dedupe_key: `valuation:${day.slice(0, 7)}`, category: 'system', kind: 'valuation', system_key: 'valuation', ref_type: null, ref_id: null,
        fire_at: new Date(at).toISOString(), title: 'Perbarui nilai investasi', url: '/keuangan/investasi', actions: [],
      });
    }
  }

  // Backup: 14 hari sejak backup terakhir — sekali per hari selama belum backup.
  const ref = settings.last_backup_at ?? input.backupRef ?? null;
  if (ref && diffDays(wibDate(new Date(ref)), today) >= 14) {
    push({
      dedupe_key: `backup:${today}`, category: 'system', kind: 'backup', system_key: 'backup', ref_type: null, ref_id: null,
      fire_at: minuteStart(now).toISOString(), title: 'Saatnya backup data', url: '/pengaturan/data', actions: [],
    });
  }

  for (const day of days) {
    const at = wibToInstant(day, '07:00').getTime();
    if (!inWindow(at)) continue;
    push({
      dedupe_key: `morning_brief:${day}`, category: 'system', kind: 'morning_brief', system_key: 'morning_brief', ref_type: null, ref_id: null,
      fire_at: new Date(at).toISOString(), title: 'Ringkasan pagi', url: '/', actions: [],
    });
  }

  return out;
}

/** Apakah pengingat (atau penundaannya) masih relevan saat ini. */
export function stillRelevant(r: Reminder, data: Partial<ReminderData>, now: Date): boolean {
  const today = wibDate(now);
  if (!r.ref_id) return true;
  if (r.kind === 'routine' || (r.kind === 'test' && r.ref_type === 'routine')) return !routineDoneOn(D(data, 'routineLogs'), r.ref_id, today);
  if (r.kind === 'task') {
    const t = D(data, 'tasks').find((x) => x.id === r.ref_id);
    return !!t && isOpenTask(t);
  }
  if (r.kind === 'module') return !moduleStudiedOn(D(data, 'sessions'), r.ref_id, today);
  return true;
}

/** Penundaan yang jatuh tempo (≤ now, tidak lebih tua dari lookback, masih relevan). */
export function dueSnoozes(input: PlanInput): { due: Reminder[]; stale: Snooze[] } {
  const lookback = (input.lookbackMin ?? REMINDER_LOOKBACK_MIN) * MIN;
  const nowMs = input.now.getTime();
  const due: Reminder[] = [];
  const stale: Snooze[] = [];
  for (const s of input.snoozes ?? []) {
    const t = new Date(s.fire_at).getTime();
    if (t > nowMs) continue;
    if (nowMs - t >= lookback || !stillRelevant(s.base, input.data, input.now)) { stale.push(s); continue; }
    due.push({ ...s.base, dedupe_key: s.key, fire_at: s.fire_at });
  }
  return { due, stale };
}

/**
 * Rencana kirim untuk saat ini: kandidat + penundaan, lalu dedupe, toggle sistem, jam tenang (sistem saja),
 * dan batas 6 pengingat sistem per hari WIB. Urut waktu; pengguna didahulukan bila waktunya sama.
 */
export function planReminders(input: PlanInput): PlanResult {
  const { now, settings } = input;
  const snz = dueSnoozes(input);
  const all = [...dueCandidates(input), ...snz.due].sort(
    (a, b) => a.fire_at.localeCompare(b.fire_at) || (a.category === b.category ? 0 : a.category === 'user' ? -1 : 1),
  );
  const today = wibDate(now);
  const seen = new Set(input.sent.map((s) => s.dedupe_key));
  let systemToday = input.sent.filter(
    (s) => s.category === 'system' && s.status === 'sent' && s.sent_at && wibDate(new Date(s.sent_at)) === today,
  ).length;
  const quietNow = inQuietHours(wibTime(now), settings.quiet_start, settings.quiet_end);
  const res: PlanResult = { fire: [], skipped: snz.stale.map((s) => ({ reminder: { ...s.base, dedupe_key: s.key, fire_at: s.fire_at }, reason: 'stale' as const })) };
  for (const r of all) {
    if (seen.has(r.dedupe_key)) { res.skipped.push({ reminder: r, reason: 'duplicate' }); continue; }
    if (r.category === 'system') {
      if (r.system_key && settings.system_notif[r.system_key] === false) { res.skipped.push({ reminder: r, reason: 'disabled' }); continue; }
      if (quietNow || inQuietHours(wibTime(new Date(r.fire_at)), settings.quiet_start, settings.quiet_end)) {
        res.skipped.push({ reminder: r, reason: 'quiet_hours' });
        continue;
      }
      if (systemToday >= SYSTEM_NOTIF_MAX_PER_DAY) { res.skipped.push({ reminder: r, reason: 'daily_cap' }); continue; }
      systemToday++;
    }
    seen.add(r.dedupe_key);
    res.fire.push(r);
  }
  return res;
}

/** Kunci penundaan (idempoten bila tombol ditekan dua kali di menit yang sama). */
export function snoozeKey(base: Pick<Reminder, 'dedupe_key'>, action: string, fireAt: Date): string {
  return `snooze:${base.dedupe_key}:${action}:${wibTime(fireAt).replace(':', '')}`;
}
