// Kata Hamzi: ringkasan harian dari Edge `ai-generate` (cache per hari) dengan cadangan templat lokal.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DailySummary } from '@common/schemas.ts';
import { dailySummarySchema } from '@common/schemas.ts';
import { repo } from '@/data';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { qk } from '@/data/hooks';
import type { Settings, TableName } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { buildDailyPayload, type TablesData } from './payload';
import { templateDaily } from './templates';

export interface SummaryResult { data: DailySummary; source: 'ai' | 'cache' | 'template' }

const ALL: TableName[] = [
  'tasks', 'subtasks', 'semesters', 'courses', 'course_schedules', 'exams', 'routines', 'routine_logs', 'study_sessions',
  'water_events', 'learning_modules', 'transactions', 'wallets', 'budgets', 'categories', 'savings_goals', 'goal_contributions',
];

export function useDailySummary(enabled = true) {
  const today = useToday();
  const qc = useQueryClient();
  return useQuery<SummaryResult>({
    queryKey: ['ai', 'daily_summary', today],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      try {
        const r = await repo.invoke<{ ok: boolean; source: SummaryResult['source']; data: unknown }>('ai-generate', { kind: 'daily_summary' });
        const parsed = dailySummarySchema.safeParse(r.data);
        if (r.ok && parsed.success) return { data: parsed.data, source: r.source };
      } catch {
        /* offline / kuota / error → templat */
      }
      const t = {} as Record<string, unknown[]>;
      for (const name of ALL) t[name] = (qc.getQueryData(qk.table(name)) as unknown[] | undefined) ?? (await repo.list(name));
      const s = qc.getQueryData<Settings>(qk.settings) ?? DEFAULT_SETTINGS;
      return { data: templateDaily(buildDailyPayload(t as unknown as TablesData, s)), source: 'template' };
    },
  });
}
