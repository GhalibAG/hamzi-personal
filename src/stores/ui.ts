// State UI saja (Zustand): toast, sheet cepat, panel chat, mode Minimal, maskot. Data domain ada di TanStack Query.
import { create } from 'zustand';
import type { Mood } from '@common/lines.id.ts';
import { readLocal, writeLocal } from '@/lib/storage';

export type QuickKind = 'expense' | 'income' | 'task' | 'event' | 'routine' | 'module' | 'timer' | 'exam' | 'course' | 'course-task';

export interface ToastState {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface QuickState {
  kind: QuickKind;
  /** Nilai awal opsional (mis. dari kartu Kata Hamzi atau usulan chat). */
  initial?: Record<string, unknown>;
}

interface UiState {
  minimal: boolean;
  setMinimal: (v: boolean) => void;

  toast: ToastState | null;
  showToast: (t: Omit<ToastState, 'id'>) => void;
  hideToast: () => void;

  quick: QuickState | null;
  openQuick: (kind: QuickKind, initial?: Record<string, unknown>) => void;
  closeQuick: () => void;

  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  toggleChat: () => void;

  /** Reaksi maskot sementara (mis. setelah centang) — dibaca mesin mood. */
  reaction: { mood: Mood; line: string; until: number } | null;
  react: (mood: Mood, line: string, ms?: number) => void;

  /** Chip "+1 tetes air" (Tumbuh). */
  wateredAt: number;
  markWatered: () => void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set) => ({
  minimal: false,
  setMinimal: (v) => set({ minimal: v }),

  toast: null,
  showToast: (t) => set({ toast: { ...t, id: ++toastSeq } }),
  hideToast: () => set({ toast: null }),

  quick: null,
  openQuick: (kind, initial) => set({ quick: { kind, initial } }),
  closeQuick: () => set({ quick: null }),

  chatOpen: readLocal('hamzi-chat-open', false),
  setChatOpen: (v) => { writeLocal('hamzi-chat-open', v); set({ chatOpen: v }); },
  toggleChat: () => set((s) => { writeLocal('hamzi-chat-open', !s.chatOpen); return { chatOpen: !s.chatOpen }; }),

  reaction: null,
  react: (mood, line, ms = 30_000) => set({ reaction: { mood, line, until: Date.now() + ms } }),

  wateredAt: 0,
  markWatered: () => set({ wateredAt: Date.now() }),
}));

/** Helper toast dengan Urungkan (3,5 dtk). */
export function toastUndo(text: string, onUndo: () => void) {
  useUi.getState().showToast({ text, actionLabel: 'Urungkan', onAction: onUndo, durationMs: 3500 });
}
export function toast(text: string) {
  useUi.getState().showToast({ text, durationMs: 3500 });
}
