// Tata letak responsif (DESIGN-SYSTEM §11): HP satu kolom; desktop area utama maks 1120, dua kolom flex-wrap.
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** Pembungkus halaman tab. HP: tanpa padding samping (bagian mengatur sendiri). Desktop: padding 24/32, gap 20. */
export function Page({ children, className, narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <div className={cx('mx-auto flex w-full flex-col pb-6 md:max-w-160 lg:gap-5 lg:px-8 lg:pt-6 lg:pb-10', narrow ? 'lg:max-w-[824px]' : 'lg:max-w-[1184px]', className)}>
      {children}
    </div>
  );
}

/** Konten HP standar: padding 16, jarak antar seksi 18–22. */
export function Stack({ children, className, gap = 'lg' }: { children: ReactNode; className?: string; gap?: 'sm' | 'md' | 'lg' }) {
  const g = gap === 'sm' ? 'gap-2.5' : gap === 'md' ? 'gap-4' : 'gap-5.5';
  return <div className={cx('flex flex-col', g, className)}>{children}</div>;
}

/** Dua kolom desktop: kiri flex 3 1 400px, kanan flex 2 1 290px; turun jadi satu kolom bila sempit. */
export function Columns({ left, right, className }: { left: ReactNode; right: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-start gap-5', className)}>
      <section className="flex min-w-0 flex-[3_1_400px] flex-col gap-3.5">{left}</section>
      <aside className="flex min-w-0 flex-[2_1_290px] flex-col gap-3.5">{right}</aside>
    </div>
  );
}
