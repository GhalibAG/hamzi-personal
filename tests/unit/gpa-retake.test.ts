// PRD §7.1: matkul diulang → nilai terbaru menggantikan (IPK & proyeksi).
import { describe, expect, it } from 'vitest';
import { latestAttempts, roundHalfUp2 } from '@common/calc/index.ts';
import { gpaSummary } from '@/features/courses/derive';
import type { Course, Semester } from '@/data/types';

const sem = (id: string, number: number, active = false): Semester => ({ id, number, label: `S${number}`, start_date: '2026-01-01', end_date: '2026-06-01', is_active: active });
const course = (id: string, semester_id: string, name: string, credits: number, final_grade: string | null, sim_grade: string | null = null): Course =>
  ({ id, semester_id, name, credits, final_grade, sim_grade, min_attendance_pct: 75 });

describe('latestAttempts', () => {
  it('memakai percobaan dengan order terbesar per key', () => {
    const r = latestAttempts([{ key: 'a', order: 1, g: 'C' }, { key: 'a', order: 3, g: 'A' }, { key: 'b', order: 2, g: 'B' }]);
    expect(r.map((x) => x.g).sort()).toEqual(['A', 'B']);
  });
});

describe('gpaSummary dengan matkul diulang', () => {
  const semesters = [sem('s1', 1), sem('s2', 2), sem('s3', 3, true)];
  it('IPK memakai nilai terbaru (C di S1 diganti B di S2)', () => {
    const courses = [
      course('c1', 's1', 'Kalkulus', 3, 'C'), course('c2', 's1', 'Fisika', 3, 'A'),
      course('c3', 's2', 'kalkulus ', 3, 'B'),
    ];
    const g = gpaSummary({ semesters, courses, attendances: [], scale: { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, D: 1, E: 0 }, curriculum: 144, target: null });
    expect(g.creditsPassed).toBe(6);
    expect(roundHalfUp2(g.ipk ?? 0)).toBe(3.5);
  });
  it('proyeksi tidak menghitung nilai lama matkul yang sedang diulang', () => {
    const courses = [course('c1', 's1', 'Kalkulus', 3, 'C'), course('c2', 's1', 'Fisika', 3, 'A'), course('c4', 's3', 'Kalkulus', 3, null, 'A')];
    const g = gpaSummary({ semesters, courses, attendances: [], scale: { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, D: 1, E: 0 }, curriculum: 144, target: 3.9 });
    expect(roundHalfUp2(g.ipk ?? 0)).toBe(3);
    expect(g.projected).toBe(4);
    expect(g.required?.display).toBe(3.8);
  });
});
