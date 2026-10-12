import { useMemo } from 'react';
import { useRows } from '@/data/hooks';
import { activeSemester } from '@/features/courses/derive';
import type { AgendaSources } from './derive';

/** Semua sumber agenda (CAL-02) dari cache TanStack Query. */
export function useAgendaSources() {
  const tasks = useRows('tasks');
  const exams = useRows('exams');
  const courses = useRows('courses');
  const schedules = useRows('course_schedules');
  const semesters = useRows('semesters');
  const events = useRows('events');
  const routines = useRows('routines');
  const semester = activeSemester(semesters.rows);
  const src = useMemo<AgendaSources>(() => ({
    tasks: tasks.rows, exams: exams.rows, courses: courses.rows, schedules: schedules.rows, semester,
    events: events.rows, routines: routines.rows,
  }), [tasks.rows, exams.rows, courses.rows, schedules.rows, semester, events.rows, routines.rows]);
  const all = [tasks, exams, courses, schedules, semesters, events, routines];
  return {
    src,
    loading: all.some((q) => q.isLoading),
    isError: all.some((q) => q.isError),
    refetch: () => { all.forEach((q) => void q.refetch()); },
  };
}
