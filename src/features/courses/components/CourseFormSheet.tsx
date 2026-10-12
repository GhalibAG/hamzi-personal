// Sheet matkul (KUL-02): kode, nama, SKS, dosen, ruang, warna, jadwal mingguan multi-baris, target nilai, batas hadir,
// nilai akhir, semester (default = aktif). Buka via openQuick('course', { id?, semester_id?, ... }).
import { useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { HARI } from '@common/format.ts';
import type { QuickSheetProps } from '@/app/quick';
import { Icon } from '@/components/icons';
import { Button, Field, IconButton, inputCls, ListSkeleton, Sheet } from '@/components/ui';
import { useRemove, useRows, useSettings, useUpsert } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { Course, CourseSchedule } from '@/data/types';
import { cx } from '@/lib/cx';
import { toast, toastUndo } from '@/stores/ui';
import { activeSemester, gradeLetters, simGradeOptions, WEEKDAY_OPTIONS } from '../derive';
import { courseFormSchema, fieldErrors } from '../schema';
import { ChipRow, ColorPicker, COURSE_COLORS, FormLabel, resolveToken, Select } from './formBits';

interface SchedRow { key: string; id?: string; weekday: number; start_time: string; end_time: string; room: string }

const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

function toSchedRows(v: unknown): SchedRow[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((x: Partial<CourseSchedule>) => ({
    key: uuid(), id: x.id, weekday: Number(x.weekday ?? 1), start_time: str(x.start_time).slice(0, 5), end_time: str(x.end_time).slice(0, 5), room: str(x.room),
  }));
}

export function CourseFormSheet(p: QuickSheetProps) {
  const qs = [useRows('courses'), useRows('semesters'), useRows('course_schedules')];
  if (qs.some((q) => q.isLoading)) {
    return <Sheet open={p.open} onClose={p.onClose} title="Mata kuliah" closeButton><ListSkeleton rows={4} /></Sheet>;
  }
  return <CourseForm {...p} />;
}

function CourseForm({ open, onClose, initial = {} }: QuickSheetProps) {
  const courses = useRows('courses').rows;
  const semesters = useRows('semesters').rows;
  const allSchedules = useRows('course_schedules').rows;
  const settings = useSettings();
  const save = useUpsert('courses');
  const saveSched = useUpsert('course_schedules');
  const removeSched = useRemove('course_schedules');
  const removeCourse = useRemove('courses');
  const nav = useNavigate();
  const { pathname } = useLocation();

  const id = typeof initial.id === 'string' ? initial.id : undefined;
  const existing = id ? courses.find((c) => c.id === id) : undefined;
  const active = activeSemester(semesters);
  const pick = (k: keyof Course) => (initial[k] !== undefined ? initial[k] : existing?.[k]);

  const [name, setName] = useState(str(pick('name')));
  const [code, setCode] = useState(str(pick('code')));
  const [credits, setCredits] = useState(str(pick('credits') ?? 3));
  const [lecturer, setLecturer] = useState(str(pick('lecturer')));
  const [room, setRoom] = useState(str(pick('room')));
  const [color, setColor] = useState<string | null>(() => str(pick('color')) || resolveToken(COURSE_COLORS[courses.length % COURSE_COLORS.length].token) || null);
  const [target, setTarget] = useState<string | null>(str(pick('target_grade')) || (existing ? null : 'A'));
  const [minAtt, setMinAtt] = useState(str(pick('min_attendance_pct') ?? 75));
  const [finalGrade, setFinalGrade] = useState(str(pick('final_grade')));
  const [semesterId, setSemesterId] = useState(str(pick('semester_id')) || active?.id || '');
  const existingSched = useMemo(() => (id ? allSchedules.filter((s) => s.course_id === id) : []), [allSchedules, id]);
  const [rows, setRows] = useState<SchedRow[]>(() => toSchedRows(initial.schedules) ?? toSchedRows(existingSched) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = useId();
  const [busy, setBusy] = useState(false);

  const sortedSem = [...semesters].sort((a, b) => b.number - a.number);
  const isActiveSem = semesterId === active?.id;
  const setRow = (key: string, patch: Partial<SchedRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { key: uuid(), weekday: rs.length ? Math.min(7, rs[rs.length - 1].weekday + 1) : 1, start_time: '08:00', end_time: '10:30', room: '' }]);

  const submit = async () => {
    const parsed = courseFormSchema.safeParse({
      semester_id: semesterId, name, code: code || undefined, credits: Number(credits), lecturer: lecturer || undefined, room: room || undefined,
      min_attendance_pct: Number(minAtt), schedules: rows.map((r) => ({ weekday: r.weekday, start_time: r.start_time, end_time: r.end_time, room: r.room || undefined })),
    });
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    setBusy(true);
    const v = parsed.data;
    const courseId = existing?.id ?? uuid();
    const row: Course = {
      ...(existing ?? {}),
      id: courseId, semester_id: v.semester_id, name: v.name, code: v.code ?? null, credits: v.credits, lecturer: v.lecturer ?? null,
      room: v.room ?? null, color, target_grade: target, min_attendance_pct: v.min_attendance_pct, final_grade: finalGrade || null,
      sim_grade: existing?.sim_grade ?? null,
    };
    try {
      await save.save(row);
      const keep = new Set(rows.map((r) => r.id).filter(Boolean));
      await Promise.all(existingSched.filter((s) => !keep.has(s.id)).map((s) => removeSched.remove(s.id)));
      if (rows.length) {
        await saveSched.save(rows.map((r) => ({ id: r.id ?? uuid(), course_id: courseId, weekday: r.weekday, start_time: r.start_time, end_time: r.end_time, room: r.room.trim() || null })));
      }
      toast(existing ? 'Matkul diperbarui' : 'Matkul tersimpan');
      onClose();
    } catch {
      toast('Gagal menyimpan. Coba lagi ya.');
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!existing) return;
    await removeCourse.remove(existing.id);
    onClose();
    if (pathname === `/kuliah/matkul/${existing.id}`) nav('/kuliah');
    toastUndo(`${existing.name} dihapus`, () => void removeCourse.undo(existing.id));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? 'Ubah mata kuliah' : 'Mata kuliah baru'}
      closeButton
      desktopWidth={520}
      footer={
        <div className="flex flex-col gap-2">
          <Button type="submit" form={formId} size="lg" block disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
          {existing && <Button variant="danger-outline" block onClick={() => void del()}>Hapus matkul</Button>}
        </div>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Nama mata kuliah" htmlFor="c-name" error={errors.name}>
          <input id="c-name" data-autofocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mis. Basis Data Lanjut" maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kode" htmlFor="c-code" error={errors.code}>
            <input id="c-code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SI601" maxLength={20} />
          </Field>
          <Field label="SKS" htmlFor="c-sks" error={errors.credits}>
            <input id="c-sks" className={inputCls} inputMode="numeric" type="number" min={1} max={10} value={credits} onChange={(e) => setCredits(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dosen" htmlFor="c-lect" hint="Tidak dikirim ke AI otomatis.">
            <input id="c-lect" className={inputCls} value={lecturer} onChange={(e) => setLecturer(e.target.value)} placeholder="Pak Hendra" maxLength={80} />
          </Field>
          <Field label="Ruang" htmlFor="c-room">
            <input id="c-room" className={inputCls} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="R. 2.3" maxLength={60} />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <FormLabel>Warna</FormLabel>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <FormLabel>Jadwal mingguan</FormLabel>
            <button type="button" onClick={addRow} className="h-11 bg-transparent px-1 text-label font-extrabold text-primary">+ Tambah jadwal</button>
          </div>
          {rows.length === 0 && <span className="text-meta text-ink-3">Belum ada jadwal. Tambahkan hari & jam kuliahnya.</span>}
          {rows.map((r, i) => (
            <fieldset key={r.key} className="m-0 flex flex-col gap-2 rounded-2xl border-0 bg-surface-2 p-3">
              <legend className="sr-only">Jadwal {i + 1}</legend>
              <div className="flex items-center gap-2">
                <label htmlFor={`s-wd-${r.key}`} className="sr-only">Hari jadwal {i + 1}</label>
                <Select id={`s-wd-${r.key}`} value={r.weekday} onChange={(e) => setRow(r.key, { weekday: Number(e.target.value) })} className="flex-1">
                  {WEEKDAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <IconButton label={`Hapus jadwal ${HARI[r.weekday]}`} variant="plain" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                  <Icon.Trash size={18} />
                </IconButton>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-w-0 flex-col gap-1 text-meta font-semibold text-ink-3">Mulai
                  <input type="time" className={cx(inputCls, 'min-w-0')} value={r.start_time} onChange={(e) => setRow(r.key, { start_time: e.target.value })} />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-meta font-semibold text-ink-3">Selesai
                  <input type="time" className={cx(inputCls, 'min-w-0')} value={r.end_time} onChange={(e) => setRow(r.key, { end_time: e.target.value })} />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-3">Ruang (bila beda)
                <input className={inputCls} value={r.room} placeholder={room || 'Ruang'} onChange={(e) => setRow(r.key, { room: e.target.value })} maxLength={60} />
              </label>
              {errors[`schedules.${i}.end_time`] && <span role="alert" className="text-meta font-semibold text-danger-fg">{errors[`schedules.${i}.end_time`]}</span>}
            </fieldset>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <FormLabel>Target nilai</FormLabel>
          <ChipRow label="Target nilai" allowNone options={simGradeOptions(settings.grade_scale).map((g) => ({ value: g, label: g }))} value={target} onChange={setTarget} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Batas kehadiran (%)" htmlFor="c-att" error={errors.min_attendance_pct}>
            <input id="c-att" className={inputCls} type="number" inputMode="numeric" min={0} max={100} value={minAtt} onChange={(e) => setMinAtt(e.target.value)} />
          </Field>
          <Field label="Nilai akhir (resmi)" htmlFor="c-final">
            <Select id="c-final" value={finalGrade} onChange={(e) => setFinalGrade(e.target.value)}>
              <option value="">Belum keluar</option>
              {gradeLetters(settings.grade_scale).map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
        </div>
        {sortedSem.length > 0 && (
          <Field label="Semester" htmlFor="c-sem" error={errors.semester_id} hint={isActiveSem ? 'Semester aktif' : undefined}>
            <Select id="c-sem" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              {sortedSem.map((s) => <option key={s.id} value={s.id}>Semester {s.number} · {s.label}{s.is_active ? ' (aktif)' : ''}</option>)}
            </Select>
          </Field>
        )}
        {sortedSem.length === 0 && <span role="alert" className="text-meta font-semibold text-danger-fg">Buat semester dulu di Kelola semester & matkul.</span>}
      </form>
    </Sheet>
  );
}
