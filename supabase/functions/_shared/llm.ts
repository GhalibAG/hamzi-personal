// Abstraksi penyedia LLM (TECH-SPEC §7.6): Gemini (utama, function calling + file) → Groq (cadangan teks).
// Nama model SELALU dari env (GEMINI_MODEL, GROQ_MODEL). LLM_MOCK=1 → MockProvider (test/CI, tanpa API sungguhan).
// Timeout 20 dtk, 1× retry pada 429/5xx. Kunci tidak pernah dicatat di log.

export interface JsonSchema {
  type: 'object' | 'string' | 'integer' | 'number' | 'boolean' | 'array';
  description?: string;
  enum?: (string | number)[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
}

export interface ToolDecl {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export type ChatPart = { type: 'text'; text: string } | { type: 'file'; mime: string; data: string; name: string };

export type ChatTurn =
  | { role: 'user'; parts: ChatPart[] }
  | { role: 'assistant'; text?: string; toolCalls?: ToolCall[]; raw?: unknown }
  | { role: 'tool'; results: { id: string; name: string; response: unknown }[] };

export interface Usage {
  in: number;
  out: number;
}

export interface ChatResult {
  text?: string;
  toolCalls?: ToolCall[];
  usage: Usage;
  model: string;
  raw?: unknown;
}

export interface LlmProvider {
  name: 'gemini' | 'groq' | 'mock';
  supportsFiles: boolean;
  generateJson<T = unknown>(a: { system: string; user: string; schema: JsonSchema; temperature?: number; timeoutMs?: number }): Promise<{ data: T; usage: Usage; model: string }>;
  chat(a: {
    system: string;
    messages: ChatTurn[];
    tools: ToolDecl[];
    toolChoice?: 'auto' | 'none';
    temperature?: number;
    timeoutMs?: number;
  }): Promise<ChatResult>;
}

export class LlmError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = false) {
    super(message);
    this.name = 'LlmError';
  }
}

const DEFAULT_TIMEOUT = 20_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = DEFAULT_TIMEOUT): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (attempt === 0) continue; // timeout/jaringan → 1× retry
      throw new LlmError(e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network', undefined, true);
    }
    clearTimeout(timer);
    if (res.ok) return await res.json();
    const retryable = res.status === 429 || res.status >= 500;
    await res.body?.cancel();
    if (retryable && attempt === 0) {
      const ra = Number(res.headers.get('retry-after'));
      await new Promise((r) => setTimeout(r, Math.min(3000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 800)));
      continue;
    }
    throw new LlmError(`http_${res.status}`, res.status, retryable);
  }
  throw new LlmError('unreachable');
}

function parseJsonText(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    throw new LlmError('invalid_json');
  }
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const numv = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ---------------------------------------------------------------- Gemini
/** Skema OpenAPI-subset Gemini: tipe huruf besar, enum hanya string. */
export function toGeminiSchema(s: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: s.type.toUpperCase() };
  let desc = s.description ?? '';
  if (s.enum) {
    if (s.enum.every((x) => typeof x === 'string')) {
      out.enum = s.enum;
      out.format = 'enum';
    } else {
      desc = `${desc}${desc ? ' ' : ''}Salah satu dari: ${s.enum.join(', ')}.`.trim();
    }
  }
  if (desc) out.description = desc;
  if (s.minimum !== undefined) out.minimum = s.minimum;
  if (s.maximum !== undefined) out.maximum = s.maximum;
  if (s.minItems !== undefined) out.minItems = String(s.minItems);
  if (s.maxItems !== undefined) out.maxItems = String(s.maxItems);
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    if (s.required?.length) out.required = s.required;
  }
  if (s.items) out.items = toGeminiSchema(s.items);
  return out;
}

