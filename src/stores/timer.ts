// Timer fokus berbasis timestamp (bukan hitung interval) — bertahan saat app ditutup (TECH-SPEC §9).
import { create } from 'zustand';
import { readLocal, writeLocal } from '@/lib/storage';

export interface ActiveTimer {
  id: string;
  moduleId: string | null;
  unitId: string | null;
  courseId: string | null;
  plannedMin: number;
  /** ms epoch saat segmen berjalan terakhir dimulai (null bila dijeda). */
  runningSince: number | null;
  /** ms yang sudah berlalu sebelum segmen sekarang. */
  elapsedBefore: number;
  /** ms epoch mulai sesi (untuk started_at). */
  startedAt: number;
  finished: boolean;
}

interface TimerState {
  active: ActiveTimer | null;
  /** Layar timer dikecilkan → chip kecil di atas navigasi. */
  minimized: boolean;
  start: (a: { id: string; moduleId?: string | null; unitId?: string | null; courseId?: string | null; plannedMin: number }) => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  clear: () => void;
  setMinimized: (v: boolean) => void;
}

const KEY = 'hamzi-timer-v1';
const save = (a: ActiveTimer | null, minimized: boolean) => writeLocal(KEY, { active: a, minimized });
const initial = readLocal<{ active: ActiveTimer | null; minimized: boolean }>(KEY, { active: null, minimized: false });

export const useTimer = create<TimerState>((set, get) => ({
  active: initial.active,
  minimized: initial.minimized,
  start: ({ id, moduleId = null, unitId = null, courseId = null, plannedMin }) => {
    const now = Date.now();
    const a: ActiveTimer = { id, moduleId, unitId, courseId, plannedMin, runningSince: now, elapsedBefore: 0, startedAt: now, finished: false };
    save(a, false);
    set({ active: a, minimized: false });
  },
  pause: () => {
    const a = get().active;
    if (!a || a.runningSince === null) return;
    const next = { ...a, elapsedBefore: a.elapsedBefore + (Date.now() - a.runningSince), runningSince: null };
    save(next, get().minimized);
    set({ active: next });
  },
  resume: () => {
    const a = get().active;
    if (!a || a.runningSince !== null || a.finished) return;
    const next = { ...a, runningSince: Date.now() };
    save(next, get().minimized);
    set({ active: next });
  },
  finish: () => {
    const a = get().active;
    if (!a) return;
    const elapsed = a.elapsedBefore + (a.runningSince ? Date.now() - a.runningSince : 0);
    const next = { ...a, elapsedBefore: elapsed, runningSince: null, finished: true };
    save(next, false);
    set({ active: next, minimized: false });
  },
  clear: () => {
    save(null, false);
    set({ active: null, minimized: false });
  },
  setMinimized: (v) => {
    save(get().active, v);
    set({ minimized: v });
  },
}));

/** Milidetik berlalu pada saat `now`. */
export function timerElapsed(a: ActiveTimer, now = Date.now()): number {
  return a.elapsedBefore + (a.runningSince ? now - a.runningSince : 0);
}
