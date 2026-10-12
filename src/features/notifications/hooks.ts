// Data & aksi pengingat (dipakai ReminderEngine, kotak /notifikasi, dan tautan aksi dari service worker).
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { NOTIF_ACTIONS } from '@common/notif-lines.id.ts';
import { wibDate } from '@common/calc/index.ts';
import { DEMO, repo } from '@/data';
import {
  qk, useAttendanceMark, useProfile, useRoutineSet, useRows, useSettingsQuery, useTaskSetDone, useUpdate,
} from '@/data/hooks';
import type { ScheduledNotification } from '@/data/types';
import { useToday } from '@/lib/hooks';
import { toast, useUi } from '@/stores/ui';
import { moduleStudiedOn, routineDoneOn, type NotifAction, type Reminder, type ReminderData } from './schedule';
import { showReminderBanner } from './banner';
import { sendTestReminder } from './push';
import { addSnooze } from './store';

/** Semua data yang dibutuhkan penjadwal + status siap. */
export function useReminderData() {
  const routines = useRows('routines');
  const routineLogs = useRows('routine_logs');
  const modules = useRows('learning_modules');
  const sessions = useRows('study_sessions');
  const tasks = useRows('tasks');
  const semesters = useRows('semesters');
  const courses = useRows('courses');
  const schedules = useRows('course_schedules');
  const attendances = useRows('attendances');
  const exams = useRows('exams');
  const transactions = useRows('transactions');
  const budgets = useRows('budgets');
  const goals = useRows('savings_goals');
  const assets = useRows('assets');
  const notifs = useRows('scheduled_notifications');
  const settings = useSettingsQuery();
  const profile = useProfile();
  const all = [routines, routineLogs, modules, sessions, tasks, semesters, courses, schedules, attendances, exams, transactions, budgets, goals, assets, notifs];
  const ready = all.every((q) => q.isSuccess) && settings.isSuccess && profile.isSuccess;
  const data: ReminderData = useMemo(() => ({
    routines: routines.rows, routineLogs: routineLogs.rows, modules: modules.rows, sessions: sessions.rows, tasks: tasks.rows,
    semesters: semesters.rows, courses: courses.rows, schedules: schedules.rows, attendances: attendances.rows, exams: exams.rows,
    transactions: transactions.rows, budgets: budgets.rows, goals: goals.rows, assets: assets.rows,
  }), [
    routines.rows, routineLogs.rows, modules.rows, sessions.rows, tasks.rows, semesters.rows, courses.rows, schedules.rows,
    attendances.rows, exams.rows, transactions.rows, budgets.rows, goals.rows, assets.rows,
  ]);
  return { data, ready, notifs: notifs.rows, settings: settings.data, profile: profile.data };
}

/** Label tombol aksi (kotak notifikasi & banner). */
export const ACTION_TITLE: Record<string, string> = {
  done: 'Tandai selesai', snooze10: 'Tunda 10 mnt', snooze60: 'Tunda 1 jam', start: 'Mulai sekarang', attend: 'Tandai hadir', log: 'Catat',
};

/** Baris notifikasi → bentuk Reminder; ref dicari dari judul bila baris lama tidak menyimpan ref_id. */
export function rowToReminder(n: ScheduledNotification, data?: Partial<ReminderData>): Reminder {
  let refId = n.ref_id ?? null;
  let refType = n.ref_type ?? null;
  if (!refId && data) {
    if (n.kind === 'routine') { refId = data.routines?.find((r) => r.name === n.title)?.id ?? null; refType = 'routine'; }
    if (n.kind === 'task') { refId = data.tasks?.find((t) => t.title === n.title)?.id ?? null; refType = 'task'; }
    if (n.kind === 'module') { refId = data.modules?.find((m) => m.title === n.title)?.id ?? null; refType = 'module'; }
  }
  return {
    dedupe_key: n.dedupe_key, category: n.category, kind: n.kind, system_key: n.category === 'system' ? n.kind : null,
    ref_type: refType, ref_id: refId, fire_at: n.fire_at, title: n.title, body: n.body, url: n.url,
    actions: n.actions?.length ? n.actions : NOTIF_ACTIONS[n.kind] ?? [],
  };
}

/**
 * Aksi yang masih relevan untuk sebuah pengingat (kotak notifikasi): rutinitas belum selesai hari ini, tugas belum selesai,
 * modul belum dipelajari hari ini, kelas hari ini belum diabsen, catat pengeluaran hari ini. "Tunda" hanya untuk hari ini.
 */
