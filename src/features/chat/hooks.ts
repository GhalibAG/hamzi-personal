// Pengendali percakapan Chat Hamzi — dipakai bersama layar /chat (HP & desktop) dan panel desktop.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { del as idbDel, get as idbGet } from 'idb-keyval';
import { wibDate, weekStart } from '@common/calc/index.ts';
import { weeklyReviewSchema, type WeeklyReview } from '@common/schemas.ts';
import { detectSensitive, redact, type SensitiveKind } from '@common/sensitive.ts';
import { repo } from '@/data';
import { qk, useRows, useSettings, useSettingsQuery, useUpdateSettings } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { AiAction, AiConversation, AiMessage, TableName } from '@/data/types';
import { useOnline, useToday } from '@/lib/hooks';
import { toast } from '@/stores/ui';
import { buildWeekPayload, type TablesData } from '@/features/ai/payload';
import { templateWeekly, weeklyToText } from '@/features/ai/templates';
import { chatMime, pdfPageCount, validateFile } from './attachments';
import { chatResponseSchema, MAX_TEXT, type ChatAttachment, type ToolUse } from './types';

export interface PendingAttachment {
  key: string;
  name: string;
  mime: string;
  size: number;
  pages?: number;
  status: 'uploading' | 'ready';
  result?: ChatAttachment;
}
export interface Notice { id: string; text: string }
export type Blocked = 'disabled' | 'offline' | 'limited' | null;

const stamp = (m: { updated_at?: string; created_at?: string }) => m.updated_at ?? m.created_at ?? '';
const byCreated = (a: AiMessage, b: AiMessage) => (a.created_at ?? '').localeCompare(b.created_at ?? '');

/** Percakapan aktif = yang terakhir dipakai/dibuat. */
export function latestConversation(rows: AiConversation[]): AiConversation | undefined {
  return [...rows].filter((c) => !c.deleted_at).sort((a, b) => stamp(b).localeCompare(stamp(a)))[0];
}

const WEEK_TABLES: TableName[] = [
  'tasks', 'study_sessions', 'learning_modules', 'transactions', 'wallets', 'budgets', 'categories', 'routines',
  'routine_logs', 'water_events', 'attendances',
];

interface SharedEntry { title?: unknown; text?: unknown; url?: unknown; files?: unknown[] }

const CHAT_TABLES: TableName[] = ['ai_messages', 'ai_conversations', 'ai_actions'];

/** "Percakapan baru": percakapan kosong menjadi yang terbaru (dimuat otomatis di /chat & panel). */
export async function startNewConversation(qc: QueryClient) {
  const now = new Date().toISOString();
  await repo.upsert('ai_conversations', { id: uuid(), title: null, created_at: now, updated_at: now });
  await Promise.all(CHAT_TABLES.map((t) => qc.invalidateQueries({ queryKey: qk.table(t) })));
}

/** "Hapus riwayat" (CHAT-08): hapus permanen semua pesan, kartu aksi, percakapan, dan log ringkasan AI. Data yang sudah ditambahkan tetap ada. */
export async function clearAiHistory(qc: QueryClient) {
  const order: TableName[] = ['ai_actions', 'ai_messages', 'ai_conversations', 'ai_requests'];
  for (const t of order) {
    const rows = await repo.list(t);
    for (const r of rows as { id: string }[]) await repo.remove(t, r.id, { hard: true });
  }
  await Promise.all(order.map((t) => qc.invalidateQueries({ queryKey: qk.table(t) })));
}

