import type { Profile, Settings, TableName, Tables, UserStats } from './types';

export type RpcName =
  | 'rpc_routine_set'
  | 'rpc_study_finish'
  | 'rpc_task_set_done'
  | 'rpc_unit_set_status'
  | 'rpc_attendance_mark';

export interface Repo {
  mode: 'demo' | 'supabase';
  list<K extends TableName>(table: K): Promise<Tables[K][]>;
  upsert<K extends TableName>(table: K, rows: Partial<Tables[K]> | Partial<Tables[K]>[]): Promise<Tables[K][]>;
  /** Ubah sebagian kolom satu baris (dipakai bila RLS tidak mengizinkan insert, mis. scheduled_notifications.read_at). */
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]>;
  /** Soft delete untuk tabel ber-`deleted_at`, selain itu hapus. */
  remove(table: TableName, id: string, opts?: { hard?: boolean }): Promise<void>;
  restore(table: TableName, id: string): Promise<void>;
  rpc<T = unknown>(name: RpcName, args: Record<string, unknown>): Promise<T>;
  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  getStats(): Promise<UserStats>;
  /** Panggil Edge Function (mode demo: penangan lokal). */
  invoke<T = unknown>(fn: string, body: unknown): Promise<T>;
  /** Unggah lampiran chat; mengembalikan path di bucket. */
  upload(file: File): Promise<{ path: string; size: number; mime: string; name: string }>;
  exportAll(): Promise<Record<string, unknown[]>>;
  importAll(data: Record<string, unknown[]>, mode: 'merge' | 'replace'): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  budget_cycle_day: 1,
  quiet_start: '23:00',
  quiet_end: '05:00',
  hide_amounts: false,
  minimal_mode: false,
  eye_mirror: false,
  curriculum_credits: 144,
  target_gpa: null,
  default_focus_min: 25,
  water_from_tasks: false,
  ai_enabled: true,
  ai_chat_enabled: true,
  chat_privacy_ack: false,
  ai_share: {
    tasks: true, task_titles: true, courses: true, learning: true, routines: true,
    finance: true, finance_amounts: true, goals: true, goals_amounts: false, investments: true, investments_amounts: false,
  },
  grade_scale: { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, D: 1, E: 0 },
  grade_ranges: [['A', 85], ['B+', 80], ['B', 70], ['C+', 65], ['C', 55], ['D', 40], ['E', 0]],
  system_notif: {
    class: true, exam: true, expense_nudge: true, budget: true, weekly_review: true, goal: true, backup: true, valuation: true, morning_brief: false,
  },
  last_backup_at: null,
};

export function uuid(): string {
  return crypto.randomUUID();
}
