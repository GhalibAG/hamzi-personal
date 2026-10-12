// Kartu IPK ungu (KUL-03) — Kuliah.dc.html (HP) & Desktop-Kuliah.dc.html (banner satu baris).
import { formatGpa } from '@common/calc/index.ts';
import { DecoCircle } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { GpaSummary } from '../derive';

function Tile({ label, value, desktop }: { label: string; value: string; desktop: boolean }) {
  return (
    <div className={cx('flex min-w-0 flex-col rounded-lg bg-white-14', desktop ? 'px-3 py-2.5' : 'px-2.5 py-2')}>
      <span className="truncate text-micro text-kuliah-sub">{label}</span>
      <span className={cx('tabular truncate font-extrabold', desktop ? 'text-section' : 'text-card')}>{value}</span>
    </div>
  );
}

export function IpkHero({ s, attendance, desktop = false }: { s: GpaSummary; attendance: number | null; desktop?: boolean }) {
  const ipk = s.ipk !== null ? formatGpa(s.ipk) : '–';
  const proj = s.projected !== null ? formatGpa(s.projected) : '–';
  const tiles = (
    <>
      <Tile desktop={desktop} label="SKS lulus" value={`${s.creditsPassed}/${s.curriculum}`} />
      <Tile desktop={desktop} label="Target IPK" value={s.target !== null ? formatGpa(s.target) : '–'} />
      <Tile desktop={desktop} label="Kehadiran" value={attendance !== null ? `${attendance}%` : '–'} />
    </>
  );
  const label = `IPK saat ini ${ipk}, proyeksi akhir semester ${proj}`;

  if (desktop) {
    return (
      <section aria-label={label} className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-5xl bg-kuliah-hero px-6 py-5 text-n-0 shadow-hero-purple">
        <DecoCircle className="-top-30 -right-15 size-65 bg-kuliah-fg" />
        <div className="relative flex min-w-35 flex-col">
          <span className="text-meta font-semibold text-kuliah-sub">IPK saat ini</span>
          <span className="tabular text-display-xl leading-[1.1] font-extrabold tracking-[-1px]">{ipk}</span>
        </div>
        <div className="relative flex min-w-37.5 flex-col">
          <span className="text-meta font-semibold text-kuliah-sub">Proyeksi akhir semester</span>
          <span className="tabular text-title font-extrabold">{proj}</span>
        </div>
        <div className="relative grid flex-[1_1_360px] grid-cols-3 gap-2.5">{tiles}</div>
      </section>
    );
  }

  return (
    <section aria-label={label} className="relative mx-4 mt-4 overflow-hidden rounded-5xl bg-kuliah-hero p-4.5 text-n-0 shadow-hero-purple">
      <DecoCircle className="-top-17.5 -right-15 size-45 bg-kuliah-fg" />
      <DecoCircle className="right-10 -bottom-12.5 size-22.5 bg-kuliah-bar opacity-60" />
      <div className="relative flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-meta font-semibold text-kuliah-sub">IPK saat ini</span>
          <span className="tabular text-display-xl leading-[1.1] font-extrabold tracking-[-1px]">{ipk}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-meta font-semibold text-kuliah-sub">Proyeksi akhir semester</span>
          <span className="tabular text-name font-extrabold">{proj}</span>
        </div>
      </div>
      <div className="relative mt-3.5 grid grid-cols-3 gap-2">{tiles}</div>
    </section>
  );
}

export function IpkHeroSkeleton({ desktop = false }: { desktop?: boolean }) {
  return <div aria-hidden="true" className={cx('animate-shimmer rounded-5xl bg-kuliah-line', desktop ? 'h-30' : 'mx-4 mt-4 h-44')} />;
}
