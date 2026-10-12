// Komposer chat (UI-SPEC §7): chip saran, baris lampiran, peringatan data sensitif, Clip + input pil + kirim.
import type { Ref } from 'react';
import { SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import { ACCEPT, fileBadge } from '../attachments';
import type { ChatController } from '../hooks';
import { HIT44, HIT44_Y, type ChatVariant } from './ChatParts';

interface ChipDef { label: string; fill?: string; send?: string }

/** Chip saran (CHAT-06): ketuk = isi input atau langsung kirim. */
export const CHIPS: ChipDef[] = [
  { label: 'Rangkum minggu ini', send: 'Rangkum minggu ini' },
  { label: '+ Rutinitas', fill: 'tambahin rutinitas ' },
  { label: 'Catat pengeluaran', fill: 'jajan ' },
  { label: 'Aku boros di mana?', send: 'Aku boros di mana?' },
  { label: '+ Tugas', fill: 'ada tugas ' },
];
/** Panel desktop: dua chip seperti DeskChat.dc.html. */
const PANEL_CHIPS = [CHIPS[1], CHIPS[3]];

const BLOCKED_PLACEHOLDER = { offline: 'Butuh internet', limited: 'Chat tersedia lagi besok', disabled: 'Chat Hamzi dimatikan' } as const;

export function Composer({ ctl, variant = 'page', inputRef }: { ctl: ChatController; variant?: ChatVariant; inputRef?: Ref<HTMLInputElement> }) {
  const panel = variant === 'panel';
  const disabled = !!ctl.blocked;
  const busy = ctl.waiting;
  const canSend = !disabled && !busy && (ctl.draft.trim().length > 0 || ctl.attachments.some((a) => a.status === 'ready'));
  const chips = panel ? PANEL_CHIPS : CHIPS;

  const pickChip = (c: ChipDef) => {
    if (c.send) void ctl.send(c.send);
    else if (c.fill) {
      ctl.setDraft(c.fill);
      const el = document.getElementById(panel ? 'chat-input-panel' : 'chat-input') as HTMLInputElement | null;
      el?.focus();
      requestAnimationFrame(() => el?.setSelectionRange(c.fill!.length, c.fill!.length));
    }
  };

  return (
    <div className={cx('flex shrink-0 flex-col gap-2 border-t border-line bg-surface', panel ? 'px-3 pt-2.5 pb-3' : 'px-2.5 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]')}>
      <div className={cx('flex gap-1.5', panel ? 'flex-wrap' : 'no-scrollbar overflow-x-auto py-1.25 -my-1.25')} role="group" aria-label="Saran perintah">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={disabled || busy}
            onClick={() => pickChip(c)}
            className={cx(
              HIT44_Y,
              'shrink-0 whitespace-nowrap rounded-full border border-brand-200 bg-primary-soft font-bold text-brand-800 hover:bg-brand-100 disabled:opacity-50',
              panel ? 'h-7.5 px-2.5 text-meta' : 'h-8.5 px-3 text-meta-lg',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {ctl.attachments.map((a) => (
        <div key={a.key} className="flex items-center gap-2 rounded-md bg-surface-2 py-1.5 pr-1 pl-2.5">
          <span className={cx('rounded-xs px-1.25 py-0.75 text-2xs font-extrabold', a.mime === 'application/pdf' ? 'bg-danger-bg text-danger-fg' : 'bg-info-bg text-info-fg')}>
            {fileBadge(a.mime, a.name)}
          </span>
          <span className="min-w-0 flex-1 truncate text-meta-lg font-semibold">
            {a.name}{a.status === 'uploading' ? ' · mengunggah…' : a.pages ? ` · ${a.pages} hlm` : ''}
          </span>
          <button
            type="button"
            aria-label={`Hapus lampiran ${a.name}`}
            onClick={() => ctl.removeAttachment(a.key)}
            className="-my-1.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent text-ink-2 hover:bg-surface"
          >
            <Icon.X size={16} />
          </button>
        </div>
      ))}

      {ctl.sensitive && (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-warn-banner-line bg-warn-banner p-3">
          <span className="flex items-start gap-2 text-meta font-semibold text-warn-fg">
            <Icon.Alert size={16} className="mt-px shrink-0" />
            <span>{ctl.sensitive.kinds.map((k) => SENSITIVE_MESSAGE[k]).join(' ')}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="xs" onClick={() => void ctl.sendRedacted()}>Samarkan lalu kirim</Button>
            <Button size="xs" variant="secondary" onClick={ctl.dismissSensitive}>Ubah dulu</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={ctl.fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = '';
            ctl.addFiles(files);
          }}
        />
        <button
          type="button"
          aria-label={panel ? 'Lampirkan file (atau seret file ke panel ini)' : 'Lampirkan file dosen (PDF atau foto)'}
          disabled={disabled}
          onClick={ctl.openPicker}
          className={cx(
            'flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted hover:bg-line disabled:opacity-50',
            panel ? cx(HIT44, 'size-10') : 'size-11',
          )}
        >
          <Icon.Clip size={panel ? 18 : 20} />
        </button>
        <label className="flex min-w-0 flex-1">
          <span className="sr-only">Pesan untuk Hamzi</span>
          <input
            id={panel ? 'chat-input-panel' : 'chat-input'}
            ref={inputRef}
            value={ctl.draft}
            disabled={disabled}
            maxLength={2000}
            autoComplete="off"
            enterKeyHint="send"
            placeholder={ctl.blocked ? BLOCKED_PLACEHOLDER[ctl.blocked] : panel ? 'Ketik perintah… (Enter kirim)' : 'Ketik perintah atau pertanyaan…'}
            onChange={(e) => ctl.setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ctl.send();
              }
            }}
            className={cx(
              'w-full min-w-0 rounded-full border border-line-strong bg-bg text-ink outline-none placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-brand-400 disabled:bg-surface-2 disabled:text-ink-3',
              panel ? 'h-10 px-3.5 text-label-lg' : 'h-11 px-4 text-body',
            )}
          />
        </label>
        <button
          type="button"
          aria-label="Kirim"
          disabled={!canSend}
          onClick={() => void ctl.send()}
          className={cx(
            'flex shrink-0 items-center justify-center rounded-full transition-colors',
            panel ? cx(HIT44, 'size-10') : 'size-11',
            canSend ? 'bg-primary text-on-primary hover:bg-primary-hover' : 'bg-line-strong text-ink-3',
          )}
        >
          <Icon.Send size={panel ? 18 : 20} />
        </button>
      </div>
    </div>
  );
}
