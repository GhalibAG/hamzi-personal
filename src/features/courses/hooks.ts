// Data layar Kuliah (setara rpc_gpa_summary + rpc_schedule_overview). Turunan dari derive.ts; rumus dari @common/calc.
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { qk, useAttendanceMark, useRemove, useRows, useSettings, useSettingsQuery } from '@/data/hooks';
import type { Attendance } from '@/data/types';
import { useNow, useToday } from '@/lib/hooks';
import { toastUndo } from '@/stores/ui';
import {
  activeSemester, attendanceAverage, classesOn, courseTasks, gpaSummary, nextClass, semesterCourses, semesterIps, upcomingExams,
} from './derive';

export function useCoursesData() {
  const now = useNow(30_000);
  const today = useToday();
  const semesters = useRows('semesters');
  const courses = useRows('courses');
  const schedules = useRows('course_schedules');
  const attendances = useRows('attendances');
  const exams = useRows('exams');
  const tasks = useRows('tasks');
  const settingsQ = useSettingsQuery();
  const settings = useSettings();

  const sem = activeSemester(semesters.rows);
  const current = useMemo(() => semesterCourses(courses.rows, sem?.id), [courses.rows, sem?.id]);
  const currentIds = useMemo(() => new Set(current.map((c) => c.id)), [current]);
  const summary = useMemo(
    () => gpaSummary({
      semesters: semesters.rows, courses: courses.rows, attendances: attendances.rows, scale: settings.grade_scale,
      curriculum: settings.curriculum_credits, target: settings.target_gpa,
    }),
    [semesters.rows, courses.rows, attendances.rows, settings.grade_scale, settings.curriculum_credits, settings.target_gpa],
  );
  const semIps = useMemo(() => semesterIps(current, settings.grade_scale, 'projected'), [current, settings.grade_scale]);
  const attendanceAvg = useMemo(() => attendanceAverage(current, attendances.rows), [current, attendances.rows]);
  const slots = useMemo(() => classesOn(today, schedules.rows, courses.rows, sem?.id), [today, schedules.rows, courses.rows, sem?.id]);
  const next = nextClass(slots, now);
  // Banner ujian ≤ 3 hari (KUL-04) untuk matkul yang masih ada.
  const examsSoon = useMemo(
    () => upcomingExams(exams.rows, today, 3).filter((x) => courses.rows.some((c) => c.id === x.exam.course_id)),
    [exams.rows, today, courses.rows],
  );
  const cTasks = useMemo(() => courseTasks(tasks.rows, currentIds), [tasks.rows, currentIds]);

  const all = [semesters, courses, schedules, attendances, exams, tasks];
  return {
    now, today, settings, sem, current, summary, semIps, attendanceAvg, slots, next, examsSoon, cTasks,
    semesters: semesters.rows, courses: courses.rows, schedules: schedules.rows, attendances: attendances.rows, exams: exams.rows, tasks: tasks.rows,
    loading: all.some((q) => q.isLoading) || settingsQ.isLoading,
    error: all.some((q) => q.isError),
    refetch: () => { all.forEach((q) => void q.refetch()); void settingsQ.refetch(); },
  };
}

export type CoursesData = ReturnType<typeof useCoursesData>;

/**
 * Tandai kehadiran (rpc_attendance_mark) dengan toast Urungkan: bila sebelumnya belum ada catatan → hapus catatan itu;
 * bila ada → kembalikan status & catatan lama.
 */
export function useMarkAttendance() {
  const qc = useQueryClient();
  const mark = useAttendanceMark();
  const remove = useRemove('attendances');
  const rowsNow = () => qc.getQueryData<Attendance[]>(qk.table('attendances')) ?? [];
  return (a: { courseId: string; date: string; status: Attendance['status']; note?: string | null; toast?: string }) => {
    const prev = rowsNow().find((x) => x.course_id === a.courseId && x.meeting_date === a.date);
    const args: Record<string, unknown> = { p_course_id: a.courseId, p_date: a.date, p_status: a.status };
    if (a.note !== undefined) args.p_note = a.note;
    mark.mutate(args);
    if (!a.toast) return;
    toastUndo(a.toast, () => {
      if (prev) {
        mark.mutate({ p_course_id: prev.course_id, p_date: prev.meeting_date, p_status: prev.status, p_note: prev.note ?? null });
        return;
      }
      const row = rowsNow().find((x) => x.course_id === a.courseId && x.meeting_date === a.date);
      if (row) void remove.remove(row.id, { hard: true });
    });
  };
}
