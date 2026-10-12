// Alat Chat Hamzi (TECH-SPEC §7.8.2–7.8.3): HANYA alat baca agregat + alat propose_*. TIDAK ADA alat tulis.
// Deklarasi propose_* dibangkitkan dari skema zod bersama (common/schemas.ts PROPOSE_SCHEMAS).
// Eksekutor alat baca memanggil RPC sebagai PENGGUNA (RLS) lalu menyaring hasil sesuai ai_share.
import { z } from 'zod';
import { PROPOSE_SCHEMAS, type ProposeTool } from './common/schemas.ts';
import { addDays, wibDate } from './common/calc/date.ts';
import { redact } from './redact.ts';
import type { JsonSchema, ToolDecl } from './llm.ts';
import { rpc, type Db } from './supabase.ts';

export type AiShare = Record<string, boolean>;

export const DEFAULT_SHARE: AiShare = {
  tasks: true, task_titles: true, courses: true, learning: true, routines: true,
  finance: true, finance_amounts: true, goals: true, goals_amounts: false, investments: true, investments_amounts: false,
};

export function shareFrom(v: unknown): AiShare {
  const out: AiShare = { ...DEFAULT_SHARE };
  if (v && typeof v === 'object') for (const [k, b] of Object.entries(v as Record<string, unknown>)) if (typeof b === 'boolean') out[k] = b;
  return out;
}

// ---------------------------------------------------------------- zod → JSON Schema (subset)
const DATE_RE = '^\\d{4}-\\d{2}-\\d{2}$';

export function zodToJsonSchema(schema: z.ZodTypeAny, description?: string): JsonSchema {
  let s: z.ZodTypeAny = schema;
  while (s instanceof z.ZodOptional || s instanceof z.ZodDefault || s instanceof z.ZodNullable || s instanceof z.ZodEffects) {
    s = s instanceof z.ZodEffects ? s.innerType() : s instanceof z.ZodDefault ? s.removeDefault() : s.unwrap();
  }
  const withDesc = (j: JsonSchema): JsonSchema => (description ? { ...j, description } : j);
  if (s instanceof z.ZodObject) {
    const shape = s.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = zodToJsonSchema(v, FIELD_HINTS[k]);
      if (!v.isOptional()) required.push(k);
    }
    return withDesc({ type: 'object', properties, ...(required.length ? { required } : {}) });
  }
  if (s instanceof z.ZodString) {
    const out: JsonSchema = { type: 'string' };
    const hints: string[] = [];
    for (const c of s._def.checks) {
      if (c.kind === 'min') out.minLength = c.value;
      else if (c.kind === 'max') out.maxLength = c.value;
      else if (c.kind === 'regex') hints.push(c.regex.source === DATE_RE ? 'format YYYY-MM-DD' : c.regex.source.includes('[0-5]') ? 'format HH:MM (24 jam)' : '');
    }
    const d = [description, ...hints.filter(Boolean)].filter(Boolean).join('; ');
    return d ? { ...out, description: d } : out;
  }
  if (s instanceof z.ZodNumber) {
    const out: JsonSchema = { type: 'number' };
    for (const c of s._def.checks) {
      if (c.kind === 'int') out.type = 'integer';
      else if (c.kind === 'min') out.minimum = c.value;
      else if (c.kind === 'max') out.maximum = c.value;
    }
    return withDesc(out);
  }
  if (s instanceof z.ZodBoolean) return withDesc({ type: 'boolean' });
  if (s instanceof z.ZodEnum) return withDesc({ type: 'string', enum: [...(s.options as string[])] });
  if (s instanceof z.ZodLiteral) {
    const v = s.value as unknown;
    return withDesc(typeof v === 'number' ? { type: 'integer', enum: [v] } : { type: 'string', enum: [String(v)] });
  }
  if (s instanceof z.ZodArray) {
    const out: JsonSchema = { type: 'array', items: zodToJsonSchema(s.element) };
    if (s._def.minLength) out.minItems = s._def.minLength.value;
    if (s._def.maxLength) out.maxItems = s._def.maxLength.value;
    if (s._def.exactLength) { out.minItems = s._def.exactLength.value; out.maxItems = s._def.exactLength.value; }
    return withDesc(out);
  }
  if (s instanceof z.ZodUnion) {
    const opts = s.options as z.ZodTypeAny[];
    // gabungan literal angka (mis. prioritas 1|2|3|4) → integer dengan enum
    if (opts.every((o) => o instanceof z.ZodLiteral && typeof o.value === 'number')) {
      const vals = opts.map((o) => (o as z.ZodLiteral<number>).value);
      return withDesc({ type: 'integer', enum: vals, minimum: Math.min(...vals), maximum: Math.max(...vals) });
    }
    // union lain (mis. repeat: enum | int[]) → string; dinormalisasi di normalizeProposeArgs sebelum validasi zod
    return { type: 'string', description: description ?? 'teks' };
  }
  return withDesc({ type: 'string' });
}

