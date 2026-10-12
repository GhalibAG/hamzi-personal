// ai-generate — Kata Hamzi (daily_summary) & review mingguan (weekly_review). TECH-SPEC §6.4, §7.2–§7.7.
// POST { kind, force? } → { ok, source: 'ai'|'cache'|'template', data }
// Alur: pengaturan → cache kind:periode → kuota AI_DAILY_LIMIT → payload agregat (ai_share, ≤ 4 KB) → penyedia
//       (Gemini → Groq) → zod (1× repair) → grounding angka + filter konten → gagal = templat → upsert ai_requests.
import { z } from 'zod';
import { dailySummarySchema, weeklyReviewSchema, type DailySummary, type WeeklyReview } from '../_shared/common/schemas.ts';
import { groundingCheck } from '../_shared/common/grounding.ts';
import { wibDate, weekStart } from '../_shared/common/calc/date.ts';
import { corsHeaders, json, logEvent, originRejected, preflight } from '../_shared/cors.ts';
import { envInt, requireUser } from '../_shared/supabase.ts';
import { providerChain, type LlmProvider } from '../_shared/llm.ts';
import { buildDailyPayload, buildWeekPayload, type DailyPayload, type WeekPayload } from '../_shared/payload.ts';
import { templateDaily, templateWeekly } from '../_shared/templates.ts';
import { shareFrom, zodToJsonSchema } from '../_shared/tools.ts';
import { hasSensitive } from '../_shared/redact.ts';

const Body = z.object({ kind: z.enum(['daily_summary', 'weekly_review']), force: z.boolean().optional() });
type Kind = z.infer<typeof Body>['kind'];
type Output = DailySummary | WeeklyReview;

const SYSTEM = `Kamu adalah Hamzi, kucing maskot asisten pribadi pengguna. Gaya: ramah, ringkas, santai tapi sopan,
tidak menggurui, tidak membuat pengguna merasa bersalah.
ATURAN KERAS:
1. Gunakan HANYA angka yang ada di DATA. Jangan menghitung, menebak, atau mengarang angka.
2. Jangan merekomendasikan produk investasi, saham, kripto, atau platform tertentu.
3. Jangan meminta atau menyebut data pribadi (nomor rekening, identitas, nama orang).
4. Bila data kurang, katakan singkat dan beri satu langkah kecil.
5. Keluarkan HANYA JSON valid sesuai skema. Bahasa Indonesia.`;

const INSTRUCTION: Record<Kind, string> = {
  daily_summary: 'Tulis ringkasan harian "Kata Hamzi": greeting (≤120 karakter), highlights 1–3 (≤140), suggestions 1–3 {text ≤160, module, action_key opsional}, mood, numbers_used (angka dari DATA yang kamu pakai).',
  weekly_review: 'Tulis review mingguan: summary (≤300 karakter), went_well 1–3, needs_attention 1–3, next_week_priorities tepat 3, mood, numbers_used.',
};

// Filter konten (§7.5): produk investasi/ticker & pola sensitif → tolak → templat.
// ("Bibit" sengaja tidak dimasukkan: itu nama tahap pohon.)
const INVEST_WORDS = /\b(bitcoin|btc|ethereum|dogecoin|crypto|kripto|nft|forex|binance|pluang|stockbit|tokocrypto|indodax|beli saham|reksa ?dana)\b/i;
const TICKER = /\b[A-Z]{4}\.JK\b|\b[Ss]aham [A-Z]{4}\b/;
const INVEST_RE = { test: (t: string) => INVEST_WORDS.test(t) || TICKER.test(t) };

function texts(kind: Kind, o: Output): string[] {
  if (kind === 'daily_summary') {
    const d = o as DailySummary;
    return [d.greeting, ...d.highlights, ...d.suggestions.map((s) => s.text)];
  }
  const w = o as WeeklyReview;
  return [w.summary, ...w.went_well, ...w.needs_attention, ...w.next_week_priorities];
}

function guard(kind: Kind, o: Output, payload: unknown): string | null {
  const all = texts(kind, o).join('\n');
  if (!groundingCheck(all, payload).ok) return 'grounding';
  if (INVEST_RE.test(all)) return 'content';
  if (hasSensitive(all)) return 'sensitive';
  return null;
}

