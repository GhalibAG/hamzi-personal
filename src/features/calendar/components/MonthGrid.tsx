// Grid bulan (CAL-01): Sen–Min, angka + titik warna sumber. `sm` = kalender kecil desktop Rencana (titik hijau tunggal).
import { Link } from 'react-router';
import { BULAN, HARI, HARI_PENDEK } from '@common/format.ts';
import { isoWeekday } from '@common/calc/index.ts';
import { cx } from '@/lib/cx';
import { useUi } from '@/stores/ui';
import { AGENDA_LABEL, monthCells, type AgendaItem, type AgendaKind } from '../derive';

export const KIND_DOT: Record<AgendaKind, string> = {
  kelas: 'bg-kuliah-bar', tugas: 'bg-rencana-bar', ujian: 'bg-target-bar', event: 'bg-n-400', rutinitas: 'bg-brand-500',
};

export function MonthGrid({ year, month, selected, today, onSelect, dots, size = 'lg' }: {
  year: number; month: number; selected: string; today: string; onSelect: (d: string) => void;
  dots: Map<string, Set<AgendaKind>>; size?: 'sm' | 'lg' | 'xl';
}) {
  const sm = size === 'sm';
  const cells = monthCells(year, month, !sm);
  return (
    <div role="group" aria-label={`Kalender ${BULAN[month]} ${year}`}>
      <div aria-hidden="true" className={cx('mb-1 grid grid-cols-7 gap-0.5 text-center font-bold text-ink-3', sm ? 'text-micro' : 'text-meta')}>
        {HARI_PENDEK.slice(1).map((h) => <span key={h}>{h}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          if (!c) return <span key={`x${i}`} className={sm ? 'h-9.5' : 'h-11'} />;
          const sel = c.date === selected;
          const isToday = c.date === today;
          const kinds = [...(dots.get(c.date) ?? [])];
          const [, m, d] = c.date.split('-').map(Number);
          const label = `${HARI[isoWeekday(c.date)]} ${d} ${BULAN[m]}${isToday ? ', hari ini' : ''}${kinds.length ? `, ada ${kinds.map((k) => AGENDA_LABEL[k]).join(', ')}` : ''}`;
          return (
            <button
              key={c.date}
              type="button"
              aria-pressed={sel}
              aria-label={label}
              onClick={() => onSelect(c.date)}
              className={cx(
                'flex flex-col items-center justify-center gap-0.5 rounded-md font-bold transition-colors',
                size === 'xl' ? 'h-16 text-body' : size === 'lg' ? 'h-11 text-label' : 'h-9.5 text-meta-lg',
                sel ? 'bg-primary text-on-primary'
                  : isToday ? 'border-[1.5px] border-brand-300 bg-surface text-primary'
                    : c.inMonth ? 'text-ink-muted hover:bg-surface-2' : 'text-n-400 hover:bg-surface-2',
              )}
            >
              <span>{c.day}</span>
              {sm ? (
                <span className={cx('size-1 rounded-full', kinds.length ? (sel ? 'bg-brand-200' : 'bg-brand-500') : 'bg-transparent')} />
              ) : (
                <span className="flex h-1.25 items-center gap-0.5">
                  {kinds.slice(0, 4).map((k) => <span key={k} className={cx('size-1.25 rounded-full', KIND_DOT[k], sel && 'ring-1 ring-on-primary')} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaInner({ it, compact }: { it: AgendaItem; compact: boolean }) {
  const time = it.time ? (it.end && !compact ? `${it.time}–${it.end}` : it.time) : 'Seharian';
  if (compact) {
    return (
      <>
        <span aria-hidden="true" className={cx('h-5.5 w-1 shrink-0 rounded-xs', KIND_DOT[it.kind])} />
        <span className="min-w-11 shrink-0 text-label font-bold">{time}</span>
        <span className={cx('min-w-0 flex-1 truncate text-label', it.done && 'text-ink-3 line-through')}>{it.title}</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className={cx('w-1 shrink-0 self-stretch rounded-xs', KIND_DOT[it.kind])} />
      <span className="min-w-12 shrink-0 text-label font-bold tabular">{time}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cx('truncate text-body font-bold', it.done && 'text-ink-3 line-through')}>{it.title}</span>
        <span className="truncate text-meta text-ink-3">{it.sub}</span>
      </span>
    </>
  );
}

/** Daftar agenda: `compact` (kartu kecil desktop Rencana) atau kartu per item (layar Kalender). */
export function AgendaList({ items, compact = false }: { items: AgendaItem[]; compact?: boolean }) {
  const openQuick = useUi((s) => s.openQuick);
  const cls = compact
    ? 'flex min-h-7 items-center gap-2.5 rounded-sm text-left text-ink no-underline hover:bg-surface-2'
    : 'flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left text-ink no-underline hover:bg-surface-2';
  return (
    <ul className={cx('m-0 flex list-none flex-col p-0', compact ? 'gap-1' : 'gap-2.5')}>
      {items.map((it) => (
        <li key={it.key}>
          {it.to ? (
            <Link to={it.to} className={cls} aria-label={`${it.time ?? 'Seharian'} ${it.title}, ${it.sub}`}><AgendaInner it={it} compact={compact} /></Link>
          ) : (
            <button type="button" onClick={() => openQuick('event', { id: it.eventId })} className={cx(cls, 'w-full')} aria-label={`${it.time ?? 'Seharian'} ${it.title}, ${it.sub}. Ubah event`}>
              <AgendaInner it={it} compact={compact} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
