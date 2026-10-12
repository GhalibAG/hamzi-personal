// Menu popover sederhana (mis. "Tunda" → +1 jam / Besok / Akhir pekan; "+ Tambah" desktop).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Kbd } from './ScreenHeader';
import { Button } from './Button';

export interface MenuItem { label: string; onSelect: () => void; hint?: string; icon?: ReactNode; danger?: boolean }

export function Menu({ trigger, items, align = 'right', width = 250 }: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; items: MenuItem[]; align?: 'left' | 'right'; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div role="menu" className={cx('absolute top-full z-30 mt-2 flex animate-pop-in flex-col rounded-xl border border-line bg-surface p-1.5 shadow-pop', align === 'right' ? 'right-0' : 'left-0')} style={{ width }}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); it.onSelect(); }}
              className={cx('flex h-11 items-center gap-2.5 rounded-md bg-transparent px-2.5 text-left text-body font-bold hover:bg-surface-2', it.danger ? 'text-danger-fg' : 'text-ink')}
            >
              {it.icon}
              <span className="flex-1">{it.label}</span>
              {it.hint && <Kbd>{it.hint}</Kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Konfirmasi sederhana sebaris (dipakai di dalam Sheet). */
export function ConfirmRow({ text, confirmLabel, onConfirm, onCancel, danger }: { text: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
      <span className="text-body">{text}</span>
      <div className="flex gap-2">
        <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Batal</Button>
      </div>
    </div>
  );
}
