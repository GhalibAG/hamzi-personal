import { cx } from '@/lib/cx';

export interface SegmentedOption<T extends string> { value: T; label: string }

/** Segmented control (DESIGN-SYSTEM §5): wadah --border, tombol 40 px, aktif putih + shadow-1. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: {
  options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx('grid gap-1 rounded-full bg-line p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={sel}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-10 truncate rounded-full px-2 text-label font-bold transition-colors duration-200',
              sel ? 'bg-surface text-ink shadow-1' : 'bg-transparent text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
