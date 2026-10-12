// Navigasi bawah 76 px, 5 tab (DESIGN-SYSTEM §4). Aktif = pil hijau muda 56×30 + ikon terisi + label tebal.
import { Link, useLocation } from 'react-router';
import { cx } from '@/lib/cx';
import { TABS } from './nav';

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid h-19 max-w-160 grid-cols-5 px-1 pt-1.5 pb-2.5">
        {TABS.map((t) => {
          const on = t.match(pathname);
          const I = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={on ? 'page' : undefined}
              className={cx('flex flex-col items-center justify-center gap-0.75 no-underline', on ? 'text-primary' : 'text-ink-3')}
            >
              <span className={cx('flex h-7.5 w-14 items-center justify-center rounded-full', on && 'bg-nav-pill')}>
                <I size={22} filled={on} strokeWidth={on ? 1.6 : 1.8} />
              </span>
              <span className={cx('text-micro', on ? 'font-extrabold' : 'font-semibold')}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
