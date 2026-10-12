// Jadwal hari ini (KUL-04): kelas lewat (opacity .75 + "Hadir ✓" / "Tandai hadir"), kelas berikutnya (ungu + "N mnt lagi",
// "Tandai hadir" → "Hadir ✓", "Catatan"), tanpa kelas → "Tidak ada kelas hari ini" + ringkas jadwal besok.
import { useState } from 'react';
import { Link } from 'react-router';
import { addDays, isoWeekday } from '@common/calc/index.ts';
import { dayLabelComma, HARI } from '@common/format.ts';
import { EmptyState } from '@/components/ui';
import type { Attendance, Course, CourseSchedule } from '@/data/types';
import { cx } from '@/lib/cx';
import { classesOn, minutesUntilLabel, slotDetail, slotState, ATTENDANCE_LABEL, type ClassSlot } from '../derive';
import { useMarkAttendance } from '../hooks';
import { MeetingSheet } from './MeetingSheet';

interface Props {
  slots: ClassSlot[];
  next: (ClassSlot & { minutesUntil: number }) | null;
  now: Date;
  today: string;
  attendances: Attendance[];
  schedules: CourseSchedule[];
  courses: Course[];
  semesterId?: string;
  desktop?: boolean;
}

function StatusChip({ status }: { status: Attendance['status'] }) {
  const ok = status === 'hadir';
  return (
    <span className={cx('shrink-0 rounded-full px-2 py-0.75 text-micro leading-none font-bold', ok ? 'bg-primary-soft text-brand-800' : status === 'alpa' ? 'bg-danger-bg text-danger-fg' : 'bg-line text-ink-muted')}>
      {ok ? 'Hadir ✓' : ATTENDANCE_LABEL[status]}
    </span>
  );
}

/** Tombol kecil di dalam baris: visual pil 28 px, area sentuh 44 px. */
function MiniMark({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="-my-2 flex h-11 shrink-0 items-center bg-transparent">
      <span className="rounded-full bg-kuliah-bg px-2.5 py-1.5 text-micro leading-none font-bold text-kuliah-deep ring-1 ring-kuliah-line">Tandai hadir</span>
    </button>
  );
}

