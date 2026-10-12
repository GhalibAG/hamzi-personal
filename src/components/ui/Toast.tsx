// Toast global (DESIGN-SYSTEM §4): HP left/right 16 bottom 92; desktop kiri bawah area konten. 3,5 dtk.
import { useEffect } from 'react';
import { useUi } from '@/stores/ui';
import { cx } from '@/lib/cx';

export function ToastHost({ desktop }: { desktop: boolean }) {
  const toast = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(hide, toast.durationMs ?? 3500);
    return () => window.clearTimeout(t);
  }, [toast, hide]);
  return (
    <div aria-live="polite" role="status" className={cx('pointer-events-none fixed z-40', desktop ? 'bottom-6 left-[calc(var(--sidebar-w)+32px)] w-[420px]' : 'right-4 bottom-23 left-4 mx-auto max-w-150')}>
      {toast && (
        <div key={toast.id} className="pointer-events-auto flex animate-toast-in items-center justify-between gap-3 rounded-xl bg-n-900 px-3.5 py-3 text-label font-semibold text-n-0 shadow-toast">
          <span>{toast.text}</span>
          {toast.actionLabel && (
            <button
              type="button"
              onClick={() => { toast.onAction?.(); hide(); }}
              className="h-9 shrink-0 bg-transparent px-1 text-label font-extrabold text-brand-300"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
