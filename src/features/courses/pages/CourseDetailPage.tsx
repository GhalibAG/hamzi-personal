// Detail matkul `/kuliah/matkul/:id` — UI-SPEC §4.4: info + warna, jadwal mingguan, kehadiran per pertemuan (KUL-07),
// komponen nilai (KUL-09), ujian (KUL-08), tugas matkul.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { wibDate, wibTime } from '@common/calc/index.ts';
import { dayLabelComma, HARI } from '@common/format.ts';
import { Icon } from '@/components/icons';
import { Button, ButtonLink, EmptyState, ErrorState, IconButton, ListSkeleton, Page, ProgressBar, ScreenHeader, SectionTitle, Tag } from '@/components/ui';
import { useRows, useUpdate } from '@/data/hooks';
import type { Attendance, Course, GradeComponent } from '@/data/types';
import { cx } from '@/lib/cx';
import { useIsDesktop } from '@/lib/hooks';
import { useUi } from '@/stores/ui';
import { courseColorStyle } from '../components/formBits';
import { GradeComponentSheet } from '../components/GradeComponentSheet';
import { MeetingSheet } from '../components/MeetingSheet';
import {
  ATTENDANCE_LABEL, componentSummary, courseAttendanceView, courseDue, EXAM_LABEL, gradeLetters, gradeMinScore, scoreId,
} from '../derive';
import { useCoursesData, type CoursesData } from '../hooks';

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={title}>
      <SectionTitle title={title} right={action} />
      {children}
    </section>
  );
}

const addBtn = (label: string, onClick: () => void, aria?: string) => (
  <Button variant="ghost" size="xs" onClick={onClick} aria-label={aria}>{label}</Button>
);

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-micro font-semibold text-ink-3">{label}</span>
      <span className="truncate text-body font-bold">{children}</span>
    </div>
  );
}