function geminiContents(turns: ChatTurn[]): Record<string, unknown>[] {
  const out: { role: string; parts: Record<string, unknown>[] }[] = [];
  const push = (role: string, parts: Record<string, unknown>[], raw?: unknown) => {
    if (!parts.length && !raw) return;
    if (raw && typeof raw === 'object') {
      const r = raw as { role?: string; parts?: Record<string, unknown>[] };
      out.push({ role: 'model', parts: r.parts ?? parts });
      return;
    }
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else out.push({ role, parts });
  };
  for (const t of turns) {
    if (t.role === 'user') {
      push('user', t.parts.map((p) => (p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mime, data: p.data } })));
    } else if (t.role === 'assistant') {
      const parts: Record<string, unknown>[] = [];
      if (t.text) parts.push({ text: t.text });
      for (const c of t.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: rec(c.args) } });
      push('model', parts, t.raw);
    } else {
      push('user', t.results.map((r) => ({
        functionResponse: {
          ...(r.id.startsWith('gen_') ? {} : { id: r.id }),
          name: r.name,
          response: r.response && typeof r.response === 'object' && !Array.isArray(r.response) ? r.response : { result: r.response },
        },
      })));
    }
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  readonly supportsFiles = true;
  constructor(private readonly key: string, private readonly model: string) {}

  private call(body: unknown, timeoutMs?: number): Promise<unknown> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    return postJson(url, { 'x-goog-api-key': this.key }, body, timeoutMs);
  }

  private static parts(r: unknown): { parts: Record<string, unknown>[]; content: unknown; usage: Usage; model?: string } {
    const root = rec(r);
    const cand = rec(arr(root.candidates)[0]);
    const content = rec(cand.content);
    const um = rec(root.usageMetadata);
    if (!arr(root.candidates).length) throw new LlmError(`blocked:${str(rec(root.promptFeedback).blockReason) ?? 'empty'}`);
    return {
      parts: arr(content.parts).map(rec),
      content: cand.content,
      usage: { in: numv(um.promptTokenCount), out: numv(um.candidatesTokenCount) },
      model: str(root.modelVersion),
    };
  }

  async generateJson<T = unknown>(a: { system: string; user: string; schema: JsonSchema; temperature?: number; timeoutMs?: number }) {
    const r = await this.call({
      systemInstruction: { parts: [{ text: a.system }] },
      contents: [{ role: 'user', parts: [{ text: a.user }] }],
      generationConfig: { temperature: a.temperature ?? 0.3, responseMimeType: 'application/json', responseSchema: toGeminiSchema(a.schema) },
    }, a.timeoutMs);
    const p = GeminiProvider.parts(r);
    const text = p.parts.filter((x) => typeof x.text === 'string' && !x.thought).map((x) => x.text as string).join('');
    return { data: parseJsonText(text) as T, usage: p.usage, model: p.model ?? this.model };
  }

  async chat(a: { system: string; messages: ChatTurn[]; tools: ToolDecl[]; toolChoice?: 'auto' | 'none'; temperature?: number; timeoutMs?: number }): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: a.system }] },
      contents: geminiContents(a.messages),
      generationConfig: { temperature: a.temperature ?? 0.4 },
    };
    if (a.tools.length) {
      // Gemini menolak OBJECT dengan properties kosong → alat tanpa argumen dikirim tanpa `parameters`.
      body.tools = [{
        functionDeclarations: a.tools.map((t) => ({
          name: t.name,
          description: t.description,
          ...(Object.keys(t.parameters.properties ?? {}).length ? { parameters: toGeminiSchema(t.parameters) } : {}),
        })),
      }];
      body.toolConfig = { functionCallingConfig: { mode: a.toolChoice === 'none' ? 'NONE' : 'AUTO' } };
    }
    const p = GeminiProvider.parts(await this.call(body, a.timeoutMs));
    const text = p.parts.filter((x) => typeof x.text === 'string' && !x.thought).map((x) => x.text as string).join('').trim();
    const toolCalls: ToolCall[] = p.parts
      .filter((x) => x.functionCall)
      .map((x, i) => {
        const fc = rec(x.functionCall);
        return { id: str(fc.id) ?? `gen_${Date.now().toString(36)}_${i}`, name: str(fc.name) ?? '', args: fc.args ?? {} };
      });
    return { text: text || undefined, toolCalls: toolCalls.length ? toolCalls : undefined, usage: p.usage, model: p.model ?? this.model, raw: p.content };
  }
}

// ---------------------------------------------------------------- Groq (OpenAI-compatible)
export class GroqProvider implements LlmProvider {
  readonly name = 'groq' as const;
  readonly supportsFiles = false;
  constructor(private readonly key: string, private readonly model: string) {}