async function generate(provider: LlmProvider, kind: Kind, payload: unknown): Promise<{ data: Output; usage: { in: number; out: number }; model: string }> {
  const schema = kind === 'daily_summary' ? dailySummarySchema : weeklyReviewSchema;
  const jsonSchema = zodToJsonSchema(schema);
  const user = `DATA:\n${JSON.stringify(payload)}\n\n${INSTRUCTION[kind]}`;
  const first = await provider.generateJson({ system: SYSTEM, user, schema: jsonSchema, temperature: 0.3, timeoutMs: 20_000 });
  const parsed = schema.safeParse(first.data);
  if (parsed.success) return { data: parsed.data, usage: first.usage, model: first.model };
  // 1× repair
  const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(akar)'}: ${i.message}`).join('; ');
  const repair = await provider.generateJson({
    system: SYSTEM,
    user: `${user}\n\nJSON sebelumnya tidak sesuai skema (${issues}). Perbaiki dan keluarkan JSON lengkap yang valid.\nJSON sebelumnya: ${JSON.stringify(first.data).slice(0, 2000)}`,
    schema: jsonSchema, temperature: 0.2, timeoutMs: 20_000,
  });
  const again = schema.safeParse(repair.data);
  if (!again.success) throw new Error('schema');
  return { data: again.data, usage: { in: first.usage.in + repair.usage.in, out: first.usage.out + repair.usage.out }, model: repair.model };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);
  if (originRejected(req)) return json({ ok: false, error: 'origin' }, 403, cors);
  const auth = await requireUser(req);
  if (!auth) return json({ ok: false, error: 'unauthorized' }, 401, cors);
  const { client: db, uid } = auth;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400, cors);
  }
  const kind = body.kind;
  const now = new Date();
  const today = wibDate(now);
  const period = kind === 'daily_summary' ? today : weekStart(today);
  const cacheKey = `${kind}:${period}`;

  try {
    const { data: st } = await db.from('user_settings').select('ai_enabled, ai_share, budget_cycle_day').eq('user_id', uid).maybeSingle();
    const share = shareFrom(st?.ai_share);
    const payload: DailyPayload | WeekPayload = kind === 'daily_summary'
      ? await buildDailyPayload(db, share, Number(st?.budget_cycle_day ?? 1), now)
      : await buildWeekPayload(db, share, now);
    const template = (): Output => (kind === 'daily_summary' ? templateDaily(payload as DailyPayload) : templateWeekly(payload as WeekPayload));

    const { data: existing } = await db.from('ai_requests')
      .select('id, status, response, created_at, calls, calls_day').eq('user_id', uid).eq('cache_key', cacheKey).maybeSingle();

    const save = async (row: Record<string, unknown>) => {
      const { data, error } = await db.from('ai_requests')
        .upsert({ user_id: uid, kind, cache_key: cacheKey, payload, created_at: new Date().toISOString(), ...row }, { onConflict: 'user_id,cache_key' })
        .select('id').single();
      if (error) throw new Error(`ai_requests: ${error.message}`);
      return (data as { id: string }).id;
    };
    const fallback = async (reason: string) => {
      const data = template();
      const id = await save({ response: data, provider: 'templat', model: null, status: 'fallback', error: reason, tokens_in: null, tokens_out: null });
      logEvent('ai-generate', { kind, source: 'template', reason });
      return json({ ok: true, source: 'template', data, id }, 200, cors);
    };

    // 1. AI dimatikan → templat
    if (st && st.ai_enabled === false) return await fallback('ai_disabled');

    // 2. cache (Segarkan: jeda minimal 10 menit)
    const fresh = existing && (existing.status === 'ok' || existing.status === 'cached') && existing.response;
    if (fresh && (!body.force || Date.now() - new Date(existing.created_at as string).getTime() < 10 * 60_000)) {
      logEvent('ai-generate', { kind, source: 'cache' });
      return json({ ok: true, source: 'cache', data: existing.response, id: existing.id }, 200, cors);
    }

    // 3. kuota harian (jumlah panggilan penyedia per hari WIB)
    const { data: usedRows } = await db.from('ai_requests').select('calls').eq('user_id', uid).eq('calls_day', today);
    const used = (usedRows ?? []).reduce((a: number, r: { calls: number | null }) => a + (r.calls ?? 0), 0);
    if (used >= envInt('AI_DAILY_LIMIT', 20)) {
      if (fresh) return json({ ok: true, source: 'cache', data: existing.response, id: existing.id }, 200, cors);
      return await fallback('quota');
    }

    // 4–6. penyedia → validasi → grounding
    const chain = providerChain({ needFiles: false });
    if (!chain.length) return await fallback('no_provider');
    const calls = (existing?.calls_day === today ? Number(existing?.calls ?? 0) : 0) + 1;
    for (const provider of chain) {
      try {
        const r = await generate(provider, kind, payload);
        const bad = guard(kind, r.data, payload);
        if (bad) {
          const data = template();
          const id = await save({ response: data, provider: provider.name, model: r.model, status: 'fallback', error: bad, tokens_in: r.usage.in, tokens_out: r.usage.out, calls, calls_day: today });
          logEvent('ai-generate', { kind, source: 'template', reason: bad, provider: provider.name });
          return json({ ok: true, source: 'template', data, id }, 200, cors);
        }
        const id = await save({ response: r.data, provider: provider.name, model: r.model, status: 'ok', error: null, tokens_in: r.usage.in, tokens_out: r.usage.out, calls, calls_day: today });
        logEvent('ai-generate', { kind, source: 'ai', provider: provider.name, tin: r.usage.in, tout: r.usage.out });
        return json({ ok: true, source: 'ai', data: r.data, id }, 200, cors);
      } catch (e) {
        logEvent('ai-generate', { kind, provider: provider.name, error: e instanceof Error ? e.message.slice(0, 60) : 'error' });
      }
    }
    if (fresh) return json({ ok: true, source: 'cache', data: existing.response, id: existing.id }, 200, cors);
    const data = template();
    const id = await save({ response: data, provider: 'templat', model: null, status: 'error', error: 'providers_failed', calls, calls_day: today });
    return json({ ok: true, source: 'template', data, id }, 200, cors);
  } catch (e) {
    logEvent('ai-generate', { kind, error: e instanceof Error ? e.message.slice(0, 80) : 'error' });
    return json({ ok: false, error: 'server' }, 500, cors);
  }
});
