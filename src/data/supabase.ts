// Repo Supabase (akun asli). Semua akses dibatasi RLS; tidak ada rahasia di klien.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { wibDate } from '@common/calc/index.ts';
import type { Repo, RpcName } from './repo';
import { DEFAULT_SETTINGS, uuid } from './repo';
import { SOFT_DELETE, type Profile, type Settings, type TableName, type Tables, type UserStats } from './types';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase belum dikonfigurasi');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/** Tabel yang tidak punya kolom yang perlu dibuang klien sebelum dikirim. */
const LOCAL_ONLY_KEYS = ['created_at'];

function clean<T extends object>(row: T): T {
  const r = { ...row } as Record<string, unknown>;
  for (const k of LOCAL_ONLY_KEYS) if (r[k] === undefined) delete r[k];
  return r as T;
}

async function uid(): Promise<string> {
  const { data } = await supabase().auth.getUser();
  if (!data.user) throw new Error('Belum masuk');
  return data.user.id;
}

function fail(e: { message: string } | null): void {
  if (e) throw new Error(e.message);
}

export function createSupabaseRepo(): Repo {
  return {
    mode: 'supabase',

    async list(table) {
      let q = supabase().from(table).select('*');
      if (SOFT_DELETE.includes(table)) q = q.is('deleted_at', null);
      // batasi tabel besar ke riwayat yang relevan
      if (table === 'scheduled_notifications') q = q.order('fire_at', { ascending: false }).limit(300);
      if (table === 'ai_messages') q = q.order('created_at', { ascending: true }).limit(500);
      const { data, error } = await q;
      fail(error);
      return (data ?? []) as Tables[typeof table][];
    },

    async upsert(table, rows) {
      const arr = (Array.isArray(rows) ? rows : [rows]).map((r) => clean({ id: uuid(), ...r }));
      const { data, error } = await supabase().from(table).upsert(arr, { onConflict: 'id' }).select('*');
      fail(error);
      return (data ?? []) as Tables[typeof table][];
    },

    async update(table, id, patch) {
      const { data, error } = await supabase().from(table).update(patch as Record<string, unknown>).eq('id', id).select('*').single();
      fail(error);
      return data as Tables[typeof table];
    },

    async remove(table, id, opts) {
      if (SOFT_DELETE.includes(table) && !opts?.hard) {
        const { error } = await supabase().from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
        fail(error);
      } else {
        const { error } = await supabase().from(table).delete().eq('id', id);
        fail(error);
      }
    },

    async restore(table, id) {
      const { error } = await supabase().from(table).update({ deleted_at: null }).eq('id', id);
      fail(error);
    },

    async rpc<T>(name: RpcName, args: Record<string, unknown>): Promise<T> {
      const { data, error } = await supabase().rpc(name, args);
      fail(error);
      return data as T;
    },

    async getProfile() {
      const id = await uid();
      const { data, error } = await supabase().from('profiles').select('*').eq('id', id).single();
      fail(error);
      return data as Profile;
    },
    async updateProfile(patch) {
      const id = await uid();
      const { data, error } = await supabase().from('profiles').update(patch).eq('id', id).select('*').single();
      fail(error);
      return data as Profile;
    },
    async getSettings() {
      const id = await uid();
      const { data, error } = await supabase().from('user_settings').select('*').eq('user_id', id).single();
      fail(error);
      return { ...DEFAULT_SETTINGS, ...(data as Partial<Settings>) };
    },
    async updateSettings(patch) {
      const id = await uid();
      const { data, error } = await supabase().from('user_settings').update(patch).eq('user_id', id).select('*').single();
      fail(error);
      return { ...DEFAULT_SETTINGS, ...(data as Partial<Settings>) };
    },
    async getStats() {
      const id = await uid();
      const { data, error } = await supabase().from('user_stats').select('*').eq('user_id', id).maybeSingle();
      fail(error);
      return (data ?? { xp_total: 0, level: 1 }) as UserStats;
    },

    async invoke<T>(fn: string, body: unknown): Promise<T> {
      const { data, error } = await supabase().functions.invoke(fn, { body: body as Record<string, unknown> });
      fail(error);
      return data as T;
    },

    async upload(file) {
      const id = await uid();
      const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
      const path = `${id}/${wibDate()}/${uuid()}-${safe}`;
      const { error } = await supabase().storage.from('chat-uploads').upload(path, file, { contentType: file.type, upsert: false });
      fail(error);
      return { path, size: file.size, mime: file.type, name: file.name };
    },

    async exportAll() {
      const names: (TableName | 'profiles' | 'user_settings')[] = [
        'profiles', 'user_settings', 'projects', 'milestones', 'tasks', 'subtasks', 'events', 'routines', 'routine_logs',
        'learning_modules', 'learning_units', 'study_sessions', 'water_events', 'xp_events', 'wallets', 'categories',
        'transactions', 'budgets', 'recurring_rules', 'semesters', 'courses', 'course_schedules', 'attendances', 'exams',
        'grade_components', 'savings_goals', 'goal_contributions', 'assets', 'asset_transactions', 'asset_valuations',
      ];
      const out: Record<string, unknown[]> = {};
      for (const n of names) {
        const { data, error } = await supabase().from(n).select('*');
        fail(error);
        out[n] = data ?? [];
      }
      return out;
    },

    async importAll(data, mode) {
      // Urutan FK (TECH-SPEC §16). "replace" = hapus dulu (soft untuk tabel ber-deleted_at tidak cukup → hard delete milik sendiri).
      const order = [
        'projects', 'milestones', 'semesters', 'courses', 'course_schedules', 'grade_components', 'exams', 'attendances',
        'tasks', 'subtasks', 'events', 'routines', 'routine_logs', 'learning_modules', 'learning_units', 'study_sessions',
        'wallets', 'categories', 'transactions', 'budgets', 'recurring_rules', 'savings_goals', 'goal_contributions',
        'assets', 'asset_transactions', 'asset_valuations',
      ];
      const me = await uid();
      if (mode === 'replace') {
        for (const t of [...order].reverse()) {
          const { error } = await supabase().from(t).delete().eq('user_id', me);
          fail(error);
        }
      }
      for (const t of order) {
        const rows = (data[t] ?? []) as Record<string, unknown>[];
        if (!rows.length) continue;
        const { error } = await supabase().from(t).upsert(rows.map((r) => ({ ...r, user_id: me })), { onConflict: 'id' });
        fail(error);
      }
      if (data.user_settings?.[0]) {
        const { user_id: _u, updated_at: _t, ...rest } = data.user_settings[0] as Record<string, unknown>;
        const { error } = await supabase().from('user_settings').update(rest).eq('user_id', me);
        fail(error);
      }
    },
  };
}
