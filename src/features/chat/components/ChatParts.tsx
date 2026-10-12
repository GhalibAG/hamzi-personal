// Komponen kecil Chat (DESIGN-SYSTEM §5): ChatBubble, FileCard, TypingDots, chip privasi. Semua item daftar flex-shrink:0.
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/cx';
import { fileBadge, fileMeta } from '../attachments';

export type ChatVariant = 'page' | 'panel';

/** Gelembung pesan. Pengguna: hijau kanan (maks 80%); Hamzi: putih kiri (maks 86%), pre-line. Panel desktop sedikit lebih kecil. */
export function ChatBubble({ role, children, variant = 'page', tone }: { role: 'user' | 'assistant'; children: ReactNode; variant?: ChatVariant; tone?: 'muted' }) {
  const panel = variant === 'panel';
  return (
    <div
      className={cx(
        'shrink-0 whitespace-pre-line break-words leading-normal',
        panel ? 'px-3.25 py-2.25 text-label-lg' : 'px-3.5 py-2.5 text-body',
        role === 'user'
          ? cx('self-end bg-primary text-on-primary', panel ? 'max-w-[84%] rounded-2xl rounded-br-xs' : 'max-w-4/5 rounded-3xl rounded-br-xs')
          : cx('self-start border border-line bg-surface', tone === 'muted' ? 'text-ink-2' : 'text-ink', panel ? 'max-w-[90%] rounded-2xl rounded-bl-xs' : 'max-w-[86%] rounded-3xl rounded-bl-xs'),
      )}
    >
      {children}
    </div>
  );
}

/** Kartu file lampiran di sisi pengguna (PDF merah). */
export function FileCard({ name, mime, size, pages, variant = 'page' }: { name: string; mime: string; size: number; pages?: number; variant?: ChatVariant }) {
  const pdf = mime === 'application/pdf';
  return (
    <div className={cx('flex shrink-0 items-center gap-2.5 self-end rounded-3xl rounded-br-xs border border-brand-200 bg-surface px-3 py-2.5', variant === 'panel' ? 'w-56' : 'w-62.5 max-w-4/5')}>
      <span className={cx('flex h-11 w-10 shrink-0 items-center justify-center rounded-[10px] text-2xs font-extrabold', pdf ? 'bg-danger-bg text-danger-fg' : 'bg-info-bg text-info-fg')}>
        {pdf ? 'PDF' : <Icon.Image size={20} title={fileBadge(mime, name)} />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-label font-bold">{name}</span>
        <span className="text-small text-ink-3">{fileMeta({ mime, size, pages })}</span>
      </span>
    </div>
  );
}

/** Indikator Hamzi sedang mengetik. */
export function TypingDots() {
  return (
    <div role="status" aria-label="Hamzi sedang mengetik" className="flex shrink-0 gap-1.25 self-start rounded-3xl rounded-bl-xs border border-line bg-surface px-4 py-3">
      <span className="size-1.75 animate-dot rounded-full bg-brand-300" />
      <span className="size-1.75 animate-dot rounded-full bg-brand-400 [animation-delay:150ms]" />
      <span className="size-1.75 animate-dot rounded-full bg-brand-500 [animation-delay:300ms]" />
    </div>
  );
}

/** Chip info privasi di atas percakapan. */
export function PrivacyChip() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 self-center rounded-full border border-line bg-surface px-3 py-1.5 text-small font-semibold text-ink-2">
      <Icon.Lock size={13} className="shrink-0" />
      <span>Hamzi cuma lihat data yang kamu izinkan · aksi selalu minta konfirmasi</span>
    </div>
  );
}

/** Perluasan area sentuh ke 44 px untuk kontrol yang tampil lebih kecil (panel desktop, chip). */
export const HIT44 = 'relative before:absolute before:-inset-1 before:content-[\'\']';
export const HIT44_Y = 'relative before:absolute before:inset-x-0 before:-inset-y-1.25 before:content-[\'\']';
