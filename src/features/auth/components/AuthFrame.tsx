// Latar hijau (`--header-bg`) + lingkaran dekoratif untuk /masuk & /onboarding (UI-SPEC §12, §14).
// Desktop: kartu tengah 440 px di atas latar hijau.
import type { ReactNode } from 'react';
import { DecoCircle } from '@/components/ui';
import { cx } from '@/lib/cx';

export function GreenBackdrop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cx('relative min-h-dvh overflow-hidden bg-header', className)}>
      <DecoCircle className="-top-27.5 -right-22.5 size-65 bg-header-c1 opacity-55" />
      <DecoCircle className="-bottom-15 -left-17.5 size-45 bg-header-c2 opacity-45" />
      <DecoCircle className="top-[38%] right-10 size-22.5 bg-header-c3 opacity-18" />
      <DecoCircle className="top-24 -left-12 size-30 bg-header-c1 opacity-30" />
      {children}
    </main>
  );
}

/** Kartu putih 440 di tengah (desktop). */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <GreenBackdrop className="flex items-center justify-center p-6">
      <div className={cx('relative flex w-full max-w-110 flex-col rounded-5xl bg-surface p-8 shadow-pop', className)}>{children}</div>
    </GreenBackdrop>
  );
}
