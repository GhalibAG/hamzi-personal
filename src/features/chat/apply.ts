// Penerapan kartu aksi di klien (TECH-SPEC §7.8.6). Data hanya dibuat SETELAH pengguna menekan konfirmasi.
// Bentuk baris = sama dengan input manual (tugas, rutinitas, modul+unit, transaksi, ujian, jadwal, event, setoran).
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { wibDate, wibTime, wibToInstant, type DateStr } from '@common/calc/index.ts';
import { matchName } from '@common/match.ts';
import { repeatDaysFromArg } from '@common/proposal-format.ts';
import {
  proposeClassSchedule, proposeEvent, proposeExam, proposeGoalContribution, proposeLearningModule, proposeRoutine,
  proposeTask, proposeTransaction, type ProposalItem,
} from '@common/schemas.ts';
import type { z } from 'zod';
import { repo } from '@/data';
import { qk } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type {
  AiAction, AiMessage, Category, Course, LearningModule, Project, Routine, SavingsGoal, Semester, TableName, Tables, Wallet,
} from '@/data/types';
import { activeSemester } from '@/features/courses/derive';
import { proposalDest, validateArgs } from './proposals';
import { UNDO_WINDOW_MS, type AppliedRef } from './types';

export interface ApplyData {
  today: DateStr;
  /** Jam WIB sekarang 'HH:MM' (default waktu transaksi). */
  now: string;
  courses: Course[];
  semesters: Semester[];
  categories: Category[];
  wallets: Wallet[];
  goals: SavingsGoal[];
  projects: Project[];
  routines: Routine[];
  modules: LearningModule[];
}

export type Write = { [K in TableName]: { table: K; row: Partial<Tables[K]> & { id: string } } }[TableName];
export interface ItemPlan { item: number; writes: Write[] }
export interface ApplyPlan { steps: ItemPlan[]; skipped: { item: number; reason: string }[] }

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at;
const iso = (d: DateStr, t: string) => wibToInstant(d, t).toISOString();

