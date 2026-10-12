// TaskRow Rencana (DESIGN-SYSTEM §5): CheckBox, judul + (Tag sumber · meta), PriorityDot.
// Varian `card` (HP: kartu putih radius 18) dan `list` (desktop/di dalam kartu: baris dengan garis bawah).
import { Link } from 'react-router';
import { CheckBox, PriorityDot, SOURCE_TAG, Tag } from '@/components/ui';
import type { Task } from '@/data/types';
import { cx } from '@/lib/cx';

export function TaskRow({ t, meta, onToggle, variant = 'card', danger = false, right }: {
  t: Task; meta: string; onToggle: (t: Task) => void; variant?: 'card' | 'list'; danger?: boolean; right?: React.ReactNode;
}) {
  const done = t.status === 'selesai';
  const tag = SOURCE_TAG[t.source_tag] ?? SOURCE_TAG.pribadi;
  return (
    <div
      className={cx(
        'flex items-center gap-3',
        variant === 'card'
          ? cx('rounded-2xl border py-2.5 pr-3.5 pl-2', danger ? 'border-danger-line bg-danger-soft' : 'border-line bg-surface')
          : 'border-b border-surface-2 py-1.5 pr-2 last:border-b-0',
      )}
    >
      <CheckBox checked={done} tone={danger ? 'danger' : 'default'} onToggle={() => onToggle(t)} label={(done ? 'Batalkan selesai: ' : 'Tandai selesai: ') + t.title} />
      <Link to={`/rencana/tugas/${t.id}`} className="flex min-w-0 flex-1 flex-col gap-1 text-ink no-underline">
        <span className={cx('truncate text-body font-semibold', done ? 'text-ink-3 line-through' : 'text-ink')}>{t.title}</span>
        {danger ? (
          <span className="truncate text-meta text-danger-fg">{meta}</span>
        ) : (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Tag tone={tag.tone}>{tag.label}</Tag>
            <span className="truncate text-meta text-ink-3">{meta}</span>
          </span>
        )}
      </Link>
      {right ?? <PriorityDot priority={t.priority} />}
    </div>
  );
}
