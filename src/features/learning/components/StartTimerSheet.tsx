// Sheet "Mulai timer fokus" (BEL-05): pilih modul aktif + unit (opsional) + durasi → useTimer.start. initial.module_id → langsung mulai.
import { useEffect, useId, useMemo, useState } from 'react';
import { Button, Chip, EmptyState, Sheet } from '@/components/ui';
import { useTimer } from '@/stores/timer';
import { useUi } from '@/stores/ui';
import type { QuickSheetProps } from '@/app/quick';
import { cx } from '@/lib/cx';
import { unitLabel } from '../derive';
import { useFocusMinutes, useLearning, useStartFocus } from '../hooks';
import { ModuleInitial } from './ModuleRow';

const DURATIONS = [15, 25, 45, 60];

export function StartTimerSheet({ open, onClose, initial }: QuickSheetProps) {
  const id = useId();
  const learning = useLearning();
  const focus = useFocusMinutes();
  const start = useStartFocus();
  const active = useTimer((s) => s.active);
  const setMinimized = useTimer((s) => s.setMinimized);
  const openQuick = useUi((s) => s.openQuick);
  const direct = typeof initial?.module_id === 'string' ? initial.module_id : null;
  const views = learning.views;
  const [moduleId, setModuleId] = useState<string | null | 'auto'>('auto');
  const [unitId, setUnitId] = useState<string | null | undefined>(undefined);
  const [minutes, setMinutes] = useState<number>(() => {
    const n = Number(initial?.planned_min);
    return Number.isInteger(n) && n > 0 && n <= 180 ? n : focus;
  });

  // Langsung mulai bila modul sudah ditentukan (mis. tombol ▶, tautan notifikasi).
  useEffect(() => {
    if (!direct || learning.loading) return;
    if (!useTimer.getState().active) start({ moduleId: direct, plannedMin: minutes });
    else useTimer.getState().setMinimized(false);
    onClose();
  }, [direct, learning.loading, start, minutes, onClose]);

  const effModule = moduleId === 'auto' ? views[0]?.module.id ?? null : moduleId;
  const current = useMemo(() => views.find((v) => v.module.id === effModule), [views, effModule]);
  const effUnit = unitId === undefined ? current?.next?.id ?? null : unitId;
  const durations = DURATIONS.includes(minutes) ? DURATIONS : [...DURATIONS, minutes].sort((a, b) => a - b);

  if (direct) return null;

  if (active && !active.finished) {
    return (
      <Sheet open={open} onClose={onClose} title="Sesi fokus berjalan" footer={<Button size="lg" block onClick={() => { setMinimized(false); onClose(); }}>Buka timer</Button>}>
        <p className="m-0 text-body text-ink-2">Selesaikan dulu sesi yang sedang berjalan sebelum memulai yang baru.</p>
      </Sheet>
    );
  }

  const go = () => {
    start({ moduleId: effModule, unitId: effModule ? effUnit : null, plannedMin: minutes });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Mulai timer fokus"
      footer={<Button size="lg" block onClick={go} disabled={learning.loading}>Mulai fokus {minutes} mnt</Button>}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted" id={`${id}-mod`}>Modul</span>
          {learning.loading ? <div className="h-14 animate-shimmer rounded-xl bg-surface-2" /> : views.length ? (
            <div role="radiogroup" aria-labelledby={`${id}-mod`} className="flex flex-col gap-1.5">
              {views.map((v) => {
                const on = effModule === v.module.id;
                return (
                  <button
                    key={v.module.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { setModuleId(v.module.id); setUnitId(undefined); }}
                    className={cx('flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left', on ? 'border-brand-300 bg-primary-soft' : 'border-line-strong bg-surface hover:bg-surface-2')}
                  >
                    <ModuleInitial v={v} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-bold text-ink">{v.module.title}</span>
                      <span className="truncate text-meta text-ink-3">{v.metaShort} · {v.done}/{v.total}</span>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={effModule === null}
                onClick={() => { setModuleId(null); setUnitId(null); }}
                className={cx('flex min-h-11 items-center rounded-xl border px-3 text-left text-body font-bold', effModule === null ? 'border-brand-300 bg-primary-soft text-ink' : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-2')}
              >
                Tanpa modul
              </button>
            </div>
          ) : (
            <EmptyState compact text="Belum ada modul aktif. Timer tetap bisa dipakai tanpa modul." action={<Button size="xs" variant="secondary" onClick={() => openQuick('module')}>+ Modul</Button>} />
          )}
        </div>
        {effModule && current && current.units.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-unit`} className="text-label font-bold text-ink-muted">Unit (opsional)</label>
            <select
              id={`${id}-unit`}
              value={effUnit ?? ''}
              onChange={(e) => setUnitId(e.target.value || null)}
              className="h-12 w-full rounded-lg border border-line-strong bg-surface px-3 text-body text-ink outline-none focus:border-brand-400"
            >
              <option value="">Tanpa unit</option>
              {current.units.map((u) => (
                <option key={u.id} value={u.id}>{unitLabel(current.units, u)}{u.status === 'selesai' ? ' (selesai)' : ''}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted" id={`${id}-dur`}>Durasi</span>
          <div role="group" aria-labelledby={`${id}-dur`} className="flex flex-wrap gap-1.5">
            {durations.map((m) => <Chip key={m} size="lg" selected={minutes === m} onClick={() => setMinutes(m)}>{m} mnt</Chip>)}
          </div>
          <span className="text-meta text-ink-3">Sesi minimal 10 menit menyiram pohonmu 1 tetes air.</span>
        </div>
      </div>
    </Sheet>
  );
}
