// "Kebiasaan" (RUT-05): grid 3 kolom semua rutinitas terjadwal hari ini (wajib & tidak), data sama dengan Tumbuh.
// Ketuk = +1 (centang: 0/1), tahan / klik kanan / tombol "−" = −1. Penuh = latar --danger-tint (DESIGN-SYSTEM HabitTile).
import { useRef } from 'react';
import { Skeleton } from '@/components/ui';
import type { Routine } from '@/data/types';
import { cx } from '@/lib/cx';
import { useGrowth } from '@/features/growth/hooks';
import { useHabitStep } from '../hooks';

function useLongPress(onLong: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  return {
    fired,
    handlers: {
      onPointerDown: () => {
        fired.current = false;
        clear();
        timer.current = window.setTimeout(() => { fired.current = true; timer.current = null; onLong(); }, ms);
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        if (fired.current) return;
        clear();
        fired.current = true;
        onLong();
      },
    },
  };
}

function HabitTile({ r, value, onStep, compact }: { r: Routine; value: number; onStep: (delta: 1 | -1) => void; compact: boolean }) {
  const target = Math.max(1, r.target_count);
  const full = value >= target;
  const lp = useLongPress(() => onStep(-1));
  return (
    <button
      type="button"
      {...lp.handlers}
      onClick={() => { if (lp.fired.current) { lp.fired.current = false; return; } onStep(1); }}
      onKeyDown={(e) => { if (e.key === '-' || e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onStep(-1); } }}
      aria-label={`${r.name}, ${value} dari ${target}. Ketuk untuk menambah, tahan untuk mengurangi`}
      aria-pressed={full}
      className={cx(
        'flex touch-manipulation flex-col items-start justify-between border text-left select-none',
        compact ? 'min-h-19 rounded-xl px-3 py-2.5' : 'min-h-21 rounded-2xl p-3',
        full ? 'border-danger-line bg-danger-tint text-danger-deep' : 'border-line bg-surface text-ink hover:bg-surface-2',
      )}
    >
      <span className={cx('tabular font-extrabold', compact ? 'text-h3' : 'text-h2')}>{value}/{target}</span>
      <span className="text-small leading-[1.3] font-semibold">{r.name}</span>
    </button>
  );
}

export function HabitGrid({ compact = false }: { compact?: boolean }) {
  const g = useGrowth();
  const step = useHabitStep();
  const list = [...g.data.requiredToday, ...g.data.othersToday].sort((a, b) => a.sort - b.sort);
  if (g.loading) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-label="Memuat kebiasaan">
        {[0, 1, 2].map((i) => <Skeleton key={i} className={compact ? 'h-19' : 'h-21'} />)}
      </div>
    );
  }
  if (!list.length) {
    return <p className="m-0 rounded-2xl border border-dashed border-line-strong bg-surface p-3 text-label text-ink-2">Belum ada kebiasaan terjadwal hari ini. Tambahkan dari Tumbuh.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {list.map((r) => {
        const value = g.data.logToday(r.id)?.value ?? 0;
        return <HabitTile key={r.id} r={r} value={value} compact={compact} onStep={(delta) => step(r, value, delta, g.today)} />;
      })}
    </div>
  );
}
