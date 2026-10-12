// Kalender kebun (TUM-04, UI-SPEC §6.3 Kalender): "Kebun {Bulan Tahun}" + N pohon, panah bulan, grid GardenDay, legenda, detail hari.
import { useMemo, useState } from 'react';
import { fromParts, isoWeekday } from '@common/calc/index.ts';
import { BULAN, HARI_PENDEK } from '@common/format.ts';
import { GardenDay } from '@/components/tree/Tree';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/cx';
import { gardenDayText, gardenMonth, type GrowthIndex } from '../derive';

const LEVEL_NAME = ['kosong', 'tunas', 'bibit', 'pohon'];

export function GardenCalendar({ index, today, variant = 'mobile' }: { index: GrowthIndex; today: string; variant?: 'mobile' | 'desktop' }) {
  const [ty, tm] = today.split('-').map(Number);
  const [ym, setYm] = useState<[number, number]>([ty, tm]);
  const [selected, setSelected] = useState<string>(today);
  const [y, m] = ym;
  const month = useMemo(() => gardenMonth(index, y, m, today), [index, y, m, today]);
  const offset = isoWeekday(fromParts(y, m, 1)) - 1;
  const isCurrent = y === ty && m === tm;
  const move = (d: -1 | 1) => {
    const nm = m + d;
    const next: [number, number] = nm < 1 ? [y - 1, 12] : nm > 12 ? [y + 1, 1] : [y, nm];
    setYm(next);
    setSelected(next[0] === ty && next[1] === tm ? today : fromParts(next[0], next[1], 1));
  };
  const sel = month.days.find((d) => d.day === selected) ?? null;
  const selN = Number(selected.slice(8, 10));
  const selM = Number(selected.slice(5, 7));
  const desktop = variant === 'desktop';

  return (
    <div className="flex flex-col gap-3.5">
      <section aria-label={`Kebun ${BULAN[m]} ${y}`} className="rounded-4xl border border-line bg-surface p-3.5">
        <div className="mb-2 flex items-center gap-1">
          <button type="button" onClick={() => move(-1)} aria-label="Bulan sebelumnya" className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent text-ink-muted hover:bg-surface-2">
            <Icon.ChevronLeft size={18} />
          </button>
          <h2 className={cx('m-0 min-w-0 truncate font-extrabold', desktop ? 'text-card' : 'text-section')} aria-live="polite">Kebun {BULAN[m]} {y}</h2>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={isCurrent}
            aria-label="Bulan berikutnya"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent text-ink-muted hover:bg-surface-2 disabled:opacity-35"
          >
            <Icon.ChevronRight size={18} />
          </button>
          <span className="ml-auto shrink-0 text-meta font-semibold text-ink-2">{month.treeCount} pohon</span>
        </div>
        <div aria-hidden="true" className="mb-1 grid grid-cols-7 gap-1 text-center text-micro font-bold text-ink-3">
          {HARI_PENDEK.slice(1).map((h) => <span key={h}>{h}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} aria-hidden="true" />)}
          {month.days.map((d) => {
            const lv = d.level < 0 ? 'belum terjadi' : LEVEL_NAME[d.level] + (d.bloom ? ', berbunga' : '');
            return (
              <GardenDay
                key={d.day}
                day={d.n}
                level={d.level}
                bloom={d.bloom}
                selected={d.day === selected}
                today={d.day === today}
                ariaLabel={`${d.n} ${BULAN[m]}${d.day === today ? ' (hari ini)' : ''}: ${lv}`}
                onClick={() => setSelected(d.day)}
              />
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-micro font-semibold text-ink-2">
          <span>· kosong</span><span>tunas = sebagian</span><span>pohon = semua wajib</span><span>bunga = + belajar</span>
        </div>
      </section>
      <div className="flex flex-col gap-1.5 rounded-3xl border border-line bg-surface p-3.5" aria-live="polite">
        <span className="text-body font-extrabold">{selN} {BULAN[selM]}{selected === today ? ' (hari ini)' : ''}</span>
        <span className="text-label leading-normal text-ink-2">{gardenDayText(sel?.info ?? null, selected === today)}</span>
      </div>
    </div>
  );
}
