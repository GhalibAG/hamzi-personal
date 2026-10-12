// "Kehadiran per mata kuliah" (KUL-04) dan "Tugas kuliah" (KUL-05).
import { Link } from 'react-router';
import { Button, EmptyState } from '@/components/ui';
import type { Attendance, Course, Task } from '@/data/types';
import { cx } from '@/lib/cx';
import { useUi } from '@/stores/ui';
import { courseAttendanceView, courseDue, courseTaskMeta } from '../derive';

export function AttendanceList({ courses, attendances, desktop = false }: { courses: Course[]; attendances: Attendance[]; desktop?: boolean }) {
  if (!courses.length) return null;
  return (
    <div className={cx('border border-line bg-surface px-3.5', desktop ? 'rounded-2xl py-1' : 'rounded-3xl py-1.5')}>
      {courses.map((c) => {
        const v = courseAttendanceView(c, attendances);
        return (
          <Link
            key={c.id}
            to={`/kuliah/matkul/${c.id}`}
            className={cx('flex min-h-11 items-center justify-between gap-3 border-b py-2.5 text-ink no-underline last:border-b-0', desktop ? 'border-surface-2' : 'border-line')}
          >
            <span className="min-w-0 truncate text-label font-semibold">{c.name}</span>
            <span className={cx('tabular shrink-0 text-label font-bold', v.warn ? 'text-danger-fg' : v.held ? 'text-ink' : 'text-ink-3')}>
              {v.label}{v.warn ? ` · batas ${c.min_attendance_pct}%` : ''}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function CourseTaskList({ tasks, courses, today, now, desktop = false }: { tasks: Task[]; courses: Course[]; today: string; now: Date; desktop?: boolean }) {
  const openQuick = useUi((s) => s.openQuick);
  const name = (id?: string | null) => courses.find((c) => c.id === id)?.name;
  if (!tasks.length) {
    return (
      <EmptyState
        compact
        text="Belum ada tugas kuliah yang terbuka. Catat laporan, kuis online, atau proyek kelompok di sini."
        action={<Button size="xs" onClick={() => openQuick('course-task')}>+ Tugas kuliah</Button>}
      />
    );
  }
  if (desktop) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-3.5 py-1">
        {tasks.map((t) => {
          const due = courseDue(t, today, now);
          return (
            <Link key={t.id} to={`/rencana/tugas/${t.id}`} className="flex min-h-11 items-center justify-between gap-2 border-b border-surface-2 py-2.5 text-ink no-underline last:border-b-0 hover:bg-surface-2">
              <span className="min-w-0 text-label-lg font-bold">
                {t.title} <span className="font-medium text-ink-3">· {courseTaskMeta(t, name(t.course_id))}</span>
              </span>
              <span className={cx('shrink-0 text-meta font-bold', due.urgent ? 'text-danger-fg' : 'text-ink-3')}>{due.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }
  return (
    <>
      {tasks.map((t) => {
        const due = courseDue(t, today, now);
        return (
          <Link key={t.id} to={`/rencana/tugas/${t.id}`} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface px-3.5 py-3 text-ink no-underline">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-body font-bold">{t.title}</span>
              <span className={cx('shrink-0 text-meta font-bold', due.urgent ? 'text-danger-fg' : 'text-ink-3')}>{due.label}</span>
            </span>
            <span className="text-meta text-ink-3">{courseTaskMeta(t, name(t.course_id))}</span>
          </Link>
        );
      })}
    </>
  );
}
