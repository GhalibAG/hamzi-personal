// Pencarian global (SRCH-01) + filter tugas (TASK-12): pencocokan lokal atas cache data (tanpa server).
import { normName } from '@common/match.ts';
import type { Category, Course, LearningModule, Project, Routine, SourceTag, Task, Transaction, Wallet } from '@/data/types';

export type GroupKey = 'tugas' | 'proyek' | 'matkul' | 'transaksi' | 'modul' | 'rutinitas';
export const GROUP_LABEL: Record<GroupKey, string> = {
  tugas: 'Tugas', proyek: 'Proyek', matkul: 'Matkul', transaksi: 'Transaksi', modul: 'Modul', rutinitas: 'Rutinitas',
};
export const GROUP_ORDER: GroupKey[] = ['tugas', 'proyek', 'matkul', 'transaksi', 'modul', 'rutinitas'];

export interface TaskFilter {
  status: 'semua' | 'terbuka' | 'selesai';
  priority: 0 | 1 | 2 | 3 | 4;
  source: '' | SourceTag;
  project: string;
  course: string;
}
export const EMPTY_FILTER: TaskFilter = { status: 'semua', priority: 0, source: '', project: '', course: '' };

export function activeFilterCount(f: TaskFilter): number {
  return [f.status !== 'semua', f.priority !== 0, !!f.source, !!f.project, !!f.course].filter(Boolean).length;
}

export interface SearchData {
  tasks: Task[]; projects: Project[]; courses: Course[]; transactions: Transaction[]; categories: Category[];
  wallets: Wallet[]; modules: LearningModule[]; routines: Routine[];
}

/** Cocok bila semua kata kueri ada di salah satu teks (tanpa beda huruf besar/kecil & tanda baca). */
export function matcher(q: string): (...texts: (string | null | undefined)[]) => boolean {
  const words = normName(q).split(' ').filter(Boolean);
  return (...texts) => {
    if (!words.length) return true;
    const hay = normName(texts.filter(Boolean).join(' '));
    return words.every((w) => hay.includes(w));
  };
}

export interface SearchResult {
  tasks: Task[]; projects: Project[]; courses: Course[]; transactions: Transaction[]; modules: LearningModule[]; routines: Routine[];
}

export function search(q: string, d: SearchData, f: TaskFilter): SearchResult {
  const hit = matcher(q);
  const hasQ = normName(q).length > 0;
  const filtered = activeFilterCount(f) > 0;
  const cat = new Map(d.categories.map((c) => [c.id, c.name]));
  const wal = new Map(d.wallets.map((w) => [w.id, w.name]));
  const prj = new Map(d.projects.map((p) => [p.id, p.name]));
  const crs = new Map(d.courses.map((c) => [c.id, c.name]));
  const tasks = (hasQ || filtered)
    ? d.tasks.filter((t) => {
      if (t.deleted_at) return false;
      if (f.status === 'terbuka' && (t.status === 'selesai' || t.status === 'dibatalkan')) return false;
      if (f.status === 'selesai' && t.status !== 'selesai') return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.source && t.source_tag !== f.source) return false;
      if (f.project && t.project_id !== f.project) return false;
      if (f.course && t.course_id !== f.course) return false;
      return hit(t.title, t.notes, t.project_id ? prj.get(t.project_id) : null, t.course_id ? crs.get(t.course_id) : null);
    }).sort((a, b) => Number(a.status === 'selesai') - Number(b.status === 'selesai') || (a.due_at ?? '9').localeCompare(b.due_at ?? '9'))
    : [];
  if (!hasQ) return { tasks, projects: [], courses: [], transactions: [], modules: [], routines: [] };
  const digits = q.replace(/[^\d]/g, '');
  return {
    tasks,
    projects: d.projects.filter((p) => !p.deleted_at && hit(p.name, p.description)),
    courses: d.courses.filter((c) => !c.deleted_at && hit(c.name, c.code, c.lecturer, c.room)).sort((a, b) => a.name.localeCompare(b.name)),
    transactions: d.transactions
      .filter((t) => !t.deleted_at && (hit(t.note, t.category_id ? cat.get(t.category_id) : null, wal.get(t.wallet_id))
        || (digits.length >= 3 && String(t.amount) === digits)))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    modules: d.modules.filter((m) => !m.deleted_at && hit(m.title, m.category)),
    routines: d.routines.filter((r) => !r.deleted_at && hit(r.name)),
  };
}

/** Potong teks untuk sorotan: bagian yang cocok dengan salah satu kata kueri (tanpa beda huruf besar/kecil). */
export function highlightParts(text: string, q: string): { t: string; hit: boolean }[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (!words.length) return [{ t: text, hit: false }];
  const lower = text.toLowerCase();
  const marks = new Array<boolean>(text.length).fill(false);
  for (const w of words) {
    let i = lower.indexOf(w);
    while (i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = lower.indexOf(w, i + w.length); }
  }
  const out: { t: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hit === marks[i]) last.t += text[i];
    else out.push({ t: text[i], hit: marks[i] });
  }
  return out;
}
