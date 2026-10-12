// Turunan Tumbuh (setara rpc_growth_overview / rpc_garden_month): pohon, level kebun, bunga, streak.
import {
  addDays, daysInMonth, fromParts, gardenLevel, hasBloom, isRoutineDue, qualifies, streak, treeStage, weekStart,
  STUDY_WATER_MAX_PER_DAY, STUDY_WATER_MIN, type DateStr, type TreeStage,
} from '@common/calc/index.ts';
import type { Routine, RoutineLog, StudySession, WaterEvent } from '@/data/types';

export interface DayGrowth { day: DateStr; due: number; done: number; studyMin: number; level: 0 | 1 | 2 | 3; bloom: boolean; qualifies: boolean }

export interface GrowthIndex {
  dayInfo: (d: DateStr) => DayGrowth;
}

/** Indeks cepat log & sesi per hari. Rutinitas wajib yang aktif (tidak diarsip) dipakai untuk W. */
export function buildGrowthIndex(routines: Routine[], logs: RoutineLog[], sessions: StudySession[]): GrowthIndex {
  const required = routines.filter((r) => r.is_required && !r.archived && !r.deleted_at);
  const doneSet = new Set(logs.filter((l) => l.done).map((l) => `${l.routine_id}|${l.log_date}`));
  const studyByDay = new Map<string, number>();
  for (const s of sessions) studyByDay.set(s.started_on, (studyByDay.get(s.started_on) ?? 0) + s.duration_min);
  const created = (r: Routine) => (r.created_at ? r.created_at.slice(0, 10) : '0000-00-00');
  const cache = new Map<string, DayGrowth>();
  return {
    dayInfo(d) {
      const hit = cache.get(d);
      if (hit) return hit;
      const due = required.filter((r) => isRoutineDue(r.repeat_days, d) && created(r) <= d);
      const done = due.filter((r) => doneSet.has(`${r.id}|${d}`)).length;
      const studyMin = studyByDay.get(d) ?? 0;
      const level = gardenLevel(due.length, done, studyMin);
      const info: DayGrowth = { day: d, due: due.length, done, studyMin, level, bloom: hasBloom(level, studyMin), qualifies: qualifies(level, studyMin) };
      cache.set(d, info);
      return info;
    },
  };
}

export interface GrowthOverview {
  waterTotal: number;
  stage: TreeStage;
  today: DayGrowth;
  streak: number;
  /** Rutinitas wajib terjadwal hari ini (urut jam pengingat). */
  requiredToday: Routine[];
  /** Rutinitas tidak wajib terjadwal hari ini. */
  othersToday: Routine[];
  logToday: (routineId: string) => RoutineLog | undefined;
}

export function growthOverview(a: { routines: Routine[]; logs: RoutineLog[]; sessions: StudySession[]; water: WaterEvent[]; today: DateStr }): GrowthOverview {
  const idx = buildGrowthIndex(a.routines, a.logs, a.sessions);
  const active = a.routines.filter((r) => !r.archived && !r.deleted_at);
  const byTime = (x: Routine, y: Routine) => (x.remind_at ?? '99').localeCompare(y.remind_at ?? '99') || x.sort - y.sort;
  const scheduled = active.filter((r) => isRoutineDue(r.repeat_days, a.today)).sort(byTime);
  const logMap = new Map(a.logs.filter((l) => l.log_date === a.today).map((l) => [l.routine_id, l]));
  return {
    waterTotal: a.water.length,
    stage: treeStage(a.water.length),
    today: idx.dayInfo(a.today),
    streak: streak(a.today, (d) => idx.dayInfo(d).qualifies),
    requiredToday: scheduled.filter((r) => r.is_required),
    othersToday: scheduled.filter((r) => !r.is_required),
    logToday: (id) => logMap.get(id),
  };
}

/** Kebun satu bulan (rpc_garden_month): level −1 untuk hari setelah hari ini. */
export function gardenMonth(idx: GrowthIndex, year: number, month: number, today: DateStr) {
  const n = daysInMonth(year, month);
  const days = Array.from({ length: n }, (_, i) => {
    const d = fromParts(year, month, i + 1);
    if (d > today) return { day: d, n: i + 1, level: -1, bloom: false, info: null as DayGrowth | null };
    const info = idx.dayInfo(d);
    return { day: d, n: i + 1, level: info.level as number, bloom: info.bloom, info };
  });
  return { days, treeCount: days.filter((x) => x.level === 3).length };
}

export { addDays };

/* ---------- Tambahan: detail hari kebun, statistik belajar, streak & heatmap per rutinitas ---------- */

const GARDEN_LEVEL_TEXT: Record<number, string> = {
  0: 'Tidak ada rutinitas tercatat. Tidak apa-apa, besok mulai lagi.',
  1: 'Sebagian kecil rutinitas selesai, jadi tunas.',
  2: 'Lebih dari separuh rutinitas selesai, jadi bibit.',
  3: 'Semua rutinitas wajib selesai, jadi satu pohon di kebun.',
};