export function TodaySchedule(p: Props) {
  const mark = useMarkAttendance();
  const [noteFor, setNoteFor] = useState<Course | null>(null);
  const statusOf = (courseId: string) => p.attendances.find((a) => a.course_id === courseId && a.meeting_date === p.today)?.status;
  const markHadir = (c: Course) => mark({ courseId: c.id, date: p.today, status: 'hadir', toast: `Hadir di ${c.name} tercatat` });

  if (!p.slots.length) {
    const tomorrow = addDays(p.today, 1);
    const tSlots = classesOn(tomorrow, p.schedules, p.courses, p.semesterId);
    const text = tSlots.length
      ? `Besok (${HARI[isoWeekday(tomorrow)]}): ${tSlots.map((s) => `${s.course.name} ${s.start}`).join(' · ')}`
      : 'Besok juga kosong. Pas buat nyicil tugas.';
    return (
      <>
        <h2 className="m-0 text-body font-extrabold">{p.desktop ? `Jadwal hari ini · ${dayLabelComma(p.today)}` : dayLabelComma(p.today)}</h2>
        <EmptyState compact title="Tidak ada kelas hari ini" text={text} />
      </>
    );
  }

  const rows = p.slots.map((s) => {
    const isNext = !!p.next && p.next.schedule.id === s.schedule.id;
    const state = slotState(s, p.now);
    const st = statusOf(s.course.id);
    return { s, isNext, past: state === 'past' && !isNext, st };
  });

  const noteSheet = noteFor && (
    <MeetingSheet key={noteFor.id} open onClose={() => setNoteFor(null)} course={noteFor} date={p.today} attendances={p.attendances} />
  );

  const nextActions = (s: ClassSlot, st: Attendance['status'] | undefined) => (
    <>
      {st === 'hadir' ? (
        <span role="status" className="inline-flex h-9 items-center rounded-full bg-primary-soft px-3.5 text-meta font-bold text-brand-800">Hadir ✓</span>
      ) : (
        <button type="button" onClick={() => markHadir(s.course)} className="h-9 shrink-0 rounded-full bg-kuliah-hero px-3.5 text-meta font-bold text-n-0 hover:bg-kuliah-deep">
          Tandai hadir
        </button>
      )}
      <button type="button" onClick={() => setNoteFor(s.course)} className="h-9 shrink-0 rounded-full border border-kuliah-line bg-surface px-3.5 text-meta font-bold text-kuliah-deep">
        Catatan
      </button>
    </>
  );

  if (p.desktop) {
    return (
      <>
        <h2 className="m-0 text-body font-extrabold">Jadwal hari ini · {dayLabelComma(p.today)}</h2>
        {rows.map(({ s, isNext, past, st }) => (
          <div
            key={s.schedule.id}
            className={cx(
              'flex flex-wrap items-center gap-3.5 rounded-2xl border px-3.5 py-3',
              isNext ? 'border-kuliah-line bg-kuliah-bg' : 'border-line bg-surface',
              past && 'opacity-80',
            )}
          >
            <span className={cx('min-w-11 text-label', isNext ? 'font-extrabold text-kuliah-hero' : 'font-bold text-ink-3')}>{s.start}</span>
            <Link to={`/kuliah/matkul/${s.course.id}`} className="flex min-w-40 flex-1 flex-col text-ink no-underline">
              <span className="text-body font-bold">
                {s.course.name}
                {isNext && <> · <span className="whitespace-nowrap text-kuliah-deep">{minutesUntilLabel(p.next!.minutesUntil)}</span></>}
              </span>
              <span className={cx('text-meta', isNext ? 'text-ink-2' : 'text-ink-3')}>{slotDetail(s)}</span>
            </Link>
            {isNext ? nextActions(s, st) : st ? <StatusChip status={st} /> : past ? <MiniMark label={`Tandai hadir ${s.course.name}`} onClick={() => markHadir(s.course)} /> : null}
          </div>
        ))}
        {noteSheet}
      </>
    );
  }

  return (
    <>
      <h2 className="m-0 text-body font-extrabold">{dayLabelComma(p.today)}</h2>
      <div className="relative flex flex-col">
        {rows.map(({ s, isNext, past, st }) => (
          <div key={s.schedule.id} className="flex gap-3">
            <div className="flex w-11 shrink-0 flex-col items-center">
              <span className={cx('text-label', isNext ? 'font-extrabold text-kuliah-hero' : 'font-bold text-ink-3')}>{s.start}</span>
              <span aria-hidden="true" className={cx('my-1 min-h-10 w-0.5 flex-1', isNext ? 'bg-kuliah-line' : 'bg-line')} />
            </div>
            <div
              className={cx(
                'mb-2.5 flex min-w-0 flex-1 flex-col rounded-2xl border px-3.5 py-3',
                isNext ? 'gap-2 border-kuliah-line bg-kuliah-bg' : 'gap-1 border-line bg-surface',
                past && 'opacity-75',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Link to={`/kuliah/matkul/${s.course.id}`} className="min-w-0 text-body font-bold text-ink no-underline">{s.course.name}</Link>
                {isNext ? (
                  <span className="shrink-0 text-micro font-bold text-kuliah-deep">{minutesUntilLabel(p.next!.minutesUntil)}</span>
                ) : st ? <StatusChip status={st} /> : past ? <MiniMark label={`Tandai hadir ${s.course.name}`} onClick={() => markHadir(s.course)} /> : null}
              </div>
              <span className={cx('text-meta', isNext ? 'text-ink-2' : 'text-ink-3')}>{slotDetail(s)}</span>
              {isNext && <div className="flex flex-wrap gap-2">{nextActions(s, st)}</div>}
            </div>
          </div>
        ))}
      </div>
      {noteSheet}
    </>
  );
}
