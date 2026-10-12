// Pilih repo: VITE_SUPABASE_URL kosong → MODE DEMO (localStorage). Komponen tidak memanggil supabase langsung.
import { localRepo } from './local';
import type { Repo } from './repo';
import { createSupabaseRepo, SUPABASE_URL } from './supabase';

export const DEMO = !SUPABASE_URL;
export const repo: Repo = DEMO ? localRepo : createSupabaseRepo();

export * from './types';
export type { Repo, RpcName } from './repo';
export { DEFAULT_SETTINGS, uuid } from './repo';