/** Kalimat kartu detail hari kebun (PRD §7.12, logika prototipe Belajar.dc.html). `info` null = hari depan. */
export function gardenDayText(info: DayGrowth | null, isToday: boolean): string {
  if (!info) return 'Belum terjadi. Rutinitas wajib akan diingatkan sesuai jamnya.';
  const studied = info.studyMin >= STUDY_WATER_MIN;
  const base = info.due === 0 && info.level === 3
    ? 'Tidak ada rutinitas wajib, tapi ada sesi belajar, jadi satu pohon di kebun.'
    : GARDEN_LEVEL_TEXT[info.level];
  if (isToday) return `Hari ini: ${info.done} dari ${info.due} rutinitas wajib${studied ? ', plus sesi belajar. ' : '. '}${base}`;
  return base + (info.bloom ? ' Ada sesi belajar mandiri, jadi berbunga.' : '');
}

/** Total menit belajar pada rentang tanggal [from, to] (inklusif), opsional untuk satu modul. */
export function studyMinutes(sessions: StudySession[], from: DateStr, to: DateStr, moduleId?: string): number {
  return sessions
    .filter((s) => s.started_on >= from && s.started_on <= to && (moduleId === undefined || s.module_id === moduleId))
    .reduce((a, s) => a + s.duration_min, 0);
}

/** Statistik minggu ini (BEL-07): menit modul & total vs target mingguan. Minggu = Senin–Minggu WIB. */
export function weekStudy(a: { sessions: StudySession[]; today: DateStr; moduleId: string; moduleTarget: number; allTargets: number }) {
  const from = weekStart(a.today);
  const to = addDays(from, 6);
  const moduleMin = studyMinutes(a.sessions, from, to, a.moduleId);
  const totalMin = studyMinutes(a.sessions, from, to);
  const pct = (v: number, t: number) => (t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0);
  return { from, to, moduleMin, totalMin, modulePct: pct(moduleMin, a.moduleTarget), totalPct: pct(totalMin, a.allTargets) };
}

/** Apakah ada sesi belajar hari ini untuk modul tertentu. */
export function studiedOn(sessions: StudySession[], day: DateStr, moduleId: string): boolean {
  return sessions.some((s) => s.started_on === day && s.module_id === moduleId);
}

/** Jumlah tetes air dari sesi belajar pada hari tertentu (TUM-02, maks STUDY_WATER_MAX_PER_DAY). */
export function studyWaterOn(water: WaterEvent[], day: DateStr): number {
  return water.filter((w) => w.source === 'study' && w.day === day).length;
}

/** Perkiraan apakah sesi berdurasi `minutes` hari ini akan memberi tetes air (TUM-02). */
export function sessionEarnsWater(minutes: number, water: WaterEvent[], day: DateStr): boolean {
  return minutes >= STUDY_WATER_MIN && studyWaterOn(water, day) < STUDY_WATER_MAX_PER_DAY;
}

const createdDay = (r: Routine) => (r.created_at ? r.created_at.slice(0, 10) : '0000-00-00');

/**
 * Streak per rutinitas (RUT-06): hari terjadwal berturut-turut yang selesai sampai kemarin, +1 bila hari ini selesai.
 * Hari yang tidak terjadwal dilewati (tidak memutus). Hari ini yang belum selesai tidak memutus streak.
 */
export function routineStreak(r: Routine, logs: RoutineLog[], today: DateStr, maxLookback = 400): number {
  const done = new Set(logs.filter((l) => l.routine_id === r.id && l.done).map((l) => l.log_date));
  const start = createdDay(r);
  let n = 0;
  let d = addDays(today, -1);
  for (let i = 0; i < maxLookback && d >= start; i++, d = addDays(d, -1)) {
    if (!isRoutineDue(r.repeat_days, d)) continue;
    if (!done.has(d)) break;
    n += 1;
  }
  return n + (done.has(today) ? 1 : 0);
}

export type HeatState = 'done' | 'partial' | 'missed' | 'off' | 'future';
export interface HeatCell { day: DateStr; state: HeatState; value: number }

/** Heatmap N minggu (kolom = minggu Senin–Minggu, baris = hari) untuk satu rutinitas (RUT-06). */
export function routineHeatmap(r: Routine, logs: RoutineLog[], today: DateStr, weeks = 12) {
  const byDay = new Map(logs.filter((l) => l.routine_id === r.id).map((l) => [l.log_date, l]));
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const start = createdDay(r);
  let doneCount = 0;
  let dueCount = 0;
  const cols = Array.from({ length: weeks }, (_, w) => {
    const ws = addDays(first, w * 7);
    const days: HeatCell[] = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(ws, i);
      const log = byDay.get(day);
      if (day > today) return { day, state: 'future', value: 0 };
      if (!isRoutineDue(r.repeat_days, day) || day < start) return { day, state: log?.done ? 'done' : 'off', value: log?.value ?? 0 };
      dueCount += 1;
      if (log?.done) { doneCount += 1; return { day, state: 'done', value: log.value }; }
      if (log && log.value > 0) return { day, state: 'partial', value: log.value };
      return { day, state: 'missed', value: 0 };
    });
    return { start: ws, days };
  });
  return { cols, doneCount, dueCount };
}
