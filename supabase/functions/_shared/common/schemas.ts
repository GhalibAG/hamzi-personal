// Skema zod bersama klien & Edge Function (TECH-SPEC §7.8.3). Deno: import map "zod" → "npm:zod@3.25.76".
import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.number().int().min(1).max(7);

export const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'every_n_days']),
  interval: z.number().int().min(1).max(365).default(1),
  by_day: z.array(day).optional(),
  day_of_month: z.number().int().min(1).max(31).optional(),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const proposeTask = z.object({
  title: z.string().min(1).max(200),
  due_date: date.optional(),
  due_time: time.optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  course_name: z.string().max(120).optional(),
  project_name: z.string().max(120).optional(),
  weight_pct: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(300).optional(),
});
export const proposeRoutine = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(['check', 'count']).default('check'),
  target_count: z.number().int().min(1).max(50).optional(),
  repeat: z.union([z.enum(['daily', 'weekdays', 'weekend']), z.array(day).min(1)]).default('daily'),
  remind_at: time.optional(),
  is_required: z.boolean().optional(),
});
export const proposeLearningModule = z.object({
  title: z.string().min(1).max(80),
  unit_titles: z.array(z.string().min(1).max(120)).max(40).optional(),
  unit_count: z.number().int().min(1).max(40).optional(),
  category: z.enum(['pemrograman', 'basis_data', 'statistik', 'bahasa', 'sertifikasi', 'kuliah', 'lainnya']).optional(),
  remind_at: time.optional(),
  remind_days: z.array(day).optional(),
});
export const proposeTransaction = z.object({
  kind: z.enum(['expense', 'income']),
  amount: z.number().int().min(1).max(10_000_000_000),
  category_name: z.string().min(1).max(40),
  date: date.optional(),
  time: time.optional(),
  note: z.string().max(140).optional(),
});
export const proposeExam = z.object({
  course_name: z.string().min(1).max(120),
  kind: z.enum(['kuis', 'uts', 'uas', 'praktikum']),
  date: date,
  time: time.optional(),
  material: z.string().max(300).optional(),
});
export const proposeClassSchedule = z.object({
  course_name: z.string().min(1).max(120),
  credits: z.number().int().min(1).max(10).optional(),
  weekday: day,
  start: time,
  end: time,
  room: z.string().max(60).optional(),
});
export const proposeEvent = z.object({
  title: z.string().min(1).max(120),
  date: date,
  start_time: time.optional(),
  end_time: time.optional(),
  all_day: z.boolean().optional(),
});
export const proposeGoalContribution = z.object({
  goal_name: z.string().min(1).max(120),
  amount: z.number().int().min(1),
  date: date.optional(),
});

export const PROPOSE_SCHEMAS = {
  propose_task: proposeTask,
  propose_routine: proposeRoutine,
  propose_learning_module: proposeLearningModule,
  propose_transaction: proposeTransaction,
  propose_exam: proposeExam,
  propose_class_schedule: proposeClassSchedule,
  propose_event: proposeEvent,
  propose_goal_contribution: proposeGoalContribution,
} as const;
export type ProposeTool = keyof typeof PROPOSE_SCHEMAS;

export interface ProposalItem {
  tool: ProposeTool;
  args: Record<string, unknown>;
  kind: string;
  label: string;
  detail: string;
  selected: boolean;
}
export interface Proposals {
  title: string;
  dest: string;
  items: ProposalItem[];
}

/** Output ringkasan harian (TECH-SPEC §7.3). */
export const dailySummarySchema = z.object({
  greeting: z.string().max(120),
  highlights: z.array(z.string().max(140)).min(1).max(3),
  suggestions: z.array(z.object({
    text: z.string().max(160),
    module: z.enum(['tasks', 'courses', 'finance', 'goals', 'learning', 'routines']),
    action_key: z.enum(['create_task_split', 'start_timer', 'log_expense', 'open_budget', 'open_routines']).optional(),
  })).min(1).max(3),
  mood: z.enum(['calm', 'happy', 'focus', 'worried', 'celebrate']),
  numbers_used: z.array(z.object({ label: z.string(), value: z.number() })).default([]),
});
export type DailySummary = z.infer<typeof dailySummarySchema>;

export const weeklyReviewSchema = z.object({
  summary: z.string().max(300),
  went_well: z.array(z.string().max(160)).min(1).max(3),
  needs_attention: z.array(z.string().max(160)).min(1).max(3),
  next_week_priorities: z.array(z.string().max(160)).length(3),
  mood: z.enum(['calm', 'happy', 'focus', 'worried', 'celebrate']),
  numbers_used: z.array(z.object({ label: z.string(), value: z.number() })).default([]),
});
export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;
