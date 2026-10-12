// Kartu proyek (PROJ-03): nama + Tag jenis, bar warna jenis, "x dari y tugas · z%", tenggat/terlambat, milestone ✓ ● ○.
import { Link } from 'react-router';
import { ProgressBar, type BarColor } from '@/components/ui';
import type { Milestone, Project } from '@/data/types';
import { cx } from '@/lib/cx';
import { KIND_LABEL, type ProjectStats } from '../derive';

export const KIND_STYLE: Record<Project['kind'], { tag: string; bar: BarColor; hero: string; fg: string }> = {
  kuliah: { tag: 'bg-rencana-bg text-rencana-fg', bar: 'rencana', hero: 'bg-rencana-bg', fg: 'text-rencana-fg' },
  pribadi: { tag: 'bg-invest-bg text-invest-fg', bar: 'invest', hero: 'bg-invest-bg', fg: 'text-invest-fg' },
  skill: { tag: 'bg-belajar-bg text-belajar-fg', bar: 'belajar', hero: 'bg-belajar-bg', fg: 'text-belajar-fg' },
  lomba: { tag: 'bg-target-bg text-target-fg', bar: 'target', hero: 'bg-target-bg', fg: 'text-target-fg' },
};

export function KindTag({ kind, className }: { kind: Project['kind']; className?: string }) {
  return <span className={cx('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-meta leading-none font-bold', KIND_STYLE[kind].tag, className)}>{KIND_LABEL[kind]}</span>;
}

/** Baris milestone: ✓ selesai dicoret abu, ● berjalan tebal, ○ belum abu. */
export function MilestoneLine({ m }: { m: Milestone }) {
  if (m.status === 'selesai') return <span className="text-ink-3 line-through"><span aria-hidden="true">✓ </span><span className="sr-only">Selesai: </span>{m.title}</span>;
  if (m.status === 'berjalan') return <span className="font-bold"><span aria-hidden="true">● </span><span className="sr-only">Berjalan: </span>{m.title}</span>;
  return <span className="text-ink-3"><span aria-hidden="true">○ </span><span className="sr-only">Belum: </span>{m.title}</span>;
}

export function ProjectCard({ p, stats, due, milestones, desktop }: {
  p: Project; stats: ProjectStats; due: { text: string; danger: boolean }; milestones: Milestone[]; desktop: boolean;
}) {
  return (
    <Link
      to={`/rencana/proyek/${p.id}`}
      className={cx('flex flex-col rounded-4xl border border-line bg-surface p-4 text-ink no-underline hover:border-line-strong', desktop ? 'gap-2.5' : 'gap-3', p.status !== 'aktif' && 'opacity-75')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cx('min-w-0 font-extrabold', desktop ? 'text-card' : 'text-section')}>{p.name}</span>
        <KindTag kind={p.kind} />
      </div>
      <ProgressBar value={stats.pct} color={KIND_STYLE[p.kind].bar} label={`Progres ${p.name}`} />
      <div className="flex justify-between gap-2 text-meta text-ink-2">
        <span>{stats.done} dari {stats.total} tugas · {stats.pct}%</span>
        <span className={cx(due.danger && 'font-bold text-danger-fg')}>{p.status === 'aktif' ? due.text : p.status === 'selesai' ? 'Selesai' : 'Ditunda'}</span>
      </div>
      {milestones.length > 0 && (
        <div className="flex flex-col gap-1.5 text-label">
          {milestones.map((m) => <MilestoneLine key={m.id} m={m} />)}
        </div>
      )}
    </Link>
  );
}
