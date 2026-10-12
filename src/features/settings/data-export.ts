// Export/Import (TECH-SPEC §16, SET-04): JSON penuh `{ app, schema_version: 2, exported_at, tables }`, CSV per modul (UTF-8 BOM),
// impor tervalidasi zod ("gabung" = upsert by id, "ganti semua" = export otomatis dulu).
import { z } from 'zod';
import { wibDate, wibTime } from '@common/calc/index.ts';
import type { Repo } from '@/data';
import type {
  Category, Course, LearningModule, LearningUnit, Project, Routine, RoutineLog, StudySession, TableName, Task, Transaction, Wallet,
} from '@/data/types';

export const SCHEMA_VERSION = 2;

/** Tabel yang dikenali saat impor (selain profiles & user_settings). push_subscriptions khusus perangkat → tidak diimpor. */
export const IMPORT_TABLES = [
  'projects', 'milestones', 'tasks', 'subtasks', 'events', 'routines', 'routine_logs', 'learning_modules', 'learning_units',
  'study_sessions', 'water_events', 'xp_events', 'wallets', 'categories', 'transactions', 'budgets', 'recurring_rules',
  'semesters', 'courses', 'course_schedules', 'attendances', 'exams', 'grade_components', 'savings_goals', 'goal_contributions',
  'assets', 'asset_transactions', 'asset_valuations', 'scheduled_notifications', 'ai_conversations', 'ai_messages', 'ai_actions',
  'ai_requests',
] as const satisfies readonly TableName[];

const rowSchema = z.record(z.string(), z.unknown());
export const backupSchema = z.object({
  app: z.literal('hamzi', { errorMap: () => ({ message: 'Ini bukan file backup Hamzi.' }) }),
  schema_version: z.literal(SCHEMA_VERSION, { errorMap: () => ({ message: `Versi backup tidak didukung (butuh versi ${SCHEMA_VERSION}).` }) }),
  exported_at: z.string().min(1, 'Tanggal export tidak ada.'),
  tables: z.record(z.string(), z.array(rowSchema, { invalid_type_error: 'Isi tabel harus berupa daftar.' })),
});
export type Backup = z.infer<typeof backupSchema>;

export type ParsedBackup =
  | { ok: true; backup: Backup; tables: Record<string, unknown[]>; rows: number; tableCount: number; ignored: string[] }
  | { ok: false; error: string };

