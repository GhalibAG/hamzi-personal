// Sheet "Event baru" (CAL-03): judul, tanggal, jam mulai/selesai atau seharian, catatan. `initial.id` = ubah event.
// initial: { id?, title?, date?, start_time?, end_time?, all_day? }. HP = sheet bawah; desktop = dialog.
import { useState } from 'react';
import { z } from 'zod';
import { wibDate, wibTime, wibToInstant } from '@common/calc/index.ts';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Button, EmptyState, Field, ListSkeleton, Sheet, Switch, inputCls, textareaCls } from '@/components/ui';
import type { QuickSheetProps } from '@/app/quick';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { CalEvent } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const eventSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi').max(120, 'Maksimal 120 karakter'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal'),
  allDay: z.boolean(),
  start: z.string(),
  end: z.string(),
  notes: z.string().max(1000, 'Maksimal 1000 karakter'),
}).superRefine((v, ctx) => {
  if (!v.allDay) {
    if (!TIME.test(v.start)) ctx.addIssue({ code: 'custom', path: ['start'], message: 'Isi jam mulai' });
    if (v.end && !TIME.test(v.end)) ctx.addIssue({ code: 'custom', path: ['end'], message: 'Jam tidak valid' });
    if (TIME.test(v.start) && TIME.test(v.end) && v.end <= v.start) ctx.addIssue({ code: 'custom', path: ['end'], message: 'Jam selesai harus setelah jam mulai' });
  }
  for (const k of ['title', 'notes'] as const) {
    const s = detectSensitive(v[k])[0];
    if (s) ctx.addIssue({ code: 'custom', path: [k], message: SENSITIVE_MESSAGE[s] });
  }
});
type Errors = Partial<Record<'title' | 'date' | 'start' | 'end' | 'notes', string>>;

function EventForm({ ev, initial, onDone }: { ev?: CalEvent; initial?: Record<string, unknown>; onDone: () => void }) {
  const today = useToday();
  const upsert = useUpsert('events');
  const rm = useRemove('events');
  const [newId] = useState(() => uuid());
  const [title, setTitle] = useState(ev?.title ?? str(initial?.title));
  const [date, setDate] = useState(ev ? wibDate(new Date(ev.starts_at)) : str(initial?.date) || today);
  const [allDay, setAllDay] = useState(ev ? ev.all_day : initial?.all_day === true);
  const [start, setStart] = useState(ev && !ev.all_day ? wibTime(new Date(ev.starts_at)) : str(initial?.start_time) || '09:00');
  const [end, setEnd] = useState(ev?.ends_at && !ev.all_day ? wibTime(new Date(ev.ends_at)) : str(initial?.end_time) || (ev ? '' : '10:00'));
  const [notes, setNotes] = useState(ev?.notes ?? str(initial?.notes));
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = eventSchema.safeParse({ title, date, allDay, start, end, notes });
    const errs: Errors = {};
    if (!r.success) for (const i of r.error.issues) errs[i.path[0] as keyof Errors] ??= i.message;
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) { document.getElementById(`ev-${first}`)?.focus(); return; }
    const isNew = !ev;
    const [saved] = await upsert.save({
      id: ev?.id ?? newId,
      title: title.trim(),
      starts_at: wibToInstant(date, allDay ? '00:00' : start).toISOString(),
      ends_at: allDay || !end ? null : wibToInstant(date, end).toISOString(),
      all_day: allDay,
      notes: notes.trim() || null,
    });
    onDone();
    if (isNew) toastUndo('Event ditambahkan', () => void rm.remove(saved.id));
    else toast('Event diperbarui');
  };

  const del = async () => {
    if (!ev) return;
    onDone();
    await rm.remove(ev.id);
    toastUndo('Event dihapus', () => void rm.undo(ev.id));
  };

  return (
    <form id="event-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Judul" htmlFor="ev-title" error={errors.title}>
        <input id="ev-title" data-autofocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Mis. Seminar karier fakultas" aria-invalid={!!errors.title} autoComplete="off" />
      </Field>
      <Field label="Tanggal" htmlFor="ev-date" error={errors.date}>
        <input id="ev-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 py-1 pr-1 pl-3.5">
        <span id="ev-allday-label" className="text-body font-bold">Seharian</span>
        <Switch checked={allDay} onChange={setAllDay} label="Seharian" />
      </div>
      {!allDay && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mulai" htmlFor="ev-start" error={errors.start}>
            <input id="ev-start" type="time" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!errors.start} />
          </Field>
          <Field label="Selesai (opsional)" htmlFor="ev-end" error={errors.end}>
            <input id="ev-end" type="time" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!errors.end} />
          </Field>
        </div>
      )}
      <Field label="Catatan (opsional)" htmlFor="ev-notes" error={errors.notes}>
        <textarea id="ev-notes" className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Tempat, hal yang perlu dibawa…" aria-invalid={!!errors.notes} />
      </Field>
      {ev && <Button variant="danger-outline" block onClick={() => void del()}>Hapus event</Button>}
    </form>
  );
}

export function EventFormSheet({ open, onClose, initial }: QuickSheetProps) {
  const events = useRows('events');
  const id = typeof initial?.id === 'string' ? initial.id : undefined;
  const ev = id ? events.rows.find((e) => e.id === id) : undefined;
  const loading = !!id && !ev && events.isLoading;
  const missing = !!id && !ev && !events.isLoading;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={ev ? 'Ubah event' : 'Event baru'}
      closeButton
      footer={!loading && !missing ? <Button size="lg" block type="submit" form="event-form">Simpan</Button> : undefined}
    >
      {loading ? <ListSkeleton rows={3} /> : missing ? (
        <EmptyState compact mood="worried" text="Event ini tidak ditemukan. Mungkin sudah dihapus." />
      ) : (
        <EventForm key={ev?.id ?? 'new'} ev={ev} initial={initial} onDone={onClose} />
      )}
    </Sheet>
  );
}
