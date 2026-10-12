// Pengganti Edge `ai-chat` di MODE DEMO: parser deterministik tanpa AI (TECH-SPEC §7.8).
// Meniru kontrak & penyimpanan Edge: pesan pengguna (teks diredaksi) + pesan asisten (proposals, tools_used,
// sent_payload agregat) + ai_actions(pending). Tidak pernah menulis data domain — hanya mengusulkan.
import { thousands } from '@common/format.ts';
import { wibDate, wibTime } from '@common/calc/index.ts';
import { redact } from '@common/sensitive.ts';
import type { Proposals } from '@common/schemas.ts';
import type { Db } from '@/data/rpc-logic';
import type { Repo } from '@/data/repo';
import { uuid } from '@/data/repo';
import type { AiMessage, Settings } from '@/data/types';
import { buildWeekPayload, type TablesData, type WeekPayload } from '@/features/ai/payload';
import { financeSummary } from '@/features/finance/derive';
import { activeSemester } from '@/features/courses/derive';
import { parseIntent, sampleFromFile, type Intent, type ParseContext } from './parser';
import { buildProposals } from './proposals';
import {
  CHAT_DAILY_LIMIT, chatRequestSchema, type ChatAttachment, type ChatResponse, type ToolUse,
} from './types';

export const QUOTA_TEXT = 'Kuota ngobrol hari ini sudah habis. Semua menu manual tetap bisa dipakai, ya.';
export const DISABLED_TEXT = 'Chat Hamzi sedang dimatikan di pengaturan privasi AI. Semua menu manual tetap bisa dipakai, ya.';

export const HELP_TEXT = [
  'Aku bisa nambah data lewat chat (selalu minta konfirmasi dulu) atau jawab pertanyaan tentang datamu. Coba misalnya:',
  '• tambahin rutinitas minum air jam 9 pagi',
  '• ada tugas resume jurnal besok jam 20.00',
  '• jajan bakso 15rb',
  '• uts basis data lanjut 2 nov jam 8',
  '• modul belajar python dasar 10 unit',
  '• acara seminar karier jumat jam 13-15',
  '• setor 100rb ke dana darurat',
  '• rangkum minggu ini · aku boros di mana?',
].join('\n');

const REFUSE_TEXT = 'Aku cuma bisa nambah data baru. Menghapus atau mengubah data lama, memindah uang, dan mengubah pengaturan nggak bisa lewat chat. '
  + 'Kamu bisa lakukan langsung dari menunya: Rencana untuk tugas, Keuangan untuk transaksi & dompet, Tumbuh untuk rutinitas, dan Pengaturan.';

function tables(db: Db): TablesData {
  const { _profile: _p, _settings: _s, _stats: _t, ...rest } = db;
  return rest as unknown as TablesData;
}

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at;

export function parseContextFromDb(db: Db, now: Date): ParseContext {
  const sem = activeSemester(db.semesters.filter(alive));
  return {
    today: wibDate(now),
    now: wibTime(now),
    courses: db.courses.filter((c) => alive(c) && (!sem || c.semester_id === sem.id)).map((c) => c.name),
    categories: db.categories.filter((c) => !c.archived && alive(c)).map((c) => ({ name: c.name, kind: c.kind })),
    goals: db.savings_goals.filter((g) => alive(g) && g.status === 'aktif').map((g) => g.name),
    projects: db.projects.filter((p) => alive(p) && p.status !== 'selesai').map((p) => p.name),
  };
}

/* ---------------- jawaban dari alat baca (agregat) ---------------- */

/** Payload minggu ini yang boleh dibaca sesuai ai_share (TECH-SPEC §7.2). */
export function shareWeek(p: WeekPayload, share: Settings['ai_share']): Partial<WeekPayload> {
  const out: Partial<WeekPayload> = { kind: p.kind, week_start: p.week_start };
  if (share.tasks) out.tasks = p.tasks;
  if (share.learning) out.learning = p.learning;
  if (share.routines) out.garden_trees = p.garden_trees;
  if (p.finance) out.finance = p.finance;
  if (share.courses) out.attendance_pct = p.attendance_pct;
  return out;
}

export function weekSummaryText(p: Partial<WeekPayload>): string {
  const lines = ['Minggu ini sejauh ini:'];
  if (p.tasks) lines.push(`• Tugas: ${p.tasks.done} selesai, ${p.tasks.overdue} terlambat`);
  if (p.learning) lines.push(p.learning.target ? `• Belajar: ${p.learning.minutes} dari ${p.learning.target} menit` : `• Belajar: ${p.learning.minutes} menit`);
  if (p.garden_trees !== undefined) lines.push(`• Kebun: ${p.garden_trees} pohon tumbuh`);
  if (p.finance) {
    let f = `• Keuangan: anggaran terpakai ${p.finance.budget_used_pct}%`;
    if (p.finance.top_category) f += `, ${p.finance.top_category} paling besar`;
    if (p.finance.spent !== undefined) f += ` (keluar Rp ${thousands(p.finance.spent)} minggu ini)`;
    lines.push(f);
  }
  if (p.attendance_pct !== undefined && p.attendance_pct !== null) lines.push(`• Kuliah: hadir ${p.attendance_pct}%`);
  if (lines.length === 1) return 'Akses data untuk Hamzi lagi dimatikan semua, jadi aku belum bisa merangkum. Atur di Riwayat AI & izin (ikon perisai).';
  const tip = p.tasks && p.tasks.overdue
    ? 'Saran: beresin tugas yang terlambat dulu, satu per satu.'
    : p.learning && p.learning.target && p.learning.minutes < p.learning.target
      ? 'Saran: satu sesi fokus hari ini biar target belajar kekejar.'
      : 'Mantap, pertahankan ritmenya!';
  return [...lines, '', tip].join('\n');
}

