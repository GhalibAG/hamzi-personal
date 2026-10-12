import { addDays, isoWeekday, type DateStr } from './date.ts';

export const TREE_THRESHOLDS = [0, 5, 15, 30, 50, 80] as const;
export const TREE_NAMES = ['Biji', 'Tunas', 'Bibit', 'Pohon muda', 'Pohon rindang', 'Pohon berbuah'] as const;
export const STUDY_WATER_MIN = 10;
export const STUDY_WATER_MAX_PER_DAY = 3;
export const TASK_WATER_MAX_PER_DAY = 3;

export interface TreeStage {
  index: number;
  name: string;
  progressPct: number;
  toNext: number;
  nextName: string | null;
}

/** Tahap pohon dari total tetes air (PRD §7.11). */
export function treeStage(water: number): TreeStage {
  let index = 0;
  TREE_THRESHOLDS.forEach((t, i) => { if (water >= t) index = i; });
  const next = index + 1 < TREE_THRESHOLDS.length ? TREE_THRESHOLDS[index + 1] : null;
  if (next === null) return { index, name: TREE_NAMES[index], progressPct: 100, toNext: 0, nextName: null };
  const base = TREE_THRESHOLDS[index];
  return {
    index,
    name: TREE_NAMES[index],
    progressPct: Math.round(((water - base) / (next - base)) * 100),
    toNext: next - water,
    nextName: TREE_NAMES[index + 1],
  };
}

/** Level kebun harian 0..3 (PRD §7.12). w = wajib terjadwal, s = terpenuhi, studyMin = total menit belajar hari itu. */
export function gardenLevel(w: number, s: number, studyMin: number): 0 | 1 | 2 | 3 {
  const studied = studyMin >= STUDY_WATER_MIN;
  if (w === 0) return studied ? 3 : 0;
  if (s <= 0) return 0;
  const r = s / w;
  if (r >= 1) return 3;
  if (r >= 0.5) return 2;
  return 1;
}

export function hasBloom(level: number, studyMin: number): boolean {
  return level === 3 && studyMin >= STUDY_WATER_MIN;
}

/** Hari memenuhi syarat streak (PRD §7.13). */
export function qualifies(level: number, studyMin: number): boolean {
  return level === 3 || studyMin >= STUDY_WATER_MIN;
}

/**
 * Streak: hari berturut-turut yang memenuhi syarat sampai kemarin, +1 bila hari ini memenuhi.
 * `isQualified(d)` mengembalikan apakah tanggal d memenuhi syarat.
 */
export function streak(today: DateStr, isQualified: (d: DateStr) => boolean, maxLookback = 400): number {
  let n = 0;
  let d = addDays(today, -1);
  for (let i = 0; i < maxLookback && isQualified(d); i++) {
    n += 1;
    d = addDays(d, -1);
  }
  return n + (isQualified(today) ? 1 : 0);
}

/** Tetes air dari sesi belajar dalam satu hari (setiap sesi ≥ 10 mnt, maks 3). */
export function waterForStudyDay(sessionMinutes: number[]): number {
  return Math.min(STUDY_WATER_MAX_PER_DAY, sessionMinutes.filter((m) => m >= STUDY_WATER_MIN).length);
}

/** Apakah rutinitas terjadwal pada tanggal d (repeatDays: 1=Senin..7=Minggu). */
export function isRoutineDue(repeatDays: number[], d: DateStr): boolean {
  return repeatDays.includes(isoWeekday(d));
}

export const REPEAT_PRESETS: Record<string, number[]> = {
  'Setiap hari': [1, 2, 3, 4, 5, 6, 7],
  'Sen–Jum': [1, 2, 3, 4, 5],
  'Akhir pekan': [6, 7],
};

export function repeatLabel(days: number[]): string {
  const key = [...days].sort().join(',');
  for (const [label, d] of Object.entries(REPEAT_PRESETS)) if (d.join(',') === key) return label;
  const names = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  return [...days].sort().map((x) => names[x]).join(', ');
}
