// Payload ringkasan AI (TECH-SPEC §7.2) dibangun dari RPC agregat (sebagai pengguna) + allowlist ai_share, ≤ 4 KB.
// Bentuk sama dengan src/features/ai/payload.ts (DailyPayload / WeekPayload). Turunan memakai common/calc.
import { budgetUsedPct, daysLeftInCycle, pctVsAvg, safeDailyRounded } from './common/calc/budget.ts';
import { isoWeekday, wibDate, wibMinutes, weekStart, type DateStr } from './common/calc/date.ts';
import { HARI } from './common/format.ts';
import { partOfDay } from './common/lines.id.ts';
import { redact } from './redact.ts';
import { rpc, type Db } from './supabase.ts';
import type { AiShare } from './tools.ts';

export const PAYLOAD_MAX_BYTES = 4096;

export interface DailyPayload {
  schema_version: 2; kind: 'daily_summary'; date: DateStr; weekday: string; part_of_day: string;
  tasks?: { due_today: number; overdue: number; done_today: number; top: { label: string; priority: string; due: string; est_min: number | null }[] };
  schedule?: { classes_today: { name: string; start: string }[]; exams_next_7d: { kind: string; course: string; in_days: number }[] };
  routines?: { required_due: number; required_done: number; garden_level: number; streak_days: number; tree_stage: string };
  learning?: { minutes_today: number; weekly_target_min: number; weekly_done_min: number };
  finance?: { amounts_included: boolean; spent_today?: number; pct_vs_avg_7d: number | null; budget_used_pct: number; safe_daily?: number; top_category_today: string | null };
  goals?: { kind: string; progress_pct: number; on_track: boolean | null }[];
}

export interface WeekPayload {
  schema_version: 2; kind: 'weekly_review'; week_start: DateStr;
  tasks?: { done: number; overdue: number };
  learning?: { minutes: number; target: number };
  garden_trees?: number;
  finance?: { spent?: number; top_category: string | null; budget_used_pct: number };
  attendance_pct?: number | null;
}

