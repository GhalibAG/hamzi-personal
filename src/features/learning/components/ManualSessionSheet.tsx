// "Catat sesi manual" (BEL-08): durasi + tanggal + jam (+ unit) → RPC rpc_study_finish (tetes air & XP sesuai aturan).
import { useId, useState } from 'react';
import { wibTime, wibToInstant } from '@common/calc/index.ts';
import { Button, Chip, Field, inputCls, Sheet } from '@/components/ui';
import { uuid } from '@/data';
import { useStudyFinish } from '@/data/hooks';
import type { LearningUnit } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { toast, useUi } from '@/stores/ui';
import { unitLabel } from '../derive';

const DURATIONS = [15, 25, 45, 60];

export function ManualSessionSheet({ open, onClose, moduleId, units }: { open: boolean; onClose: () => void; moduleId: string; units: LearningUnit[] }) {
  const id = useId();
  const today = useToday();
  const [minutes, setMinutes] = useState(25);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() => {
    const t = wibTime();
    return t > '20:00' ? '20:00' : t;
  });
  const [unitId, setUnitId] = useState<string>('');
  const finish = useStudyFinish();
  const markWatered = useUi((s) => s.markWatered);

  const at = date && time ? wibToInstant(date, time) : null;
  const err = !at ? 'Isi tanggal dan jam.'
    : at.getTime() > Date.now() ? 'Waktu mulai belum terjadi.'
      : minutes < 1 || minutes > 720 ? 'Durasi 1–720 menit.' : null;

  const save = async () => {
    if (err || !at || finish.isPending) return;
    try {
      const res = await finish.mutateAsync({ p_id: uuid(), p_started_at: at.toISOString(), p_duration_min: minutes, p_module_id: moduleId, p_unit_id: unitId || null, p_source: 'manual' });
      if (res.water_awarded) { markWatered(); toast('Sesi tercatat. +1 tetes air!'); } else toast('Sesi tercatat.');
      onClose();
    } catch {
      toast('Gagal mencatat sesi. Coba lagi.');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Catat sesi manual"
      footer={<Button size="lg" block disabled={!!err || finish.isPending} onClick={() => void save()}>Simpan sesi</Button>}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted" id={`${id}-d`}>Durasi</span>
          <div role="group" aria-labelledby={`${id}-d`} className="flex flex-wrap items-center gap-1.5">
            {DURATIONS.map((m) => <Chip key={m} size="lg" selected={minutes === m} onClick={() => setMinutes(m)}>{m} mnt</Chip>)}
            <label className="sr-only" htmlFor={`${id}-min`}>Durasi lain (menit)</label>
            <input
              id={`${id}-min`}
              type="number"
              inputMode="numeric"
              min={1}
              max={720}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(720, Math.round(Number(e.target.value) || 0))))}
              className="tabular h-10 w-20 rounded-full border border-line-strong bg-surface px-3 text-center text-label font-bold text-ink outline-none focus:border-brand-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Tanggal" htmlFor={`${id}-date`}>
            <input id={`${id}-date`} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Jam mulai" htmlFor={`${id}-time`}>
            <input id={`${id}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </Field>
        </div>
        {units.length > 0 && (
          <Field label="Unit (opsional)" htmlFor={`${id}-unit`}>
            <select id={`${id}-unit`} value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls}>
              <option value="">Tanpa unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(units, u)}</option>)}
            </select>
          </Field>
        )}
        {err ? <span role="alert" className="text-meta font-semibold text-danger-fg">{err}</span> : (
          <span className="text-meta text-ink-3">Sesi minimal 10 menit menyiram pohon (maks 3 tetes per hari dari belajar).</span>
        )}
      </div>
    </Sheet>
  );
}
