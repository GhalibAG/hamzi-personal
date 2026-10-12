// MAS-02: mesin mood Hamzi (prioritas DESIGN-SYSTEM §6.4).
import { describe, expect, it } from 'vitest';
import { computeMood, type MoodInput } from '@/features/home/mood';
import type { Task } from '@/data/types';

const now = new Date('2026-10-12T09:08:00Z'); // Senin 16:08 WIB
const base: MoodInput = {
  now, reaction: null, timerRunning: false, absentDays: 0, sinceLoadMs: 60_000, tasks: [], schedules: [], courses: [], semesters: [],
  budgetTotal: 2_000_000, budgetUsedPct: 58, hideAmounts: false,
};
const task = (o: Partial<Task>): Task => ({ id: 't', title: 'Laporan', status: 'belum', priority: 3, source_tag: 'kuliah', ...o });

describe('computeMood', () => {
  it('default calm dengan ringkasan hari ini', () => {
    const m = computeMood({ ...base, tasks: [task({ priority: 2, due_at: '2026-10-12T16:59:00Z', all_day: true })] });
    expect(m.mood).toBe('calm');
    expect(m.line).toBe('Hari ini 1 tugas & 0 kelas. Mulai dari yang kecil ya!');
  });
  it('worried: tugas prioritas tinggi tenggat < 24 jam', () => {
    const m = computeMood({ ...base, tasks: [task({ due_at: '2026-10-13T02:00:00Z' })] });
    expect(m.mood).toBe('worried');
    expect(m.line).toContain('Laporan tenggatnya besok');
  });
  it('worried: anggaran ≥ 80% tanpa nominal saat disembunyikan', () => {
    expect(computeMood({ ...base, budgetUsedPct: 85 }).line).toContain('85%');
    expect(computeMood({ ...base, budgetUsedPct: 85, hideAmounts: true }).line).not.toMatch(/\d/);
  });
  it('focus saat timer berjalan mengalahkan worried', () => {
    expect(computeMood({ ...base, timerRunning: true, budgetUsedPct: 90 }).mood).toBe('focus');
  });
  it('celebrate mengalahkan semua; reaksi kedaluwarsa diabaikan', () => {
    const until = now.getTime() + 5000;
    expect(computeMood({ ...base, timerRunning: true, reaction: { mood: 'celebrate', line: 'Target 50% tercapai!', until } }).mood).toBe('celebrate');
    expect(computeMood({ ...base, reaction: { mood: 'happy', line: 'x', until: now.getTime() - 1 } }).mood).toBe('calm');
  });
  it('happy setelah centang (di bawah worried)', () => {
    const r = { mood: 'happy' as const, line: 'Satu tugas sudah beres. Mantap!', until: now.getTime() + 30_000 };
    expect(computeMood({ ...base, reaction: r }).mood).toBe('happy');
    expect(computeMood({ ...base, reaction: r, budgetUsedPct: 95 }).mood).toBe('worried');
  });
  it('sleeping saat absen ≥ 3 hari (10 dtk pertama), sleepy ≥ 23:00', () => {
    expect(computeMood({ ...base, absentDays: 3, sinceLoadMs: 2000 }).mood).toBe('sleeping');
    expect(computeMood({ ...base, absentDays: 3, sinceLoadMs: 20_000 }).mood).toBe('calm');
    expect(computeMood({ ...base, now: new Date('2026-10-12T16:30:00Z') }).mood).toBe('sleepy');
  });
});