function InfoCard({ c, d }: { c: Course; d: CoursesData }) {
  const upd = useUpdate('courses');
  const att = courseAttendanceView(c, d.attendances);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface py-3.5 pr-4 pl-5">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-kuliah-bar" style={courseColorStyle(c.color)} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
        <Info label="Dosen">{c.lecturer || '–'}</Info>
        <Info label="Ruang">{c.room || '–'}</Info>
        <Info label="Target nilai">{c.target_grade || '–'}</Info>
        <Info label="Kehadiran">
          <span className={att.warn ? 'text-danger-fg' : undefined}>{att.held ? att.label : '–'}</span>
        </Info>
        <Info label="Batas hadir">{c.min_attendance_pct}%</Info>
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="cd-final" className="text-micro font-semibold text-ink-3">Nilai akhir (resmi)</label>
          <select
            id="cd-final"
            value={c.final_grade ?? ''}
            onChange={(e) => void upd.patch(c.id, { final_grade: e.target.value || null })}
            className="-ml-1 h-11 w-full max-w-40 rounded-lg border border-line-strong bg-surface px-2 text-body font-bold text-ink outline-none focus:border-brand-400"
          >
            <option value="">Belum keluar</option>
            {gradeLetters(d.settings.grade_scale).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function Schedules({ c, d }: { c: Course; d: CoursesData }) {
  const openQuick = useUi((s) => s.openQuick);
  const rows = d.schedules.filter((s) => s.course_id === c.id).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  return (
    <Section title="Jadwal mingguan" action={addBtn('Ubah jadwal', () => openQuick('course', { id: c.id }))}>
      {rows.length === 0 ? (
        <EmptyState compact text="Belum ada jadwal mingguan untuk matkul ini." action={<Button size="xs" onClick={() => openQuick('course', { id: c.id })}>+ Jadwal</Button>} />
      ) : (
        <div className="rounded-3xl border border-line bg-surface px-3.5 py-1">
          {rows.map((s) => (
            <div key={s.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="text-body font-bold">{HARI[s.weekday]}</span>
              <span className="tabular text-label text-ink-2">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{(s.room ?? c.room) ? ` · ${s.room ?? c.room}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function StatusTag({ status }: { status: Attendance['status'] }) {
  return <Tag tone={status === 'hadir' ? 'rutinitas' : status === 'alpa' ? 'danger' : 'neutral'}>{status === 'hadir' ? 'Hadir ✓' : ATTENDANCE_LABEL[status]}</Tag>;
}

function Attendances({ c, d }: { c: Course; d: CoursesData }) {
  const [sheet, setSheet] = useState<string | null>(null);
  const rows = d.attendances.filter((a) => a.course_id === c.id).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
  const v = courseAttendanceView(c, d.attendances);
  return (
    <Section title="Kehadiran" action={addBtn('+ Catat pertemuan', () => setSheet(d.today))}>
      {rows.length === 0 ? (
        <EmptyState compact text="Belum ada pertemuan tercatat. Tandai hadir setiap kelas supaya persentasenya terpantau." />
      ) : (
        <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface px-3.5 pt-3.5 pb-1">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label font-bold text-ink-2">Hadir</span>
              <span className={cx('tabular text-body font-extrabold', v.warn && 'text-danger-fg')}>{v.label}{v.warn ? ` · batas ${c.min_attendance_pct}%` : ''}</span>
            </div>
            <ProgressBar value={v.pct} color={v.warn ? 'danger' : 'kuliah'} height={6} label="Persentase kehadiran" />
          </div>
          <div className="flex flex-col">
            {rows.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSheet(a.meeting_date)}
                className="flex min-h-11 items-center gap-3 border-t border-line bg-transparent py-2 text-left hover:bg-surface-2"
                aria-label={`${dayLabelComma(a.meeting_date)}, ${ATTENDANCE_LABEL[a.status]}. Ubah`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-label font-semibold">{dayLabelComma(a.meeting_date)}</span>
                  {a.note && <span className="truncate text-meta text-ink-3">{a.note}</span>}
                </span>
                <StatusTag status={a.status} />
              </button>
            ))}
          </div>
        </div>
      )}
      {sheet && (
        <MeetingSheet
          key={sheet} open pickDate onClose={() => setSheet(null)} course={c} date={sheet} attendances={d.attendances}
          title={rows.some((r) => r.meeting_date === sheet) ? 'Ubah pertemuan' : 'Catat pertemuan'}
        />
      )}
    </Section>
  );
}

function Components({ c, d }: { c: Course; d: CoursesData }) {
  const all = useRows('grade_components').rows;
  const rows = useMemo(() => all.filter((g) => g.course_id === c.id), [all, c.id]);
  const [sheet, setSheet] = useState<{ comp?: GradeComponent } | null>(null);
  const targetScore = gradeMinScore(c.target_grade, d.settings.grade_ranges);
  const sum = componentSummary(rows, targetScore !== undefined && c.target_grade ? { score: targetScore, grade: c.target_grade } : undefined, d.settings.grade_ranges);
  const left = Math.max(0, 100 - sum.weightTotal);
  return (
    <Section title="Komponen nilai" action={addBtn('+ Komponen', () => setSheet({}))}>
      {rows.length === 0 ? (
        <EmptyState compact text="Masukkan bobot dari kontrak kuliah (mis. Tugas 30%, UTS 30%, UAS 40%) untuk melihat nilai sementara." />
      ) : (
        <div className="flex flex-col rounded-3xl border border-line bg-surface px-3.5 py-1">
          {rows.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSheet({ comp: g })}
              className="flex min-h-11 items-center gap-3 border-b border-line bg-transparent py-2.5 text-left hover:bg-surface-2"
              aria-label={`Ubah komponen ${g.name}`}
            >
              <span className="flex-1 text-body font-bold">{g.name}</span>
              <span className="tabular w-14 text-right text-label text-ink-3">{scoreId(Number(g.weight_pct))}%</span>
              <span className={cx('tabular w-12 text-right text-body font-extrabold', g.score === null || g.score === undefined ? 'text-ink-3' : 'text-ink')}>
                {g.score === null || g.score === undefined ? '–' : scoreId(Number(g.score))}
              </span>
            </button>
          ))}
          <div className="flex flex-col gap-1 py-3">
            <span className="text-label font-bold text-kuliah-deep">{sum.text}</span>
            {Math.abs(sum.weightTotal - 100) > 0.001 && (
              <span className="text-meta font-semibold text-warn-strong">Total bobot {scoreId(sum.weightTotal)}% · sebaiknya 100%</span>
            )}
          </div>
        </div>
      )}
      {sheet && (
        <GradeComponentSheet
          key={sheet.comp?.id ?? 'new'} open onClose={() => setSheet(null)} courseId={c.id} component={sheet.comp}
          suggestedWeight={sheet.comp ? undefined : left || undefined}
        />
      )}
    </Section>
  );
}

function Exams({ c, d }: { c: Course; d: CoursesData }) {
  const openQuick = useUi((s) => s.openQuick);
  const rows = d.exams.filter((e) => e.course_id === c.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <Section title="Ujian" action={addBtn('+ Ujian', () => openQuick('exam', { course_id: c.id }))}>
      {rows.length === 0 ? (
        <EmptyState compact text="Belum ada kuis atau ujian. Hamzi akan mengingatkan H-3 & H-1." />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((e) => {
            const at = new Date(e.starts_at);
            const day = wibDate(at);
            const past = at.getTime() < d.now.getTime();
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => openQuick('exam', { id: e.id })}
                aria-label={`Ubah ${EXAM_LABEL[e.kind]} ${dayLabelComma(day)}`}
                className={cx('flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left hover:bg-surface-2', past && 'opacity-75')}
              >
                <Tag tone="ujian">{EXAM_LABEL[e.kind]}</Tag>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body font-bold">{dayLabelComma(day)} · {wibTime(at)}</span>
                  <span className="truncate text-meta text-ink-3">{[e.material, e.room].filter(Boolean).join(' · ') || 'Materi belum diisi'}</span>
                </span>
                <Icon.ChevronRight size={18} className="text-ink-3" />
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function Tasks({ c, d }: { c: Course; d: CoursesData }) {
  const openQuick = useUi((s) => s.openQuick);
  const rows = d.tasks
    .filter((t) => t.course_id === c.id && !t.deleted_at && t.status !== 'dibatalkan')
    .sort((a, b) => Number(a.status === 'selesai') - Number(b.status === 'selesai') || (a.due_at ?? '9').localeCompare(b.due_at ?? '9'));
  return (
    <Section title="Tugas" action={addBtn('+ Tugas', () => openQuick('course-task', { course_id: c.id }), `Tambah tugas ${c.name}`)}>
      {rows.length === 0 ? (
        <EmptyState compact text="Belum ada tugas untuk matkul ini." action={<Button size="xs" onClick={() => openQuick('course-task', { course_id: c.id })}>+ Tugas kuliah</Button>} />
      ) : (
        <div className="rounded-3xl border border-line bg-surface px-3.5 py-1">
          {rows.map((t) => {
            const done = t.status === 'selesai';
            const due = courseDue(t, d.today, d.now);
            return (
              <Link key={t.id} to={`/rencana/tugas/${t.id}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-2.5 text-ink no-underline last:border-b-0">
                <span className={cx('min-w-0 text-body font-bold', done && 'text-ink-3 line-through')}>{t.title}</span>
                <span className={cx('shrink-0 text-meta font-bold', done ? 'text-brand-800' : due.urgent ? 'text-danger-fg' : 'text-ink-3')}>{done ? 'Selesai' : due.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams();
  const d = useCoursesData();
  const desktop = useIsDesktop();
  const openQuick = useUi((s) => s.openQuick);
  const c = d.courses.find((x) => x.id === id);
  const sem = c ? d.semesters.find((s) => s.id === c.semester_id) : undefined;

  if (d.loading) {
    return <Page narrow><ScreenHeader back="/kuliah" title="Mata kuliah" /><div className="px-4 pt-4 lg:px-0"><ListSkeleton rows={5} /></div></Page>;
  }
  if (!c) {
    return (
      <Page narrow>
        <ScreenHeader back="/kuliah" title="Mata kuliah" />
        <div className="px-4 pt-4 lg:px-0">
          {d.error ? <ErrorState onRetry={d.refetch} /> : (
            <EmptyState mood="worried" title="Matkul tidak ditemukan" text="Mungkin sudah dihapus." action={<ButtonLink to="/kuliah" size="sm">Kembali ke Kuliah</ButtonLink>} />
          )}
        </div>
      </Page>
    );
  }
  const overline = [c.code, `${c.credits} SKS`, sem ? `Semester ${sem.number}` : null].filter(Boolean).join(' · ');
  return (
    <Page narrow>
      <ScreenHeader
        back="/kuliah"
        overline={overline}
        title={c.name}
        right={desktop
          ? <Button variant="secondary" size="md" icon={<Icon.Edit size={18} />} onClick={() => openQuick('course', { id: c.id })}>Ubah matkul</Button>
          : <IconButton label="Ubah matkul" onClick={() => openQuick('course', { id: c.id })}><Icon.Edit size={20} /></IconButton>}
      />
      <div className="flex flex-col gap-5.5 px-4 pt-4.5 pb-6 lg:px-0 lg:pt-0">
        {d.error && <ErrorState onRetry={d.refetch} />}
        <InfoCard c={c} d={d} />
        <Schedules c={c} d={d} />
        <Attendances c={c} d={d} />
        <Components c={c} d={d} />
        <Exams c={c} d={d} />
        <Tasks c={c} d={d} />
      </div>
    </Page>
  );
}
