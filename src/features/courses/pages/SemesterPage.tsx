// Kelola semester & matkul `/kuliah/semester` — UI-SPEC §4.4, KUL-01/02 (+ nilai akhir semester lalu agar IPK benar),
// pintasan Pengaturan Akademik (target IPK, SKS kurikulum).
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { formatGpa } from '@common/calc/index.ts';
import { Icon } from '@/components/icons';
import {
  Button, EmptyState, ErrorState, Field, IconButton, inputCls, ListSkeleton, Menu, Page, ScreenHeader, SectionTitle, Tag,
} from '@/components/ui';
import { useRemove, useUpdate, useUpdateSettings } from '@/data/hooks';
import type { Course, Semester } from '@/data/types';
import { cx } from '@/lib/cx';
import { useIsDesktop } from '@/lib/hooks';
import { toast, toastUndo, useUi } from '@/stores/ui';
import { courseColorStyle } from '../components/formBits';
import { SemesterFormSheet } from '../components/SemesterFormSheet';
import { gradeLetters, semesterCourses, semesterIps, shortDate } from '../derive';
import { useCoursesData, type CoursesData } from '../hooks';
import { academicSettingsSchema, fieldErrors, parseDecimal } from '../schema';

const selectCls = 'h-11 w-21 shrink-0 rounded-lg border border-line-strong bg-surface px-2 text-label font-bold text-ink outline-none focus:border-brand-400';

function AcademicSettings({ d }: { d: CoursesData }) {
  const updSettings = useUpdateSettings();
  const [target, setTarget] = useState(d.settings.target_gpa !== null ? formatGpa(d.settings.target_gpa) : '');
  const [curr, setCurr] = useState(String(d.settings.curriculum_credits));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const parsed = academicSettingsSchema.safeParse({ target_gpa: target.trim() ? parseDecimal(target) : null, curriculum_credits: Number(curr) });
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    updSettings.mutate(parsed.data, { onSuccess: () => toast('Pengaturan akademik tersimpan'), onError: () => toast('Gagal menyimpan. Coba lagi ya.') });
  };
  const s = d.summary;
  return (
    <form className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-body font-extrabold">IPK {s.ipk !== null ? formatGpa(s.ipk) : '–'}</span>
        <span className="text-meta font-semibold text-ink-3">{s.creditsPassed}/{s.curriculum} SKS lulus</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target IPK" htmlFor="ac-target" error={errors.target_gpa} hint="Mis. 3,65">
          <input id="ac-target" inputMode="decimal" className={inputCls} value={target} placeholder="3,65" onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="SKS kurikulum" htmlFor="ac-curr" error={errors.curriculum_credits} hint="Total SKS lulus">
          <input id="ac-curr" type="number" inputMode="numeric" min={1} max={300} className={inputCls} value={curr} onChange={(e) => setCurr(e.target.value)} />
        </Field>
      </div>
      <Button type="submit" variant="soft" size="sm" className="self-start">Simpan pengaturan</Button>
    </form>
  );
}

function SemesterCard({ s, d, selected, onSelect, onEdit, onActivate }: {
  s: Semester; d: CoursesData; selected: boolean; onSelect: () => void; onEdit: () => void; onActivate: () => void;
}) {
  const own = semesterCourses(d.courses, s.id);
  const ip = semesterIps(own, d.settings.grade_scale, 'official');
  const isActive = d.sem?.id === s.id;
  return (
    <div className={cx('flex items-center gap-2 rounded-2xl border pr-1.5', selected ? 'border-kuliah-line bg-kuliah-bg' : 'border-line bg-surface')}>
      <button type="button" aria-pressed={selected} onClick={onSelect} className="flex min-w-0 flex-1 flex-col gap-0.5 bg-transparent py-3 pl-3.5 text-left">
        <span className="flex items-center gap-2">
          <span className="text-body font-extrabold">Semester {s.number}</span>
          {isActive && <Tag tone="kuliah">Aktif</Tag>}
        </span>
        <span className="truncate text-meta text-ink-2">{s.label} · {shortDate(s.start_date)} – {shortDate(s.end_date)}</span>
        <span className="text-meta font-semibold text-ink-3">
          {own.length} matkul · {ip.credits} SKS{ip.ips !== null ? ` · IPS ${formatGpa(ip.ips)}` : ''}
        </span>
      </button>
      {!isActive && <Button variant="outline-kuliah" size="xs" onClick={onActivate}>Jadikan aktif</Button>}
      <IconButton variant="plain" label={`Ubah semester ${s.number}`} onClick={onEdit}><Icon.Edit size={18} /></IconButton>
    </div>
  );
}

