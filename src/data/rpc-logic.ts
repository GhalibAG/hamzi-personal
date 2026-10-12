// Emulasi RPC tulis atomik untuk MODE DEMO. Perilaku identik dengan SQL di supabase/migrations (TECH-SPEC §5.5).
import {
  addDays, isRoutineDue, levelFromXp, STUDY_WATER_MAX_PER_DAY, STUDY_WATER_MIN, TASK_WATER_MAX_PER_DAY, taskXp,
  treeStage, wibDate, weekStart, XP, gardenLevel,
} from '@common/calc/index.ts';
import type { Tables, TableName } from './types';
import { uuid } from './repo';

export type Db = { [K in TableName]: Tables[K][] } & {
  _profile: { id: string; display_name: string; onboarded_at: string | null };
  _settings: import('./types').Settings;
  _stats: { xp_total: number; level: number };
};

const ME = '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();
const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at;

function addXp(db: Db, kind: string, ref: string, day: string, xp: number) {
  if (db.xp_events.some((e) => e.kind === kind && e.ref_id === ref && e.day === day)) return;
  db.xp_events.push({ id: uuid(), kind, ref_id: ref, day, xp });
}
function delXp(db: Db, kind: string, ref: string, day: string) {
  db.xp_events = db.xp_events.filter((e) => !(e.kind === kind && e.ref_id === ref && e.day === day));
}
function addWater(db: Db, source: 'routine' | 'study' | 'task', ref: string, day: string) {
  if (db.water_events.some((w) => w.source === source && w.ref_id === ref && w.day === day)) return false;
  db.water_events.push({ id: uuid(), source, ref_id: ref, day });
  return true;
}
function delWater(db: Db, source: string, ref: string, day: string) {
  db.water_events = db.water_events.filter((w) => !(w.source === source && w.ref_id === ref && w.day === day));
}
export function recomputeStats(db: Db) {
  const xp = db.xp_events.reduce((a, e) => a + e.xp, 0);
  db._stats = { xp_total: xp, level: levelFromXp(xp) };
}

function allRequiredDone(db: Db, day: string): boolean {
  const req = db.routines.filter((r) => alive(r) && !r.archived && r.is_required && isRoutineDue(r.repeat_days, day) && (!r.created_at || wibDate(new Date(r.created_at)) <= day));
  if (req.length === 0) return false;
  return req.every((r) => db.routine_logs.some((l) => l.routine_id === r.id && l.log_date === day && l.done));
}

export function rpcRoutineSet(db: Db, a: { p_routine_id: string; p_date: string; p_value: number }) {
  const r = db.routines.find((x) => x.id === a.p_routine_id);
  if (!r) throw new Error('Rutinitas tidak ditemukan');
  const value = Math.max(0, Math.min(a.p_value, r.target_count));
  const done = value >= r.target_count;
  let log = db.routine_logs.find((l) => l.routine_id === r.id && l.log_date === a.p_date);
  const wasDone = !!log?.done;
  if (!log) {
    log = { id: uuid(), routine_id: r.id, log_date: a.p_date, value, done, updated_at: now() };
    db.routine_logs.push(log);
  } else {
    log.value = value; log.done = done; log.updated_at = now();
  }
  if (done && !wasDone) { addWater(db, 'routine', r.id, a.p_date); addXp(db, 'routine', r.id, a.p_date, XP.routine); }
  if (!done && wasDone) { delWater(db, 'routine', r.id, a.p_date); delXp(db, 'routine', r.id, a.p_date); }
  if (allRequiredDone(db, a.p_date)) addXp(db, 'all_required', ME, a.p_date, XP.allRequired);
  else delXp(db, 'all_required', ME, a.p_date);
  recomputeStats(db);
  return { done, water_total: db.water_events.length, stage: treeStage(db.water_events.length).name, all_required: allRequiredDone(db, a.p_date) };
}

export function rpcStudyFinish(db: Db, a: { p_id: string; p_started_at: string; p_duration_min: number; p_module_id?: string | null; p_unit_id?: string | null; p_source?: 'timer' | 'manual' }) {
  const day = wibDate(new Date(a.p_started_at));
  if (!db.study_sessions.some((s) => s.id === a.p_id)) {
    db.study_sessions.push({
      id: a.p_id, started_at: a.p_started_at, duration_min: Math.max(1, Math.round(a.p_duration_min)), started_on: day,
      module_id: a.p_module_id ?? null, unit_id: a.p_unit_id ?? null, source: a.p_source === 'manual' ? 'manual' : 'timer',
    });
  }
  let waterAwarded = false;
  const studyWaterToday = db.water_events.filter((w) => w.source === 'study' && w.day === day).length;
  if (a.p_duration_min >= STUDY_WATER_MIN && studyWaterToday < STUDY_WATER_MAX_PER_DAY) waterAwarded = addWater(db, 'study', a.p_id, day);
  const xpStudyToday = db.xp_events.filter((e) => e.kind === 'study' && e.day === day).reduce((s, e) => s + e.xp, 0);
  const xp = Math.min(Math.floor(a.p_duration_min / 5), XP.studyMaxPerDay - xpStudyToday);
  if (xp > 0) addXp(db, 'study', a.p_id, day, xp);
  // target mingguan
  const ws = weekStart(day);
  const weekMin = db.study_sessions.filter((s) => s.started_on >= ws && s.started_on <= addDays(ws, 6)).reduce((s, x) => s + x.duration_min, 0);
  const target = db.learning_modules.filter((m) => alive(m) && m.status === 'aktif').reduce((s, m) => s + m.weekly_target_min, 0);
  if (target > 0 && weekMin >= target) addXp(db, 'weekly_target', ME, ws, XP.weeklyTarget);
  recomputeStats(db);
  return { water_awarded: waterAwarded, water_total: db.water_events.length, stage: treeStage(db.water_events.length).name };
}

