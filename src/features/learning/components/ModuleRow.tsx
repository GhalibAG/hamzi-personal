// ModuleRow (HP, BEL-04) & ModuleCard (desktop, Desktop-Tumbuh.dc.html).
import { Link } from 'react-router';
import { Icon } from '@/components/icons';
import { ProgressBar } from '@/components/ui';
import { cx } from '@/lib/cx';
import { LM_TILE, type ModuleView } from '../derive';

export function ModuleInitial({ v, size = 'md' }: { v: Pick<ModuleView, 'color' | 'initials'>; size?: 'md' | 'sm' | 'lg' }) {
  const s = size === 'lg' ? 'size-13 rounded-2xl text-section' : size === 'sm' ? 'size-10 rounded-lg text-label' : 'size-11 rounded-lg text-body';
  return <span aria-hidden="true" className={cx('flex shrink-0 items-center justify-center font-extrabold', s, LM_TILE[v.color])}>{v.initials}</span>;
}

export function ModuleRow({ v, onStart, focusMin }: { v: ModuleView; onStart: () => void; focusMin: number }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-3.5 py-3">
      <Link to={`/tumbuh/modul/${v.module.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink no-underline">
        <ModuleInitial v={v} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex justify-between gap-2">
            <span className="truncate text-body font-bold">{v.module.title}</span>
            <span className="tabular shrink-0 text-meta font-bold text-ink-2">{v.done}/{v.total}</span>
          </span>
          <ProgressBar value={v.pct} color={`lm-${v.color}`} height={6} label={`Progres ${v.module.title}`} />
          <span className="text-small text-ink-3">{v.meta}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onStart}
        aria-label={`Mulai fokus ${focusMin} menit: ${v.module.title}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-hover"
      >
        <Icon.Play size={16} />
      </button>
    </div>
  );
}

export function ModuleCard({ v, onStart, focusMin }: { v: ModuleView; onStart: () => void; focusMin: number }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface px-3.5 py-3">
      <Link to={`/tumbuh/modul/${v.module.id}`} className="flex items-center gap-2.5 text-ink no-underline">
        <ModuleInitial v={v} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-bold">{v.module.title}</span>
          <span className="truncate text-small text-ink-3">{v.metaShort}</span>
        </span>
      </Link>
      <div className="flex items-center gap-2.5">
        <ProgressBar className="flex-1" value={v.pct} color={`lm-${v.color}`} height={6} label={`Progres ${v.module.title}`} />
        <span className="tabular text-meta font-bold">{v.done}/{v.total}</span>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="h-10 rounded-full bg-info-bg text-label font-extrabold text-info-fg hover:brightness-95"
      >
        Mulai fokus {focusMin} mnt
      </button>
    </div>
  );
}