interface SpendingFacts {
  amounts: boolean;
  top: { name: string; pct: number; amount?: number }[];
  pct_vs_avg_7d: number | null;
  budget_used_pct: number | null;
}

export function spendingFacts(db: Db, now: Date): SpendingFacts | null {
  const s = db._settings;
  if (!s.ai_share.finance) return null;
  const t = tables(db);
  const f = financeSummary({ transactions: t.transactions, wallets: t.wallets, budgets: t.budgets, categories: t.categories, cycleDay: s.budget_cycle_day, today: wibDate(now) });
  const amounts = !!s.ai_share.finance_amounts;
  return {
    amounts,
    top: f.byCategory.slice(0, 3).map((c) => ({ name: c.category?.name ?? 'Lainnya', pct: c.pct, ...(amounts ? { amount: c.amount } : {}) })),
    pct_vs_avg_7d: f.pctVsAvg,
    budget_used_pct: f.budgetTotal ? f.budgetUsedPct : null,
  };
}

export function spendingText(f: SpendingFacts | null): string {
  if (!f) return 'Akses data keuangan untuk Hamzi lagi dimatikan. Nyalakan "Keuangan" di Riwayat AI & izin (ikon perisai) kalau mau aku bantu cek.';
  if (!f.top.length) return 'Belum ada pengeluaran di siklus ini. Catat tiap jajan biar aku bisa bantu cek ya.';
  const [a, ...rest] = f.top;
  const lines: string[] = [];
  lines.push(`Paling besar di ${a.name}: ${a.pct}% dari pengeluaran siklus ini${a.amount !== undefined ? ` (Rp ${thousands(a.amount)})` : ''}.`);
  if (rest.length) lines.push(`Berikutnya ${rest.map((c) => `${c.name} ${c.pct}%`).join(' dan ')}.`);
  if (f.pct_vs_avg_7d !== null && f.pct_vs_avg_7d > 0) lines.push(`Pengeluaran hari ini ${f.pct_vs_avg_7d}% di atas rata-rata 7 hari.`);
  if (f.budget_used_pct !== null) lines.push(`Anggaran terpakai ${f.budget_used_pct}%.`);
  lines.push('');
  lines.push(a.name === 'Makan'
    ? 'Saran: coba bawa bekal beberapa kali seminggu. Mau aku bikinin rutinitasnya? Ketik misalnya: tambahin rutinitas siapin bekal jam 06:30 sen-jum'
    : 'Saran: pasang anggaran per kategori di Keuangan supaya aku bisa ngingetin lebih awal.');
  return lines.join('\n');
}

/* ---------------- penangan utama ---------------- */

interface Reply { text: string; proposals: Proposals | null; tools: ToolUse[]; toolResults: Record<string, unknown> }

function demoDelay(): Promise<void> {
  if (import.meta.env.MODE === 'test') return Promise.resolve();
  return new Promise((r) => setTimeout(r, 650));
}

function defaultWalletName(db: Db): string {
  const ws = db.wallets.filter((w) => !w.archived && alive(w));
  return (ws.find((w) => w.is_default) ?? ws[0])?.name ?? 'Tunai';
}

function replyFor(intent: Intent, db: Db, now: Date, ctx: ParseContext, fileName?: string): Reply {
  const base = { proposals: null, tools: [] as ToolUse[], toolResults: {} as Record<string, unknown> };
  switch (intent.type) {
    case 'help':
      return { ...base, text: (intent.greet ? 'Halo! ' : '') + HELP_TEXT };
    case 'refuse':
      return { ...base, text: REFUSE_TEXT };
    case 'ask':
      return { ...base, text: intent.text };
    case 'week_summary': {
      const p = shareWeek(buildWeekPayload(tables(db), db._settings, now), db._settings.ai_share);
      return {
        ...base,
        text: weekSummaryText(p),
        tools: [{ name: 'get_week_summary', args: { week_start: p.week_start }, result_summary: 'agregat minggu ini' }],
        toolResults: { get_week_summary: p },
      };
    }
    case 'spending': {
      const f = spendingFacts(db, now);
      return {
        ...base,
        text: spendingText(f),
        tools: f ? [{ name: 'get_finance_summary', args: { period: 'siklus_ini' }, result_summary: 'agregat pengeluaran per kategori' }] : [],
        toolResults: f ? { get_finance_summary: f } : {},
      };
    }
    case 'propose': {
      const { proposals, invalid } = buildProposals(intent.calls, { today: ctx.today, defaultWallet: defaultWalletName(db), fileName });
      if (!proposals) {
        return { ...base, text: 'Maaf, aku belum nangkap detailnya. Coba tulis lebih lengkap ya.\n\n' + HELP_TEXT };
      }
      const tools: ToolUse[] = proposals.items.map((i) => ({ name: i.tool, args: i.args, result_summary: 'shown_to_user_for_confirmation' }));
      const text = invalid ? `${intent.reply}\n(${invalid} usulan lain aku lewati karena datanya belum lengkap.)` : intent.reply;
      return { ...base, text, proposals, tools };
    }
  }
}