export function relevantActions(r: Reminder, data: Partial<ReminderData>, today: string): NotifAction[] {
  const sentToday = wibDate(new Date(r.fire_at)) === today;
  const a = (action: string): NotifAction => ({ action, title: ACTION_TITLE[action] ?? action });
  const routineId = r.kind === 'routine' || (r.kind === 'test' && r.ref_type === 'routine') ? r.ref_id : null;
  if (routineId) {
    const exists = data.routines?.some((x) => x.id === routineId && !x.archived && !x.deleted_at);
    if (!exists || !sentToday || routineDoneOn(data.routineLogs ?? [], routineId, today)) return [];
    return [a('done'), a('snooze10')];
  }
  if (r.kind === 'task' && r.ref_id) {
    const t = data.tasks?.find((x) => x.id === r.ref_id);
    if (!t || t.deleted_at || t.status === 'selesai' || t.status === 'dibatalkan') return [];
    return sentToday ? [a('done'), a('snooze60')] : [a('done')];
  }
  if (r.kind === 'module' && r.ref_id) {
    const m = data.modules?.find((x) => x.id === r.ref_id);
    if (!m || m.status !== 'aktif' || !sentToday || moduleStudiedOn(data.sessions ?? [], m.id, today)) return [];
    return [a('start'), a('snooze10')];
  }
  if (r.kind === 'class' && r.ref_id && sentToday) {
    const s = data.schedules?.find((x) => x.id === r.ref_id);
    if (!s || data.attendances?.some((x) => x.course_id === s.course_id && x.meeting_date === today)) return [];
    return [a('attend')];
  }
  if (r.kind === 'expense_nudge' && sentToday) return [a('log')];
  return [];
}

const SNOOZE_MIN: Record<string, number> = { snooze10: 10, snooze60: 60 };

/** Jalankan aksi notifikasi di dalam app (banner, kotak notifikasi, tautan `?notif_action=` dari SW mode demo). */
export function useNotifActions(data: Partial<ReminderData>, notifs: ScheduledNotification[]) {
  const today = useToday();
  const nav = useNavigate();
  const routineSet = useRoutineSet();
  const taskDone = useTaskSetDone();
  const attend = useAttendanceMark();
  const update = useUpdate('scheduled_notifications');
  const openQuick = useUi((s) => s.openQuick);
  const markWatered = useUi((s) => s.markWatered);
  const react = useUi((s) => s.react);

  const markRead = (r: Reminder, rowId?: string) => {
    const row = rowId ? notifs.find((n) => n.id === rowId) : notifs.find((n) => n.dedupe_key === r.dedupe_key);
    if (row && !row.read_at) void update.patch(row.id, { read_at: new Date().toISOString() }).catch(() => undefined);
  };

  return async (r: Reminder, action: string, opts: { rowId?: string } = {}): Promise<boolean> => {
    try {
      switch (action) {
        case 'done': {
          const routineId = r.kind === 'routine' || r.ref_type === 'routine' ? r.ref_id : null;
          if (routineId) {
            const routine = data.routines?.find((x) => x.id === routineId);
            if (!routine) { toast('Rutinitasnya sudah tidak ada.'); break; }
            if (routineDoneOn(data.routineLogs ?? [], routineId, today)) { toast('Sudah tercatat hari ini.'); break; }
            await routineSet.mutateAsync({ p_routine_id: routineId, p_date: today, p_value: routine.target_count });
            markWatered();
            react('happy', 'Satu centang lagi buat pohonmu. Mantap!');
            toast('Tercatat. +1 tetes air');
            break;
          }
          if (r.kind === 'task' && r.ref_id) {
            await taskDone.mutateAsync({ p_task_id: r.ref_id, p_done: true });
            react('happy', 'Satu tugas sudah beres. Mantap!');
            toast('Tercatat. Satu tugas beres.');
            break;
          }
          toast('Oke, tercatat.');
          break;
        }
        case 'snooze10':
        case 'snooze60': {
          const min = SNOOZE_MIN[action];
          addSnooze(r, action, min);
          toast(min === 10 ? 'Oke, diingatkan lagi 10 menit lagi' : 'Oke, diingatkan lagi 1 jam lagi');
          break;
        }
        case 'attend': {
          const s = data.schedules?.find((x) => x.id === r.ref_id);
          if (!s) { toast('Jadwal kelasnya tidak ditemukan.'); break; }
          await attend.mutateAsync({ p_course_id: s.course_id, p_date: today, p_status: 'hadir' });
          toast('Tercatat hadir.');
          break;
        }
        case 'start':
          nav(r.ref_id ? `/tumbuh/sesi?modul=${r.ref_id}` : '/tumbuh/sesi');
          break;
        case 'log':
          openQuick('expense');
          break;
        default:
          nav(r.url || '/');
      }
      markRead(r, opts.rowId);
      return true;
    } catch {
      toast('Belum bisa dicatat. Coba lagi ya.');
      return false;
    }
  };
}

/** Tombol "Coba pengingat": kirim push uji; mode demo tanpa izin → tampilkan sebagai banner dalam app. */
export function useTestReminder() {
  const qc = useQueryClient();
  const [state, setState] = useState<{ busy: boolean; ok: boolean | null; message: string | null }>({ busy: false, ok: null, message: null });
  const send = async () => {
    setState({ busy: true, ok: null, message: null });
    const r = await sendTestReminder();
    await qc.invalidateQueries({ queryKey: qk.table('scheduled_notifications') });
    if (!r.ok && DEMO) {
      const rows = await repo.list('scheduled_notifications');
      const latest = rows.filter((n) => n.kind === 'test').sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))[0];
      if (latest) {
        showReminderBanner({ ...rowToReminder(latest), fire_at: new Date().toISOString() });
        setState({ busy: false, ok: true, message: 'Izin notifikasi belum ada, jadi pengingat uji tampil di dalam app.' });
        return;
      }
    }
    setState({ busy: false, ok: r.ok, message: r.message });
  };
  return { ...state, send };
}
