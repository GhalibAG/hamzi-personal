import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/cx';
import { IconButton } from './Button';

/** Header layar non-Beranda (DESIGN-SYSTEM §4): overline 12/600 + judul 26/800; kanan tombol 44. */
export function ScreenHeader({ overline, title, right, back, onBack, className }: {
  overline?: ReactNode; title: ReactNode; right?: ReactNode; back?: string | boolean; onBack?: () => void; className?: string;
}) {
  const nav = useNavigate();
  return (
    <header className={cx('flex flex-wrap items-center gap-3 px-4 pt-5 lg:px-0 lg:pt-0', className)}>
      {back && (
        <IconButton label="Kembali" onClick={onBack ?? (() => (typeof back === 'string' ? nav(back) : nav(-1)))}>
          <Icon.ChevronLeft size={20} />
        </IconButton>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {overline && <span className="truncate text-meta font-semibold text-ink-3">{overline}</span>}
        <h1 className="m-0 truncate text-title font-extrabold tracking-[-0.5px]">{title}</h1>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}

/** Pintasan keyboard tampil sebagai kotak kecil ("N", "/"). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx('rounded-xs border border-line-strong px-1.5 py-px font-sans text-micro font-bold text-ink-3', className)}>{children}</kbd>;
}
