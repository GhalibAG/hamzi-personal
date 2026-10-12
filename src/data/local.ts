// Repo MODE DEMO: semua data di localStorage peramban (tanpa server). Perilaku RPC = rpc-logic.ts.
import { wibDate, XP, goalProgressPct } from '@common/calc/index.ts';
import type { Repo, RpcName } from './repo';
import { DEFAULT_SETTINGS, uuid } from './repo';
import {
  onTransactionInserted, recomputeStats, rpcAttendanceMark, rpcRoutineSet, rpcStudyFinish, rpcTaskSetDone, rpcUnitSetStatus,
  type Db,
} from './rpc-logic';
import { buildSeed, emptyDb } from './seed';
import { SOFT_DELETE, type Profile, type Settings, type TableName, type Tables } from './types';
import { invokeLocal } from './local-functions';

const KEY = 'hamzi-demo-v1';
type Row = { id: string; deleted_at?: string | null; [k: string]: unknown };

let cache: Db | null = null;
const listeners = new Set<() => void>();

function load(): Db {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      cache = { ...emptyDb(), ...parsed, _settings: { ...DEFAULT_SETTINGS, ...parsed._settings } };
      return cache;
    }
  } catch {
    /* data rusak → seed ulang */
  }
  cache = buildSeed();
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* kuota penuh / mode privat: tetap jalan di memori */
  }
  listeners.forEach((l) => l());
}

/** Dipanggil saat data demo berubah (dipakai untuk invalidasi cache Query lintas tab). */
export function onDemoChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pengaturan > Data: kembalikan data contoh atau kosongkan. */
export function resetDemo(mode: 'sample' | 'empty') {
  if (mode === 'sample') cache = buildSeed();
  else {
    cache = emptyDb();
    cache._profile = { id: cache._profile.id, display_name: 'Teman', onboarded_at: null };
    // kategori & dompet default seperti akun baru
    import('./seed').then(({ defaultFinance }) => { if (cache) { defaultFinance(cache); persist(); } });
  }
  persist();
}

const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const nowIso = () => new Date().toISOString();
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function tableOf(db: Db, t: TableName): Row[] {
  return db[t] as unknown as Row[];
}

function goalXp(db: Db, goalId: string) {
  const g = db.savings_goals.find((x) => x.id === goalId);
  if (!g) return;
  const saved = db.goal_contributions.filter((c) => c.goal_id === goalId && !c.deleted_at).reduce((s, c) => s + c.amount, 0);
  const pct = goalProgressPct(saved, g.target_amount);
  for (const m of [25, 50, 75, 100]) {
    const kind = `goal_${m}`;
    if (pct >= m && !db.xp_events.some((e) => e.kind === kind && e.ref_id === goalId)) {
      db.xp_events.push({ id: uuid(), kind, ref_id: goalId, day: wibDate(), xp: XP.goal[m] });
    }
  }
  recomputeStats(db);
}

