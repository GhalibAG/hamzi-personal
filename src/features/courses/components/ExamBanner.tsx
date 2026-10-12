// Banner ujian ≤ 3 hari (KUL-04): "Kuis Analisis Sistem · H-3" + "Kamis 10:00 · bab 1–3 · 2 sesi belajar dijadwalkan".
import { Link } from 'react-router';
import { Icon } from '@/components/icons';
import type { Course, Exam, Task } from '@/data/types';
import { examBannerText, studySessionsFor } from '../derive';

export function ExamBanners({ items, courses, tasks, today }: {
  items: { exam: Exam; inDays: number }[]; courses: Course[]; tasks: Task[]; today: string;
}) {
  if (!items.length) return null;
  return (
    <>
      {items.map(({ exam, inDays }) => {
        const course = courses.find((c) => c.id === exam.course_id);
        if (!course) return null;
        const t = examBannerText(exam, course.name, inDays, studySessionsFor(exam, tasks, today));
        return (
          <Link
            key={exam.id}
            to={`/kuliah/matkul/${course.id}`}
            className="flex items-center gap-3 rounded-2xl border border-warn-banner-line bg-warn-banner px-3.5 py-3 text-ink no-underline"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warn-bg text-warn-strong">
              <Icon.Alert size={20} strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body font-bold">{t.title}</span>
              <span className="text-meta text-ink-2">{t.sub}</span>
            </span>
          </Link>
        );
      })}
    </>
  );
}
