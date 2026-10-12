// Payload agregat untuk ringkasan (TECH-SPEC §7.2) — versi klien untuk MODE DEMO & cadangan templat.
// Edge Function `ai-generate` membangun payload yang sama dari RPC SQL. Hanya agregat + allowlist ai_share.
import { addDays, isoWeekday, wibDate, wibMinutes, weekStart, type DateStr } from '@common/calc/index.ts';
import { HARI } from '@common/format.ts';
import { partOfDay } from '@common/lines.id.ts';
import { redact } from '@common/sensitive.ts';
import type { Settings, Tables } from '@/data/types';
import { financeSummary } from '@/features/finance/derive';
import { growthOverview } from '@/features/growth/derive';
import { activeSemester, classesOn, upcomingExams, EXAM_LABEL } from '@/features/courses/derive';
import { dueDay, dueLabel, isDone, isOpen, isOverdue, rankTasks } from '@/features/tasks/derive';
import { goalView } from '@/features/goals/derive';

export type TablesData = { [K in keyof Tables]: Tables[K][] };

const PRIO = ['', 'rendah', 'sedang', 'tinggi', 'kritis'];

export interface DailyPayload {
  schema_version: 2; kind: 'daily_summary'; date: DateStr; weekday: string; part_of_day: string;
  tasks?: { due_today: number; overdue: number; done_today: number; top: { label: string; priority: string; due: string; est_min: number | null }[] };
  schedule?: { classes_today: { name: string; start: string }[]; exams_next_7d: { kind: string; course: string; in_days: number }[] };
  routines?: { required_due: number; required_done: number; garden_level: number; streak_days: number; tree_stage: string };
  learning?: { minutes_today: number; weekly_target_min: number; weekly_done_min: number };
  finance?: { amounts_included: boolean; spent_today?: number; pct_vs_avg_7d: number | null; budget_used_pct: number; safe_daily?: number; top_category_today: string | null };
  goals?: { kind: string; progress_pct: number; on_track: boolean | null }[];
}

export function buildDailyPayload(t: TablesData, s: Settings, now: Date = new Date()): DailyPayload {
  const today = wibDate(now);
  const share = s.ai_share;
  const p: DailyPayload = { schema_version: 2, kind: 'daily_summary', date: today, weekday: HARI[isoWeekday(today)], part_of_day: partOfDay(wibMinutes(now)) };
  if (share.tasks) {
    const ranked = rankTasks(t.tasks, now).slice(0, 3);
    p.tasks = {
      due_today: t.tasks.filter((x) => isOpen(x) && dueDay(x) === today).length,
      overdue: t.tasks.filter((x) => isOverdue(x, now)).length,
      done_today: t.tasks.filter((x) => isDone(x) && x.completed_at && wibDate(new Date(x.completed_at)) === today).length,
      top: ranked.map((x, i) => ({
        label: share.task_titles ? redact(x.title) : `Tugas ${String.fromCharCode(65 + i)}`,
        priority: PRIO[x.priority], due: dueLabel(x, today).toLowerCase(), est_min: x.estimate_min ?? null,
      })),
    };
  }
  if (share.courses) {
    const sem = activeSemester(t.semesters);
    p.schedule = {
      classes_today: classesOn(today, t.course_schedules, t.courses, sem?.id).map((c) => ({ name: c.course.name, start: c.start })),
      exams_next_7d: upcomingExams(t.exams, today, 7).map((e) => ({
        kind: (EXAM_LABEL[e.exam.kind] ?? e.exam.kind).toLowerCase(), course: t.courses.find((c) => c.id === e.exam.course_id)?.name ?? 'Matkul', in_days: e.inDays,
      })),
    };
  }
  const g = growthOverview({ routines: t.routines, logs: t.routine_logs, sessions: t.study_sessions, water: t.water_events, today });
  if (share.routines) {
    p.routines = { required_due: g.today.due, required_done: g.today.done, garden_level: g.today.level, streak_days: g.streak, tree_stage: g.stage.name };
  }
  if (share.learning) {
    const ws = weekStart(today);
    const weekMin = t.study_sessions.filter((x) => x.started_on >= ws && x.started_on <= addDays(ws, 6)).reduce((a, x) => a + x.duration_min, 0);
    p.learning = {
      minutes_today: g.today.studyMin,
      weekly_target_min: t.learning_modules.filter((m) => m.status === 'aktif' && !m.deleted_at).reduce((a, m) => a + m.weekly_target_min, 0),
      weekly_done_min: weekMin,
    };
  }
  if (share.finance) {
    const f = financeSummary({ transactions: t.transactions, wallets: t.wallets, budgets: t.budgets, categories: t.categories, cycleDay: s.budget_cycle_day, today });
    const topToday = f.todayTx.filter((x) => x.kind === 'expense').reduce<Record<string, number>>((acc, x) => {
      const n = t.categories.find((c) => c.id === x.category_id)?.name ?? 'Lainnya';
      acc[n] = (acc[n] ?? 0) + x.amount;
      return acc;
    }, {});
    const top = Object.entries(topToday).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    p.finance = {
      amounts_included: !!share.finance_amounts, pct_vs_avg_7d: f.pctVsAvg, budget_used_pct: f.budgetUsedPct, top_category_today: top,
      ...(share.finance_amounts ? { spent_today: f.spentToday, safe_daily: f.safeDaily } : {}),
    };
  }
  if (share.goals) {
    p.goals = t.savings_goals.filter((x) => x.status === 'aktif' && !x.deleted_at).map((x) => {
      const v = goalView(x, t.goal_contributions, today);
      return { kind: x.kind, progress_pct: v.pct, on_track: v.onTrack };
    });
  }
  return p;
}

