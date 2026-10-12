// Catatan pertemuan / status kehadiran per tanggal (KUL-07). Tulis lewat rpc_attendance_mark (p_note).
import { useState } from 'react';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { dayLong } from '@common/format.ts';
import { Button, Field, inputCls, Segmented, Sheet, textareaCls } from '@/components/ui';
import { useRemove } from '@/data/hooks';
import type { Attendance, Course } from '@/data/types';
import { toastUndo } from '@/stores/ui';
import { useMarkAttendance } from '../hooks';
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, type AttendanceStatus } from '../derive';

export function MeetingSheet({ open, onClose, course, date, attendances, pickDate = false, title }: {
  open: boolean; onClose: () => void; course: Course; date: string; attendances: Attendance[]; pickDate?: boolean; title?: string;
}) {
  const [day, setDay] = useState(date);
  const existing = attendances.find((a) => a.course_id === course.id && a.meeting_date === day);
  const [status, setStatus] = useState<AttendanceStatus>(existing?.status ?? 'hadir');
  const [note, setNote] = useState(existing?.note ?? '');
  const [touched, setTouched] = useState(false);
  const markAttendance = useMarkAttendance();
  const remove = useRemove('attendances');
  const sensitive = detectSensitive(note);
  const tooLong = note.length > 500;
  const error = tooLong ? 'Catatan maksimal 500 karakter' : sensitive.length ? SENSITIVE_MESSAGE[sensitive[0]] : undefined;

  const changeDay = (d: string) => {
    setDay(d);
    const ex = attendances.find((a) => a.course_id === course.id && a.meeting_date === d);
    setStatus(ex?.status ?? 'hadir');
    setNote(ex?.note ?? '');
  };

  const save = () => {
    setTouched(true);
    if (error || !day) return;
    markAttendance({ courseId: course.id, date: day, status, note: note.trim() ? note.trim() : null, toast: existing ? 'Pertemuan diperbarui' : 'Pertemuan dicatat' });
    onClose();
  };

  const del = () => {
    if (!existing) return;
    const snap = existing;
    void remove.remove(snap.id, { hard: true });
    toastUndo('Catatan pertemuan dihapus', () => markAttendance({ courseId: snap.course_id, date: snap.meeting_date, status: snap.status, note: snap.note ?? null }));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? 'Catatan pertemuan'}
      closeButton
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={save}>Simpan</Button>
          {pickDate && existing && <Button variant="danger-outline" block onClick={del}>Hapus pertemuan ini</Button>}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-body font-bold">{course.name}</span>
          {!pickDate && <span className="text-meta text-ink-3">{dayLong(day)}</span>}
        </div>
        {pickDate && (
          <Field label="Tanggal pertemuan" htmlFor="meet-date">
            <input id="meet-date" type="date" className={inputCls} value={day} onChange={(e) => changeDay(e.target.value)} />
          </Field>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted" id="meet-status">Status kehadiran</span>
          <Segmented
            label="Status kehadiran"
            value={status}
            onChange={setStatus}
            options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: ATTENDANCE_LABEL[s] }))}
          />
        </div>
        <Field label="Catatan" htmlFor="meet-note" hint="Materi, tugas yang diumumkan, atau hal penting di kelas." error={touched || tooLong || sensitive.length ? error : undefined}>
          <textarea
            id="meet-note"
            data-autofocus={!pickDate || undefined}
            className={textareaCls}
            value={note}
            maxLength={600}
            placeholder="Mis. bahas normalisasi 3NF, kuis minggu depan"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Sheet>
  );
}