function nextDue(dueAt: string, rec: NonNullable<Tables['tasks']['recurrence']>): string {
  const d = new Date(dueAt);
  const interval = Math.max(1, rec.interval || 1);
  if (rec.freq === 'daily' || rec.freq === 'every_n_days') d.setUTCDate(d.getUTCDate() + interval);
  else if (rec.freq === 'weekly') {
    if (rec.by_day && rec.by_day.length) {
      for (let i = 1; i <= 7 * interval; i++) {
        const c = new Date(d.getTime() + i * 86_400_000);
        const wd = ((c.getUTCDay() + 6) % 7) + 1;
        if (rec.by_day.includes(wd)) return c.toISOString();
      }
    }
    d.setUTCDate(d.getUTCDate() + 7 * interval);
  } else if (rec.freq === 'monthly') d.setUTCMonth(d.getUTCMonth() + interval);
  return d.toISOString();
}

export function rpcTaskSetDone(db: Db, a: { p_task_id: string; p_done: boolean }) {
  const t = db.tasks.find((x) => x.id === a.p_task_id);
  if (!t) throw new Error('Tugas tidak ditemukan');
  const day = wibDate();
  const was = t.status === 'selesai';
  t.status = a.p_done ? 'selesai' : 'belum';
  t.completed_at = a.p_done ? now() : null;
  t.updated_at = now();
  if (a.p_done && !was) {
    addXp(db, 'task', t.id, day, taskXp(t.priority));
    if (db._settings.water_from_tasks && db.water_events.filter((w) => w.source === 'task' && w.day === day).length < TASK_WATER_MAX_PER_DAY) addWater(db, 'task', t.id, day);
    if (t.recurrence && t.due_at && !db.tasks.some((x) => x.recurrence_parent_id === t.id && alive(x))) {
      db.tasks.push({ ...t, id: uuid(), status: 'belum', completed_at: null, due_at: nextDue(t.due_at, t.recurrence), recurrence_parent_id: t.id, created_at: now(), updated_at: now() });
    }
  }
  if (!a.p_done && was) {
    db.xp_events = db.xp_events.filter((e) => !(e.kind === 'task' && e.ref_id === t.id));
    db.water_events = db.water_events.filter((w) => !(w.source === 'task' && w.ref_id === t.id));
  }
  recomputeStats(db);
  return { done: a.p_done, xp: taskXp(t.priority) };
}

export function rpcUnitSetStatus(db: Db, a: { p_unit_id: string; p_status: 'belum' | 'sedang' | 'selesai' }) {
  const u = db.learning_units.find((x) => x.id === a.p_unit_id);
  if (!u) throw new Error('Unit tidak ditemukan');
  u.status = a.p_status;
  u.completed_at = a.p_status === 'selesai' ? now() : null;
  return { ok: true };
}

export function rpcAttendanceMark(db: Db, a: { p_course_id: string; p_date: string; p_status: 'hadir' | 'izin' | 'sakit' | 'alpa'; p_note?: string | null }) {
  let r = db.attendances.find((x) => x.course_id === a.p_course_id && x.meeting_date === a.p_date);
  if (!r) { r = { id: uuid(), course_id: a.p_course_id, meeting_date: a.p_date, status: a.p_status, note: a.p_note ?? null }; db.attendances.push(r); }
  else { r.status = a.p_status; if (a.p_note !== undefined) r.note = a.p_note; }
  return { ok: true };
}

/** XP transaksi (+2, maks 3/hari) — di Supabase dilakukan trigger. */
export function onTransactionInserted(db: Db, tx: Tables['transactions']) {
  if (tx.kind !== 'expense' && tx.kind !== 'income') return;
  const n = db.xp_events.filter((e) => e.kind === 'tx' && e.day === tx.occurred_on).length;
  if (n < XP.transactionMaxPerDay) addXp(db, 'tx', tx.id, tx.occurred_on, XP.transaction);
  recomputeStats(db);
}

export { gardenLevel };