export interface WeekPayload {
  schema_version: 2; kind: 'weekly_review'; week_start: DateStr;
  tasks: { done: number; overdue: number };
  learning: { minutes: number; target: number };
  garden_trees: number;
  finance?: { spent?: number; top_category: string | null; budget_used_pct: number };
  attendance_pct: number | null;
}

export function buildWeekPayload(t: TablesData, s: Settings, now: Date = new Date()): WeekPayload {
  const today = wibDate(now);
  const ws = weekStart(today);
  const we = addDays(ws, 6);
  const inWeek = (d: string | null | undefined) => !!d && d >= ws && d <= we;
  const done = t.tasks.filter((x) => isDone(x) && x.completed_at && inWeek(wibDate(new Date(x.completed_at)))).length;
  const overdue = t.tasks.filter((x) => isOverdue(x, now)).length;
  const minutes = t.study_sessions.filter((x) => inWeek(x.started_on)).reduce((a, x) => a + x.duration_min, 0);
  const target = t.learning_modules.filter((m) => m.status === 'aktif' && !m.deleted_at).reduce((a, m) => a + m.weekly_target_min, 0);
  const f = financeSummary({ transactions: t.transactions, wallets: t.wallets, budgets: t.budgets, categories: t.categories, cycleDay: s.budget_cycle_day, today });
  const weekExp = t.transactions.filter((x) => x.kind === 'expense' && !x.deleted_at && inWeek(x.occurred_on));
  const byCat = weekExp.reduce<Record<string, number>>((acc, x) => {
    const n = t.categories.find((c) => c.id === x.category_id)?.name ?? 'Lainnya';
    acc[n] = (acc[n] ?? 0) + x.amount;
    return acc;
  }, {});
  let trees = 0;
  for (let d = ws; d <= today; d = addDays(d, 1)) {
    const info = growthOverview({ routines: t.routines, logs: t.routine_logs, sessions: t.study_sessions, water: t.water_events, today: d }).today;
    if (info.level === 3) trees++;
  }
  const att = t.attendances.filter((a) => inWeek(a.meeting_date));
  return {
    schema_version: 2, kind: 'weekly_review', week_start: ws,
    tasks: { done, overdue },
    learning: { minutes, target },
    garden_trees: trees,
    finance: s.ai_share.finance ? {
      top_category: Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      budget_used_pct: f.budgetUsedPct,
      ...(s.ai_share.finance_amounts ? { spent: weekExp.reduce((a, x) => a + x.amount, 0) } : {}),
    } : undefined,
    attendance_pct: att.length ? Math.round((att.filter((a) => a.status === 'hadir').length / att.length) * 100) : null,
  };
}
