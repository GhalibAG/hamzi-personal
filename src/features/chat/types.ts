// Kontrak Chat Hamzi (TECH-SPEC §7.8.1): request/response `ai-chat` + skema lampiran.
import { z } from 'zod';
import { PROPOSE_SCHEMAS, type ProposeTool, type Proposals } from '@common/schemas.ts';

/** Sumber jawaban. 'demo' = parser lokal tanpa AI (MODE DEMO). */
export type ChatSource = 'gemini' | 'groq' | 'limited' | 'error' | 'demo';

export const CHAT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type ChatMime = (typeof CHAT_MIMES)[number];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS = 3;
export const MAX_TEXT = 2000;
/** Batas pesan pengguna per hari WIB (CHAT-10). Server memakai AI_CHAT_DAILY_LIMIT. */
export const CHAT_DAILY_LIMIT = 30;
/** Jendela Urungkan kartu aksi (AGENTS Data & privasi #5). */
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export const chatAttachmentSchema = z.object({
  path: z.string().min(1).max(400),
  mime: z.enum(CHAT_MIMES),
  name: z.string().min(1).max(200),
  size: z.number().int().min(0).max(MAX_FILE_BYTES),
  pages: z.number().int().min(1).max(5000).optional(),
});
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

export const chatRequestSchema = z
  .object({
    conversation_id: z.string().uuid().nullish(),
    text: z.string().max(MAX_TEXT).optional(),
    attachments: z.array(chatAttachmentSchema).max(MAX_ATTACHMENTS).optional(),
  })
  .refine((b) => !!b.text?.trim() || !!b.attachments?.length, { message: 'Isi teks atau lampiran' });
export type ChatRequest = z.infer<typeof chatRequestSchema>;

const toolNames = Object.keys(PROPOSE_SCHEMAS) as [ProposeTool, ...ProposeTool[]];

export const proposalsSchema = z.object({
  title: z.string(),
  dest: z.string(),
  items: z.array(z.object({
    tool: z.enum(toolNames),
    args: z.record(z.unknown()),
    kind: z.string(),
    label: z.string(),
    detail: z.string(),
    selected: z.boolean(),
  })),
});

export const chatResponseSchema = z.object({
  conversation_id: z.string().nullable(),
  message: z.object({
    id: z.string(),
    text: z.string(),
    proposals: proposalsSchema.nullish(),
    action_id: z.string().nullish(),
  }),
  source: z.enum(['gemini', 'groq', 'limited', 'error', 'demo']),
});

export interface ChatResponse {
  conversation_id: string | null;
  message: { id: string; text: string; proposals?: Proposals | null; action_id?: string | null };
  source: ChatSource;
}

/** Ringkasan alat yang dipakai (ai_messages.tools_used) untuk Riwayat AI. */
export interface ToolUse { name: string; args: Record<string, unknown>; result_summary: string }

/** Referensi data yang dibuat dari kartu aksi (ai_actions.applied_refs) + indeks item usulan. */
export interface AppliedRef { table: string; id: string; item: number }