/** Petakan item terpilih → baris yang akan ditulis. Murni (id dari `genId`). */
export function buildApplyPlan(items: ProposalItem[], selected: number[], data: ApplyData, genId: () => string = uuid): ApplyPlan {
  const steps: ItemPlan[] = [];
  const skipped: ApplyPlan['skipped'] = [];
  const sem = activeSemester(data.semesters.filter(alive));
  const courses = data.courses.filter(alive).filter((c) => !sem || c.semester_id === sem.id);
  const newCourses = new Map<string, Course>();
  let routineSort = data.routines.reduce((m, r) => Math.max(m, r.sort), -1);
  let moduleSort = data.modules.reduce((m, r) => Math.max(m, r.sort), -1);
  let moduleCount = data.modules.filter(alive).length;
  const wallets = data.wallets.filter((w) => alive(w) && !w.archived);
  const wallet = wallets.find((w) => w.is_default) ?? wallets[0];

  const findCourse = (name: string): Course | null => matchName(name, [...courses, ...newCourses.values()]);
  /** Matkul cocok, atau dibuat baru di semester aktif (untuk ujian/jadwal). */
  const ensureCourse = (name: string, credits: number | undefined, writes: Write[]): Course | null => {
    const hit = findCourse(name);
    if (hit) return hit;
    if (!sem) return null;
    const c: Course = {
      id: genId(), semester_id: sem.id, code: null, name, credits: credits ?? 3, lecturer: null, room: null, color: null,
      target_grade: null, min_attendance_pct: 75, final_grade: null, sim_grade: null,
    };
    newCourses.set(c.id, c);
    writes.push({ table: 'courses', row: c });
    return c;
  };

  for (const idx of [...new Set(selected)].sort((a, b) => a - b)) {
    const it = items[idx];
    if (!it) continue;
    const args = validateArgs(it.tool, it.args);
    if (!args) { skipped.push({ item: idx, reason: 'Data usulan tidak valid' }); continue; }
    const writes: Write[] = [];
    switch (it.tool) {
      case 'propose_task': {
        const a = args as z.infer<typeof proposeTask>;
        const course = a.course_name ? findCourse(a.course_name) : null;
        const project = a.project_name ? matchName(a.project_name, data.projects.filter(alive)) : null;
        writes.push({
          table: 'tasks',
          row: {
            id: genId(), title: a.title, notes: a.notes ?? null, status: 'belum', priority: a.priority ?? 2,
            source_tag: course ? 'kuliah' : project ? 'proyek' : 'pribadi',
            due_at: a.due_date ? iso(a.due_date, a.due_time ?? '23:59') : null,
            all_day: !!a.due_date && !a.due_time,
            project_id: project?.id ?? null, milestone_id: null, course_id: course?.id ?? null, course_task_kind: null,
            weight_pct: a.weight_pct ?? null, estimate_min: null, recurrence: null, recurrence_parent_id: null,
            remind_offsets: [60], completed_at: null,
          },
        });
        break;
      }
      case 'propose_routine': {
        const a = args as z.infer<typeof proposeRoutine>;
        writes.push({
          table: 'routines',
          row: {
            id: genId(), name: a.name, kind: a.kind, target_count: a.kind === 'count' ? (a.target_count ?? 1) : 1,
            is_required: a.is_required ?? true, repeat_days: repeatDaysFromArg(a.repeat), remind_at: a.remind_at ?? '07:00',
            remind_enabled: true, icon: null, color: null, sort: ++routineSort, archived: false,
          },
        });
        break;
      }
      case 'propose_learning_module': {
        const a = args as z.infer<typeof proposeLearningModule>;
        const id = genId();
        writes.push({
          table: 'learning_modules',
          row: {
            id, title: a.title, category: a.category ?? 'lainnya', color_index: moduleCount++ % 5, weekly_target_min: 120,
            remind_at: a.remind_at ?? null, remind_days: a.remind_days ?? [1, 2, 3, 4, 5, 6, 7], remind_enabled: !!a.remind_at,
            status: 'aktif', template_key: null, sort: ++moduleSort,
          },
        });
        const titles = a.unit_titles?.length ? a.unit_titles : Array.from({ length: a.unit_count ?? 10 }, (_, i) => `Unit ${i + 1}`);
        titles.forEach((title, i) => writes.push({
          table: 'learning_units',
          row: { id: genId(), module_id: id, title, kind: 'bacaan', url: null, est_min: 30, status: 'belum', notes: null, completed_at: null, sort: i },
        }));
        break;
      }
      case 'propose_transaction': {
        const a = args as z.infer<typeof proposeTransaction>;
        if (!wallet) { skipped.push({ item: idx, reason: 'Belum ada dompet' }); continue; }
        const cats = data.categories.filter((c) => alive(c) && !c.archived && c.kind === a.kind);
        const cat = matchName(a.category_name, cats) ?? matchName('Lainnya', cats);
        const date = a.date ?? data.today;
        const at = iso(date, a.time ?? (date === data.today ? data.now : '12:00'));
        writes.push({
          table: 'transactions',
          row: {
            id: genId(), kind: a.kind, amount: a.amount, direction: 1, wallet_id: wallet.id, to_wallet_id: null,
            category_id: cat?.id ?? null, occurred_at: at, occurred_on: date, note: a.note ?? null, recurring_rule_id: null,
          },
        });
        break;
      }
      case 'propose_exam': {
        const a = args as z.infer<typeof proposeExam>;
        const course = ensureCourse(a.course_name, undefined, writes);
        if (!course) { skipped.push({ item: idx, reason: 'Belum ada semester aktif' }); continue; }
        writes.push({
          table: 'exams',
          row: { id: genId(), course_id: course.id, kind: a.kind, starts_at: iso(a.date, a.time ?? '08:00'), material: a.material ?? null, room: null, prep_status: 'belum' },
        });
        break;
      }
      case 'propose_class_schedule': {
        const a = args as z.infer<typeof proposeClassSchedule>;
        const course = ensureCourse(a.course_name, a.credits, writes);
        if (!course) { skipped.push({ item: idx, reason: 'Belum ada semester aktif' }); continue; }
        writes.push({
          table: 'course_schedules',
          row: { id: genId(), course_id: course.id, weekday: a.weekday, start_time: a.start, end_time: a.end, room: a.room ?? null },
        });
        break;
      }
      case 'propose_event': {
        const a = args as z.infer<typeof proposeEvent>;
        const allDay = a.all_day ?? !a.start_time;
        writes.push({
          table: 'events',
          row: {
            id: genId(), title: a.title, starts_at: iso(a.date, a.start_time ?? '00:00'),
            ends_at: a.end_time ? iso(a.date, a.end_time) : null, all_day: allDay, notes: null,
          },
        });
        break;
      }
      case 'propose_goal_contribution': {
        const a = args as z.infer<typeof proposeGoalContribution>;
        const goal = matchName(a.goal_name, data.goals.filter((g) => alive(g) && g.status === 'aktif'));
        if (!goal) { skipped.push({ item: idx, reason: 'perlu dipilih' }); continue; }
        writes.push({ table: 'goal_contributions', row: { id: genId(), goal_id: goal.id, amount: a.amount, contributed_at: a.date ?? data.today, note: null } });
        break;
      }
    }
    if (writes.length) steps.push({ item: idx, writes });
  }
  return { steps, skipped };
}

