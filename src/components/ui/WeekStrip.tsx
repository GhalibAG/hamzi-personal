import { addDays, weekStart } from '@common/calc/index.ts';
import { HARI_PENDEK, HARI } from '@common/format.ts';
import { cx } from '@/lib/cx';

/** Strip minggu Sen–Min (DESIGN-SYSTEM §5 WeekStrip). `dots` = tanggal yang punya agenda. */
export function WeekStrip({ anchor, selected, onSelect, dots, today }: {
  anchor: string; selected: string; onSelect: (d: string) => void; dots: Set<string>; today: string;
}) {
  const start = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label="Pilih tanggal minggu ini">
      {days.map((d, i) => {
        const sel = d === selected;
        const dayNum = Number(d.slice(8, 10));
        return (
          <button
            key={d}
            type="button"
            aria-pressed={sel}
            aria-label={`${HARI[i + 1]} ${dayNum}${d === today ? ' (hari ini)' : ''}${dots.has(d) ? ', ada agenda' : ''}`}
            onClick={() => onSelect(d)}
            className={cx(
              'flex h-17 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors',
              sel ? 'bg-primary text-on-primary shadow-day-sel' : 'bg-transparent text-ink-muted hover:bg-surface-2',
            )}
          >
            <span className="text-micro font-semibold">{HARI_PENDEK[i + 1]}</span>
            <span className="text-section-lg font-extrabold">{dayNum}</span>
            <span className={cx('size-1.25 rounded-full', dots.has(d) ? (sel ? 'bg-brand-200' : 'bg-brand-500') : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}
