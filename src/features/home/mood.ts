// Mesin mood Hamzi (DESIGN-SYSTEM §6.4): prioritas celebrate > sleeping > excited > focus > worried > happy > sleepy > calm.
import { useMemo } from 'react';
import { fillLine, pickLine, type Mood } from '@common/lines.id.ts';
import { wibDate, wibMinutes } from '@common/calc/index.ts';
import { useRows, useSettings } from '@/data/hooks';
import { useNow } from '@/lib/hooks';
import { readLocal, writeLocal } from '@/lib/storage';
import { useUi } from '@/stores/ui';
import { useTimer } from '@/stores/timer';
import { activeSemester, classesOn } from '@/features/courses/derive';
import { dueDay, isOpen, isOverdue } from '@/features/tasks/derive';
import { useFinanceSummary } from '@/features/finance/hooks';

/** Hari absen sejak terakhir membuka app (dihitung sekali saat modul dimuat). */
const LAST_KEY = 'hamzi-last-open';
const lastOpen = readLocal<string | null>(LAST_KEY, null);
const todayAtLoad = wibDate();
export const absentDays = lastOpen ? Math.max(0, Math.round((Date.parse(todayAtLoad) - Date.parse(lastOpen)) / 86_400_000)) : 0;
writeLocal(LAST_KEY, todayAtLoad);
const loadedAt = Date.now();

export interface MoodState { mood: Mood; line: string }

export function useMoodEngine(): MoodState {
  const now = useNow(15_000);
  const reaction = useUi((s) => s.reaction);
  const timerRunning = useTimer((s) => !!s.active && !s.active.finished && s.active.runningSince !== null);
  const s = useSettings();
  const tasks = useRows('tasks').rows;
  const schedules = useRows('course_schedules').rows;
  const courses = useRows('courses').rows;
  const semesters = useRows('semesters').rows;
  const fin = useFinanceSummary().data;

  return useMemo<MoodState>(() => {
    const today = wibDate(now);
    const mins = wibMinutes(now);
    if (reaction && reaction.until > now.getTime() && reaction.mood === 'celebrate') return { mood: 'celebrate', line: reaction.line };
    if (absentDays >= 3 && now.getTime() - loadedAt < 10_000) return { mood: 'sleeping', line: pickLine('sleeping', {}, 0) };
    if (reaction && reaction.until > now.getTime() && reaction.mood === 'excited') return { mood: 'excited', line: reaction.line };
    if (timerRunning) return { mood: 'focus', line: pickLine('focus', {}, 0) };
    const soon = tasks.filter((t) => isOpen(t) && t.priority >= 3 && t.due_at && !isOverdue(t, now) && new Date(t.due_at).getTime() - now.getTime() <= 24 * 3_600_000);
    if (soon.length) return { mood: 'worried', line: fillLine('{task} tenggatnya {when}, mau dicicil?', { task: soon[0].title, when: dueDay(soon[0]) === today ? 'hari ini' : 'besok' }) };
    if (fin.budgetTotal && fin.budgetUsedPct >= 80) return { mood: 'worried', line: s.hide_amounts ? 'Anggaran hampir habis. Pelan-pelan dulu jajannya ya.' : pickLine('worried_budget', { pct: fin.budgetUsedPct }, 0) };
    if (reaction && reaction.until > now.getTime()) return { mood: reaction.mood, line: reaction.line };
    if (mins >= 23 * 60 || mins < 4 * 60 || absentDays === 2) return { mood: 'sleepy', line: pickLine('sleepy', {}, 0) };
    const sem = activeSemester(semesters);
    const classesLeft = classesOn(today, schedules, courses, sem?.id).filter((c) => c.end > `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`).length;
    const dueToday = tasks.filter((t) => isOpen(t) && (dueDay(t) === today || isOverdue(t, now))).length;
    return { mood: 'calm', line: pickLine('calm_summary', { tasks: dueToday, classes: classesLeft }, 0) };
  }, [now, reaction, timerRunning, tasks, schedules, courses, semesters, fin.budgetTotal, fin.budgetUsedPct, s.hide_amounts]);
}

/** Ketuk Hamzi → reaksi acak 3 dtk. */
export function tapHamzi() {
  const moods: Mood[] = ['happy', 'excited', 'calm', 'happy'];
  const m = moods[Math.floor(Math.random() * moods.length)];
  useUi.getState().react(m === 'excited' ? 'happy' : m, pickLine('tap'), 3000);
}