export function createLocalRepo(): Repo {
  return {
    mode: 'demo',

    async list(table) {
      await tick();
      const db = load();
      const rows = tableOf(db, table).filter((r) => !r.deleted_at);
      return clone(rows) as unknown as Tables[typeof table][];
    },

    async upsert(table, input) {
      await tick();
      const db = load();
      const arr = tableOf(db, table);
      const rows = (Array.isArray(input) ? input : [input]) as Partial<Row>[];
      const out: Row[] = [];
      for (const r of rows) {
        const id = (r.id as string | undefined) ?? uuid();
        const idx = arr.findIndex((x) => x.id === id);
        const stamp = nowIso();
        let row: Row;
        if (idx >= 0) {
          row = { ...arr[idx], ...r, id, updated_at: stamp };
          arr[idx] = row;
        } else {
          row = { created_at: stamp, updated_at: stamp, deleted_at: null, ...r, id } as Row;
          arr.push(row);
        }
        if (table === 'transactions') {
          const at = new Date(String(row.occurred_at ?? stamp));
          row.occurred_at = at.toISOString();
          row.occurred_on = wibDate(at);
          row.direction = (row.direction as number | undefined) ?? 1;
          if (idx < 0) onTransactionInserted(db, row as unknown as Tables['transactions']);
        }
        if (table === 'study_sessions') row.started_on = wibDate(new Date(String(row.started_at)));
        if (table === 'goal_contributions') {
          row.contributed_at = (row.contributed_at as string | undefined) ?? wibDate();
          goalXp(db, String(row.goal_id));
        }
        out.push(row);
      }
      persist();
      return clone(out) as unknown as Tables[typeof table][];
    },

    async update(table, id, patch) {
      await tick();
      const db = load();
      const arr = tableOf(db, table);
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) throw new Error('Data tidak ditemukan');
      arr[idx] = { ...arr[idx], ...(patch as Partial<Row>), id, updated_at: nowIso() };
      persist();
      return clone(arr[idx]) as unknown as Tables[typeof table];
    },

    async remove(table, id, opts) {
      await tick();
      const db = load();
      const arr = tableOf(db, table);
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) return;
      if (SOFT_DELETE.includes(table) && !opts?.hard) {
        arr[idx] = { ...arr[idx], deleted_at: nowIso() };
        if (table === 'transactions') {
          db.xp_events = db.xp_events.filter((e) => !(e.kind === 'tx' && e.ref_id === id));
          recomputeStats(db);
        }
      } else {
        arr.splice(idx, 1);
        // kaskade sederhana (meniru FK on delete cascade)
        if (table === 'learning_modules') db.learning_units = db.learning_units.filter((u) => u.module_id !== id);
        if (table === 'tasks') db.subtasks = db.subtasks.filter((s) => s.task_id !== id);
        if (table === 'routines') db.routine_logs = db.routine_logs.filter((l) => l.routine_id !== id);
        if (table === 'courses') {
          db.course_schedules = db.course_schedules.filter((s) => s.course_id !== id);
          db.attendances = db.attendances.filter((s) => s.course_id !== id);
        }
        if (table === 'ai_conversations') db.ai_messages = db.ai_messages.filter((m) => m.conversation_id !== id);
      }
      persist();
    },

    async restore(table, id) {
      await tick();
      const db = load();
      const arr = tableOf(db, table);
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) return;
      arr[idx] = { ...arr[idx], deleted_at: null, updated_at: nowIso() };
      if (table === 'transactions') onTransactionInserted(db, arr[idx] as unknown as Tables['transactions']);
      persist();
    },

    async rpc<T>(name: RpcName, args: Record<string, unknown>): Promise<T> {
      await tick();
      const db = load();
      let res: unknown;
      switch (name) {
        case 'rpc_routine_set': res = rpcRoutineSet(db, args as Parameters<typeof rpcRoutineSet>[1]); break;
        case 'rpc_study_finish': res = rpcStudyFinish(db, args as Parameters<typeof rpcStudyFinish>[1]); break;
        case 'rpc_task_set_done': res = rpcTaskSetDone(db, args as Parameters<typeof rpcTaskSetDone>[1]); break;
        case 'rpc_unit_set_status': res = rpcUnitSetStatus(db, args as Parameters<typeof rpcUnitSetStatus>[1]); break;
        case 'rpc_attendance_mark': res = rpcAttendanceMark(db, args as Parameters<typeof rpcAttendanceMark>[1]); break;
      }
      persist();
      return clone(res) as T;
    },

    async getProfile() {
      return clone(load()._profile) as Profile;
    },
    async updateProfile(patch) {
      const db = load();
      db._profile = { ...db._profile, ...patch };
      persist();
      return clone(db._profile) as Profile;
    },
    async getSettings() {
      return clone(load()._settings) as Settings;
    },
    async updateSettings(patch) {
      const db = load();
      db._settings = { ...db._settings, ...patch };
      persist();
      return clone(db._settings);
    },
    async getStats() {
      const db = load();
      recomputeStats(db);
      return clone(db._stats);
    },

    async invoke<T>(fn: string, body: unknown): Promise<T> {
      const db = load();
      const res = await invokeLocal(fn, body, db, localRepo);
      persist();
      return res as T;
    },

    async upload(file) {
      const path = `${load()._profile.id}/${wibDate()}/${uuid()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
      demoFiles.set(path, file);
      return { path, size: file.size, mime: file.type, name: file.name };
    },

    async exportAll() {
      const db = load();
      const tables: Record<string, unknown[]> = {};
      for (const k of Object.keys(db) as (keyof Db)[]) {
        if (k.startsWith('_')) continue;
        tables[k] = clone(db[k] as unknown[]);
      }
      tables.profiles = [clone(db._profile)];
      tables.user_settings = [clone(db._settings)];
      return tables;
    },

    async importAll(data, mode) {
      const db = load();
      for (const [k, rows] of Object.entries(data)) {
        if (k === 'profiles') { db._profile = { ...db._profile, ...(rows[0] as object) }; continue; }
        if (k === 'user_settings') { db._settings = { ...db._settings, ...(rows[0] as object) }; continue; }
        if (!(k in db) || k.startsWith('_')) continue;
        const arr = db[k as TableName] as unknown as Row[];
        if (mode === 'replace') arr.splice(0, arr.length);
        for (const r of rows as Row[]) {
          const i = arr.findIndex((x) => x.id === r.id);
          if (i >= 0) arr[i] = r; else arr.push(r);
        }
      }
      recomputeStats(db);
      persist();
    },
  };
}

export const localRepo: Repo = createLocalRepo();

/** File lampiran chat di mode demo (hanya di memori sesi). */
export const demoFiles = new Map<string, File>();
