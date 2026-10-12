import { useEffect, useMemo, useState } from 'react';
import { xpProgress } from '@common/calc/index.ts';
import { useRows, useStats } from '@/data/hooks';
import { useToday } from '@/lib/hooks';
import { useUi } from '@/stores/ui';
import { buildGrowthIndex, growthOverview } from './derive';

/** Ringkasan Tumbuh hari ini (pohon, rutinitas, streak). */
export function useGrowth() {
  const today = useToday();
  const routines = useRows('routines');
  const logs = useRows('routine_logs');
  const sessions = useRows('study_sessions');
  const water = useRows('water_events');
  const loading = routines.isLoading || logs.isLoading || water.isLoading;
  const data = useMemo(
    () => growthOverview({ routines: routines.rows, logs: logs.rows, sessions: sessions.rows, water: water.rows, today }),
    [routines.rows, logs.rows, sessions.rows, water.rows, today],
  );
  const index = useMemo(() => buildGrowthIndex(routines.rows, logs.rows, sessions.rows), [routines.rows, logs.rows, sessions.rows]);
  return { data, index, loading, today };
}

/** Level & progres XP. */
export function useXp() {
  const s = useStats();
  const xp = s.data?.xp_total ?? 0;
  return { xp, ...xpProgress(xp) };
}

/** True selama `ms` setelah menyiram (chip "+1 tetes air", TUM-01). */
export function useJustWatered(ms = 1800): boolean {
  const at = useUi((s) => s.wateredAt);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!at) return;
    const left = at + ms - Date.now();
    if (left <= 0) return;
    const t = window.setTimeout(() => tick((x) => x + 1), left + 10);
    return () => window.clearTimeout(t);
  }, [at, ms]);
  return at > 0 && Date.now() - at < ms;
}