/** Validasi teks JSON backup; hanya tabel yang dikenali yang diteruskan, setiap baris wajib punya `id`. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File bukan JSON yang valid.' };
  }
  const p = backupSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Format backup tidak dikenali.' };
  const known = new Set<string>([...IMPORT_TABLES, 'profiles', 'user_settings']);
  const tables: Record<string, unknown[]> = {};
  const ignored: string[] = [];
  let rows = 0;
  for (const [name, list] of Object.entries(p.data.tables)) {
    if (!known.has(name)) { ignored.push(name); continue; }
    if (name !== 'profiles' && name !== 'user_settings') {
      const bad = list.findIndex((r) => typeof r.id !== 'string' || !r.id);
      if (bad >= 0) return { ok: false, error: `Baris ke-${bad + 1} di tabel ${name} tidak punya id.` };
      rows += list.length;
    }
    tables[name] = list;
  }
  return { ok: true, backup: p.data, tables, rows, tableCount: Object.keys(tables).length, ignored };
}

export async function buildBackup(repo: Repo, now = new Date()): Promise<Backup> {
  const tables = (await repo.exportAll()) as Record<string, Record<string, unknown>[]>;
  return { app: 'hamzi', schema_version: SCHEMA_VERSION, exported_at: now.toISOString(), tables };
}

export function backupFileName(now = new Date()): string {
  return `hamzi-backup-${wibDate(now)}.json`;
}

/** Unduh teks sebagai file (Blob). */
export function downloadText(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- CSV ---------- */

type Cell = string | number | boolean | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'ya' : 'tidak') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV UTF-8 dengan BOM (agar Excel membaca huruf Indonesia dengan benar). */
export function toCsv(headers: string[], rows: Cell[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const wibDateTime = (iso?: string | null) => (iso ? `${wibDate(new Date(iso))} ${wibTime(new Date(iso))}` : '');
const KIND_TX: Record<string, string> = { expense: 'pengeluaran', income: 'pemasukan', transfer: 'transfer', adjustment: 'penyesuaian' };

export function transactionsCsv(txs: Transaction[], categories: Category[], wallets: Wallet[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const wal = new Map(wallets.map((w) => [w.id, w.name]));
  const rows = txs
    .filter((t) => !t.deleted_at)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((t) => [
      t.occurred_on, wibTime(new Date(t.occurred_at)), KIND_TX[t.kind] ?? t.kind, t.category_id ? cat.get(t.category_id) : '',
      wal.get(t.wallet_id), t.to_wallet_id ? wal.get(t.to_wallet_id) : '', t.kind === 'adjustment' ? t.amount * t.direction : t.amount, t.note,
    ]);
  return toCsv(['tanggal', 'jam', 'jenis', 'kategori', 'dompet', 'ke_dompet', 'nominal_rp', 'catatan'], rows);
}

export function tasksCsv(tasks: Task[], projects: Project[], courses: Course[]): string {
  const prj = new Map(projects.map((p) => [p.id, p.name]));
  const crs = new Map(courses.map((c) => [c.id, c.name]));
  const rows = tasks
    .filter((t) => !t.deleted_at)
    .map((t) => [
      t.title, t.status, t.priority, t.source_tag, t.all_day && t.due_at ? wibDate(new Date(t.due_at)) : wibDateTime(t.due_at),
      wibDateTime(t.completed_at), t.project_id ? prj.get(t.project_id) : '', t.course_id ? crs.get(t.course_id) : '', t.estimate_min, t.notes,
    ]);
  return toCsv(['judul', 'status', 'prioritas', 'sumber', 'tenggat', 'selesai_pada', 'proyek', 'matkul', 'estimasi_menit', 'catatan'], rows);
}

export function routinesCsv(routines: Routine[], logs: RoutineLog[]): string {
  const byId = new Map(routines.map((r) => [r.id, r]));
  const rows = logs
    .filter((l) => byId.has(l.routine_id))
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((l) => {
      const r = byId.get(l.routine_id) as Routine;
      return [l.log_date, r.name, r.is_required ? 'wajib' : 'kebiasaan', r.kind === 'count' ? 'jumlah' : 'centang', l.value, r.target_count, l.done];
    });
  return toCsv(['tanggal', 'rutinitas', 'jenis', 'tipe', 'nilai', 'target', 'selesai'], rows);
}

export function sessionsCsv(sessions: StudySession[], modules: LearningModule[], units: LearningUnit[], courses: Course[]): string {
  const mod = new Map(modules.map((m) => [m.id, m.title]));
  const unit = new Map(units.map((u) => [u.id, u.title]));
  const crs = new Map(courses.map((c) => [c.id, c.name]));
  const rows = sessions
    .filter((s) => !s.deleted_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((s) => [
      s.started_on, wibTime(new Date(s.started_at)), s.duration_min, s.module_id ? mod.get(s.module_id) : '',
      s.unit_id ? unit.get(s.unit_id) : '', s.course_id ? crs.get(s.course_id) : '', s.source,
    ]);
  return toCsv(['tanggal', 'mulai', 'durasi_menit', 'modul', 'unit', 'matkul', 'sumber'], rows);
}

export type CsvKind = 'transaksi' | 'tugas' | 'rutinitas' | 'sesi-belajar';
export const CSV_LABEL: Record<CsvKind, string> = {
  transaksi: 'Transaksi', tugas: 'Tugas', rutinitas: 'Rutinitas & log', 'sesi-belajar': 'Sesi belajar',
};

/** Ambil data lalu bangun CSV satu modul. */
export async function buildCsv(repo: Repo, kind: CsvKind): Promise<string> {
  switch (kind) {
    case 'transaksi': {
      const [t, c, w] = await Promise.all([repo.list('transactions'), repo.list('categories'), repo.list('wallets')]);
      return transactionsCsv(t, c, w);
    }
    case 'tugas': {
      const [t, p, c] = await Promise.all([repo.list('tasks'), repo.list('projects'), repo.list('courses')]);
      return tasksCsv(t, p, c);
    }
    case 'rutinitas': {
      const [r, l] = await Promise.all([repo.list('routines'), repo.list('routine_logs')]);
      return routinesCsv(r, l);
    }
    case 'sesi-belajar': {
      const [s, m, u, c] = await Promise.all([repo.list('study_sessions'), repo.list('learning_modules'), repo.list('learning_units'), repo.list('courses')]);
      return sessionsCsv(s, m, u, c);
    }
  }
}
