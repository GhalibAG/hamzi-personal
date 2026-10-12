// Notifikasi dalam app (DESIGN-SYSTEM §4 "Notifikasi dalam app", Belajar.dc.html screenshot 15):
// top 12, kiri/kanan 10, putih, radius 22, --shadow-notif. Dipakai bila izin notifikasi sistem belum diberikan.
import { useEffect, useRef, useState } from 'react';
import { wibTime } from '@common/calc/index.ts';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/cx';
import { ACTION_TITLE } from '../hooks';
import type { Reminder } from '../schedule';

const AUTO_NEXT_MS = 20_000;

export function ReminderBanner({ item, queued, onAction, onOpen, onClose }: {
  item: Reminder;
  /** Jumlah pengingat lain yang menunggu. */
  queued: number;
  onAction: (action: string) => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [hold, setHold] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (hold) return;
    const t = window.setTimeout(() => closeRef.current(), AUTO_NEXT_MS);
    return () => window.clearTimeout(t);
  }, [hold, item.dedupe_key]);

  const age = Date.now() - new Date(item.fire_at).getTime();
  const when = age < 2 * 60_000 ? 'sekarang' : wibTime(new Date(item.fire_at));
  const actions = item.actions.slice(0, 2);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Pengingat: ${item.title}`}
      data-testid="reminder-banner"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
      className="fixed inset-x-2.5 top-3 z-50 mx-auto flex max-w-120 animate-pop-in flex-col gap-2 rounded-4xl bg-surface px-3.5 py-3 shadow-notif lg:top-auto lg:right-6 lg:bottom-6 lg:left-auto lg:w-95"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex size-5.5 shrink-0 items-center justify-center rounded-xs bg-primary text-on-primary">
          <Icon.Sprout size={14} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1 truncate text-meta font-semibold text-ink-2">
          Hamzi · {when}{queued > 0 ? ` · ${queued} lagi` : ''}
        </span>
        <button
          type="button"
          aria-label="Tutup pengingat"
          onClick={onClose}
          className="-my-3 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent text-ink-3 hover:bg-surface-2"
        >
          <Icon.X size={18} />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="flex flex-col gap-1 bg-transparent p-0 text-left">
        <span className="text-body font-extrabold text-ink">{item.title}</span>
        <span className="text-label text-ink-muted">{item.body}</span>
      </button>
      <div className="flex gap-2">
        {actions.length > 0 ? actions.map((a, i) => (
          <button
            key={a.action}
            type="button"
            onClick={() => onAction(a.action)}
            className={cx('h-11 flex-1 rounded-md text-label font-extrabold', i === 0 ? 'bg-primary-soft text-brand-800' : 'bg-surface-2 text-ink-muted')}
          >
            {a.title || ACTION_TITLE[a.action]}
          </button>
        )) : (
          <button type="button" onClick={onOpen} className="h-11 flex-1 rounded-md bg-primary-soft text-label font-extrabold text-brand-800">
            Lihat
          </button>
        )}
      </div>
    </div>
  );
}
