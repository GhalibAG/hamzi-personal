// Isi percakapan bersama (HP /chat, desktop /chat, panel desktop): daftar pesan + komposer + dialog privasi + seret-lepas.
import { useEffect, useRef, useState, type DragEvent, type Ref } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button, ErrorState, Sheet, Skeleton } from '@/components/ui';
import { DEMO } from '@/data';
import { cx } from '@/lib/cx';
import type { ChatController } from '../hooks';
import { ActionCard } from './ActionCard';
import { ChatBubble, FileCard, PrivacyChip, TypingDots, type ChatVariant } from './ChatParts';
import { Composer } from './Composer';

const BLOCKED_TEXT = {
  offline: 'Kamu lagi offline. Hamzi butuh internet buat ngobrol, tapi semua menu lain tetap jalan dan datamu aman di perangkat.',
  limited: 'Kuota ngobrol hari ini sudah habis. Semua menu manual tetap bisa dipakai, ya. Chat tersedia lagi besok.',
  disabled: 'Chat Hamzi lagi dimatikan di pengaturan privasi AI. Semua menu manual tetap bisa dipakai, ya.',
} as const;

export const PRIVACY_TEXT = 'File dibaca oleh Gemini (gratis). Jangan unggah KTP, data nilai/identitas orang lain, atau nomor rekening.';

export function ChatConversation({ ctl, variant = 'page', inputRef }: { ctl: ChatController; variant?: ChatVariant; inputRef?: Ref<HTMLInputElement> }) {
  const panel = variant === 'panel';
  const scroller = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const { messages, pending } = ctl;
  const showPending = !!pending && !messages.some((m) => m.role === 'user' && m.content === pending.text && (m.created_at ?? '') >= pending.at);

  // Gulir ke pesan terbaru
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, messages.length, ctl.waiting, ctl.notices.length, showPending, ctl.blocked, ctl.loading]);

  const onDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    ctl.addFiles(Array.from(e.dataTransfer.files));
  };

  const empty = !ctl.loading && !ctl.error && !messages.length && !showPending && !ctl.waiting;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Percakapan dengan Hamzi"
        className={cx('flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-surface-2', panel ? 'p-3.5 px-3' : 'px-3 pt-3.5 pb-3')}
      >
        {!panel && <PrivacyChip />}
        {DEMO && !panel && (
          <span className="shrink-0 self-center text-center text-small text-ink-3">Mode demo: Hamzi menjawab dengan aturan sederhana, tanpa AI.</span>
        )}

        {ctl.loading && (
          <div className="flex shrink-0 flex-col gap-2.5" aria-busy="true" aria-label="Memuat percakapan">
            <Skeleton className="h-10 w-1/2 self-end rounded-3xl" />
            <Skeleton className="h-20 w-3/4 rounded-3xl" />
            <Skeleton className="h-10 w-2/5 self-end rounded-3xl" />
          </div>
        )}
        {ctl.error && <div className="shrink-0"><ErrorState text="Percakapan belum bisa dimuat." onRetry={ctl.retry} /></div>}

        {empty && !ctl.blocked && (
          <div className="flex shrink-0 flex-col items-center gap-2 px-4 py-6 text-center">
            <Mascot mood="happy" size={panel ? 72 : 88} />
            <span className="text-card font-extrabold">Mau mulai dari mana?</span>
            <span className="max-w-72 text-body text-ink-2">
              Aku bisa nambah tugas, rutinitas, atau pengeluaran lewat chat, merangkum minggumu, dan membaca file dosen. Semua aksi selalu minta konfirmasi dulu.
            </span>
          </div>
        )}

        {messages.map((m) => (
          m.role === 'user' ? (
            <div key={m.id} className="flex shrink-0 flex-col items-end gap-2.5">
              {m.attachments?.map((a) => <FileCard key={a.path} {...a} variant={variant} />)}
              {m.content && <ChatBubble role="user" variant={variant}>{m.content}</ChatBubble>}
            </div>
          ) : (
            <div key={m.id} className="flex shrink-0 flex-col gap-2.5">
              {m.content && <ChatBubble role="assistant" variant={variant}>{m.content}</ChatBubble>}
              {m.proposals?.items?.length ? <ActionCard message={m} action={ctl.actions.get(m.id)} variant={variant} /> : null}
            </div>
          )
        ))}

        {showPending && pending && (
          <div className="flex shrink-0 flex-col items-end gap-2.5">
            {pending.attachments.map((a) => <FileCard key={a.path} {...a} variant={variant} />)}
            {pending.text && <ChatBubble role="user" variant={variant}>{pending.text}</ChatBubble>}
          </div>
        )}
        {ctl.waiting && <TypingDots />}
        {ctl.notices.map((n) => <ChatBubble key={n.id} role="assistant" variant={variant} tone="muted">{n.text}</ChatBubble>)}
        {ctl.blocked && !ctl.loading && (
          <div className="flex shrink-0 flex-col gap-2">
            <div className="flex items-end gap-2">
              <Mascot mood={ctl.blocked === 'offline' ? 'sleepy' : 'calm'} size={40} />
              <ChatBubble role="assistant" variant={variant}>{BLOCKED_TEXT[ctl.blocked]}</ChatBubble>
            </div>
            {ctl.blocked === 'disabled' && (
              <Link to="/chat/riwayat" className="ml-12 self-start text-label font-extrabold text-primary no-underline">Buka pengaturan privasi AI</Link>
            )}
          </div>
        )}
      </div>

      <Composer ctl={ctl} variant={variant} inputRef={inputRef} />

      {dragging && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-400 bg-primary-soft/90 text-label font-extrabold text-brand-800">
          <Icon.Upload size={28} />
          Lepas file untuk dilampirkan
        </div>
      )}

      <Sheet open={ctl.privacyOpen} onClose={ctl.closePrivacy} title="Sebelum melampirkan file" footer={
        <Button block size="lg" onClick={ctl.ackPrivacy} data-autofocus>Mengerti</Button>
      }>
        <div className="flex items-start gap-3">
          <Mascot mood="focus" size={56} />
          <div className="flex flex-col gap-2 text-body text-ink-2">
            <p className="m-0 font-semibold text-ink">{PRIVACY_TEXT}</p>
            <p className="m-0">PDF atau foto (JPG, PNG, WebP) maksimal 10 MB. File dihapus otomatis setelah 7 hari, dan isi file hanya dibaca sebagai data, bukan perintah.</p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