type J = Record<string, unknown>;
const rec = (v: unknown): J => (v && typeof v === 'object' && !Array.isArray(v) ? (v as J) : {});
const list = (v: unknown): J[] => (Array.isArray(v) ? v.map(rec) : []);
const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const s = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function buildDailyPayload(db: Db, share: AiShare, cycleDay: number, now: Date = new Date()): Promise<DailyPayload> {
  const date = wibDate(now);
  const p: DailyPayload = {
    schema_version: 2, kind: 'daily_summary', date, weekday: HARI[isoWeekday(date)], part_of_day: partOfDay(wibMinutes(now)),
  };
  const jobs: Promise<void>[] = [];
  if (share.tasks) {
    jobs.push(rpc<J>(db, 'rpc_tasks_overview', { p_date: date, p_limit: 3 }).then((t) => {
      p.tasks = {
        due_today: n(t.due_today), overdue: n(t.overdue), done_today: n(t.done_today),
        top: list(t.top).slice(0, 3).map((x, i) => ({
          label: share.task_titles ? redact(s(x.title)).slice(0, 80) : `Tugas ${String.fromCharCode(65 + i)}`,
          priority: s(x.priority_label).toLowerCase(),
          due: s(x.due_label).toLowerCase(),
          est_min: x.est_min === null || x.est_min === undefined ? null : n(x.est_min),
        })),
      };
    }));
  }
  if (share.courses) {
    jobs.push(rpc<J>(db, 'rpc_schedule_overview', { p_date: date }).then((sc) => {
      p.schedule = {
        classes_today: list(sc.classes_today).map((c) => ({ name: redact(s(c.name)), start: s(c.start) })),
        exams_next_7d: list(sc.exams_next_7d).map((e) => ({ kind: s(e.kind_label).toLowerCase(), course: redact(s(e.course)), in_days: n(e.in_days) })),
      };
    }));
  }
  if (share.routines) {
    jobs.push(rpc<J>(db, 'rpc_growth_overview', { p_date: date }).then((g) => {
      p.routines = {
        required_due: n(g.required_due), required_done: n(g.required_done), garden_level: n(g.garden_level_today),
        streak_days: n(g.streak), tree_stage: s(g.stage_name),
      };
    }));
  }
  if (share.learning) {
    jobs.push(rpc<J>(db, 'rpc_learning_overview', { p_date: date }).then((l) => {
      p.learning = { minutes_today: n(l.minutes_today), weekly_target_min: n(l.weekly_target_min), weekly_done_min: n(l.minutes_week) };
    }));
  }
  if (share.finance) {
    jobs.push(rpc<J>(db, 'rpc_finance_daily', { p_date: date }).then((f) => {
      const budget = f.budget_total === null || f.budget_total === undefined ? null : n(f.budget_total);
      const spentCycle = n(f.spent_cycle);
      const spentToday = n(f.spent_today);
      p.finance = {
        amounts_included: !!share.finance_amounts,
        pct_vs_avg_7d: pctVsAvg(spentToday, n(f.avg_daily_7d)),
        budget_used_pct: budget ? budgetUsedPct(spentCycle, budget) : 0,
        top_category_today: f.top_category_today ? s(f.top_category_today) : null,
        ...(share.finance_amounts
          ? { spent_today: spentToday, safe_daily: budget ? safeDailyRounded(budget, spentCycle, daysLeftInCycle(date, cycleDay)) : 0 }
          : {}),
      };
    }));
  }
  if (share.goals) {
    jobs.push(rpc<J>(db, 'rpc_goals_overview').then((g) => {
      p.goals = list(g.goals).filter((x) => x.status === 'aktif').map((x) => ({
        kind: s(x.kind), progress_pct: n(x.progress_pct), on_track: typeof x.on_track === 'boolean' ? x.on_track : null,
      }));
    }));
  }
  await Promise.all(jobs);
  return fitDaily(p);
}

export async function buildWeekPayload(db: Db, share: AiShare, now: Date = new Date()): Promise<WeekPayload> {
  const ws = weekStart(wibDate(now));
  const w = rec(await rpc(db, 'rpc_week_summary', { p_week_start: ws }));
  const p: WeekPayload = { schema_version: 2, kind: 'weekly_review', week_start: s(w.week_start) || ws };
  if (share.tasks) p.tasks = { done: n(rec(w.tasks).done), overdue: n(rec(w.tasks).overdue) };
  if (share.learning) p.learning = { minutes: n(rec(w.learning).minutes), target: n(rec(w.learning).target) };
  if (share.routines) p.garden_trees = n(w.garden_trees);
  if (share.finance) {
    const f = rec(w.finance);
    p.finance = {
      top_category: f.top_category ? s(f.top_category) : null,
      budget_used_pct: n(f.budget_used_pct),
      ...(share.finance_amounts ? { spent: n(f.spent) } : {}),
    };
  }
  if (share.courses) p.attendance_pct = w.attendance_pct === null || w.attendance_pct === undefined ? null : n(w.attendance_pct);
  return p;
}

export function payloadBytes(p: unknown): number {
  return new TextEncoder().encode(JSON.stringify(p)).length;
}

/** Pangkas daftar sampai ≤ 4 KB (daftar terpanjang dulu). */
function fitDaily(p: DailyPayload): DailyPayload {
  const arrays = (): unknown[][] => [p.goals ?? [], p.schedule?.exams_next_7d ?? [], p.schedule?.classes_today ?? [], p.tasks?.top ?? []];
  let guard = 0;
  while (payloadBytes(p) > PAYLOAD_MAX_BYTES && guard++ < 100) {
    const longest = arrays().sort((a, b) => b.length - a.length)[0];
    if (!longest || longest.length === 0) break;
    longest.pop();
  }
  return p;
}
