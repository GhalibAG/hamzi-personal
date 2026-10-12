// Sheet "Rutinitas wajib baru" (RUT-01/02, UI-SPEC §6.4, screenshot 16) + "Opsi lain" (jenis jumlah, wajib, hari tertentu).
import { useId, useMemo, useState, type FormEvent } from 'react';
import { inQuietHours, REPEAT_PRESETS } from '@common/calc/index.ts';
import { HARI_PENDEK } from '@common/format.ts';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Button, Chip, Field, inputCls, Segmented, Sheet } from '@/components/ui';
import { useRows, useSettings, useUpsert } from '@/data/hooks';
import type { Routine } from '@/data/types';
import type { QuickSheetProps } from '@/app/quick';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/ui';
import { hhmm } from '@/features/learning/derive';
import { ToggleSwitch } from '@/features/growth/components/ToggleSwitch';

const PRESETS = Object.entries(REPEAT_PRESETS) as [string, number[]][];
const sameDays = (a: number[], b: number[]) => [...a].sort().join(',') === [...b].sort().join(',');

function str(v: unknown, d = ''): string { return typeof v === 'string' ? v : d; }
function num(v: unknown, d: number): number { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; }
function days(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(Number).filter((x) => Number.isInteger(x) && x >= 1 && x <= 7);
  return out.length ? [...new Set(out)].sort() : null;
}

export interface RoutineDraft {
  name: string; kind: Routine['kind']; target: number; required: boolean; days: number[]; time: string;
}

export function draftFrom(initial: Record<string, unknown> | undefined, existing?: Routine): RoutineDraft {
  const src = { ...(existing ?? {}), ...(initial ?? {}) } as Record<string, unknown>;
  const kind = src.kind === 'count' ? 'count' : 'check';
  return {
    name: str(src.name),
    kind,
    target: kind === 'count' ? Math.min(50, num(src.target_count, 8)) : 1,
    required: src.is_required === undefined ? true : !!src.is_required,
    days: days(src.repeat_days) ?? [1, 2, 3, 4, 5, 6, 7],
    time: src.remind_at === null ? '' : hhmm(str(src.remind_at, existing ? '' : '06:00')),
  };
}

export function draftError(dr: RoutineDraft): string | null {
  const s = detectSensitive(dr.name);
  if (s.length) return SENSITIVE_MESSAGE[s[0]];
  if (dr.name.trim().length > 60) return 'Nama maksimal 60 karakter.';
  return null;
}