/** Tabel yang perlu disegarkan setelah tulis (termasuk efek samping XP). */
function touched(tables: string[]): TableName[] {
  const set = new Set(tables as TableName[]);
  if (set.has('transactions') || set.has('goal_contributions')) set.add('xp_events');
  set.add('ai_actions');
  return [...set];
}

async function invalidate(qc: QueryClient, tables: string[]) {
  const list = touched(tables);
  await Promise.all(list.map((t) => qc.invalidateQueries({ queryKey: qk.table(t) })));
  if (list.includes('xp_events')) void qc.invalidateQueries({ queryKey: qk.stats });
}

/** Apakah Urungkan masih boleh (≤ 24 jam sejak diterapkan). */
export function canUndo(action: Pick<AiAction, 'state' | 'updated_at' | 'created_at'> | undefined, now = Date.now()): boolean {
  if (!action || action.state !== 'applied') return false;
  const at = Date.parse(action.updated_at ?? action.created_at ?? '');
  return Number.isFinite(at) && now - at < UNDO_WINDOW_MS;
}

/** Indeks item yang sudah diterapkan (dari applied_refs). */
export function appliedItems(action: AiAction | undefined): number[] {
  const refs = (action?.applied_refs ?? []) as Partial<AppliedRef>[];
  return [...new Set(refs.map((r) => r.item).filter((x): x is number => typeof x === 'number'))].sort((a, b) => a - b);
}

const LOAD: TableName[] = ['courses', 'semesters', 'categories', 'wallets', 'savings_goals', 'projects', 'routines', 'learning_modules'];

export interface ApplyResult { count: number; dest: string; skipped: { item: number; reason: string }[] }

export function useProposalActions() {
  const qc = useQueryClient();

  async function load(): Promise<ApplyData> {
    const rows = await Promise.all(LOAD.map((t) => qc.ensureQueryData({ queryKey: qk.table(t), queryFn: () => repo.list(t) })));
    const [courses, semesters, categories, wallets, goals, projects, routines, modules] = rows as [
      Course[], Semester[], Category[], Wallet[], SavingsGoal[], Project[], Routine[], LearningModule[],
    ];
    const now = new Date();
    return { today: wibDate(now), now: wibTime(now), courses, semesters, categories, wallets, goals, projects, routines, modules };
  }

  async function setState(message: AiMessage, action: AiAction | undefined, patch: Pick<AiAction, 'state' | 'applied_refs'>) {
    const stamp = new Date().toISOString();
    if (action) await repo.update('ai_actions', action.id, { ...patch, updated_at: stamp });
    else await repo.upsert('ai_actions', { id: uuid(), message_id: message.id, ...patch, created_at: stamp, updated_at: stamp });
  }

  /** Terapkan item terpilih. Gagal di tengah → yang sudah tertulis dihapus lagi (tidak ada data setengah jadi). */
  async function apply(message: AiMessage, action: AiAction | undefined, selected: number[]): Promise<ApplyResult> {
    const items = message.proposals?.items ?? [];
    const plan = buildApplyPlan(items, selected, await load());
    const refs: AppliedRef[] = [];
    try {
      for (const step of plan.steps) {
        for (const w of step.writes) {
          await repo.upsert(w.table, w.row as Partial<Tables[typeof w.table]>);
          refs.push({ table: w.table, id: w.row.id, item: step.item });
        }
      }
      if (refs.length) await setState(message, action, { state: 'applied', applied_refs: refs });
    } catch (e) {
      for (const r of [...refs].reverse()) {
        try { await repo.remove(r.table as TableName, r.id, { hard: true }); } catch { /* lanjut */ }
      }
      await invalidate(qc, refs.map((r) => r.table));
      throw e;
    }
    await invalidate(qc, refs.map((r) => r.table));
    const done = plan.steps.map((s) => items[s.item]).filter(Boolean);
    return { count: plan.steps.length, dest: proposalDest(done), skipped: plan.skipped };
  }

  /** Urungkan (≤ 24 jam): hapus semua data yang dibuat kartu ini (soft delete bila tabel mendukung). */
  async function undo(message: AiMessage, action: AiAction) {
    const refs = (action.applied_refs ?? []) as AppliedRef[];
    for (const r of [...refs].reverse()) await repo.remove(r.table as TableName, r.id);
    await setState(message, action, { state: 'undone', applied_refs: refs });
    await invalidate(qc, refs.map((r) => r.table));
  }

  async function cancel(message: AiMessage, action: AiAction | undefined) {
    await setState(message, action, { state: 'cancelled', applied_refs: [] });
    await invalidate(qc, []);
  }

  return { apply, undo, cancel };
}
