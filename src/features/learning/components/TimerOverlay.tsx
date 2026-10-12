// Timer fokus (BEL-05/06, UI-SPEC §6.5, screenshot 17; desktop = dialog 420, d08). Berbasis timestamp (useTimer + timerElapsed).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button, Ring, Sheet } from '@/components/ui';
import { useRows, useStudyFinish, useUnitSetStatus } from '@/data/hooks';
import { useIsDesktop, useNow, useToday } from '@/lib/hooks';
import { cx } from '@/lib/cx';
import { timerElapsed, useTimer, type ActiveTimer } from '@/stores/timer';
import { toast, useUi } from '@/stores/ui';
import { formatClock } from '@/app/TimerChip';
import { sessionEarnsWater } from '@/features/growth/derive';
import { useGrowth } from '@/features/growth/hooks';
import { unitLabel, unitsOf } from '../derive';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Menit tercatat: menit penuh yang berlalu, min 1, maks durasi rencana. */
function sessionMinutes(a: ActiveTimer, now = Date.now()): number {
  return Math.max(1, Math.min(a.plannedMin, Math.floor(timerElapsed(a, now) / 60_000)));
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(el.tagName) || el.isContentEditable;
}

export function TimerOverlay() {
  const desktop = useIsDesktop();
  const active = useTimer((s) => s.active);
  const pause = useTimer((s) => s.pause);
  const resume = useTimer((s) => s.resume);
  const finish = useTimer((s) => s.finish);
  const clear = useTimer((s) => s.clear);
  const setMinimized = useTimer((s) => s.setMinimized);
  const now = useNow(500);
  const today = useToday();
  const modules = useRows('learning_modules').rows;
  const units = useRows('learning_units').rows;
  const water = useRows('water_events').rows;
  const growth = useGrowth();
  const studyFinish = useStudyFinish();
  const unitSet = useUnitSetStatus();
  const markWatered = useUi((s) => s.markWatered);
  const react = useUi((s) => s.react);
  const [saving, setSaving] = useState(false);
  const [askUnit, setAskUnit] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const mod = active?.moduleId ? modules.find((m) => m.id === active.moduleId) : undefined;
  const modUnits = useMemo(() => (mod ? unitsOf(units, mod.id) : []), [mod, units]);
  const unit = active?.unitId ? modUnits.find((u) => u.id === active.unitId) : undefined;
  const unitNo = unit ? modUnits.findIndex((u) => u.id === unit.id) + 1 : 0;

  const elapsed = active ? timerElapsed(active, now.getTime()) : 0;
  const planned = (active?.plannedMin ?? 25) * 60_000;
  const finished = !!active?.finished;
  const running = !!active && !finished && active.runningSince !== null;

  // Selesai otomatis saat waktu habis (juga setelah app dibuka lagi).
  useEffect(() => {
    if (active && !active.finished && active.runningSince !== null && elapsed >= planned) finish();
  }, [active, elapsed, planned, finish]);

  // Fokus awal ke panel; jebak Tab; Spasi = jeda/lanjut; Esc = kecilkan.
  useEffect(() => {
    const t = window.setTimeout(() => panel.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (askUnit) return;
    const key = (e: KeyboardEvent) => {
      const a = useTimer.getState().active;
      if (!a) return;
      if (e.key === 'Escape') { e.preventDefault(); setMinimized(true); return; }
      if ((e.key === ' ' || e.code === 'Space') && !isTyping(e.target) && !a.finished) {
        e.preventDefault();
        if (a.runningSince !== null) pause(); else resume();
        return;
      }
      if (e.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [askUnit, pause, resume, setMinimized]);

  if (!active) return null;

  const mins = sessionMinutes(active, now.getTime());
  const earns = sessionEarnsWater(mins, water, today);
  const status = finished ? 'Sesi selesai' : running ? `Fokus · ${active.plannedMin} menit` : 'Dijeda';
  const mood = finished ? 'celebrate' : running ? 'focus' : 'calm';
  const line = finished
    ? earns ? 'Kerja bagus! Pohonmu dapat 1 tetes air.' : mins < 10 ? 'Sesi singkat tetap tercatat. Coba 10 menit lain kali ya.' : 'Kerja bagus! Sesi ini tercatat.'
    : running ? 'Fokus dulu ya, aku jagain waktunya.' : 'Istirahat sebentar boleh.';
  const pct = finished ? 100 : Math.min(100, (elapsed / planned) * 100);
  const clock = finished ? 'Beres!' : formatClock(Math.max(0, planned - elapsed));
  const title = mod?.title ?? 'Sesi fokus';
  const sub = unit ? unitLabel(modUnits, unit) : mod ? 'Belajar mandiri' : 'Tanpa modul';

  const done = async () => {
    if (saving) return;
    setSaving(true);
    const stageBefore = growth.data.stage.name;
    const m = sessionMinutes(active);
    try {
      const res = await studyFinish.mutateAsync({
        p_id: active.id, p_started_at: new Date(active.startedAt).toISOString(), p_duration_min: m,
        p_module_id: active.moduleId, p_unit_id: active.unitId,
      });
      if (res.water_awarded) { markWatered(); toast('+1 tetes air. Pohonmu makin subur!'); }
      else toast(m < 10 ? 'Sesi tercatat. Minimal 10 menit untuk dapat tetes air.' : 'Sesi tercatat.');
      if (res.water_awarded && res.stage !== stageBefore) react('celebrate', `Pohonmu naik jadi ${res.stage}!`);
      else if (res.water_awarded) react('happy', 'Kerja bagus! Pohonmu dapat 1 tetes air.');
      if (unit && unit.status !== 'selesai') setAskUnit(true);
      else clear();
    } catch {
      toast('Gagal menyimpan sesi. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const answerUnit = (yes: boolean) => {
    if (unit) {
      if (yes) { unitSet.mutate({ p_unit_id: unit.id, p_status: 'selesai' }); toast(`Unit ${unitNo} ditandai selesai.`); }
      else if (unit.status === 'belum') unitSet.mutate({ p_unit_id: unit.id, p_status: 'sedang' });
    }
    setAskUnit(false);
    clear();
  };

  const unitSheet = (
    <Sheet
      open={askUnit}
      onClose={() => answerUnit(false)}
      title={`Unit ${unitNo} selesai?`}
      footer={(
        <div className="grid grid-cols-2 gap-2.5">
          <Button size="lg" variant="outline-primary" onClick={() => answerUnit(false)}>Belum</Button>
          <Button size="lg" onClick={() => answerUnit(true)}>Ya, tandai</Button>
        </div>
      )}
    >
      <p className="m-0 text-body text-ink-2">{unit ? unitLabel(modUnits, unit) : ''}{mod ? ` — ${mod.title}` : ''}</p>
    </Sheet>
  );

  const controls = finished ? (
    <Button size="lg" block onClick={() => void done()} disabled={saving}>{saving ? 'Menyimpan…' : earns ? 'Siram pohon & kembali' : 'Simpan & kembali'}</Button>
  ) : (
    <div className="grid grid-cols-2 gap-2.5">
      <Button size="lg" variant="outline-primary" onClick={running ? pause : resume}>{running ? 'Jeda' : 'Lanjut'}</Button>
      <Button size="lg" onClick={finish}>Selesai</Button>
    </div>
  );

  if (desktop) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <button type="button" aria-label="Kecilkan timer" tabIndex={-1} onClick={() => setMinimized(true)} className="absolute inset-0 animate-fade-in cursor-default bg-scrim" />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Timer fokus"
          tabIndex={-1}
          className="relative flex w-105 max-w-full animate-dialog-in flex-col items-center gap-2.5 rounded-sheet bg-primary-soft p-6 shadow-pop outline-none"
        >
          <span className="text-label font-bold text-brand-800" aria-live="polite">{status}</span>
          <span className="text-center text-h3 font-extrabold">{title}</span>
          {unit && <span className="-mt-2 text-label text-ink-2">{sub}</span>}
          <div className="relative size-40">
            <div aria-hidden="true" className="absolute inset-2.5 rounded-full bg-surface" />
            <Ring value={pct} size={160} stroke={10} color="var(--brand-500)" track="var(--brand-100)" label={`Progres sesi ${Math.round(pct)} persen`} textClass="flex-col">
              <Mascot mood={mood} size={80} />
              <span role="timer" className="tabular -mt-1 text-timer-sm font-extrabold">{clock}</span>
            </Ring>
          </div>
          <span className="text-center text-label-lg font-semibold text-brand-800">{line}</span>
          <div className="w-full [&_button]:h-12 [&_button]:text-card">{controls}</div>
          <span className="text-small text-ink-2">{finished ? 'Esc = kecilkan' : 'Spasi = jeda/lanjut · Esc = kecilkan'}</span>
        </div>
        {unitSheet}
      </div>
    );
  }

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="Timer fokus"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col items-center overflow-y-auto overscroll-contain bg-primary-soft px-6 pt-5 pb-[max(28px,env(safe-area-inset-bottom))] outline-none"
    >
      <div className="flex items-center justify-between self-stretch">
        <button type="button" aria-label="Kecilkan timer" onClick={() => setMinimized(true)} className="flex size-11 items-center justify-center rounded-full bg-surface text-ink-muted">
          <Icon.ChevronDown size={20} />
        </button>
        <span className="text-label font-bold text-brand-800" aria-live="polite">{status}</span>
        <span className="w-11" aria-hidden="true" />
      </div>
      <span className="mt-3 text-center text-h3 font-extrabold">{title}</span>
      <span className="mt-0.5 text-label text-ink-2">{sub}</span>
      <div className="relative mt-4.5 size-65 shrink-0">
        <div aria-hidden="true" className="absolute inset-3 rounded-full bg-surface" />
        <Ring value={pct} size={260} stroke={12} color="var(--brand-500)" track="var(--brand-100)" label={`Progres sesi ${Math.round(pct)} persen`} textClass="flex-col">
          <Mascot mood={mood} size={120} />
          <span role="timer" className={cx('tabular -mt-1.5 font-extrabold tracking-[-1px]', 'text-display-2xl')}>{clock}</span>
        </Ring>
      </div>
      <span className="mt-4.5 min-h-5 text-center text-body font-semibold text-brand-800">{line}</span>
      <div className="mt-auto flex flex-col gap-2.5 self-stretch pt-6">{controls}</div>
      {unitSheet}
    </div>
  );
}
