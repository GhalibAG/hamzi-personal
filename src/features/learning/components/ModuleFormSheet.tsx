// Sheet "Modul belajar baru" (BEL-02, BEL-09, UI-SPEC §6.4, screenshot 16): nama, Pakai templat, jumlah unit, jam pengingat.
import { useId, useMemo, useState, type FormEvent } from 'react';
import { inQuietHours } from '@common/calc/index.ts';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Button, Chip, Field, inputCls, Sheet } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useRows, useSettings, useUpsert } from '@/data/hooks';
import { uuid } from '@/data';
import type { LearningModule, LearningUnit } from '@/data/types';
import type { QuickSheetProps } from '@/app/quick';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/ui';
import { CATEGORIES, CATEGORY_LABEL, hhmm, lmIndex } from '../derive';
import { MODULE_TEMPLATES, templateByKey, type ModuleTemplate } from '../templates';

const UNIT_OPTS = [5, 10, 15, 20];

function str(v: unknown, d = ''): string { return typeof v === 'string' ? v : d; }

export function ModuleFormSheet({ open, onClose, initial }: QuickSheetProps) {
  const id = useId();
  const s = useSettings();
  const modules = useRows('learning_modules').rows;
  const editId = typeof initial?.id === 'string' ? initial.id : null;
  const existing = useMemo(() => (editId ? modules.find((m) => m.id === editId) : undefined), [editId, modules]);

  const initTitles = Array.isArray(initial?.unit_titles) ? (initial.unit_titles as unknown[]).map((x) => String(x).slice(0, 120)).filter(Boolean) : [];
  const [title, setTitle] = useState(() => str(initial?.title, existing?.title ?? ''));
  const [units, setUnits] = useState<number>(() => {
    const n = Number(initial?.unit_count);
    return initTitles.length || (Number.isInteger(n) && n > 0 && n <= 60 ? n : 10);
  });
  const [time, setTime] = useState(() => (initial?.remind_at === null ? '' : hhmm(str(initial?.remind_at, existing?.remind_at ?? (existing ? '' : '20:00')))));
  const [category, setCategory] = useState(() => {
    const c = str(initial?.category, existing?.category ?? 'lainnya');
    return CATEGORIES.includes(c) ? c : 'lainnya';
  });
  const [tpl, setTpl] = useState<ModuleTemplate | null>(() => templateByKey(str(initial?.template_key)) ?? null);
  const [customTitles] = useState<string[]>(initTitles);
  const [picking, setPicking] = useState(false);
  const up = useUpsert('learning_modules');
  const upUnits = useUpsert('learning_units');

  const sens = detectSensitive(title);
  const err = sens.length ? SENSITIVE_MESSAGE[sens[0]] : title.trim().length > 80 ? 'Nama maksimal 80 karakter.' : null;
  const valid = title.trim().length > 0 && !err;
  const quiet = time && inQuietHours(time, hhmm(s.quiet_start), hhmm(s.quiet_end));

  const pick = (t: ModuleTemplate) => {
    setTpl(t);
    if (!title.trim() || MODULE_TEMPLATES.some((x) => x.title === title.trim())) setTitle(t.title);
    setCategory(t.category);
    setUnits(t.units.length);
    setPicking(false);
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid || up.isPending || upUnits.isPending) return;
    try {
      if (existing) {
        await up.save({ id: existing.id, title: title.trim(), category, remind_at: time || null, remind_enabled: time ? existing.remind_enabled || !existing.remind_at : false });
        toast('Modul diperbarui.');
        onClose();
        return;
      }
      const moduleId = uuid();
      const used = modules.length;
      const row: Partial<LearningModule> = {
        id: moduleId, title: title.trim(), category, color_index: lmIndex(used), weekly_target_min: 120,
        remind_at: time || null, remind_days: [1, 2, 3, 4, 5, 6, 7], remind_enabled: !!time, status: 'aktif',
        template_key: tpl?.key ?? null, sort: modules.reduce((m, x) => Math.max(m, x.sort), -1) + 1,
      };
      await up.save(row);
      const list: Partial<LearningUnit>[] = Array.from({ length: units }, (_, i) => ({
        module_id: moduleId,
        title: tpl?.units[i]?.title ?? customTitles[i] ?? `Unit ${i + 1}`,
        kind: tpl?.units[i]?.kind ?? 'bacaan',
        url: null, est_min: 30, status: 'belum', notes: null, completed_at: null, sort: i,
      }));
      if (list.length) await upUnits.save(list);
      toast(`Modul tersimpan dengan ${units} unit.`);
      onClose();
    } catch {
      toast('Gagal menyimpan. Coba lagi.');
    }
  };

  const unitChoices = UNIT_OPTS.includes(units) ? UNIT_OPTS : [...UNIT_OPTS, units].sort((a, b) => a - b);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? 'Ubah modul' : 'Modul belajar baru'}
      footer={<Button size="lg" block disabled={!valid || up.isPending || upUnits.isPending} onClick={() => void save()}>Simpan</Button>}
    >
      <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-3.5">
        {!existing && (
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            className="-mt-2 -mb-1.5 h-9 self-start bg-transparent p-0 text-meta font-bold text-primary underline-offset-2 hover:underline"
          >
            {picking ? 'Tutup templat' : 'Pakai templat'}
          </button>
        )}
        {picking && (
          <div role="group" aria-label="Templat modul" className="grid grid-cols-2 gap-2">
            {MODULE_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tpl?.key === t.key}
                onClick={() => pick(t)}
                className={cx('flex min-h-14 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left', tpl?.key === t.key ? 'border-brand-300 bg-primary-soft' : 'border-line-strong bg-surface hover:bg-surface-2')}
              >
                <span className="text-label font-bold text-ink">{t.title}</span>
                <span className="text-meta text-ink-3">{t.units.length} unit</span>
              </button>
            ))}
          </div>
        )}
        <Field label="Nama modul" htmlFor={`${id}-name`} error={err ?? undefined}>
          <input
            id={`${id}-name`}
            data-autofocus
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="mis. Python untuk data"
            className={cx(inputCls, 'text-card')}
            autoComplete="off"
          />
        </Field>
        {existing && (
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-bold text-ink-muted" id={`${id}-cat`}>Kategori</span>
            <div role="group" aria-labelledby={`${id}-cat`} className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c]}</Chip>)}
            </div>
          </div>
        )}
        {!existing && (tpl ? (
          <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-bold text-ink-muted">Templat: {tpl.title} · {tpl.units.length} unit</span>
              <button type="button" onClick={() => { setTpl(null); setUnits(customTitles.length || 10); }} aria-label="Hapus templat" className="flex size-9 items-center justify-center rounded-full bg-transparent text-ink-3 hover:bg-surface">
                <Icon.X size={16} />
              </button>
            </div>
            <span className="text-meta text-ink-3">{tpl.units.slice(0, 4).map((u) => u.title).join(' · ')}{tpl.units.length > 4 ? ' · …' : ''}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-bold text-ink-muted" id={`${id}-units`}>Jumlah unit / bab</span>
            <div role="group" aria-labelledby={`${id}-units`} className="flex flex-wrap gap-1.5">
              {unitChoices.map((u) => (
                <Chip key={u} size="lg" selected={units === u} onClick={() => setUnits(u)}>{u} unit</Chip>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${id}-time`} className="text-label font-bold text-ink-muted">Jam pengingat</label>
            <div className="flex items-center gap-1">
              {time && <button type="button" onClick={() => setTime('')} className="h-11 bg-transparent px-2 text-meta font-bold text-ink-3 hover:text-ink">Tanpa</button>}
              <input
                id={`${id}-time`}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tabular h-11 rounded-lg border border-line-strong bg-surface px-3 text-card font-bold text-ink outline-none focus:border-brand-400"
              />
            </div>
          </div>
          {quiet && <span className="text-meta text-warn-strong">Jam ini masuk jam tenang ({hhmm(s.quiet_start)}–{hhmm(s.quiet_end)}). Pengingat buatanmu tetap dikirim.</span>}
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