const FIELD_HINTS: Record<string, string> = {
  priority: 'Prioritas: 1 Rendah, 2 Sedang, 3 Tinggi, 4 Kritis',
  due_date: 'Tanggal tenggat',
  due_time: 'Jam tenggat',
  course_name: 'Nama mata kuliah persis seperti di list_names(courses) bila ada',
  category_name: 'Nama kategori persis seperti di list_names(categories) bila ada',
  goal_name: 'Nama target persis seperti di list_names(goals)',
  weight_pct: 'Bobot nilai dalam persen',
  repeat: "Pengulangan: 'daily', 'weekdays' (Sen–Jum), 'weekend', atau daftar hari '1,3,5' (1=Senin … 7=Minggu)",
  remind_days: 'Hari pengingat 1=Senin … 7=Minggu',
  weekday: 'Hari 1=Senin … 7=Minggu',
  amount: 'Nominal rupiah bilangan bulat (tanpa titik)',
  kind: 'Jenis',
  unit_titles: 'Judul unit belajar berurutan',
  target_count: 'Target per hari (untuk jenis count)',
};

/** Rapikan argumen model sebelum validasi zod (tanpa mengarang nilai). */
export function normalizeProposeArgs(tool: ProposeTool, args: unknown): unknown {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  const a = { ...(args as Record<string, unknown>) };
  if (tool === 'propose_routine' && typeof a.repeat === 'string') {
    const r = a.repeat.trim().toLowerCase();
    if (/^[1-7](\s*,\s*[1-7])*$/.test(r)) a.repeat = [...new Set(r.split(',').map((x) => Number(x.trim())))];
    else if (['setiap hari', 'harian', 'everyday'].includes(r)) a.repeat = 'daily';
  }
  for (const k of ['amount', 'priority', 'target_count', 'unit_count', 'weekday', 'credits', 'weight_pct']) {
    if (typeof a[k] === 'string' && /^\d+$/.test(a[k] as string)) a[k] = Number(a[k]);
  }
  for (const [k, v] of Object.entries(a)) if (v === null) delete a[k];
  return a;
}