export function useChatController() {
  const qc = useQueryClient();
  const settings = useSettings();
  const settingsQ = useSettingsQuery();
  const updateSettings = useUpdateSettings();
  const online = useOnline();
  const today = useToday();
  const convs = useRows('ai_conversations');
  const msgs = useRows('ai_messages');
  const acts = useRows('ai_actions');

  const conversation = useMemo(() => latestConversation(convs.rows), [convs.rows]);
  const messages = useMemo(
    () => (conversation ? msgs.rows.filter((m) => m.conversation_id === conversation.id).sort(byCreated) : []),
    [msgs.rows, conversation],
  );
  const actions = useMemo(() => {
    const map = new Map<string, AiAction>();
    for (const a of [...acts.rows].sort((x, y) => stamp(x).localeCompare(stamp(y)))) map.set(a.message_id, a);
    return map;
  }, [acts.rows]);

  const limited = useMemo(() => {
    const last = [...msgs.rows].filter((m) => m.role === 'assistant').sort(byCreated).pop();
    return !!last && last.status === 'limited' && !!last.created_at && wibDate(new Date(last.created_at)) === today;
  }, [msgs.rows, today]);

  const blocked: Blocked = !settings.ai_enabled || !settings.ai_chat_enabled ? 'disabled' : !online ? 'offline' : limited ? 'limited' : null;

  const [draft, setDraftState] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const attRef = useRef(attachments);
  useEffect(() => { attRef.current = attachments; }, [attachments]);
  const [waiting, setWaiting] = useState(false);
  const [pending, setPending] = useState<{ text: string; attachments: ChatAttachment[]; at: string } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [sensitive, setSensitive] = useState<{ kinds: SensitiveKind[]; text: string } | null>(null);
  const heldFiles = useRef<File[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setDraft = useCallback((v: string) => { setDraftState(v.slice(0, MAX_TEXT)); setSensitive(null); }, []);
  const pushNotice = useCallback((text: string) => setNotices((n) => [...n, { id: uuid(), text }]), []);

  const refresh = useCallback(async () => {
    await Promise.all(CHAT_TABLES.map((t) => qc.invalidateQueries({ queryKey: qk.table(t) })));
  }, [qc]);

  /* ---------- lampiran ---------- */

  const processFiles = useCallback((list: File[]) => {
    let current = attRef.current.map((a) => ({ size: a.size }));
    for (const f of list) {
      const err = validateFile(f, current);
      if (err) { toast(err); continue; }
      current = [...current, { size: f.size }];
      const key = uuid();
      const mime = chatMime(f) ?? f.type;
      setAttachments((a) => [...a, { key, name: f.name, mime, size: f.size, status: 'uploading' }]);
      void (async () => {
        try {
          const [up, pages] = await Promise.all([repo.upload(f), mime === 'application/pdf' ? pdfPageCount(f) : Promise.resolve(undefined)]);
          const result: ChatAttachment = { path: up.path, mime: mime as ChatAttachment['mime'], name: up.name, size: up.size, ...(pages ? { pages } : {}) };
          setAttachments((a) => a.map((x) => (x.key === key ? { ...x, pages, status: 'ready', result } : x)));
        } catch {
          setAttachments((a) => a.filter((x) => x.key !== key));
          toast(`${f.name} belum bisa diunggah. Coba lagi ya.`);
        }
      })();
    }
  }, []);

  /** Tambah file (pilih, seret-lepas, atau bagikan). Pertama kali → dialog privasi CHAT-09. */
  const addFiles = useCallback((list: File[]) => {
    if (!list.length || blocked) return;
    if (!settings.chat_privacy_ack) { heldFiles.current = list; setPrivacyOpen(true); return; }
    processFiles(list);
  }, [blocked, settings.chat_privacy_ack, processFiles]);

  const openPicker = useCallback(() => {
    if (blocked) return;
    if (!settings.chat_privacy_ack) { heldFiles.current = null; setPrivacyOpen(true); return; }
    fileInput.current?.click();
  }, [blocked, settings.chat_privacy_ack]);

  const ackPrivacy = useCallback(() => {
    updateSettings.mutate({ chat_privacy_ack: true });
    setPrivacyOpen(false);
    const held = heldFiles.current;
    heldFiles.current = null;
    if (held) processFiles(held);
    else fileInput.current?.click();
  }, [updateSettings, processFiles]);

  const closePrivacy = useCallback(() => { heldFiles.current = null; setPrivacyOpen(false); }, []);
  const removeAttachment = useCallback((key: string) => setAttachments((a) => a.filter((x) => x.key !== key)), []);

  /* ---------- kirim ---------- */

  const send = useCallback(async (raw?: string, opts: { redacted?: boolean } = {}) => {
    if (blocked || waiting) return;
    const text = (raw ?? draft).trim().slice(0, MAX_TEXT);
    const current = attRef.current;
    if (current.some((a) => a.status === 'uploading')) { toast('Tunggu sebentar, file masih diunggah.'); return; }
    const ready = current.map((a) => a.result).filter((x): x is ChatAttachment => !!x);
    if (!text && !ready.length) return;
    if (!opts.redacted) {
      const kinds = detectSensitive(text);
      if (kinds.length) { setDraftState(text); setSensitive({ kinds, text }); return; }
    }
    setSensitive(null);
    setDraftState('');
    setAttachments([]);
    setPending({ text, attachments: ready, at: new Date(Date.now() - 5000).toISOString() });
    setWaiting(true);
    try {
      const res = await repo.invoke<unknown>('ai-chat', {
        ...(conversation ? { conversation_id: conversation.id } : {}),
        ...(text ? { text } : {}),
        ...(ready.length ? { attachments: ready } : {}),
      });
      await refresh();
      const parsed = chatResponseSchema.safeParse(res);
      if (!parsed.success) pushNotice('Hamzi belum bisa menjawab sekarang. Coba lagi sebentar ya.');
      else {
        const saved = (qc.getQueryData<AiMessage[]>(qk.table('ai_messages')) ?? []).some((m) => m.id === parsed.data.message.id);
        if (!saved && parsed.data.message.text) pushNotice(parsed.data.message.text);
      }
    } catch {
      setDraftState(text);
      setAttachments(current);
      pushNotice(navigator.onLine
        ? 'Hamzi lagi nggak bisa dihubungi. Pesanmu aku kembalikan ke kolom ketik, coba kirim lagi sebentar ya. Semua menu manual tetap bisa dipakai.'
        : 'Kamu lagi offline. Pesanmu aku kembalikan ke kolom ketik, kirim lagi kalau sudah ada internet ya.');
    } finally {
      setPending(null);
      setWaiting(false);
    }
  }, [blocked, waiting, draft, conversation, refresh, pushNotice, qc]);

  const sendRedacted = useCallback(async () => {
    if (!sensitive) return;
    await send(redact(sensitive.text), { redacted: true });
  }, [sensitive, send]);

  /* ---------- percakapan ---------- */

  const ensureConversation = useCallback(async (title: string | null): Promise<string> => {
    if (conversation) return conversation.id;
    const now = new Date().toISOString();
    const [row] = await repo.upsert('ai_conversations', { id: uuid(), title, created_at: now, updated_at: now });
    return row.id;
  }, [conversation]);

  const newConversation = useCallback(async () => {
    await startNewConversation(qc);
    setNotices([]);
    setSensitive(null);
  }, [qc]);

  /** /chat?review=minggu (AI-02, TECH-SPEC §6.4 langkah 8): review mingguan sebagai pesan Hamzi. */
  const weeklyReview = useCallback(async () => {
    const ws = weekStart(wibDate());
    if (messages.some((m) => m.role === 'assistant' && (m.tools_used as ToolUse[] | undefined)?.some((t) => t?.name === 'weekly_review' && t.args?.week_start === ws))) return;
    setWaiting(true);
    try {
      let review: WeeklyReview | null = null;
      let source = 'template';
      let payload: unknown = null;
      try {
        const r = await repo.invoke<{ ok?: boolean; source?: string; data?: unknown }>('ai-generate', { kind: 'weekly_review' });
        const p = weeklyReviewSchema.safeParse(r?.data);
        if (r?.ok !== false && p.success) { review = p.data; source = r.source ?? 'ai'; }
      } catch {
        /* offline / kuota → templat lokal */
      }
      if (!review) {
        const t = {} as Record<string, unknown[]>;
        for (const name of WEEK_TABLES) t[name] = await qc.ensureQueryData({ queryKey: qk.table(name), queryFn: () => repo.list(name) });
        const p = buildWeekPayload(t as unknown as TablesData, settings);
        review = templateWeekly(p);
        payload = p;
      }
      const convId = await ensureConversation('Review mingguan');
      const msg: Partial<AiMessage> & { id: string } = {
        id: uuid(), conversation_id: convId, role: 'assistant', content: weeklyToText(review), attachments: [], proposals: null,
        tools_used: [{ name: 'weekly_review', args: { week_start: ws }, result_summary: source }], sent_payload: payload,
        provider: source === 'ai' ? 'ai' : source === 'cache' ? 'cache' : 'templat', model: null,
        status: source === 'template' ? 'fallback' : 'ok', created_at: new Date().toISOString(),
      };
      await repo.upsert('ai_messages', msg);
      await refresh();
    } catch {
      pushNotice('Review mingguan belum bisa dibuat sekarang. Coba buka lagi nanti ya.');
    } finally {
      setWaiting(false);
    }
  }, [messages, qc, settings, ensureConversation, refresh, pushNotice]);

  /** /chat?shared=1 (CHAT-07, TECH-SPEC §7.8.7): ambil isi 'shared-inbox' → lampiran + teks siap kirim (tidak otomatis). */
  const importShared = useCallback(async () => {
    let inbox: SharedEntry[] = [];
    try {
      inbox = ((await idbGet('shared-inbox')) as SharedEntry[] | undefined) ?? [];
      await idbDel('shared-inbox');
    } catch {
      return;
    }
    if (!inbox.length) return;
    const texts = [...new Set(inbox.flatMap((e) => [e.title, e.text, e.url]).filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()))];
    if (texts.length) setDraftState((d) => [d, ...texts].filter(Boolean).join('\n').slice(0, MAX_TEXT));
    const files = inbox.flatMap((e) => e.files ?? []).filter((f): f is File => typeof File !== 'undefined' && f instanceof File);
    if (files.length) addFiles(files);
  }, [addFiles]);

  return {
    // data
    conversation, messages, actions, loading: convs.isLoading || msgs.isLoading, error: msgs.isError || convs.isError,
    retry: () => { void msgs.refetch(); void convs.refetch(); void acts.refetch(); },
    settingsReady: settingsQ.isSuccess,
    // status
    blocked, waiting, pending, notices,
    // composer
    draft, setDraft, send, sendRedacted, sensitive, dismissSensitive: () => setSensitive(null),
    attachments, addFiles, removeAttachment, openPicker, fileInput,
    // privasi
    privacyOpen, ackPrivacy, closePrivacy,
    // aksi
    newConversation, weeklyReview, importShared,
  };
}

export type ChatController = ReturnType<typeof useChatController>;