  private call(body: unknown, timeoutMs?: number): Promise<unknown> {
    return postJson('https://api.groq.com/openai/v1/chat/completions', { authorization: `Bearer ${this.key}` }, body, timeoutMs);
  }

  private static usage(r: Record<string, unknown>): Usage {
    const u = rec(r.usage);
    return { in: numv(u.prompt_tokens), out: numv(u.completion_tokens) };
  }

  async generateJson<T = unknown>(a: { system: string; user: string; schema: JsonSchema; temperature?: number; timeoutMs?: number }) {
    const r = rec(await this.call({
      model: this.model,
      temperature: a.temperature ?? 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${a.system}\nSkema JSON keluaran: ${JSON.stringify(a.schema)}` },
        { role: 'user', content: a.user },
      ],
    }, a.timeoutMs));
    const msg = rec(rec(arr(r.choices)[0]).message);
    return { data: parseJsonText(str(msg.content) ?? '') as T, usage: GroqProvider.usage(r), model: str(r.model) ?? this.model };
  }

  async chat(a: { system: string; messages: ChatTurn[]; tools: ToolDecl[]; toolChoice?: 'auto' | 'none'; temperature?: number; timeoutMs?: number }): Promise<ChatResult> {
    const messages: Record<string, unknown>[] = [{ role: 'system', content: a.system }];
    for (const t of a.messages) {
      if (t.role === 'user') {
        if (t.parts.some((p) => p.type === 'file')) throw new LlmError('files_not_supported');
        messages.push({ role: 'user', content: t.parts.map((p) => (p.type === 'text' ? p.text : '')).join('\n') });
      } else if (t.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: t.text ?? null,
          ...(t.toolCalls?.length
            ? { tool_calls: t.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })) }
            : {}),
        });
      } else {
        for (const r of t.results) messages.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.response) });
      }
    }
    const body: Record<string, unknown> = { model: this.model, temperature: a.temperature ?? 0.4, messages };
    if (a.tools.length) {
      body.tools = a.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
      body.tool_choice = a.toolChoice === 'none' ? 'none' : 'auto';
    }
    const r = rec(await this.call(body, a.timeoutMs));
    const msg = rec(rec(arr(r.choices)[0]).message);
    const toolCalls: ToolCall[] = arr(msg.tool_calls).map((x, i) => {
      const c = rec(x);
      const f = rec(c.function);
      let args: unknown = {};
      try {
        args = JSON.parse(str(f.arguments) ?? '{}');
      } catch {
        args = { _invalid_json: str(f.arguments) ?? '' };
      }
      return { id: str(c.id) ?? `gen_${i}`, name: str(f.name) ?? '', args };
    });
    const text = (str(msg.content) ?? '').trim();
    return { text: text || undefined, toolCalls: toolCalls.length ? toolCalls : undefined, usage: GroqProvider.usage(r), model: str(r.model) ?? this.model };
  }
}

// ---------------------------------------------------------------- Mock (LLM_MOCK=1)
// Deterministik: tidak memanggil jaringan. Dipakai e2e/CI (AGENTS.md: dilarang memanggil API AI sungguhan di test).
export class MockProvider implements LlmProvider {
  readonly name = 'mock' as const;
  readonly supportsFiles = true;

  generateJson<T = unknown>(a: { system: string; user: string; schema: JsonSchema }) {
    const props = a.schema.properties ?? {};
    const data = 'greeting' in props
      ? {
        greeting: 'Halo! Ini ringkasan uji.',
        highlights: ['Ringkasan ini dibuat penyedia tiruan.'],
        suggestions: [{ text: 'Catat pengeluaran hari ini biar anggaran tetap rapi.', module: 'finance', action_key: 'log_expense' }],
        mood: 'calm',
        numbers_used: [],
      }
      : {
        summary: 'Ringkasan mingguan uji dari penyedia tiruan.',
        went_well: ['Kamu tetap membuka Hamzi minggu ini.'],
        needs_attention: ['Tidak ada yang mendesak.'],
        next_week_priorities: ['Cicil tugas terbesar.', 'Jadwalkan sesi belajar.', 'Catat pengeluaran setiap malam.'],
        mood: 'calm',
        numbers_used: [],
      };
    return Promise.resolve({ data: data as T, usage: { in: 0, out: 0 }, model: 'mock' });
  }

  chat(a: { system: string; messages: ChatTurn[]; tools: ToolDecl[]; toolChoice?: 'auto' | 'none' }): Promise<ChatResult> {
    const last = a.messages[a.messages.length - 1];
    const has = (n: string) => a.toolChoice !== 'none' && a.tools.some((t) => t.name === n);
    const done = (text: string): Promise<ChatResult> => Promise.resolve({ text, usage: { in: 0, out: 0 }, model: 'mock' });
    const call = (name: string, args: Record<string, unknown>): Promise<ChatResult> =>
      Promise.resolve({ toolCalls: [{ id: `gen_mock_${name}`, name, args }], usage: { in: 0, out: 0 }, model: 'mock' });
    if (!last || last.role === 'tool') {
      const proposed = last?.role === 'tool' && last.results.some((r) => r.name.startsWith('propose_'));
      return done(proposed ? 'Cek dulu ya, ini usulanku. Bisa diubah sebelum disimpan.' : 'Ini ringkasan dari datamu (mode uji).');
    }
    if (last.role !== 'user') return done('Oke.');
    const text = last.parts.map((p) => (p.type === 'text' ? p.text : '')).join(' ').toLowerCase();
    const hasFile = last.parts.some((p) => p.type === 'file');
    const hhmm = (() => {
      const m = text.match(/jam\s+(\d{1,2})(?:[.:](\d{2}))?/);
      return m ? `${m[1].padStart(2, '0')}:${(m[2] ?? '00').padStart(2, '0')}` : undefined;
    })();
    if (hasFile && has('propose_task')) return call('propose_task', { title: 'Tugas dari file', priority: 2 });
    if (/rutinitas/.test(text) && has('propose_routine')) {
      const name = text.replace(/.*rutinitas\s+/, '').replace(/\s+jam\s+.*$/, '').trim() || 'Rutinitas baru';
      const count = text.match(/(\d+)\s*(gelas|kali)/);
      return call('propose_routine', {
        name: name.charAt(0).toUpperCase() + name.slice(1, 60),
        kind: count ? 'count' : 'check',
        ...(count ? { target_count: Number(count[1]) } : {}),
        repeat: 'daily',
        ...(hhmm ? { remind_at: hhmm } : {}),
      });
    }
    const amount = text.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?\b/);
    if (/(catat|keluar|beli|bayar|jajan)/.test(text) && amount && has('propose_transaction')) {
      const mult = /jt|juta/.test(amount[2] ?? '') ? 1_000_000 : /rb|ribu|k/.test(amount[2] ?? '') ? 1000 : 1;
      return call('propose_transaction', { kind: 'expense', amount: Math.round(Number(amount[1].replace(',', '.')) * mult), category_name: 'Makan' });
    }
    if (/tugas/.test(text) && has('propose_task')) {
      return call('propose_task', { title: text.replace(/.*tugas\s+/, '').slice(0, 120) || 'Tugas baru' });
    }
    if (/(rangkum|minggu ini)/.test(text) && has('get_week_summary')) return call('get_week_summary', {});
    if (/boros/.test(text) && has('get_finance_summary')) {
      const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
      const from = new Date(Date.now() + 7 * 3_600_000 - 6 * 86_400_000).toISOString().slice(0, 10);
      return call('get_finance_summary', { from, to: today });
    }
    return done('Hamzi (mode uji) sudah menerima pesanmu.');
  }
}

/** Urutan penyedia: Gemini → Groq (Groq dilewati bila ada file). Hanya yang kuncinya & modelnya tersedia. */
export function providerChain(opts: { needFiles: boolean }): LlmProvider[] {
  if (Deno.env.get('LLM_MOCK') === '1') return [new MockProvider()];
  const list: LlmProvider[] = [];
  const gk = Deno.env.get('GEMINI_API_KEY');
  const gm = Deno.env.get('GEMINI_MODEL');
  if (gk && gm) list.push(new GeminiProvider(gk, gm));
  const qk = Deno.env.get('GROQ_API_KEY');
  const qm = Deno.env.get('GROQ_MODEL');
  if (qk && qm && !opts.needFiles) list.push(new GroqProvider(qk, qm));
  return list;
}
