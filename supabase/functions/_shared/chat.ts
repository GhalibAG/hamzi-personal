// Inti Chat Hamzi (TECH-SPEC §7.8): loop alat maks 4 putaran, usulan propose_* divalidasi zod dan diberi label di server,
// TIDAK ADA alat tulis. Dipisah dari ai-chat/index.ts agar bisa diuji tanpa server.
import { PROPOSE_SCHEMAS, type ProposalItem, type Proposals, type ProposeTool } from './common/schemas.ts';
import { proposalDetail, proposalKind, proposalLabel } from './common/proposal-format.ts';
import type { ChatTurn, LlmProvider, ToolCall, Usage } from './llm.ts';
import { ALL_TOOLS, executeReadTool, isProposeTool, isReadTool, normalizeProposeArgs, scrub, type AiShare } from './tools.ts';
import type { Db } from './supabase.ts';

export const MAX_ROUNDS = 4;

/** Lampiran yang ditampilkan di judul kartu. */
export interface AttLike { name: string }

// ---------------------------------------------------------------- Kartu usulan (§7.8.5)
const DEST: Record<ProposeTool, string> = {
  propose_task: 'Rencana', propose_event: 'Rencana', propose_exam: 'Kuliah', propose_class_schedule: 'Kuliah',
  propose_routine: 'Tumbuh', propose_learning_module: 'Tumbuh', propose_transaction: 'Keuangan', propose_goal_contribution: 'Keuangan',
};

export function singleTitle(item: ProposalItem): string {
  switch (item.tool) {
    case 'propose_routine': return item.args.is_required === false ? 'Rutinitas baru' : 'Rutinitas wajib baru';
    case 'propose_transaction': return item.args.kind === 'income' ? 'Catat pemasukan' : 'Catat pengeluaran';
    case 'propose_task': return 'Tugas baru';
    case 'propose_exam': return 'Ujian baru';
    case 'propose_learning_module': return 'Modul belajar baru';
    case 'propose_class_schedule': return 'Jadwal kelas baru';
    case 'propose_event': return 'Event baru';
    case 'propose_goal_contribution': return 'Setoran target';
  }
}

export function buildProposals(items: ProposalItem[], attachments: AttLike[]): Proposals {
  const n = items.length;
  const title = attachments.length
    ? `Usulan dari ${attachments[0].name.replace(/\.[^.]+$/, '')} (${n})`
    : n === 1 ? singleTitle(items[0]) : `Usulan (${n})`;
  const dest = [...new Set(items.map((i) => DEST[i.tool]))].join(' & ');
  return { title, dest, items };
}

export function historySummary(p: unknown, state: string | undefined): string {
  if (!p || typeof p !== 'object') return '';
  const pr = p as Proposals;
  const labels = (pr.items ?? []).slice(0, 8).map((i) => `${i.kind}: ${i.label}`).join('; ');
  const st = state === 'applied' ? 'sudah disimpan pengguna' : state === 'cancelled' ? 'dibatalkan' : state === 'undone' ? 'diurungkan' : 'menunggu konfirmasi';
  return `\n[Kartu usulan "${pr.title}" (${st}): ${labels}]`;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

/** Salinan percakapan untuk sent_payload: tanpa base64 file, hasil alat dipotong. */
export function stripTurns(turns: ChatTurn[]): unknown[] {
  return turns.map((t) => {
    if (t.role === 'user') return { role: 'user', parts: t.parts.map((p) => (p.type === 'file' ? { type: 'file', name: p.name, mime: p.mime, bytes: Math.floor((p.data.length * 3) / 4) } : p)) };
    if (t.role === 'assistant') return { role: 'assistant', text: t.text, toolCalls: t.toolCalls };
    return { role: 'tool', results: t.results.map((r) => ({ name: r.name, response: JSON.stringify(r.response).slice(0, 4000) })) };
  });
}

export interface Outcome {
  text: string;
  proposals: ProposalItem[];
  toolsUsed: { name: string; args: unknown; result_summary: string }[];
  usage: Usage;
  model: string;
  turns: ChatTurn[];
}

export async function runChat(provider: LlmProvider, system: string, base: ChatTurn[], ctx: { db: Db; share: AiShare; now: Date; today: string; wallet: string }): Promise<Outcome> {
  const turns = [...base];
  const proposals: ProposalItem[] = [];
  const toolsUsed: Outcome['toolsUsed'] = [];
  const usage: Usage = { in: 0, out: 0 };
  let model = '';
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const r = await provider.chat({
      system, messages: turns, tools: ALL_TOOLS, toolChoice: round < MAX_ROUNDS ? 'auto' : 'none', temperature: 0.4, timeoutMs: 20_000,
    });
    usage.in += r.usage.in;
    usage.out += r.usage.out;
    model = r.model;
    if (!r.toolCalls?.length || round === MAX_ROUNDS) return { text: r.text ?? '', proposals, toolsUsed, usage, model, turns };
    const calls: ToolCall[] = r.toolCalls.slice(0, 12);
    turns.push({ role: 'assistant', text: r.text, toolCalls: calls, raw: r.raw });
    const results: { id: string; name: string; response: unknown }[] = [];
    for (const c of calls) {
      if (isReadTool(c.name)) {
        try {
          const out = await executeReadTool(c.name, c.args, { db: ctx.db, share: ctx.share, now: ctx.now });
          toolsUsed.push({ name: c.name, args: scrub(c.args), result_summary: out.summary });
          results.push({ id: c.id, name: c.name, response: out.result });
        } catch {
          toolsUsed.push({ name: c.name, args: scrub(c.args), result_summary: 'gagal' });
          results.push({ id: c.id, name: c.name, response: { error: 'data belum bisa dibaca' } });
        }
      } else if (isProposeTool(c.name)) {
        const parsed = PROPOSE_SCHEMAS[c.name].safeParse(normalizeProposeArgs(c.name, c.args));
        if (parsed.success && proposals.length < 40) {
          const args = parsed.data as Record<string, unknown>;
          proposals.push({
            tool: c.name, args,
            kind: proposalKind(c.name, args),
            label: proposalLabel(c.name, args),
            detail: proposalDetail(c.name, args, { today: ctx.today, defaultWallet: ctx.wallet }),
            selected: true,
          });
          toolsUsed.push({ name: c.name, args: scrub(args), result_summary: 'usulan ditampilkan' });
          results.push({ id: c.id, name: c.name, response: { status: 'shown_to_user_for_confirmation' } });
        } else {
          const err = parsed.success ? 'terlalu banyak usulan' : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'args'}: ${i.message}`).join('; ');
          toolsUsed.push({ name: c.name, args: scrub(c.args), result_summary: 'argumen tidak valid' });
          results.push({ id: c.id, name: c.name, response: { status: 'invalid_arguments', error: err } });
        }
      } else {
        results.push({ id: c.id, name: c.name || 'unknown', response: { error: 'alat tidak dikenal; hanya alat baca dan propose_* yang tersedia' } });
      }
    }
    turns.push({ role: 'tool', results });
  }
  return { text: '', proposals, toolsUsed, usage, model, turns };
}
