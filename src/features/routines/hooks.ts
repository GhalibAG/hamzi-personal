// Centang rutinitas (RUT-03) lewat RPC atomik + umpan balik pohon (TUM-01/02): chip tetes air, reaksi Hamzi.
import { useCallback } from 'react';
import { fillLine, LINES, type Mood } from '@common/lines.id.ts';
import { STUDY_WATER_MIN } from '@common/calc/index.ts';
import { useRoutineSet } from '@/data/hooks';
import type { Routine, RoutineLog } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { toast, useUi } from '@/stores/ui';
import { useGrowth } from '@/features/growth/hooks';

export type ReactFn = (mood: Mood, line: string) => void;

/**
 * Mengembalikan `toggle(routine, log, delta)`:
 * - centang: 0 ↔ 1; jumlah: ketuk +1 (maks target), `delta = -1` (tahan) −1.
 * Menyiram → markWatered; naik tahap → celebrate; semua wajib beres → excited.
 */
export function useRoutineToggle(onReact?: ReactFn) {
  const m = useRoutineSet();
  const today = useToday();
  const markWatered = useUi((s) => s.markWatered);
  const react = useUi((s) => s.react);
  const { data } = useGrowth();
  const { mutateAsync } = m;
  const stageBefore = data.stage.name;
  const allBefore = data.today.due > 0 && data.today.done >= data.today.due;
  const studied = data.today.studyMin >= STUDY_WATER_MIN;

  return useCallback((r: Routine, log: RoutineLog | undefined, delta: 1 | -1 = 1) => {
    const target = r.kind === 'count' ? Math.max(1, r.target_count) : 1;
    const cur = log?.value ?? 0;
    const wasDone = !!log?.done;
    let next: number;
    if (delta === -1) next = Math.max(0, cur - 1);
    else if (r.kind === 'count') {
      if (cur >= target) { toast(`Sudah ${target}/${target}. Tahan untuk mengurangi.`); return; }
      next = cur + 1;
    } else next = wasDone ? 0 : 1;
    if (next === cur) return;
    const willDone = next >= target;
    if (willDone && !wasDone) markWatered();
    const emit = (mood: Mood, line: string) => { react(mood, line); onReact?.(mood, line); };
    mutateAsync({ p_routine_id: r.id, p_date: today, p_value: next })
      .then((res) => {
        if (willDone && !wasDone && res.stage !== stageBefore) emit('celebrate', fillLine('Pohonmu naik jadi {stage}!', { stage: res.stage }));
        else if (res.all_required && !allBefore && r.is_required) emit('excited', studied ? LINES.all_required[0] : LINES.all_required[1]);
      })
      .catch(() => toast('Gagal menyimpan. Coba lagi.'));
  }, [mutateAsync, today, markWatered, react, onReact, stageBefore, allBefore, studied]);
}
