// Sheet bawah (HP) ↔ Dialog tengah (desktop ≥1024) — DESIGN-SYSTEM §4 & §11.
// Tutup: ketuk backdrop, Esc, geser turun pada handle. Fokus dijebak di dalam; fokus dikembalikan saat ditutup.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { useIsDesktop } from '@/lib/hooks';
import { Icon } from '@/components/icons';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Judul terlihat (18/800). Bila tidak ada, `label` dipakai sebagai aria-label. */
  title?: ReactNode;
  label?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Lebar dialog desktop (default 440). */
  desktopWidth?: number;
  /** Tinggi penuh di HP (mis. timer). */
  full?: boolean;
  className?: string;
  /** Tampilkan tombol tutup (X) di kanan judul. */
  closeButton?: boolean;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

export function Sheet({ open, onClose, title, label, children, footer, desktopWidth = 440, full = false, className, closeButton }: SheetProps) {
  const desktop = useIsDesktop();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    openCount++;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (el ?? panel.current)?.focus();
    }, 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); }
      if (e.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', key, true);
      openCount--;
      if (openCount <= 0) document.body.style.overflow = '';
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const header = (title || closeButton) && (
    <div className="flex items-center justify-between gap-3 pb-3">
      {title ? <h2 id={titleId} className="m-0 text-h3 font-extrabold">{title}</h2> : <span />}
      {closeButton && (
        <button type="button" aria-label="Tutup" onClick={onClose} className="flex size-11 items-center justify-center rounded-full bg-transparent text-ink-3 hover:bg-surface-2">
          <Icon.X size={20} />
        </button>
      )}
    </div>
  );

  const body = desktop ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button type="button" aria-label="Tutup" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-fade-in cursor-default bg-scrim" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        className={cx('relative flex max-h-[calc(100vh-48px)] w-full animate-dialog-in flex-col rounded-5xl bg-surface p-5 shadow-pop outline-none', className)}
        style={{ maxWidth: desktopWidth }}
      >
        {header}
        <div className="-mx-1 flex-1 overflow-y-auto px-1">{children}</div>
        {footer && <div className="pt-4">{footer}</div>}
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="Tutup" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-fade-in cursor-default bg-scrim" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        className={cx(
          'relative mx-auto flex w-full max-w-160 animate-sheet-up flex-col rounded-t-sheet bg-surface px-4 pt-2.5 pb-5 shadow-sheet outline-none',
          full ? 'h-[100dvh] rounded-none' : 'max-h-[92dvh]',
          className,
        )}
      >
        <div
          className="flex h-6 shrink-0 touch-none items-start justify-center"
          onPointerDown={(e) => { drag.current = { y: e.clientY, dy: 0 }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            if (!drag.current || !panel.current) return;
            drag.current.dy = Math.max(0, e.clientY - drag.current.y);
            panel.current.style.transform = `translateY(${drag.current.dy}px)`;
          }}
          onPointerUp={() => {
            if (!drag.current || !panel.current) return;
            const close = drag.current.dy > 80;
            panel.current.style.transform = '';
            drag.current = null;
            if (close) onClose();
          }}
        >
          <span aria-hidden="true" className="mt-0.5 h-1 w-9 rounded-full bg-line-strong" />
        </div>
        {header}
        <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-[env(safe-area-inset-bottom)]">{children}</div>
        {footer && <div className="pt-4">{footer}</div>}
      </div>
    </div>
  );
  return createPortal(body, document.body);
}

/** Label + kontrol form (input 48 radius 14, UI-SPEC §6.4). */
export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-label font-bold text-ink-muted">{label}</label>
      {children}
      {hint && !error && <span className="text-meta text-ink-3">{hint}</span>}
      {error && <span role="alert" className="text-meta font-semibold text-danger-fg">{error}</span>}
    </div>
  );
}

export const inputCls = 'h-12 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-body text-ink outline-none placeholder:text-ink-3 focus:border-brand-400';
export const textareaCls = 'min-h-24 w-full rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-body text-ink outline-none placeholder:text-ink-3 focus:border-brand-400';
