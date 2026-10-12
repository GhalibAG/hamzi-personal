// Hook data bersama (TanStack Query). Fitur memakai hook ini; komponen tidak memanggil repo/supabase langsung.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { repo } from './index';
import type { RpcName } from './repo';
import { DEFAULT_SETTINGS, uuid } from './repo';
import type { Profile, Settings, TableName, Tables, UserStats } from './types';

export const qk = {
  table: (t: TableName) => ['t', t] as const,
  profile: ['profile'] as const,
  settings: ['settings'] as const,
  stats: ['stats'] as const,
};

/** Baris aktif sebuah tabel (tanpa yang di-soft-delete). */
export function useRows<K extends TableName>(table: K, opts: { enabled?: boolean } = {}) {
  const q = useQuery({ queryKey: qk.table(table), queryFn: () => repo.list(table), enabled: opts.enabled ?? true });
  return { ...q, rows: (q.data ?? EMPTY) as Tables[K][] };
}
const EMPTY: never[] = [];

export function useProfile() {
  return useQuery({ queryKey: qk.profile, queryFn: () => repo.getProfile() });
}
export function useSettingsQuery() {
  return useQuery({ queryKey: qk.settings, queryFn: () => repo.getSettings() });
}
export function useStats() {
  return useQuery({ queryKey: qk.stats, queryFn: () => repo.getStats() });
}

/** Tabel turunan yang ikut berubah (meniru trigger SQL). */
const SIDE_EFFECTS: Partial<Record<TableName, TableName[]>> = {
  transactions: ['xp_events'],
  goal_contributions: ['xp_events'],
};

function invalidateTables(qc: QueryClient, tables: TableName[], stats = false) {
  for (const t of tables) void qc.invalidateQueries({ queryKey: qk.table(t) });
  if (stats) void qc.invalidateQueries({ queryKey: qk.stats });
}

type WithId<T> = Partial<T> & { id: string };

/** Simpan (insert/ubah) dengan optimistic update + rollback. Id dibuat klien bila belum ada. */
export function useUpsert<K extends TableName>(table: K) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (rows: WithId<Tables[K]>[]) => repo.upsert(table, rows),
    onMutate: async (rows) => {
      await qc.cancelQueries({ queryKey: qk.table(table) });
      const prev = qc.getQueryData<Tables[K][]>(qk.table(table));
      qc.setQueryData<Tables[K][]>(qk.table(table), (old = []) => {
        const next = [...old];
        for (const r of rows) {
          const i = next.findIndex((x) => (x as { id: string }).id === r.id);
          if (i >= 0) next[i] = { ...next[i], ...r } as Tables[K];
          else next.push({ created_at: new Date().toISOString(), ...r } as unknown as Tables[K]);
        }
        return next;
      });
      return { prev };
    },
    onError: (_e, _rows, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.table(table), ctx.prev);
    },
    onSettled: () => {
      const extra = SIDE_EFFECTS[table] ?? [];
      invalidateTables(qc, [table, ...extra], extra.length > 0);
    },
  });
  /** Kembalikan baris yang disimpan (dengan id). */
  const save = async (input: Partial<Tables[K]> | Partial<Tables[K]>[]) => {
    const rows = (Array.isArray(input) ? input : [input]).map((r) => ({ ...r, id: (r as { id?: string }).id ?? uuid() })) as WithId<Tables[K]>[];
    return m.mutateAsync(rows);
  };
  return { ...m, save };
}

/** Ubah sebagian kolom. */
export function useUpdate<K extends TableName>(table: K) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (a: { id: string; patch: Partial<Tables[K]> }) => repo.update(table, a.id, a.patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.table(table) });
      const prev = qc.getQueryData<Tables[K][]>(qk.table(table));
      qc.setQueryData<Tables[K][]>(qk.table(table), (old = []) => old.map((x) => ((x as { id: string }).id === id ? { ...x, ...patch } : x)));
      return { prev };
    },
    onError: (_e, _a, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.table(table), ctx.prev);
    },
    onSettled: () => invalidateTables(qc, [table]),
  });
  return { ...m, patch: (id: string, patch: Partial<Tables[K]>) => m.mutateAsync({ id, patch }) };
}

/** Hapus (soft delete bila tabel mendukung) + fungsi `undo` untuk toast Urungkan. */
export function useRemove<K extends TableName>(table: K) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (a: { id: string; hard?: boolean }) => repo.remove(table, a.id, { hard: a.hard }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: qk.table(table) });
      const prev = qc.getQueryData<Tables[K][]>(qk.table(table));
      qc.setQueryData<Tables[K][]>(qk.table(table), (old = []) => old.filter((x) => (x as { id: string }).id !== id));
      return { prev };
    },
    onError: (_e, _a, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.table(table), ctx.prev);
    },
    onSettled: () => {
      const extra = SIDE_EFFECTS[table] ?? [];
      invalidateTables(qc, [table, ...extra], extra.length > 0);
    },
  });
  const remove = (id: string, opts: { hard?: boolean } = {}) => m.mutateAsync({ id, hard: opts.hard });
  const undo = async (id: string) => {
    await repo.restore(table, id);
    const extra = SIDE_EFFECTS[table] ?? [];
    invalidateTables(qc, [table, ...extra], extra.length > 0);
  };
  return { ...m, remove, undo };
}