function CourseRow({ c, scale }: { c: Course; scale: Record<string, number> }) {
  const upd = useUpdate('courses');
  const rm = useRemove('courses');
  const openQuick = useUi((s) => s.openQuick);
  const del = async () => {
    await rm.remove(c.id);
    toastUndo(`${c.name} dihapus`, () => void rm.undo(c.id));
  };
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-1.5 pr-1 pl-3.5">
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-kuliah-bar" style={courseColorStyle(c.color)} />
      <Link to={`/kuliah/matkul/${c.id}`} className="flex min-w-0 flex-1 flex-col py-1 text-ink no-underline">
        <span className="truncate text-body font-bold">{c.name}</span>
        <span className="truncate text-meta text-ink-3">{[c.code, `${c.credits} SKS`, c.lecturer].filter(Boolean).join(' · ')}</span>
      </Link>
      <label htmlFor={`fg-${c.id}`} className="sr-only">Nilai akhir {c.name}</label>
      <select
        id={`fg-${c.id}`}
        className={selectCls}
        value={c.final_grade ?? ''}
        onChange={(e) => void upd.patch(c.id, { final_grade: e.target.value || null })}
      >
        <option value="">Nilai –</option>
        {gradeLetters(scale).map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <Menu
        width={180}
        trigger={({ open, toggle }) => (
          <IconButton variant="plain" label={`Opsi ${c.name}`} aria-expanded={open} aria-haspopup="menu" onClick={toggle}><Icon.More size={20} /></IconButton>
        )}
        items={[
          { label: 'Ubah', icon: <Icon.Edit size={18} />, onSelect: () => openQuick('course', { id: c.id }) },
          { label: 'Hapus', danger: true, icon: <Icon.Trash size={18} />, onSelect: () => void del() },
        ]}
      />
    </div>
  );
}

export default function SemesterPage() {
  const d = useCoursesData();
  const desktop = useIsDesktop();
  const openQuick = useUi((s) => s.openQuick);
  const upd = useUpdate('semesters');
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<{ semester?: Semester } | null>(params.get('new') === '1' ? {} : null);
  const [picked, setPicked] = useState<string | null>(null);

  const sorted = [...d.semesters].sort((a, b) => b.number - a.number);
  const selected = sorted.find((s) => s.id === picked) ?? d.sem ?? sorted[0];
  const selCourses = selected ? semesterCourses(d.courses, selected.id) : [];
  const selIps = semesterIps(selCourses, d.settings.grade_scale, 'official');

  const closeForm = () => {
    setForm(null);
    if (params.has('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };
  const activate = async (s: Semester) => {
    for (const x of d.semesters) if (x.is_active && x.id !== s.id) await upd.patch(x.id, { is_active: false });
    await upd.patch(s.id, { is_active: true });
    setPicked(s.id);
    toast(`Semester ${s.number} jadi semester aktif`);
  };

  const addSemesterBtn = desktop
    ? <Button className="shadow-day-sel" onClick={() => setForm({})}>+ Semester</Button>
    : <IconButton label="Semester baru" onClick={() => setForm({})}><Icon.Plus size={20} /></IconButton>;

  return (
    <Page narrow>
      <ScreenHeader back="/kuliah" overline="Kuliah" title="Semester & matkul" right={addSemesterBtn} />
      <div className="flex flex-col gap-5.5 px-4 pt-4.5 pb-6 lg:px-0 lg:pt-0">
        {d.error && <ErrorState onRetry={d.refetch} />}
        {d.loading ? <ListSkeleton rows={4} /> : (
          <>
            <section className="flex flex-col gap-2.5">
              <SectionTitle title="Pengaturan akademik" />
              <AcademicSettings key={`${d.settings.target_gpa}-${d.settings.curriculum_credits}`} d={d} />
            </section>

            <section className="flex flex-col gap-2.5">
              <SectionTitle title="Semester" />
              {sorted.length === 0 ? (
                <EmptyState
                  title="Belum ada semester"
                  text="Buat semester aktif, lalu tambahkan semester sebelumnya beserta nilai akhirnya supaya IPK terhitung benar."
                  action={<Button onClick={() => setForm({})}>Buat semester</Button>}
                />
              ) : sorted.map((s) => (
                <SemesterCard
                  key={s.id} s={s} d={d} selected={selected?.id === s.id}
                  onSelect={() => setPicked(s.id)} onEdit={() => setForm({ semester: s })} onActivate={() => void activate(s)}
                />
              ))}
            </section>

            {selected && (
              <section className="flex flex-col gap-2.5" aria-label={`Mata kuliah semester ${selected.number}`}>
                <SectionTitle
                  title={`Mata kuliah · Semester ${selected.number}`}
                  right={<Button variant="ghost" size="xs" onClick={() => openQuick('course', { semester_id: selected.id })}>+ Matkul</Button>}
                />
                <span className="-mt-1 text-meta text-ink-3">
                  {selCourses.length} matkul · {selIps.credits} SKS · {selIps.ips !== null ? `IPS resmi ${formatGpa(selIps.ips)} (${selIps.graded} SKS bernilai)` : 'nilai akhir belum diisi'}
                </span>
                {selCourses.length === 0 ? (
                  <EmptyState
                    compact
                    text={selected.id === d.sem?.id ? 'Belum ada matkul di semester ini.' : 'Tambahkan matkul semester ini beserta nilai akhirnya agar IPK benar.'}
                    action={<Button size="xs" onClick={() => openQuick('course', { semester_id: selected.id })}>+ Matkul</Button>}
                  />
                ) : selCourses.map((c) => <CourseRow key={c.id} c={c} scale={d.settings.grade_scale} />)}
              </section>
            )}
          </>
        )}
      </div>
      {form && !d.loading && (
        <SemesterFormSheet
          key={form.semester?.id ?? 'new'}
          open
          onClose={closeForm}
          semester={form.semester}
          semesters={d.semesters}
          courses={d.courses}
          onSaved={(id) => setPicked(id)}
        />
      )}
    </Page>
  );
}
