// Turunan Tumbuh (setara rpc_growth_overview / rpc_garden_month): pohon, level kebun, bunga, streak.
import {
  addDays, daysInMonth, fromParts, gardenLevel, hasBloom, isRoutineDue, qualifies, streak, treeStage, type DateStr, type TreeStage,
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