// ---------------------------------------------------------------- Deklarasi alat
const READ_ARGS = {
  get_today_overview: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  get_week_summary: z.object({ week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  get_finance_summary: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  get_courses_overview: z.object({}),
  get_learning_overview: z.object({}),
  get_goals_overview: z.object({}),
  get_growth_overview: z.object({}),
  list_upcoming: z.object({ days: z.number().int().min(1).max(14).default(7) }),
  list_names: z.object({ type: z.enum(['courses', 'categories', 'goals', 'modules', 'routines', 'projects']) }),
} as const;
export type ReadTool = keyof typeof READ_ARGS;

const READ_DESC: Record<ReadTool, string> = {
  get_today_overview: 'Ringkasan hari ini: tugas teratas, kelas & ujian, rutinitas/pohon, keuangan hari ini, target teratas.',
  get_week_summary: 'Ringkasan satu minggu (Senin–Minggu): tugas selesai/terlambat, menit belajar vs target, pohon kebun, pengeluaran & kategori teratas, kehadiran.',
  get_finance_summary: 'Ringkasan keuangan periode from..to: total per kategori, pemasukan/pengeluaran, dibanding periode sebelumnya.',
  get_courses_overview: 'IPK, SKS, IPS, proyeksi, kehadiran, jadwal kelas hari ini, ujian ≤ 7 hari, daftar mata kuliah aktif.',
  get_learning_overview: 'Belajar mandiri: menit hari ini & minggu ini, target, modul aktif dan progres unit.',
  get_goals_overview: 'Target tabungan (jenis, progres %, status, kebutuhan per bulan) dan ringkasan investasi.',
  get_growth_overview: 'Pohon & kebun: tetes air, tahap pohon, rutinitas wajib hari ini, level kebun, streak.',
  list_upcoming: 'Daftar agenda N hari ke depan (maks 14): tugas, ujian, event, kelas (judul, tanggal, jam).',
  list_names: 'Daftar nama untuk pencocokan: courses, categories, goals, modules, routines, projects.',
};

const PROPOSE_DESC: Record<ProposeTool, string> = {
  propose_task: 'USULKAN tugas baru (tidak menyimpan; pengguna harus konfirmasi).',
  propose_routine: 'USULKAN rutinitas/kebiasaan baru (tidak menyimpan).',
  propose_learning_module: 'USULKAN modul belajar mandiri + unit (tidak menyimpan).',
  propose_transaction: 'USULKAN catatan pengeluaran/pemasukan (tidak menyimpan, tidak memindah uang).',
  propose_exam: 'USULKAN ujian/kuis (tidak menyimpan).',
  propose_class_schedule: 'USULKAN jadwal kelas mingguan (tidak menyimpan).',
  propose_event: 'USULKAN event kalender (tidak menyimpan).',
  propose_goal_contribution: 'USULKAN setoran ke target tabungan yang SUDAH ada (tidak menyimpan).',
};

export const READ_TOOLS: ToolDecl[] = (Object.keys(READ_ARGS) as ReadTool[]).map((name) => ({
  name,
  description: READ_DESC[name],
  parameters: zodToJsonSchema(READ_ARGS[name]),
}));

export const PROPOSE_TOOLS: ToolDecl[] = (Object.keys(PROPOSE_SCHEMAS) as ProposeTool[]).map((name) => ({
  name,
  description: PROPOSE_DESC[name],
  parameters: zodToJsonSchema(PROPOSE_SCHEMAS[name]),
}));

export const ALL_TOOLS: ToolDecl[] = [...READ_TOOLS, ...PROPOSE_TOOLS];

export const isReadTool = (n: string): n is ReadTool => n in READ_ARGS;
export const isProposeTool = (n: string): n is ProposeTool => n in PROPOSE_SCHEMAS;

// ---------------------------------------------------------------- Sanitasi
type J = Record<string, unknown>;
const rec = (v: unknown): J => (v && typeof v === 'object' && !Array.isArray(v) ? (v as J) : {});
const list = (v: unknown): J[] => (Array.isArray(v) ? v.map(rec) : []);

const DROP_KEYS = new Set(['room', 'lecturer', 'note', 'notes', 'display_name', 'subscriptions', 'endpoint']);

/** Buang id & kunci terlarang, redaksi setiap string (nomor panjang, email, telepon). */
export function scrub(v: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (typeof v === 'string') return redact(v).slice(0, 300);
  if (Array.isArray(v)) return v.slice(0, 60).map((x) => scrub(x, depth + 1));
  if (v && typeof v === 'object') {
    const out: J = {};
    for (const [k, x] of Object.entries(v as J)) {
      if (DROP_KEYS.has(k) || k === 'id' || k.endsWith('_id')) continue;
      out[k] = scrub(x, depth + 1);
    }
    return out;
  }
  return v;
}

const pick = (o: J, keys: string[]): J => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const disabled = (what: string) => ({ disabled: true, message: `Pengguna tidak membagikan data ${what} ke Hamzi.` });
const letter = (i: number) => String.fromCharCode(65 + (i % 26));

function tasksView(t: J, share: AiShare): J {
  return {
    due_today: t.due_today, overdue: t.overdue, done_today: t.done_today,
    top: list(t.top).map((x, i) => ({
      label: share.task_titles ? x.title : `Tugas ${letter(i)}`,
      priority: x.priority_label, due: x.due_label, overdue: x.overdue, est_min: x.est_min,
      ...(share.courses && x.course ? { course: x.course } : {}),
    })),
  };
}

function scheduleView(s: J): J {
  return {
    classes_today: list(s.classes_today).map((c) => pick(c, ['name', 'start', 'end', 'attendance'])),
    exams_next_7d: list(s.exams_next_7d).map((e) => ({ kind: e.kind_label, course: e.course, date: e.date, time: e.time, in_days: e.in_days })),
  };
}

function growthView(g: J): J {
  return pick(g, ['water_total', 'stage_name', 'progress_pct', 'to_next', 'next_name', 'required_due', 'required_done',
    'garden_level_today', 'bloom_today', 'study_min_today', 'streak']);
}

const FIN_AMOUNT_KEYS = ['spent_today', 'avg_daily_7d', 'spent_cycle', 'income_cycle', 'budget_total', 'safe_daily', 'balance_total'];

export interface ToolContext {
  db: Db;
  share: AiShare;
  now: Date;
}

/** Jalankan alat baca sebagai pengguna; hasil sudah disaring ai_share + scrub. */
export async function executeReadTool(name: ReadTool, rawArgs: unknown, ctx: ToolContext): Promise<{ result: unknown; summary: string }> {
  const parsed = READ_ARGS[name].safeParse(rawArgs ?? {});
  if (!parsed.success) return { result: { error: 'argumen tidak valid', detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`) }, summary: 'argumen tidak valid' };
  const args = parsed.data as J;
  const { db, share } = ctx;
  const today = wibDate(ctx.now);
  let result: J;

  switch (name) {
    case 'get_today_overview': {
      const date = (args.date as string | undefined) ?? today;
      const home = rec(await rpc(db, 'rpc_home', { p_date: date }));
      result = { date, weekday: home.weekday, part_of_day: home.part_of_day, level: home.level, xp: home.xp };
      if (share.tasks) result.tasks = tasksView(rec(await rpc(db, 'rpc_tasks_overview', { p_date: date, p_limit: 5 })), share);
      if (share.courses) result.schedule = scheduleView(rec(await rpc(db, 'rpc_schedule_overview', { p_date: date })));
      if (share.routines) result.growth = growthView(rec(await rpc(db, 'rpc_growth_overview', { p_date: date })));
      if (share.finance) {
        const f = pick(home, ['pct_vs_avg', 'budget_used_pct', 'days_left', ...FIN_AMOUNT_KEYS]);
        if (!share.finance_amounts) for (const k of FIN_AMOUNT_KEYS) delete f[k];
        result.finance = { amounts_included: !!share.finance_amounts, ...f };
      }
      if (share.goals && home.top_goal) {
        const g = rec(home.top_goal);
        result.top_goal = { name: g.name, kind: g.kind, progress_pct: g.progress_pct, ...(share.goals_amounts ? { saved: g.saved, target_amount: g.target_amount } : {}) };
      }
      break;
    }
    case 'get_week_summary': {
      const ws = (args.week_start as string | undefined) ?? today;
      const w = rec(await rpc(db, 'rpc_week_summary', { p_week_start: ws }));
      result = { week_start: w.week_start, week_end: w.week_end };
      if (share.tasks) result.tasks = w.tasks;
      if (share.learning) result.learning = w.learning;
      if (share.routines) result.garden = { trees: rec(w.garden).trees, days: list(rec(w.garden).days).map((d) => pick(d, ['day', 'level'])) };
      if (share.finance) {
        const f = rec(w.finance);
        result.finance = share.finance_amounts
          ? f
          : { top_category: f.top_category, budget_used_pct: f.budget_used_pct, top_categories: list(f.top_categories).map((c) => pick(c, ['name', 'pct'])) };
      }
      if (share.courses) result.attendance = w.attendance;
      break;
    }
    case 'get_finance_summary': {
      if (!share.finance) return { result: disabled('keuangan'), summary: 'keuangan tidak dibagikan' };
      let from = args.from as string;
      let to = args.to as string;
      if (to < from) [from, to] = [to, from];
      if (from < addDays(to, -366)) from = addDays(to, -366);
      const p = rec(await rpc(db, 'rpc_finance_period', { p_from: from, p_to: to }));
      result = share.finance_amounts
        ? { ...p, amounts_included: true }
        : {
          from: p.from, to: p.to, amounts_included: false, expense_change_pct: p.expense_change_pct,
          by_category: list(p.by_category).map((c) => pick(c, ['name', 'pct'])),
        };
      break;
    }
    case 'get_courses_overview': {
      if (!share.courses) return { result: disabled('kuliah'), summary: 'kuliah tidak dibagikan' };
      const g = rec(await rpc(db, 'rpc_gpa_summary'));
      const s = rec(await rpc(db, 'rpc_schedule_overview', { p_date: today }));
      result = {
        ...pick(g, ['ipk', 'credits_passed', 'curriculum_credits', 'target_gpa', 'semester_credits', 'ips_official', 'ips_sim', 'projected', 'required', 'attendance_pct', 'attendance_avg_pct']),
        semester: g.active_semester ? pick(rec(g.active_semester), ['number', 'label']) : null,
        courses: list(g.courses).map((c) => pick(c, ['name', 'credits', 'final_grade', 'sim_grade', 'target_grade', 'attendance', 'min_attendance_pct'])),
        ...scheduleView(s),
      };
      break;
    }
    case 'get_learning_overview': {
      if (!share.learning) return { result: disabled('belajar'), summary: 'belajar tidak dibagikan' };
      const l = rec(await rpc(db, 'rpc_learning_overview', { p_date: today }));
      result = {
        ...pick(l, ['minutes_today', 'minutes_week', 'weekly_target_min', 'week_start']),
        modules: list(l.modules).map((m) => pick(m, ['title', 'category', 'done', 'total', 'minutes_week', 'weekly_target_min', 'next_unit', 'studied_today'])),
      };
      break;
    }
    case 'get_goals_overview': {
      result = {};
      if (share.goals) {
        const g = rec(await rpc(db, 'rpc_goals_overview'));
        result.goals = list(g.goals).map((x) => ({
          ...pick(x, ['name', 'kind', 'status', 'state', 'progress_pct', 'due_date', 'months_left', 'on_track']),
          ...(share.goals_amounts ? pick(x, ['target_amount', 'saved', 'monthly_needed', 'monthly_plan']) : {}),
        }));
      } else result.goals = disabled('target tabungan');
      if (share.investments) {
        const inv = rec(await rpc(db, 'rpc_investments_overview'));
        result.investments = {
          by_class: inv.by_class,
          total_pl_pct: inv.total_pl_pct,
          assets: list(inv.assets).map((a) => ({
            ...pick(a, ['asset_class', 'alloc_pct', 'pl_pct', 'days_since_valuation']),
            ...(share.investments_amounts ? pick(a, ['capital', 'value', 'pl']) : {}),
          })),
          ...(share.investments_amounts ? pick(inv, ['total_capital', 'total_value', 'total_pl']) : {}),
        };
      }
      break;
    }
    case 'get_growth_overview': {
      if (!share.routines) return { result: disabled('rutinitas'), summary: 'rutinitas tidak dibagikan' };
      result = growthView(rec(await rpc(db, 'rpc_growth_overview', { p_date: today })));
      break;
    }
    case 'list_upcoming': {
      const u = rec(await rpc(db, 'rpc_list_upcoming', { p_days: args.days }));
      let i = 0;
      const items = list(u.items).filter((x) => {
        if (x.type === 'task') return share.tasks;
        if (x.type === 'exam' || x.type === 'class') return share.courses;
        return true;
      }).map((x) => (x.type === 'task' && !share.task_titles ? { ...x, title: `Tugas ${letter(i++)}` } : x));
      result = { from: u.from, to: u.to, items };
      break;
    }
    case 'list_names': {
      const t = args.type as string;
      const flag: Record<string, string> = { courses: 'courses', categories: 'finance', goals: 'goals', modules: 'learning', routines: 'routines', projects: 'tasks' };
      if (!share[flag[t]]) return { result: disabled(t), summary: `${t} tidak dibagikan` };
      result = rec(await rpc(db, 'rpc_list_names', { p_type: t }));
      break;
    }
  }
  const clean = scrub(result) as J;
  return { result: clean, summary: summarize(name, clean) };
}

function summarize(name: string, r: J): string {
  const parts = Object.entries(r).slice(0, 8).map(([k, v]) => (Array.isArray(v) ? `${k}[${v.length}]` : k));
  return `${name}: ${parts.join(', ')}`.slice(0, 160);
}
