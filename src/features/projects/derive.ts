// Turunan Proyek (PROJ-01..03): progres tugas, teks tenggat, urutan milestone.
import { BULAN_PENDEK } from '@common/format.ts';
import type { DateStr } from '@common/calc/index.ts';
import type { Milestone, Project, Task } from '@/data/types';
import { isDone, isOverdue } from '@/features/tasks/derive';

export const KIND_LABEL: Record<Project['kind'], string> = { kuliah: 'Kuliah', pribadi: 'Pribadi', skill: 'Skill', lomba: 'Lomba' };
export const STATUS_LABEL: Record<Project['status'], string> = { aktif: 'Aktif', ditunda: 'Ditunda', selesai: 'Selesai' };
export const MS_STATUS_LABEL: Record<Milestone['status'], string> = { belum: 'Belum', berjalan: 'Berjalan', selesai: 'Selesai' };

export interface ProjectStats { total: number; done: number; pct: number; overdue: number }

const live = (t: Task) => !t.deleted_at && t.status !== 'dibatalkan';

export function projectTasks(projectId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.project_id === projectId && live(t));
}

/** "x dari y tugas · z%" + jumlah terlambat. */
export function taskStats(list: Task[], now: Date): ProjectStats {
  const total = list.length;
  const done = list.filter(isDone).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, overdue: list.filter((t) => isOverdue(t, now)).length };
}

/** "30 Nov" (+ tahun bila beda tahun dengan hari ini). */
export function shortDate(d: DateStr, today: DateStr): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${BULAN_PENDEK[m]}${d.slice(0, 4) !== today.slice(0, 4) ? ` ${y}` : ''}`;
}

/** Teks kanan kartu proyek: "N terlambat" (merah) › "Tenggat 30 Nov" › "Tanpa tenggat". */
export function projectDueText(p: Project, s: ProjectStats, today: DateStr): { text: string; danger: boolean } {
  if (s.overdue > 0) return { text: `${s.overdue} terlambat`, danger: true };
  if (p.due_date) return { text: `Tenggat ${shortDate(p.due_date, today)}`, danger: p.status !== 'selesai' && p.due_date < today };
  return { text: 'Tanpa tenggat', danger: false };
}

export function projectMilestones(projectId: string, milestones: Milestone[]): Milestone[] {
  return milestones
    .filter((m) => m.project_id === projectId && !m.deleted_at)
    .sort((a, b) => a.sort - b.sort || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}

/** Proyek urut: aktif → ditunda → selesai; dalam grup urutan dibuat (stabil, sama dengan prototipe). */
export function sortProjects(projects: Project[]): Project[] {
  const rank = { aktif: 0, ditunda: 1, selesai: 2 } as const;
  return projects
    .filter((p) => !p.deleted_at)
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}

export const NEXT_MS_STATUS: Record<Milestone['status'], Milestone['status']> = { belum: 'berjalan', berjalan: 'selesai', selesai: 'belum' };