const RPC_TOUCHES: Record<RpcName, TableName[]> = {
  rpc_routine_set: ['routine_logs', 'water_events', 'xp_events'],
  rpc_study_finish: ['study_sessions', 'water_events', 'xp_events'],
  rpc_task_set_done: ['tasks', 'water_events', 'xp_events'],
  rpc_unit_set_status: ['learning_units'],
  rpc_attendance_mark: ['attendances'],
};

/** Panggil RPC tulis atomik lalu segarkan tabel terkait. `optimistic` opsional untuk umpan balik ≤100 ms. */
export function useRpc<T = unknown>(name: RpcName, optimistic?: (qc: QueryClient, args: Record<string, unknown>) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => repo.rpc<T>(name, args),
    onMutate: async (args) => {
      const keys = RPC_TOUCHES[name];
      await Promise.all(keys.map((t) => qc.cancelQueries({ queryKey: qk.table(t) })));
      const prev = keys.map((t) => [t, qc.getQueryData(qk.table(t))] as const);
      optimistic?.(qc, args);
      return { prev };
    },
    onError: (_e, _a, ctx) => {
      ctx?.prev.forEach(([t, d]) => qc.setQueryData(qk.table(t), d));
    },
    onSettled: () => invalidateTables(qc, RPC_TOUCHES[name], true),
  });
}

/** Rutinitas: set nilai absolut (centang = target, batal = 0, jumlah = n). */
export function useRoutineSet() {
  return useRpc<{ done: boolean; water_total: number; stage: string; all_required: boolean }>('rpc_routine_set', (qc, a) => {
    qc.setQueryData<Tables['routine_logs'][]>(qk.table('routine_logs'), (old = []) => {
      const i = old.findIndex((l) => l.routine_id === a.p_routine_id && l.log_date === a.p_date);
      const routines = qc.getQueryData<Tables['routines'][]>(qk.table('routines')) ?? [];
      const target = routines.find((r) => r.id === a.p_routine_id)?.target_count ?? 1;
      const value = Number(a.p_value);
      const row = { id: i >= 0 ? old[i].id : uuid(), routine_id: String(a.p_routine_id), log_date: String(a.p_date), value, done: value >= target };
      if (i >= 0) { const n = [...old]; n[i] = { ...n[i], ...row }; return n; }
      return [...old, row];
    });
  });
}

/** Tugas: centang/batal. */
export function useTaskSetDone() {
  return useRpc<{ done: boolean; xp: number }>('rpc_task_set_done', (qc, a) => {
    qc.setQueryData<Tables['tasks'][]>(qk.table('tasks'), (old = []) =>
      old.map((t) => (t.id === a.p_task_id ? { ...t, status: a.p_done ? 'selesai' : 'belum', completed_at: a.p_done ? new Date().toISOString() : null } : t)));
  });
}

export function useStudyFinish() {
  return useRpc<{ water_awarded: boolean; water_total: number; stage: string }>('rpc_study_finish');
}
export function useUnitSetStatus() {
  return useRpc('rpc_unit_set_status', (qc, a) => {
    qc.setQueryData<Tables['learning_units'][]>(qk.table('learning_units'), (old = []) =>
      old.map((u) => (u.id === a.p_unit_id ? { ...u, status: a.p_status as Tables['learning_units']['status'] } : u)));
  });
}
export function useAttendanceMark() {
  return useRpc('rpc_attendance_mark', (qc, a) => {
    qc.setQueryData<Tables['attendances'][]>(qk.table('attendances'), (old = []) => {
      const i = old.findIndex((x) => x.course_id === a.p_course_id && x.meeting_date === a.p_date);
      const row = { id: i >= 0 ? old[i].id : uuid(), course_id: String(a.p_course_id), meeting_date: String(a.p_date), status: a.p_status as Tables['attendances']['status'], note: (a.p_note as string | null | undefined) ?? (i >= 0 ? old[i].note : null) };
      if (i >= 0) { const n = [...old]; n[i] = row; return n; }
      return [...old, row];
    });
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => repo.updateSettings(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.settings });
      const prev = qc.getQueryData<Settings>(qk.settings);
      if (prev) qc.setQueryData<Settings>(qk.settings, { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.settings, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.settings }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => repo.updateProfile(patch),
    onSuccess: (p) => qc.setQueryData(qk.profile, p),
  });
}

export type { UserStats };

/** Pengaturan dengan nilai default bila belum termuat. */
export function useSettings(): Settings {
  const q = useSettingsQuery();
  return q.data ?? DEFAULT_SETTINGS;
}
