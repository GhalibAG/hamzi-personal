// Potongan form kecil yang dipakai sheet Tugas, Proyek, Milestone, Event.
import { useId, type ReactNode } from 'react';
import { Chip } from '@/components/ui';
import { cx } from '@/lib/cx';

/** Grup chip pilihan tunggal/ganda berlabel (role=group + aria-pressed). */
export function ChipGroup<T extends string | number>({ label, options, value, onChange, multi = false, hint, error, className }: {
  label: string;
  options: { value: T; label: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  multi?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
}) {
  const id = useId();
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <span id={id} className="text-label font-bold text-ink-muted">{label}</span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2" data-multi={multi || undefined}>
        {options.map((o) => (
          <Chip key={String(o.value)} selected={selected(o.value)} onClick={() => onChange(o.value)}>{o.label}</Chip>
        ))}
      </div>
      {hint && !error && <span className="text-meta text-ink-3">{hint}</span>}
      {error && <span role="alert" className="text-meta font-semibold text-danger-fg">{error}</span>}
    </div>
  );
}
