// RoutineRow (DESIGN-SYSTEM §5): CheckCircle + nama + meta + chip lonceng. Jenis jumlah: "5/8" di bulatan, ketuk +1, tahan −1.
import { useRef } from 'react';
import { Link } from 'react-router';
import { repeatLabel } from '@common/calc/index.ts';
import { Icon } from '@/components/icons';
import type { Routine, RoutineLog } from '@/data/types';
import { cx } from '@/lib/cx';
import { hhmm } from '@/features/learning/derive';

const LONG_PRESS_MS = 500;

export function CheckCircle({ r, log, onToggle }: { r: Routine; log?: RoutineLog; onToggle: (delta: 1 | -1) => void }) {
  const done = !!log?.done;
  const value = log?.value ?? 0;
  const count = r.kind === 'count';
  const target = count ? r.target_count : 1;
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);
  const cancel = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  const label = count
    ? `${r.name}: ${value} dari ${target}. Ketuk untuk tambah satu, tahan untuk kurangi.`
    : (done ? 'Batalkan: ' : 'Selesai: ') + r.name;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={done}
      onPointerDown={() => {
        if (!count) return;
        longFired.current = false;
        cancel();
        timer.current = window.setTimeout(() => { longFired.current = true; onToggle(-1); }, LONG_PRESS_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => { if (count) e.preventDefault(); }}
      onKeyDown={(e) => { if (count && (e.key === '-' || e.key === 'Backspace')) { e.preventDefault(); onToggle(-1); } }}
      onClick={() => {
        if (longFired.current) { longFired.current = false; return; }
        onToggle(1);
      }}
      className="flex size-11 shrink-0 touch-manipulation items-center justify-center bg-transparent select-none"
    >
      <span
        className={cx(
          'flex h-6 min-w-6 items-center justify-center rounded-full transition-colors duration-150',
          done ? 'bg-brand-500' : count && value > 0 ? 'border-2 border-brand-400 bg-surface px-0.5' : 'border-2 border-n-300 bg-surface px-0.5',
        )}
      >
        {done ? (
          <Icon.Check size={14} strokeWidth={3.2} className="text-on-primary" />
        ) : count ? (
          <span className="tabular text-2xs leading-none font-extrabold text-ink-muted">{value}/{target}</span>
        ) : null}
      </span>
    </button>
  );
}

export function routineMeta(r: Routine, variant: 'mobile' | 'desktop'): string {
  const rep = repeatLabel(r.repeat_days);
  const count = r.kind === 'count' ? ` · target ${r.target_count}` : '';
  if (variant === 'desktop') return `${rep}${r.remind_at ? ' · ' + hhmm(r.remind_at) : ''}${count}`;
  return `${rep} · ${r.is_required ? 'wajib' : 'kebiasaan'}${count}`;
}

export function RoutineRow({ r, log, onToggle, variant = 'mobile' }: {
  r: Routine; log?: RoutineLog; onToggle: (delta: 1 | -1) => void; variant?: 'mobile' | 'desktop';
}) {
  const done = !!log?.done;
  const desktop = variant === 'desktop';
  return (
    <div
      className={cx(
        'flex items-center rounded-2xl border transition-colors duration-150',
        desktop ? 'gap-2 py-1.5 pr-3 pl-1' : 'gap-2.5 py-2 pr-3 pl-1.5',
        done ? 'border-brand-200 bg-primary-soft' : 'border-line bg-surface',
      )}
    >
      <CheckCircle r={r} log={log} onToggle={onToggle} />
      <Link to={`/tumbuh/rutinitas/${r.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 no-underline">
        <span className={cx('truncate text-body font-bold', done ? 'text-brand-800' : 'text-ink')}>{r.name}</span>
        <span className="truncate text-meta text-ink-3">{routineMeta(r, variant)}</span>
      </Link>
      {!desktop && r.remind_at && (
        <span className={cx('flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.25 py-1 text-meta font-bold', r.remind_enabled ? 'text-ink-muted' : 'text-ink-3')}>
          {r.remind_enabled ? <Icon.Bell size={13} strokeWidth={2.2} /> : <Icon.BellOff size={13} strokeWidth={2.2} />}
          <span className="sr-only">Pengingat</span>
          <span className="tabular">{hhmm(r.remind_at)}</span>
          {!r.remind_enabled && <span className="sr-only">nonaktif</span>}
        </span>
      )}
    </div>
  );
}
