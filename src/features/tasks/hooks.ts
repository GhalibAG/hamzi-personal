// Hook interaksi tugas bersama (Rencana, detail tugas, detail proyek, pencarian).
import { useCallback } from 'react';
import { taskXp, wibDate } from '@common/calc/index.ts';
import { pickLine } from '@common/lines.id.ts';
import { useRoutineSet, useTaskSetDone, useUpdate } from '@/data/hooks';
import type { Routine, Task } from '@/data/types';
import { toast, toastUndo, useUi } from '@/stores/ui';
import { dueLabel, snoozeDue, type SnoozeOption } from './derive';

/** Centang/batal tugas (TASK-07): RPC atomik + toast "Mantap, satu beres! +XP" dengan Urungkan + reaksi Hamzi. */
export function useTaskToggle() {
  const m = useTaskSetDone();
  const react = useUi((s) => s.react);
  const { mutate } = m;
  return useCallback((t: Task) => {
    const done = t.status !== 'selesai';
    mutate({ p_task_id: t.id, p_done: done });
    if (done) {
      react('happy', pickLine('happy'));
      toastUndo(`Mantap, satu beres! +${taskXp(t.priority)} XP`, () => mutate({ p_task_id: t.id, p_done: false }));
    }
  }, [mutate, react]);
}

/** Tunda cepat (TASK-08) + toast Urungkan yang mengembalikan tenggat lama. */
export function useTaskSnooze() {
  const upd = useUpdate('tasks');
  const { patch } = upd;
  return useCallback((t: Task, opt: SnoozeOption) => {
    const now = new Date();
    const next = snoozeDue(t, opt, now);
    const prev = { due_at: t.due_at ?? null, all_day: !!t.all_day };
    void patch(t.id, next);
    const label = dueLabel({ ...t, ...next }, wibDate(now));
    toastUndo(`Ditunda ke ${label.charAt(0).toLowerCase()}${label.slice(1)}`, () => void patch(t.id, prev));
  }, [patch]);
}

/** Kebiasaan (RUT-03/05): ketuk +1 (centang: 0/1), tahan −1. Nilai absolut lewat RPC. */
export function useHabitStep() {
  const m = useRoutineSet();
  const markWatered = useUi((s) => s.markWatered);
  const react = useUi((s) => s.react);
  const { mutate } = m;
  return useCallback((r: Routine, current: number, delta: 1 | -1, date: string) => {
    const target = Math.max(1, r.target_count);
    const next = r.kind === 'check' && delta === 1
      ? (current >= 1 ? 0 : 1)
      : Math.max(0, Math.min(target, current + delta));
    if (next === current) {
      if (delta === 1) toast(`${r.name} sudah penuh hari ini. Tahan untuk mengurangi.`);
      return;
    }
    const becameDone = current < target && next >= target;
    mutate({ p_routine_id: r.id, p_date: date, p_value: next }, {
      onSuccess: (res) => {
        if (!becameDone) return;
        markWatered();
        if (res?.all_required && r.is_required) react('celebrate', pickLine('all_required'));
      },
    });
  }, [mutate, markWatered, react]);
}
