// Klien Supabase untuk Edge Function (TECH-SPEC §6):
// - userClient: memakai header Authorization dari request → RLS berlaku (default untuk semua fungsi).
// - serviceClient: service role — HANYA untuk scheduler-tick, notif-action, account-delete.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Db = SupabaseClient;

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Env ${name} belum diatur`);
  return v;
}

export function envInt(name: string, fallback: number): number {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Supabase menyuntikkan SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY ke Edge Function.
// [verifikasi] project baru bisa memakai kunci publishable/secret — keduanya didukung lewat nama env cadangan.
function anonKey(): string {
  return Deno.env.get('SUPABASE_ANON_KEY') ?? env('SUPABASE_PUBLISHABLE_KEY');
}
function serviceKey(): string {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SECRET_KEY');
}

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export function userClient(req: Request): Db {
  return createClient(env('SUPABASE_URL'), anonKey(), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: NO_SESSION,
  });
}

export function serviceClient(): Db {
  return createClient(env('SUPABASE_URL'), serviceKey(), { auth: NO_SESSION });
}

/** Verifikasi JWT pengguna ke Auth; null bila tidak sah. */
export async function requireUser(req: Request): Promise<{ client: Db; uid: string } | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = userClient(req);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, uid: data.user.id };
}

/** Panggil RPC dan kembalikan data (lempar Error bila gagal). */
export async function rpc<T = unknown>(db: Db, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}