/**
 * Tangani `ai-chat` di mode demo. Kontrak sama dengan Edge:
 * `{ conversation_id, message: { id, text, proposals?, action_id? }, source }`.
 */
export async function localChat(body: unknown, db: Db, _repo: Repo): Promise<ChatResponse> {
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) throw new Error('Pesan tidak valid');
  const req = parsed.data;
  const s = db._settings;
  if (!s.ai_enabled || !s.ai_chat_enabled) {
    return { conversation_id: req.conversation_id ?? null, message: { id: uuid(), text: DISABLED_TEXT }, source: 'error' };
  }
  const attachments: ChatAttachment[] = req.attachments ?? [];
  if (attachments.some((a) => !a.path.startsWith(`${db._profile.id}/`))) throw new Error('Lampiran tidak valid');

  const now = new Date();
  const today = wibDate(now);
  const text = redact(req.text?.trim() ?? '');
  const stamp = () => new Date().toISOString();

  // percakapan
  let conv = req.conversation_id ? db.ai_conversations.find((c) => c.id === req.conversation_id && alive(c)) : undefined;
  if (!conv) {
    const title = (text || attachments[0]?.name || 'Percakapan baru').slice(0, 60);
    conv = { id: uuid(), title, created_at: stamp(), updated_at: stamp(), deleted_at: null };
    db.ai_conversations.push(conv);
  }

  // kuota harian (dihitung sebelum pesan ini disimpan)
  const usedToday = db.ai_messages.filter((m) => m.role === 'user' && m.created_at && wibDate(new Date(m.created_at)) === today).length;
  const limited = usedToday >= CHAT_DAILY_LIMIT;

  const userMsg: AiMessage = {
    id: uuid(), conversation_id: conv.id, role: 'user', content: text, attachments,
    proposals: null, tools_used: [], sent_payload: null, provider: null, model: null, status: 'ok', created_at: stamp(),
  };
  db.ai_messages.push(userMsg);

  const assistant = (content: string, extra: Partial<AiMessage>): AiMessage => ({
    id: uuid(), conversation_id: conv.id, role: 'assistant', content: content.slice(0, 8000), attachments: [],
    proposals: null, tools_used: [], sent_payload: null, provider: 'demo', model: null, status: 'ok', created_at: stamp(), ...extra,
  });

  if (limited) {
    const m = assistant(QUOTA_TEXT, { status: 'limited', provider: null });
    db.ai_messages.push(m);
    conv.updated_at = stamp();
    return { conversation_id: conv.id, message: { id: m.id, text: m.content }, source: 'limited' };
  }

  await demoDelay();

  const ctx = parseContextFromDb(db, now);
  let reply: Reply;
  let fileName: string | undefined;
  if (attachments.length) {
    fileName = attachments[0].name;
    const sample = sampleFromFile(fileName, ctx);
    const intro = 'Mode demo: aku belum bisa membaca isi file. Di akun asli, Hamzi membaca PDF/foto dari dosen lalu merangkum bobot nilai, tenggat, dan ujian.';
    if (sample) {
      reply = replyFor({ type: 'propose', calls: sample, reply: `${intro}\n\nIni contoh usulan dari nama filenya. Centang yang mau ditambah:` }, db, now, ctx, fileName);
    } else {
      reply = {
        text: `${intro}\n\nSementara ini, kamu bisa ketik isinya, misalnya: "ada tugas laporan praktikum 5 tanggal 20 matkul basis data lanjut".`,
        proposals: null, tools: [], toolResults: {},
      };
    }
  } else {
    reply = replyFor(parseIntent(text, ctx), db, now, ctx);
  }

  const sent_payload = {
    mode: 'demo',
    date: today,
    text,
    attachments: attachments.map((a) => ({ name: a.name, mime: a.mime, size: a.size, pages: a.pages ?? null })),
    tool_results: reply.toolResults,
  };
  const m = assistant(reply.text.slice(0, 1200), { proposals: reply.proposals, tools_used: reply.tools, sent_payload });
  db.ai_messages.push(m);
  let action_id: string | null = null;
  if (reply.proposals) {
    action_id = uuid();
    db.ai_actions.push({ id: action_id, message_id: m.id, state: 'pending', applied_refs: [], created_at: stamp(), updated_at: stamp() });
  }
  conv.updated_at = stamp();
  return {
    conversation_id: conv.id,
    message: { id: m.id, text: m.content, proposals: reply.proposals, action_id },
    source: 'demo',
  };
}
