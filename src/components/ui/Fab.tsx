// FAB 56 px + SpeedDial (DESIGN-SYSTEM §4/§5). Disembunyikan saat toast tampil. Hanya HP/tablet.
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/cx';
import { useUi } from '@/stores/ui';
import { MOD_BG, type ModTone } from './basic';

export interface SpeedDialItem { label: string; icon: ReactNode; tone: ModTone; onSelect: () => void }

export function Fab({ label = 'Tambah cepat', onClick, items }: { label?: string; onClick?: () => void; items?: SpeedDialItem[] }) {
  const [open, setOpen] = useState(false);
  const toastShown = useUi((s) => s.toast !== null);
  if (toastShown && !open) return null;
  const hasMenu = !!items?.length;
  return createPortal(
    <>
      {open && hasMenu && (
        <>
          <button type="button" aria-label="Tutup menu tambah" onClick={() => setOpen(false)} className="fixed inset-0 z-30 animate-fade-in bg-scrim" />
          <div className="fixed right-4 bottom-40 z-30 flex flex-col items-end gap-2.5" role="menu">
            {items!.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); it.onSelect(); }}
                className="flex h-12 animate-pop-in items-center gap-2.5 rounded-full bg-surface py-0 pr-4 pl-2 text-body font-bold text-ink shadow-pop"
              >
                <span className={cx('flex size-8.5 items-center justify-center rounded-full', MOD_BG[it.tone])}>{it.icon}</span>
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        aria-label={open ? 'Tutup menu tambah' : label}
        aria-expanded={hasMenu ? open : undefined}
        onClick={() => (hasMenu ? setOpen((v) => !v) : onClick?.())}
        className="fixed right-4 bottom-23 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-fab hover:bg-primary-hover"
      >
        <Icon.Plus size={26} className={cx('transition-transform duration-200', open && 'rotate-45')} />
      </button>
    </>,
    document.body,
  );
}
