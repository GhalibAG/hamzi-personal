// Chip timer kecil di atas navigasi bawah saat layar timer dikecilkan (UI-SPEC §6.5).
import { Icon } from '@/components/icons';
import { useNow } from '@/lib/hooks';
import { timerElapsed, useTimer } from '@/stores/timer';

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function TimerChip() {
  const active = useTimer((s) => s.active);
  const minimized = useTimer((s) => s.minimized);
  const setMinimized = useTimer((s) => s.setMinimized);
  const now = useNow(1000);
  if (!active || !minimized) return null;
  const remain = active.plannedMin * 60_000 - timerElapsed(active, now.getTime());
  return (
    <button
      type="button"
      onClick={() => setMinimized(false)}
      aria-label="Buka timer fokus"
      className="fixed bottom-21 left-1/2 z-20 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3.5 text-label font-extrabold text-on-primary shadow-fab"
    >
      <Icon.Clock size={16} />
      <span className="tabular">{active.finished ? 'Beres!' : formatClock(Math.max(0, remain))}</span>
    </button>
  );
}
