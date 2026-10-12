// Antrean banner pengingat dalam app (dipakai ReminderEngine; fitur lain boleh memanggil `showReminderBanner`).
import { create } from 'zustand';
import type { Reminder } from './schedule';

interface BannerState {
  queue: Reminder[];
  push: (items: Reminder[]) => void;
  shift: () => void;
}

export const useBannerQueue = create<BannerState>((set) => ({
  queue: [],
  push: (items) => set((s) => ({ queue: [...s.queue, ...items.filter((b) => !s.queue.some((x) => x.dedupe_key === b.dedupe_key))] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

/** Tampilkan pengingat sebagai banner dalam app (mis. "Coba pengingat" saat izin notifikasi belum ada). */
export function showReminderBanner(r: Reminder | Reminder[]) {
  useBannerQueue.getState().push(Array.isArray(r) ? r : [r]);
}