/** Bagian form rutinitas yang dipakai sheet & halaman detail. */
export function RoutineFields({ dr, set, showMore, setShowMore, autoFocus = false }: {
  dr: RoutineDraft; set: (p: Partial<RoutineDraft>) => void; showMore: boolean; setShowMore: (v: boolean) => void; autoFocus?: boolean;
}) {
  const id = useId();
  const s = useSettings();
  const err = draftError(dr);
  const quiet = dr.time && inQuietHours(dr.time, hhmm(s.quiet_start), hhmm(s.quiet_end));
  const preset = PRESETS.find(([, d]) => sameDays(d, dr.days))?.[0];
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Nama rutinitas" htmlFor={`${id}-name`} error={err ?? undefined}>
        <input
          id={`${id}-name`}
          data-autofocus={autoFocus || undefined}
          value={dr.name}
          maxLength={60}
          onChange={(e) => set({ name: e.target.value.slice(0, 60) })}
          placeholder="mis. Minum air 8 gelas"
          className={cx(inputCls, 'text-card')}
          autoComplete="off"
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-bold text-ink-muted" id={`${id}-rep`}>Ulangi</span>
        <div role="group" aria-labelledby={`${id}-rep`} className="flex flex-wrap gap-1.5">
          {PRESETS.map(([label, d]) => (
            <Chip key={label} size="lg" selected={preset === label} onClick={() => set({ days: d })}>{label}</Chip>
          ))}
        </div>
        {!showMore && (
          <button type="button" onClick={() => setShowMore(true)} aria-expanded={false} className="h-9 self-start bg-transparent p-0 text-meta font-bold text-primary underline-offset-2 hover:underline">
            Opsi lain
          </button>
        )}
      </div>
      {showMore && (
        <div className="flex flex-col gap-3.5 rounded-2xl bg-surface-2 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-bold text-ink-muted" id={`${id}-days`}>Hari tertentu</span>
            <div role="group" aria-labelledby={`${id}-days`} className="grid grid-cols-7 gap-1">
              {HARI_PENDEK.slice(1).map((h, i) => {
                const n = i + 1;
                const on = dr.days.includes(n);
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={on}
                    aria-label={h}
                    onClick={() => set({ days: on ? dr.days.filter((x) => x !== n) : [...dr.days, n].sort() })}
                    className={cx('h-11 rounded-md border text-meta font-bold', on ? 'border-brand-300 bg-primary-soft text-on-primary-soft' : 'border-line-strong bg-surface text-ink-muted')}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            {!dr.days.length && <span role="alert" className="text-meta font-semibold text-danger-fg">Pilih minimal satu hari.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-bold text-ink-muted">Jenis</span>
            <Segmented<Routine['kind']>
              label="Jenis rutinitas"
              value={dr.kind}
              onChange={(k) => set({ kind: k, target: k === 'count' ? Math.max(2, dr.target) : 1 })}
              options={[{ value: 'check', label: 'Centang' }, { value: 'count', label: 'Jumlah per hari' }]}
            />
          </div>
          {dr.kind === 'count' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-label font-bold text-ink-muted" id={`${id}-target`}>Target per hari</span>
              <div role="group" aria-labelledby={`${id}-target`} className="flex items-center gap-1">
                <Button size="xs" variant="secondary" className="w-11" aria-label="Kurangi target" disabled={dr.target <= 2} onClick={() => set({ target: Math.max(2, dr.target - 1) })}>−</Button>
                <span className="tabular w-10 text-center text-section font-extrabold" aria-live="polite">{dr.target}</span>
                <Button size="xs" variant="secondary" className="w-11" aria-label="Tambah target" disabled={dr.target >= 50} onClick={() => set({ target: Math.min(50, dr.target + 1) })}>+</Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-label font-bold text-ink-muted">Wajib</span>
              <span className="text-meta text-ink-3">Rutinitas wajib menentukan pohon di kebun harian.</span>
            </div>
            <ToggleSwitch checked={dr.required} onChange={(v) => set({ required: v })} label="Rutinitas wajib" />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-time`} className="text-label font-bold text-ink-muted">Jam pengingat</label>
          <div className="flex items-center gap-1">
            {dr.time && (
              <button type="button" onClick={() => set({ time: '' })} className="h-11 bg-transparent px-2 text-meta font-bold text-ink-3 hover:text-ink">Tanpa</button>
            )}
            <input
              id={`${id}-time`}
              type="time"
              value={dr.time}
              onChange={(e) => set({ time: e.target.value })}
              className="tabular h-11 rounded-lg border border-line-strong bg-surface px-3 text-card font-bold text-ink outline-none focus:border-brand-400"
            />
          </div>
        </div>
        {quiet && <span className="text-meta text-warn-strong">Jam ini masuk jam tenang ({hhmm(s.quiet_start)}–{hhmm(s.quiet_end)}). Pengingat buatanmu tetap dikirim.</span>}
        {!dr.time && <span className="text-meta text-ink-3">Tanpa jam, rutinitas ini tidak diingatkan.</span>}
      </div>
    </div>
  );
}

export function RoutineFormSheet({ open, onClose, initial }: QuickSheetProps) {
  const routines = useRows('routines').rows;
  const editId = typeof initial?.id === 'string' ? initial.id : null;
  const existing = useMemo(() => (editId ? routines.find((r) => r.id === editId) : undefined), [editId, routines]);
  const [dr, setDr] = useState<RoutineDraft>(() => draftFrom(initial, existing));
  const [showMore, setShowMore] = useState(() => !!initial && (initial.kind === 'count' || initial.is_required === false || (days(initial.repeat_days) !== null && !PRESETS.some(([, d]) => sameDays(d, days(initial.repeat_days) ?? [])))));
  const up = useUpsert('routines');
  const set = (p: Partial<RoutineDraft>) => setDr((x) => ({ ...x, ...p }));
  const valid = dr.name.trim().length > 0 && dr.days.length > 0 && !draftError(dr);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid || up.isPending) return;
    const row: Partial<Routine> = {
      name: dr.name.trim(), kind: dr.kind, target_count: dr.kind === 'count' ? dr.target : 1, is_required: dr.required,
      repeat_days: [...dr.days].sort(), remind_at: dr.time || null,
      remind_enabled: existing ? (dr.time ? existing.remind_enabled || !existing.remind_at : false) : !!dr.time,
    };
    try {
      if (existing) await up.save({ ...row, id: existing.id });
      else await up.save({ ...row, icon: null, color: null, archived: false, sort: routines.reduce((m, r) => Math.max(m, r.sort), -1) + 1 });
      toast(existing ? 'Rutinitas diperbarui.' : 'Rutinitas tersimpan. Pohonmu siap disiram.');
      onClose();
    } catch {
      toast('Gagal menyimpan. Coba lagi.');
    }
  };

  const title = existing ? 'Ubah rutinitas' : dr.required ? 'Rutinitas wajib baru' : 'Rutinitas baru';
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={<Button size="lg" block disabled={!valid || up.isPending} onClick={() => void save()}>Simpan</Button>}
    >
      <form onSubmit={(e) => void save(e)} noValidate>
        <RoutineFields dr={dr} set={set} showMore={showMore} setShowMore={setShowMore} autoFocus />
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
