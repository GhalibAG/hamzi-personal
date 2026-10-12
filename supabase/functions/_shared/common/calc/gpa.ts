import { ceil2, roundHalfUp2 } from './number.ts';

export type GradeScale = Record<string, number>;

export const DEFAULT_GRADE_SCALE: GradeScale = { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, D: 1, E: 0 };
export const DEFAULT_GRADE_RANGES: [string, number][] = [
  ['A', 85], ['B+', 80], ['B', 70], ['C+', 65], ['C', 55], ['D', 40], ['E', 0],
];

export interface GradedCourse { credits: number; grade: string | null | undefined }

/** Total poin (Σ bobot × SKS) dan SKS untuk matkul bernilai. */
export function points(courses: GradedCourse[], scale: GradeScale = DEFAULT_GRADE_SCALE): { points: number; credits: number } {
  let p = 0;
  let c = 0;
  for (const x of courses) {
    if (!x.grade || scale[x.grade] === undefined) continue;
    p += scale[x.grade] * x.credits;
    c += x.credits;
  }
  return { points: p, credits: c };
}

/** IPS mentah (tanpa pembulatan). 0 bila tidak ada SKS. */
export function ips(courses: GradedCourse[], scale: GradeScale = DEFAULT_GRADE_SCALE): number {
  const { points: p, credits } = points(courses, scale);
  return credits === 0 ? 0 : p / credits;
}

/** IPK dari ringkasan per semester. */
export function ipk(semesters: { points: number; credits: number }[]): number {
  const p = semesters.reduce((a, s) => a + s.points, 0);
  const c = semesters.reduce((a, s) => a + s.credits, 0);
  return c === 0 ? 0 : p / c;
}

export interface RequiredResult { value: number; display: number; unreachable: boolean }

/** Rata-rata yang dibutuhkan di SKS sisa untuk mencapai target IPK (PRD §7.2). */
export function requiredAvgForTarget(a: { creditsDone: number; pointsDone: number; creditsLeft: number; target: number }): RequiredResult {
  if (a.creditsLeft <= 0) return { value: NaN, display: NaN, unreachable: true };
  const value = (a.target * (a.creditsDone + a.creditsLeft) - a.pointsDone) / a.creditsLeft;
  return { value, display: ceil2(Math.max(0, value)), unreachable: value > 4 + 1e-9 };
}

/** IPS yang dibutuhkan di semester aktif (PRD §7.2). */
export function requiredIpsThisSemester(a: { pointsDone: number; creditsDone: number; semesterCredits: number; target: number }): RequiredResult {
  return requiredAvgForTarget({ creditsDone: a.creditsDone, pointsDone: a.pointsDone, creditsLeft: a.semesterCredits, target: a.target });
}

/** Proyeksi IPK = (poin lama + poin semester) / (SKS lama + SKS semester). */
export function projectedGpa(a: { pointsDone: number; creditsDone: number; semesterPoints: number; semesterCredits: number }): number {
  const c = a.creditsDone + a.semesterCredits;
  return c === 0 ? 0 : (a.pointsDone + a.semesterPoints) / c;
}

export interface GradeComponent { weightPct: number; score: number | null | undefined }

/** Nilai sementara dari komponen terisi + skor yang dibutuhkan pada komponen tersisa untuk target. */
export function courseProjected(components: GradeComponent[], target?: number): { current: number | null; neededOnRemaining: number | null } {
  const filled = components.filter((c) => c.score !== null && c.score !== undefined);
  const wFilled = filled.reduce((a, c) => a + c.weightPct, 0);
  const sum = filled.reduce((a, c) => a + (c.score as number) * c.weightPct, 0);
  const current = wFilled === 0 ? null : sum / wFilled;
  const wLeft = components.reduce((a, c) => a + c.weightPct, 0) - wFilled;
  let neededOnRemaining: number | null = null;
  if (target !== undefined && wLeft > 0) neededOnRemaining = (target * (wFilled + wLeft) - sum) / wLeft;
  return { current, neededOnRemaining };
}

export function scoreToGrade(score: number, ranges: [string, number][] = DEFAULT_GRADE_RANGES): string {
  for (const [g, min] of ranges) if (score >= min) return g;
  return ranges[ranges.length - 1][0];
}

/** Persen kehadiran 2 desimal. */
export function attendancePct(present: number, held: number): number {
  return held === 0 ? 100 : roundHalfUp2((present / held) * 100);
}

/** Merah bila persen < batas + 5 (PRD §7.3). */
export function attendanceWarn(present: number, held: number, minPct = 75): boolean {
  if (held === 0) return false;
  return (present / held) * 100 < minPct + 5;
}

export function formatGpa(x: number): string {
  return roundHalfUp2(x).toFixed(2).replace('.', ',');
}

/**
 * Matkul diulang → nilai terbaru menggantikan (PRD §7.1). `key` = nama matkul ternormalisasi,
 * `order` = nomor semester; untuk key yang sama dipakai baris dengan order terbesar.
 */
export function latestAttempts<T extends { key: string; order: number }>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const b = best.get(r.key);
    if (!b || r.order >= b.order) best.set(r.key, r);
  }
  return [...best.values()];
}
