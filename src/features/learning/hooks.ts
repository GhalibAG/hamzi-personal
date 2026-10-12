import { useCallback, useMemo } from 'react';
import { uuid } from '@/data';
import { useRows, useSettings } from '@/data/hooks';
import { useToday } from '@/lib/hooks';
import { useTimer } from '@/stores/timer';
import { toast } from '@/stores/ui';
import { moduleView, nextUnit, unitsOf } from './derive';

/** Modul, unit, sesi + tampilan kartu modul aktif (urut `sort`). */
export function useLearning() {
  const today = useToday();
  const modules = useRows('learning_modules');
  const units = useRows('learning_units');
  const sessions = useRows('study_sessions');
  const views = useMemo(
    () => modules.rows
      .filter((m) => m.status === 'aktif')
      .sort((a, b) => a.sort - b.sort)
      .map((m) => moduleView(m, units.rows, sessions.rows, today)),
    [modules.rows, units.rows, sessions.rows, today],
  );
  return {
    today,
    modules: modules.rows,
    units: units.rows,
    sessions: sessions.rows,
    views,
    loading: modules.isLoading || units.isLoading,
    isError: modules.isError || units.isError,
    refetch: () => { void modules.refetch(); void units.refetch(); void sessions.refetch(); },
  };
}

/** Durasi fokus bawaan (user_settings.default_focus_min, 25). */
export function useFocusMinutes(): number {
  const s = useSettings();
  return s.default_focus_min > 0 ? s.default_focus_min : 25;
}

/**
 * Mulai timer fokus untuk modul (unit berikutnya otomatis). Bila sudah ada sesi berjalan, buka lagi sesi itu.
 * Mengembalikan true bila timer baru dimulai.
 */
export function useStartFocus() {
  const units = useRows('learning_units').rows;
  const focus = useFocusMinutes();
  return useCallback((a: { moduleId?: string | null; unitId?: string | null; plannedMin?: number } = {}) => {
    const t = useTimer.getState();
    if (t.active) {
      t.setMinimized(false);
      if (!t.active.finished) toast('Masih ada sesi fokus yang berjalan.');
      return false;
    }
    const moduleId = a.moduleId ?? null;
    const unitId = a.unitId !== undefined ? a.unitId : moduleId ? nextUnit(unitsOf(units, moduleId))?.id ?? null : null;
    t.start({ id: uuid(), moduleId, unitId, plannedMin: a.plannedMin ?? focus });
    return true;
  }, [units, focus]);
}
